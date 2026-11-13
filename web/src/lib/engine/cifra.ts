import { addDays, daysBetween, nextDayOfMonth, shortDate, toDayNumber } from './dates';
import { nextIncomeDate, resolveIncome, type IncomeEstimate } from './income';
import { flowOf, identifyMerchant, stripAccents, type Category, type UserCategoryOverride } from './merchant';
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
  /** Gasto del día a día que la persona escribió (modo rápido), en centavos. */
  declaredDailyMinor?: number | null;
  categoryOverrides?: Record<string, UserCategoryOverride>;
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
  /**
   * De dónde sale el gasto del día a día: de los movimientos (tres semanas o más), de lo que la persona
   * escribió en el modo rápido, o de ningún lado todavía.
   */
  dailySource: 'movimientos' | 'declarado' | 'sin_datos';
  declaredDailyMinor: number | null;
  /** Días desde el saldo más viejo usado (0 = de hoy). */
  balanceAgeDays: number | null;
  /** Cuentas que entran en la cifra, con su saldo. */
  accounts: AccountBalance[];
  /** Cobros fijos escritos a mano (todos, incluidos los que ya aparecen en los movimientos). */
  commitments: Commitment[];
  /** Compromisos escritos a mano que ya aparecen como cobro en los movimientos: no se cuentan dos veces. */
  matchedCommitments: string[];
  /**
   * Compromisos que se parecen a un cobro detectado sin ser idénticos (otro monto u otro día). No se quitan solos:
   * se le pregunta a la persona si es el mismo.
   */
  commitmentSuggestions: CommitmentSuggestion[];
}

export interface CommitmentSuggestion {
  commitmentId: string;
  seriesKey: string;
  seriesName: string;
  seriesAmountMinor: number;
  seriesDay: number;
}

/** Inicio del aviso de saldo viejo, para que la pantalla de inicio lo reemplace por el formulario. */
export const STALE_BALANCE_WARNING = 'Tu saldo es del';

/** Días de movimientos desde los que el gasto diario se calcula con ellos en vez de con lo que la persona escribió. */
export const MIN_HISTORY_DAYS = 21;

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

/**
 * Un compromiso escrito a mano es el mismo cobro que una serie detectada si es el mismo comercio, o si es
 * mensual, cuesta parecido (10 %) y cae a tres días o menos del mismo día del mes.
 */
export function sameCharge(c: Commitment, r: RecurringSeries): boolean {
  if (identifyMerchant(c.name).key === r.merchantKey) return true;
  if (r.cadence !== 'mensual' || r.typicalMinor <= 0) return false;
  const ratio = c.amountMinor / r.typicalMinor;
  const day = Number(r.nextDate.slice(8, 10));
  const diff = Math.abs(day - c.dayOfMonth);
  return ratio >= 0.9 && ratio <= 1.1 && Math.min(diff, 31 - diff) <= 3;
}

/** Qué categorías de cobro detectado puede ser un compromiso, según cómo lo nombró la persona. */
const NAME_HINTS: Array<[RegExp, Category[]]> = [
  [/ARRIENDO|ALQUILER|RENTA|ADMINISTRACION|CANON/, ['transferencias', 'otros']],
  [/CELULAR|TELEFONO|PLAN|INTERNET|WIFI|CLARO|MOVISTAR|TIGO|WOM|ETB/, ['telefonia_internet']],
  [/SERVICIO|LUZ|AGUA|GAS|ENERGIA|ENEL|VANTI|ACUEDUCTO|EPM/, ['servicios_hogar']],
  [/GIMNASIO|GYM|SMART ?FIT|BODYTECH/, ['gimnasio']],
  [/SUSCRIPCION|NETFLIX|SPOTIFY|DISNEY|HBO|\bMAX\b|PRIME|YOUTUBE|STREAMING|ICLOUD|GOOGLE ONE|CHATGPT/, ['suscripciones']],
  [/UNIVERSIDAD|COLEGIO|SEMESTRE|MATRICULA|CURSO|PENSION ESCOLAR/, ['educacion']],
  [/SEGURO|EPS|PREPAGADA|MEDICINA/, ['salud']],
];

function dayGap(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 31 - d);
}

/**
 * Para cada compromiso, el cobro detectado que más se le parece si el nombre apunta a esa categoría
 * (monto entre la mitad y el doble, hasta 6 días de diferencia) o, sin pista en el nombre, si el monto
 * es casi el mismo (20 %) y cae a 5 días o menos. Cada cobro se sugiere para un solo compromiso.
 */
export function suggestSameCharges(commitments: Commitment[], series: RecurringSeries[], exclude: Set<string>): CommitmentSuggestion[] {
  const monthly = series.filter((r) => r.active && r.cadence === 'mensual' && r.typicalMinor > 0 && r.category !== 'efectivo' && r.category !== 'pagos_tarjeta');
  const used = new Set<string>();
  const out: CommitmentSuggestion[] = [];
  for (const c of commitments) {
    if (exclude.has(c.id)) continue;
    const name = stripAccents(c.name).toUpperCase();
    const hinted = NAME_HINTS.filter(([re]) => re.test(name)).flatMap(([, cats]) => cats);
    let best: { r: RecurringSeries; score: number } | null = null;
    for (const r of monthly) {
      if (used.has(r.merchantKey) || c.notSameAs?.includes(r.merchantKey)) continue;
      const ratio = c.amountMinor / r.typicalMinor;
      const day = Number(r.nextDate.slice(8, 10));
      const gap = dayGap(day, c.dayOfMonth);
      const ok = hinted.length
        ? hinted.includes(r.category) && ratio >= 0.5 && ratio <= 2 && gap <= 6
        : ratio >= 0.8 && ratio <= 1.25 && gap <= 5;
      if (!ok) continue;
      const score = Math.abs(Math.log(ratio)) + gap / 10;
      if (!best || score < best.score) best = { r, score };
    }
    if (best) {
      used.add(best.r.merchantKey);
      out.push({
        commitmentId: c.id,
        seriesKey: best.r.merchantKey,
        seriesName: best.r.name,
        seriesAmountMinor: best.r.typicalMinor,
        seriesDay: Number(best.r.nextDate.slice(8, 10)),
      });
    }
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
  const declared = input.declaredDailyMinor ?? null;
  if (!input.transactions.length && declared === null) missing.push('movimientos');
  if (!withBalance.length) missing.push('saldo');
  if (included.length > withBalance.length && withBalance.length) {
    warnings.push('Una de tus cuentas no tiene saldo. La cifra solo cuenta las que sí lo tienen.');
  }

  const balanceMinor = withBalance.reduce((s, a) => s + (a.balanceMinor ?? 0), 0);
  const balanceOn = withBalance.length
    ? withBalance.reduce((min, a) => (a.balanceOn! < min ? a.balanceOn! : min), withBalance[0]!.balanceOn!)
    : null;
  const anchor = balanceOn && balanceOn < today ? balanceOn : today;
  const balanceAgeDays = balanceOn ? Math.max(0, daysBetween(balanceOn, today)) : null;
  if (balanceOn && daysBetween(balanceOn, today) > 3) {
    warnings.push(`${STALE_BALANCE_WARNING} ${shortDate(balanceOn)}. Actualízalo para que la cifra sea precisa.`);
  }

  const recurring = detectRecurring(transactions, today, input.categoryOverrides).filter((r) => input.marks[r.merchantKey] !== 'no_es_fijo');
  const fixedKeys = new Set(recurring.filter((r) => r.active).map((r) => r.merchantKey));

  // Cobros que todavía no han pasado desde la fecha del saldo hasta el próximo ingreso.
  const pending: PendingCharge[] = [];
  const paidAfterAnchor = new Set(
    transactions
      .filter((t) => t.amountMinor < 0 && t.postedOn > anchor)
      .map((t) => identifyMerchant(t.description, input.categoryOverrides).key),
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
  const activeRecurring = recurring.filter((r) => r.active);
  const matchedCommitments: string[] = [];
  for (const c of input.commitments) {
    if (activeRecurring.some((r) => sameCharge(c, r))) {
      matchedCommitments.push(c.id);
      continue;
    }
    for (const date of commitmentDates(c, anchor, nextIncomeOn)) {
      pending.push({ key: `compromiso:${c.id}`, name: c.name, date, amountMinor: c.amountMinor, estimated: false, origin: 'compromiso' });
    }
  }
  pending.sort((a, b) => a.date.localeCompare(b.date));
  const pendingMinor = pending.reduce((s, p) => s + p.amountMinor, 0);

  const lastTx = transactions.reduce<string | null>((max, t) => (!max || t.postedOn > max ? t.postedOn : max), null);
  const firstTx = transactions.reduce<string | null>((min, t) => (!min || t.postedOn < min ? t.postedOn : min), null);
  const historyDays = firstTx && lastTx ? daysBetween(firstTx, lastTx) + 1 : 0;
  const estimated = estimateDailyVariable(transactions, fixedKeys, lastTx ?? today).daily;
  // Con tres semanas de movimientos manda lo que muestran; antes, lo que la persona escribió (si lo escribió).
  let dailySource: CifraResult['dailySource'];
  let daily: number;
  if (transactions.length && historyDays >= MIN_HISTORY_DAYS) {
    dailySource = 'movimientos';
    daily = estimated;
  } else if (declared !== null) {
    dailySource = 'declarado';
    daily = declared;
  } else if (transactions.length) {
    dailySource = 'movimientos';
    daily = estimated;
    warnings.push('Hay menos de tres semanas de movimientos. El gasto del día a día es un estimado preliminar.');
  } else {
    dailySource = 'sin_datos';
    daily = 0;
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
    dailySource,
    declaredDailyMinor: declared,
    balanceAgeDays,
    accounts: included,
    commitments: input.commitments,
    matchedCommitments,
    commitmentSuggestions: suggestSameCharges(input.commitments, recurring, new Set(matchedCommitments)),
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
 * Lo que conviene que quede libre después de un gasto para no quedar justo: hasta tres días del
 * gasto del día a día (menos si el pago llega antes).
 */
export function spendReserveMinor(cifra: Pick<CifraResult, 'dailyVariableMinor' | 'daysLeft'>): number {
  return cifra.dailyVariableMinor * Math.min(3, cifra.daysLeft);
}

/** El gasto más grande que todavía recibe un "sí" de canISpend: la cifra menos esa reserva. Nunca negativo. */
export function comfortableSpendMinor(
  cifra: Pick<CifraResult, 'availableMinor' | 'dailyVariableMinor' | 'daysLeft'>,
): number {
  return Math.max(0, cifra.availableMinor - spendReserveMinor(cifra));
}

/**
 * "¿Puedo hacer este gasto?" Se compara contra la misma cifra del inicio:
 * lo libre después de lo comprometido y del gasto normal hasta el próximo ingreso.
 */
export function canISpend(cifra: CifraResult, amountMinor: number): SpendAnswer {
  const remaining = cifra.availableMinor - amountMinor;
  const verdict: SpendAnswer['verdict'] = remaining < 0 ? 'no' : remaining < spendReserveMinor(cifra) ? 'justo' : 'si';
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
