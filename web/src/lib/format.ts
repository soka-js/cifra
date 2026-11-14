/**
 * Formatea un entero con punto de miles, como se escribe en Colombia: 1234567 -> "1.234.567".
 * Toda cifra que se muestre en pantalla pasa por aquí o por cop(); nunca se formatea a mano.
 */
export function formatThousands(value: number | string): string {
  const num = typeof value === 'number' ? Math.round(value) : parseInt(String(value).replace(/[^0-9-]/g, ''), 10);
  if (isNaN(num)) return '0';
  return Math.abs(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Pesos colombianos con punto de miles y sin centavos: 180822800 centavos -> "$1.808.228". */
export function cop(minor: number, opts: { sign?: boolean; space?: boolean } = {}): string {
  const pesos = Math.round(minor / 100);
  const formatted = formatThousands(Math.abs(pesos));
  const sign = pesos < 0 ? '-' : opts.sign && pesos > 0 ? '+' : '';
  const space = opts.space ? ' ' : '';
  return `${sign}$${space}${formatted}`;
}

/**
 * Un monto en miles de pesos, para etiquetas donde no cabe el número entero (barras de una gráfica
 * rotulada "en miles de pesos"): 4523400 centavos ($45.234) -> "45"; 120000000 ($1.200.000) -> "1.200".
 * Un monto positivo de menos de $500 se muestra "<1" para no confundirlo con cero.
 */
export function milesDePesos(minor: number): string {
  const miles = Math.round(Math.abs(minor) / 100 / 1000);
  if (miles === 0 && minor !== 0) return '<1';
  return formatThousands(miles);
}

/**
 * Un porcentaje guardado en puntos básicos, como se escribe en Colombia: 500 -> "5 %", 450 -> "4,5 %".
 * El espacio antes del % es de no separación, para que el número y el signo no queden en renglones distintos.
 */
export function percentFromBps(bps: number): string {
  const pct = Math.round(bps) / 100;
  return `${String(pct).replace('.', ',')} %`;
}

/** Interpreta lo que escribe la persona ("45.000", "45000", "45 mil") como centavos. */
export function parsePesosInput(value: string): number | null {
  const s = value.toLowerCase().replace(/\s/g, '');
  const mil = s.endsWith('mil') ? 1000 : 1;
  const digits = s.replace(/mil$/, '').replace(/[$.,]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const pesos = Number(digits) * mil;
  return pesos > 0 && pesos < 10_000_000_000 ? pesos * 100 : null;
}

/** Saldo escrito por la persona: acepta 0 y negativos (sobregiro). Devuelve centavos o null si no se entiende. */
export function parseBalanceInput(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const negative = raw.startsWith('-');
  const rest = raw.replace(/^-/, '').trim();
  if (/^[$\s]*0+([.,]0+)?$/.test(rest)) return 0;
  const minor = parsePesosInput(rest);
  if (minor === null) return null;
  return negative ? -minor : minor;
}

export type SpendPeriod = 'dia' | 'semana' | 'mes';
const PERIOD_DAYS: Record<SpendPeriod, number> = { dia: 1, semana: 7, mes: 30 };

/** Lleva un gasto escrito por día, semana o mes a centavos por día, redondeado a pesos enteros. */
export function toDailyMinor(amountMinor: number, period: SpendPeriod): number {
  return Math.round(amountMinor / PERIOD_DAYS[period] / 100) * 100;
}

export const CONSENT_VERSION = 'v1-2026-11';
export { shortDate } from './engine/dates';

