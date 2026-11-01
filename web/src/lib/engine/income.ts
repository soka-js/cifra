import { daysBetween, nextDayOfMonth, nextWeekday, isoWeekday } from './dates';
import { identifyMerchant, isPayroll } from './merchant';
import type { IncomeFrequency, IncomeSettings, Tx } from './types';

export interface IncomeEstimate {
  frequency: IncomeFrequency;
  days: number[];
  typicalMinor: number | null;
  payer: string | null;
  lastDate: string | null;
  /** Detectado en los movimientos o tomado de lo que la persona configuró. */
  origin: 'configurado' | 'detectado' | 'sin_datos';
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10));
}

/** Los pagos de fin de mes caen entre el 28 y el 31; se guardan como 30 y se ajustan al mes. */
function normalizePayday(d: number): number {
  return d >= 28 ? 30 : d;
}

/**
 * Busca el ingreso principal: el pagador cuyos abonos se repiten con frecuencia
 * mensual, quincenal o semanal y que más plata trae al mes.
 */
export function detectIncome(txs: Tx[]): IncomeEstimate | null {
  const credits = txs.filter((t) => t.amountMinor > 0);
  if (credits.length < 2) return null;
  const groups = new Map<string, Tx[]>();
  for (const t of credits) {
    const key = isPayroll(t.description) ? 'nomina' : identifyMerchant(t.description).key;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  const totalCredits = credits.reduce((s, t) => s + t.amountMinor, 0);
  let best: (IncomeEstimate & { monthly: number }) | null = null;

  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.postedOn.localeCompare(b.postedOn));
    const intervals = list.slice(1).map((t, i) => daysBetween(list[i]!.postedOn, t.postedOn));
    const med = median(intervals);
    let frequency: IncomeFrequency | null = null;
    if (med >= 26 && med <= 35) frequency = 'mensual';
    else if (med >= 12 && med <= 18) frequency = 'quincenal';
    else if (med >= 6 && med <= 8) frequency = 'semanal';
    if (!frequency) continue;
    const typical = Math.round(median(list.map((t) => t.amountMinor)));
    const sum = list.reduce((s, t) => s + t.amountMinor, 0);
    if (sum < totalCredits * 0.2 && key !== 'nomina') continue;
    const monthly = frequency === 'mensual' ? typical : frequency === 'quincenal' ? typical * 2 : typical * 4.3;

    let days: number[];
    if (frequency === 'semanal') {
      days = [Math.round(median(list.map((t) => isoWeekday(t.postedOn))))];
    } else if (frequency === 'mensual') {
      days = [normalizePayday(Math.round(median(list.map((t) => dayOfMonth(t.postedOn)))))];
    } else {
      const early = list.map((t) => dayOfMonth(t.postedOn)).filter((d) => d <= 20);
      const late = list.map((t) => dayOfMonth(t.postedOn)).filter((d) => d > 20);
      const a = early.length ? Math.round(median(early)) : 15;
      const b = late.length ? normalizePayday(Math.round(median(late))) : 30;
      days = [a, b];
    }
    const payer = key === 'nomina' ? 'Nómina' : identifyMerchant(list[0]!.description).name;
    const cand = {
      frequency,
      days,
      typicalMinor: typical,
      payer,
      lastDate: list[list.length - 1]!.postedOn,
      origin: 'detectado' as const,
      monthly,
    };
    if (!best || cand.monthly > best.monthly) best = cand;
  }
  if (!best) return null;
  const { monthly: _m, ...estimate } = best;
  return estimate;
}

/** Combina lo que la persona configuró (manda) con lo detectado. */
export function resolveIncome(settings: IncomeSettings, txs: Tx[]): IncomeEstimate {
  const detected = detectIncome(txs);
  if (settings.frequency && settings.frequency !== 'irregular' && settings.days?.length) {
    return {
      frequency: settings.frequency,
      days: settings.days,
      typicalMinor: detected?.typicalMinor ?? null,
      payer: detected?.payer ?? null,
      lastDate: detected?.lastDate ?? null,
      origin: 'configurado',
    };
  }
  if (settings.frequency === 'irregular') {
    return { frequency: 'irregular', days: [], typicalMinor: null, payer: null, lastDate: null, origin: 'configurado' };
  }
  return detected ?? { frequency: 'irregular', days: [], typicalMinor: null, payer: null, lastDate: null, origin: 'sin_datos' };
}

/** Próxima fecha de ingreso después de hoy. Para ingresos irregulares, el último día del mes. */
export function nextIncomeDate(income: IncomeEstimate, today: string): string {
  if (income.frequency === 'semanal' && income.days[0]) return nextWeekday(today, income.days[0]);
  if ((income.frequency === 'mensual' || income.frequency === 'quincenal') && income.days.length) {
    return nextDayOfMonth(today, income.days);
  }
  return nextDayOfMonth(today, [31]);
}
