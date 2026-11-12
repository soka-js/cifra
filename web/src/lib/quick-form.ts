import type { IncomeFrequency } from './engine/types';
import { parseBalanceInput, parsePesosInput, toDailyMinor, type SpendPeriod } from './format';

/**
 * Lee el formulario de los cuatro datos (cada cuánto te pagan, cuánto tienes, qué pagas fijo,
 * cuánto se te va en el día a día). Función pura: la usa la prueba pública en el navegador.
 * Los nombres de los campos son los mismos que usa el modo rápido con cuenta (saveQuickStart),
 * para que lo que la persona escribe aquí se pueda guardar tal cual cuando cree su cuenta.
 */

export interface QuickFormValues {
  frequency: IncomeFrequency;
  days: number[];
  balanceMinor: number;
  fixed: Array<{ name: string; amountMinor: number; dayOfMonth: number }>;
  dailyMinor: number;
  /** Lo que la persona creía que podía gastar, si lo escribió. */
  guessMinor: number | null;
}

export type QuickFormResult =
  | { ok: true; values: QuickFormValues }
  | { ok: false; step: number; message: string };

const FREQUENCIES: IncomeFrequency[] = ['mensual', 'quincenal', 'semanal', 'irregular'];
const PERIODS: SpendPeriod[] = ['dia', 'semana', 'mes'];
export const MAX_FIXED = 15;

function intIn(raw: unknown, min: number, max: number): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Días de pago según la frecuencia. Devuelve null si falta o no es válido lo que se necesita. */
export function incomeDays(
  frequency: IncomeFrequency,
  raw: { day1?: unknown; day2?: unknown; weekday?: unknown },
): number[] | null {
  if (frequency === 'mensual') {
    const d = intIn(raw.day1, 1, 31);
    return d === null ? null : [d];
  }
  if (frequency === 'quincenal') {
    const a = intIn(raw.day1, 1, 31) ?? 15;
    const b = intIn(raw.day2, 1, 31) ?? 30;
    return a === b ? null : [a, b].sort((x, y) => x - y);
  }
  if (frequency === 'semanal') {
    const w = intIn(raw.weekday, 1, 7);
    return w === null ? null : [w];
  }
  return [];
}

export function parseQuickForm(form: FormData): QuickFormResult {
  const fail = (step: number, message: string): QuickFormResult => ({ ok: false, step, message });

  const frequency = String(form.get('frequency') ?? '') as IncomeFrequency;
  if (!FREQUENCIES.includes(frequency)) return fail(0, 'Elige cada cuánto te pagan.');
  const days = incomeDays(frequency, { day1: form.get('day1'), day2: form.get('day2'), weekday: form.get('weekday') });
  if (days === null) return fail(0, 'Elige el día o los días en que te pagan.');

  const balanceMinor = parseBalanceInput(String(form.get('balance') ?? ''));
  if (balanceMinor === null) {
    return fail(1, 'Escribe cuánto tienes hoy, por ejemplo 1.250.000. Si no tienes nada, escribe 0.');
  }

  const names = form.getAll('fixedName').map((v) => String(v).trim().slice(0, 60));
  const amounts = form.getAll('fixedAmount').map((v) => String(v).trim());
  const dayValues = form.getAll('fixedDay').map((v) => String(v).trim());
  const fixed: QuickFormValues['fixed'] = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i] ?? '';
    const amountRaw = amounts[i] ?? '';
    if (!name && !amountRaw) continue;
    const amountMinor = parsePesosInput(amountRaw);
    const day = intIn(dayValues[i], 1, 31);
    if (!name || amountMinor === null || day === null) {
      return fail(2, `Revisa "${name || `el cobro ${i + 1}`}": necesita nombre, monto y día del mes.`);
    }
    fixed.push({ name, amountMinor, dayOfMonth: day });
  }
  if (fixed.length > MAX_FIXED) return fail(2, `Escribe hasta ${MAX_FIXED} cobros fijos.`);

  const dailyRaw = String(form.get('daily') ?? '').trim();
  const period = String(form.get('period') ?? '') as SpendPeriod;
  const dailyAmount = /^[$\s]*0+$/.test(dailyRaw) ? 0 : parsePesosInput(dailyRaw);
  if (!dailyRaw || dailyAmount === null || !PERIODS.includes(period)) {
    return fail(3, 'Escribe cuánto gastas en el día a día, por ejemplo 30.000 al día.');
  }

  const guessRaw = String(form.get('guess') ?? '').trim();
  const guessMinor = guessRaw ? parseBalanceInput(guessRaw) : null;

  return {
    ok: true,
    values: { frequency, days, balanceMinor, fixed, dailyMinor: toDailyMinor(dailyAmount, period), guessMinor },
  };
}
