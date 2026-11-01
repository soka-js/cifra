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

export const CONSENT_VERSION = 'v1-2026-11';
