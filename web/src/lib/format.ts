/** Formato de pesos colombianos sin decimales: 1234500 centavos -> "$12.345". */
export function cop(minor: number, opts: { sign?: boolean } = {}): string {
  const pesos = Math.round(minor / 100);
  const abs = Math.abs(pesos).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  const sign = pesos < 0 ? '-' : opts.sign && pesos > 0 ? '+' : '';
  return `${sign}$${abs}`;
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
