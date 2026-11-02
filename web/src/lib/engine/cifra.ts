import { addDays, daysBetween, nextDayOfMonth, shortDate, toDayNumber } from './dates';
import { nextIncomeDate, resolveIncome, type IncomeEstimate } from './income';
import { flowOf, identifyMerchant } from './merchant';
import { detectRecurring, type RecurringSeries } from './recurring';
import { splitInternalTransfers } from './transfers';
import type { AccountBalance, Commitment, IncomeSettings, Tx } from './types';

export type RecurringMarkValue = 'lo_uso' | 'no_lo_uso' | 'no_es_fijo';

export interface CifraInput {
  today: string;
  accounts: AccountBalance[];
  transactions: Tx[];
  income: IncomeSettings;
  bufferMinor: number;
  commitments: Commitment[];
  marks: Record<string, RecurringMarkValue>;
}

export interface PendingCharge {
  key: string;
  name: string;
  date: string;
  amountMinor: number;
  estimated: boolean;
  origin: 'detectado' | 'compromiso';
}

export interface CifraResult {
  ready: boolean;
  /** Qué falta para poder calcular (sin saldo, sin movimientos). */
  missing: Array<'saldo' | 'movimientos'>;
  today: string;
  income: IncomeEstimate;
  nextIncomeOn: string;
  daysLeft: number;
  /** Fecha del saldo más viejo usado: desde ahí se cuentan los cobros pendientes. */
  balanceOn: string | null;
  balanceMinor: number;
  pending: PendingCharge[];
  pendingMinor: number;
  dailyVariableMinor: number;
  projectedVariableMinor: number;
  projectionDays: number;
  bufferMinor: number;
  /** Lo que queda libre hasta el próximo ingreso, después de lo comprometido y del gasto normal. */
  availableMinor: number;
  perDayMinor: number;
  status: 'holgado' | 'justo' | 'en_rojo';
  recurring: RecurringSeries[];
  warnings: string[];
  historyDays: number;
  /** Movimientos excluidos por ser transferencias entre cuentas propias. */
  internalTransfers: number;
}

/** Días hacia atrás que se miran para estimar el gasto del día a día. */
const VARIABLE_WINDOW = 56;

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx]!;
}

/**
 * Gasto diario típico del día a día: compras, domicilios, transporte, retiros en efectivo y transferencias
 * a terceros que no son cobros fijos. Se promedian los días de la ventana (incluidos los días sin gasto),
 * recortando los días atípicos por encima del percentil 95 para que una compra grande no infle el estimado.
 */
export function estimateDailyVariable(txs: Tx[], fixedKeys: Set<string>, endDate: string): { daily: number; days: number } {
  if (!txs.length) return { daily: 0, days: 0 };
  const firstDate = txs.reduce((min, t) => (t.postedOn < min ? t.postedOn : min), txs[0]!.postedOn);
  const span = daysBetween(firstDate, endDate) + 1;
  const days = Math.max(1, Math.min(VARIABLE_WINDOW, span));
  const start = addDays(endDate, -(days - 1));
  const totals = new Map<string, number>();
  for (const t of txs) {
    if (t.amountMinor >= 0 || t.postedOn < start || t.postedOn > endDate) continue;
    const flow = flowOf(t.description, t.amountMinor);
    if (flow === 'pago_tarjeta') continue;
    if (fixedKeys.has(identifyMerchant(t.description).key)) continue;
    totals.set(t.postedOn, (totals.get(t.postedOn) ?? 0) + -t.amountMinor);
  }
  const series: number[] = [];
  for (let i = 0; i < days; i++) series.push(totals.get(addDays(start, i)) ?? 0);
  const cap = percentile([...series].sort((a, b) => a - b), 0.95);
  const capped = series.map((v) => Math.min(v, cap > 0 ? cap : v));
  const daily = capped.reduce((s, v) => s + v, 0) / days;
  // Redondeado a pesos enteros.
  return { daily: Math.round(daily / 100) * 100, days };
}

function commitmentDates(c: Commitment, fromExclusive: string, toInclusive: string): string[] {
  const out: string[] = [];
  let cursor = fromExclusive;
  for (let i = 0; i < 4; i++) {
    const next = nextDayOfMonth(cursor, [c.dayOfMonth]);
    if (next > toInclusive) break;
    out.push(next);
    cursor = next;
  }
  return out;
}

export function computeCifra(input: CifraInput): CifraResult {
  const { today } = input;
  const warnings: string[] = [];
  // Lo que se mueve entre tus propias cuentas no es ingreso ni gasto: se saca antes de todo lo demás.
  const { external: transactions, internal } = splitInternalTransfers(input.transactions);
  const income = resolveIncome(input.income, transactions);
  const nextIncomeOn = nextIncomeDate(income, today);
  const daysLeft = Math.max(1, daysBetween(today, nextIncomeOn));

  const included = input.accounts.filter((a) => a.includeInCifra);
  const withBalance = included.filter((a) => a.balanceMinor !== null && a.balanceOn);
  const missing: CifraResult['missing'] = [];
  if (!input.transactions.length) missing.push('movimientos');
  if (!withBalance.length) missing.push('saldo');
  if (included.length > withBalance.length && withBalance.length) {
    warnings.push('Una de tus cuentas no tiene saldo. La cifra solo cuenta las que sí lo tienen.');
  }

  const balanceMinor = withBalance.reduce((s, a) => s + (a.balanceMinor ?? 0), 0);
  const balanceOn = withBalance.length
    ? withBalance.reduce((min, a) => (a.balanceOn! < min ? a.balanceOn! : min), withBalance[0]!.balanceOn!)
    : null;
  const anchor = balanceOn && balanceOn < today ? balanceOn : today;
  if (balanceOn && daysBetween(balanceOn, today) > 3) {
    warnings.push(`Tu saldo es del ${shortDate(balanceOn)}. Actualízalo para que la cifra sea precisa.`);
  }

  const recurring = detectRecurring(transactions, today).filter((r) => input.marks[r.merchantKey] !== 'no_es_fijo');
  const fixedKeys = new Set(recurring.filter((r) => r.active).map((r) => r.merchantKey));

  // Cobros que todavía no han pasado desde la fecha del saldo hasta el próximo ingreso.
  const pending: PendingCharge[] = [];
  const paidAfterAnchor = new Set(
    transactions
      .filter((t) => t.amountMinor < 0 && t.postedOn > anchor)
      .map((t) => identifyMerchant(t.description).key),
  );
  for (const r of recurring) {
    if (!r.active || paidAfterAnchor.has(r.merchantKey)) continue;
    let date = r.nextDate;
    const step = r.cadence === 'semanal' ? 7 : r.cadence === 'quincenal' ? 15 : null;
    while (toDayNumber(date) <= toDayNumber(nextIncomeOn)) {
      // Incluye cobros atrasados (fecha esperada ya pasada y sin verse): todavía pueden llegar.
      pending.push({
        key: r.merchantKey,
        name: r.name,
        date,
        amountMinor: r.typicalMinor,
        estimated: r.variableAmount,
        origin: 'detectado',
      });
      if (!step) break;
      date = addDays(date, step);
    }
  }
  for (const c of input.commitments) {
    for (const date of commitmentDates(c, anchor, nextIncomeOn)) {
      pending.push({ key: `compromiso:${c.id}`, name: c.name, date, amountMinor: c.amountMinor, estimated: false, origin: 'compromiso' });
    }
  }
  pending.sort((a, b) => a.date.localeCompare(b.date));
  const pendingMinor = pending.reduce((s, p) => s + p.amountMinor, 0);

  const lastTx = transactions.reduce<string | null>((max, t) => (!max || t.postedOn > max ? t.postedOn : max), null);
  const firstTx = transactions.reduce<string | null>((min, t) => (!min || t.postedOn < min ? t.postedOn : min), null);
  const historyDays = firstTx && lastTx ? daysBetween(firstTx, lastTx) + 1 : 0;
  const { daily } = estimateDailyVariable(transactions, fixedKeys, lastTx ?? today);
  if (transactions.length && historyDays < 21) {
    warnings.push('Hay menos de tres semanas de movimientos. El gasto del día a día es un estimado preliminar.');
  }

  // El gasto normal se proyecta desde la fecha del saldo: lo que se gastó desde entonces ya no está.
  const projectionDays = Math.max(daysLeft, daysBetween(anchor, nextIncomeOn));
  const projectedVariableMinor = daily * projectionDays;
  const availableMinor = balanceMinor - pendingMinor - projectedVariableMinor - input.bufferMinor;
  const perDayMinor = Math.max(0, Math.floor(availableMinor / daysLeft));
  const status: CifraResult['status'] =
    availableMinor < 0 ? 'en_rojo' : availableMinor < daily * Math.min(7, daysLeft) ? 'justo' : 'holgado';

  return {
    ready: missing.length === 0,
    missing,
    today,
    income,
    nextIncomeOn,
    daysLeft,
    balanceOn,
    balanceMinor,
    pending,
    pendingMinor,
    dailyVariableMinor: daily,
    projectedVariableMinor,
    projectionDays,
    bufferMinor: input.bufferMinor,
    availableMinor,
    perDayMinor,
    status,
    recurring,
    warnings,
    historyDays,
    internalTransfers: internal.length,
  };
}

export interface SpendAnswer {
  verdict: 'si' | 'justo' | 'no';
  amountMinor: number;
  remainingMinor: number;
  perDayAfterMinor: number;
  shortfallMinor: number;
  nextIncomeOn: string;
  daysLeft: number;
}

/**
 * "¿Puedo hacer este gasto?" Se compara contra la misma cifra del inicio:
 * lo libre después de lo comprometido y del gasto normal hasta el próximo ingreso.
 */
export function canISpend(cifra: CifraResult, amountMinor: number): SpendAnswer {
  const remaining = cifra.availableMinor - amountMinor;
  const verdict: SpendAnswer['verdict'] =
    remaining < 0 ? 'no' : remaining < cifra.dailyVariableMinor * Math.min(3, cifra.daysLeft) ? 'justo' : 'si';
  return {
    verdict,
    amountMinor,
    remainingMinor: remaining,
    perDayAfterMinor: Math.max(0, Math.floor(remaining / cifra.daysLeft)),
    shortfallMinor: remaining < 0 ? -remaining : 0,
    nextIncomeOn: cifra.nextIncomeOn,
    daysLeft: cifra.daysLeft,
  };
}
