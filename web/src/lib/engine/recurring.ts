import { addDays, daysBetween } from './dates';
import { categoryOf, flowOf, identifyMerchant, type Category, type UserCategoryOverride } from './merchant';
import type { Tx } from './types';

export type Cadence = 'semanal' | 'quincenal' | 'mensual' | 'bimestral' | 'trimestral' | 'anual';

export const CADENCE_DAYS: Record<Cadence, number> = {
  semanal: 7,
  quincenal: 15,
  mensual: 30,
  bimestral: 61,
  trimestral: 91,
  anual: 365,
};

const CADENCE_WINDOWS: Array<{ cadence: Cadence; min: number; max: number }> = [
  { cadence: 'semanal', min: 6, max: 8 },
  { cadence: 'quincenal', min: 13, max: 17 },
  { cadence: 'mensual', min: 26, max: 35 },
  { cadence: 'bimestral', min: 56, max: 66 },
  { cadence: 'trimestral', min: 85, max: 97 },
  { cadence: 'anual', min: 350, max: 380 },
];

export interface RecurringSeries {
  merchantKey: string;
  name: string;
  category: Category;
  cadence: Cadence;
  /** Monto típico en centavos, positivo. */
  typicalMinor: number;
  /** Equivalente mensual en centavos. */
  monthlyMinor: number;
  /** Acumulado histórico cobrado en los movimientos disponibles (H.1.3 e I.5). */
  historicalTotalMinor: number;
  occurrences: number;
  firstDate: string;
  lastDate: string;
  nextDate: string;
  /** Sigue vigente: el último cobro no está muy atrasado frente a su frecuencia. */
  active: boolean;
  /** Los montos cambian (servicios públicos), así que el próximo es un estimado. */
  variableAmount: boolean;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function cadenceFor(intervalDays: number): Cadence | null {
  for (const w of CADENCE_WINDOWS) if (intervalDays >= w.min && intervalDays <= w.max) return w.cadence;
  return null;
}

const VARIABLE_OK: Category[] = ['servicios_hogar', 'telefonia_internet', 'comisiones'];
const SUBSCRIPTION_LIKE: Category[] = ['suscripciones', 'telefonia_internet', 'servicios_hogar', 'gimnasio', 'comisiones'];

/**
 * Busca cobros que se repiten: mismo comercio, intervalos regulares y montos parecidos.
 * Con dos cobros basta si el comercio es de suscripción conocido; si no, se piden tres.
 */
export function detectRecurring(
  txs: Tx[],
  today: string,
  overrides?: Record<string, UserCategoryOverride>,
): RecurringSeries[] {
  const groups = new Map<string, Tx[]>();
  for (const tx of txs) {
    if (tx.amountMinor >= 0) continue;
    const flow = flowOf(tx.description, tx.amountMinor);
    if (flow === 'pago_tarjeta' || flow === 'efectivo') continue;
    const key = identifyMerchant(tx.description, overrides).key;
    if (key === 'sin_nombre') continue;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const out: RecurringSeries[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.postedOn.localeCompare(b.postedOn));
    // Varios cobros el mismo día (dos compras en el D1) cuentan como uno para medir la frecuencia.
    const byDay = new Map<string, number>();
    for (const t of list) byDay.set(t.postedOn, (byDay.get(t.postedOn) ?? 0) + -t.amountMinor);
    const dates = [...byDay.keys()];
    if (dates.length < 2) continue;
    const intervals = dates.slice(1).map((d, i) => daysBetween(dates[i]!, d));
    const cadence = cadenceFor(median(intervals));
    if (!cadence) continue;
    const w = CADENCE_WINDOWS.find((c) => c.cadence === cadence)!;
    const regular = intervals.filter((iv) => iv >= w.min && iv <= w.max).length;
    if (regular / intervals.length < 0.75) continue;

    const first = list[0]!;
    const merchant = identifyMerchant(first.description, overrides);
    const category = categoryOf(first.description, first.amountMinor, overrides);
    const isTransfer = category === 'transferencias';
    const amounts = [...byDay.values()];
    const ratio = Math.max(...amounts) / Math.min(...amounts);
    const variableAmount = ratio > 1.08;
    const maxRatio = isTransfer ? 1.05 : VARIABLE_OK.includes(category) ? 1.8 : 1.3;
    if (ratio > maxRatio) continue;

    const knownSubscription = SUBSCRIPTION_LIKE.includes(category);
    const needed = knownSubscription ? 2 : 3;
    if (dates.length < needed) continue;
    // Comercios del día a día (mercado, comida, transporte, compras, ocio) se repiten sin ser compromisos fijos.
    if (['mercado', 'comida', 'transporte', 'combustible', 'salud', 'compras', 'ocio', 'otros'].includes(category) && !isTransfer) {
      if (cadence !== 'mensual' || ratio > 1.05 || dates.length < 3) continue;
    }

    const lastDate = dates[dates.length - 1]!;
    const step = CADENCE_DAYS[cadence];
    const typical = Math.round(median(amounts));
    const historicalTotalMinor = list.reduce((s, t) => s + -t.amountMinor, 0);
    let nextDate = addDays(lastDate, cadence === 'mensual' ? 0 : step);
    if (cadence === 'mensual') {
      // Mismo día del mes siguiente, ajustado si el mes es más corto.
      const [y, m, d] = lastDate.split('-').map(Number) as [number, number, number];
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      const dim = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
      nextDate = `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`;
    }
    // Si la fecha esperada ya pasó hace poco, el cobro sigue vigente y se espera en cualquier momento.
    const overdue = daysBetween(nextDate, today);
    const active = overdue <= Math.max(10, step * 0.5);

    out.push({
      merchantKey: key,
      name: isTransfer ? `Transferencia: ${merchant.name.replace(/^Transferencia\s*/i, '') || 'sin nombre'}` : merchant.name,
      category,
      cadence,
      typicalMinor: typical,
      monthlyMinor: Math.round((typical * 30) / step),
      historicalTotalMinor,
      occurrences: dates.length,
      firstDate: dates[0]!,
      lastDate,
      nextDate,
      active,
      variableAmount,
    });
  }
  return out.sort((a, b) => b.monthlyMinor - a.monthlyMinor);
}
