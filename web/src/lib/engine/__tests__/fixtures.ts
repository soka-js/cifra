import { addDays, clampedDate } from '../dates';
import type { Tx } from '../types';

/** Generador determinista (mulberry32) para que las pruebas den siempre lo mismo. */
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pesos = (n: number) => n * 100;

/**
 * Tres meses (agosto a octubre de 2026) de una persona con nómina el 30, arriendo por transferencia el 1,
 * suscripciones, servicios y gasto diario aleatorio entre 15.000 y 60.000 pesos casi todos los días.
 */
export function ledger(): Tx[] {
  const r = rng(42);
  const txs: Tx[] = [];
  const add = (postedOn: string, description: string, amount: number) =>
    txs.push({ accountId: 'a1', postedOn, description, amountMinor: pesos(amount) });
  for (const [y, m] of [[2026, 8], [2026, 9], [2026, 10]] as const) {
    add(clampedDate(y, m, 1), 'TRANSFERENCIA A JUAN CARLOS PEREZ', -900_000);
    add(clampedDate(y, m, 3), 'COMPRA EN SMART FIT CHAPINERO', -99_900);
    add(clampedDate(y, m, 5), 'COMPRA INTL NETFLIX.COM', -26_900);
    add(clampedDate(y, m, 10), 'PAGO PSE ENEL COLOMBIA', -(80_000 + Math.round(r() * 30_000)));
    add(clampedDate(y, m, 12), 'COMPRA INTL SPOTIFY P3F2A1', -16_900);
    add(clampedDate(y, m, 20), 'PAGO SV CLARO COLOMBIA', -55_000);
    add(clampedDate(y, m, 30), 'PAGO NOMINA EMPRESA EJEMPLO SAS', 2_500_000);
    for (let d = 1; d <= 31; d++) {
      const date = clampedDate(y, m, d);
      if (date.slice(8) !== String(d).padStart(2, '0')) continue;
      if (r() < 0.8) {
        const shops = ['COMPRA EN D1 SAS', 'COMPRA EN RAPPI', 'UBER TRIP', 'COMPRA POS TIENDA DONA ROSA', 'COMPRA EN EXITO'];
        add(date, shops[Math.floor(r() * shops.length)]!, -(15_000 + Math.round(r() * 45_000)));
      }
    }
  }
  return txs.sort((a, b) => a.postedOn.localeCompare(b.postedOn));
}

export function lastDate(txs: Tx[]): string {
  return txs[txs.length - 1]!.postedOn;
}

export { addDays };
