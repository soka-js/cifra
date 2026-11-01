/**
 * Fechas como texto 'AAAA-MM-DD' y aritmética en días UTC. Así no hay sorpresas de zona horaria:
 * un movimiento del 15 de octubre es del 15 de octubre en cualquier servidor.
 */

const DAY_MS = 86_400_000;

export function toDayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / DAY_MS);
}

export function fromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(toDayNumber(iso) + days);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return toDayNumber(toIso) - toDayNumber(fromIso);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Fecha del día `day` en ese mes; si el mes es más corto (30 en febrero), cae en el último día. */
export function clampedDate(year: number, month1: number, day: number): string {
  const d = Math.min(day, daysInMonth(year, month1));
  return `${year}-${String(month1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Primer día estrictamente posterior a `afterIso` que cae en alguno de los días del mes dados. */
export function nextDayOfMonth(afterIso: string, days: number[]): string {
  const [y, m] = afterIso.split('-').map(Number) as [number, number];
  const after = toDayNumber(afterIso);
  let best: number | null = null;
  for (let k = 0; k < 3; k++) {
    const month0 = m - 1 + k;
    const year = y + Math.floor(month0 / 12);
    const month1 = (month0 % 12) + 1;
    for (const d of days) {
      const n = toDayNumber(clampedDate(year, month1, d));
      if (n > after && (best === null || n < best)) best = n;
    }
    if (best !== null) break;
  }
  return fromDayNumber(best!);
}

/** Día de la semana ISO (1 = lunes ... 7 = domingo). */
export function isoWeekday(iso: string): number {
  const wd = new Date(toDayNumber(iso) * DAY_MS).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function nextWeekday(afterIso: string, weekday: number): string {
  for (let i = 1; i <= 7; i++) {
    const cand = addDays(afterIso, i);
    if (isoWeekday(cand) === weekday) return cand;
  }
  return addDays(afterIso, 7);
}

/** Hoy en Colombia (UTC-5, sin horario de verano). */
export function todayInBogota(now: Date = new Date()): string {
  return new Date(now.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** '2026-11-15' -> '15 nov' */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m! - 1]}`;
}
