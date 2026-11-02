import { daysBetween } from './dates';
import { flowOf } from './merchant';
import type { Tx } from './types';

/**
 * Plata que se movió entre tus propias cuentas (de Bancolombia a Nequi, pago de tu tarjeta desde tu ahorro)
 * no es ni ingreso ni gasto. Se empareja una salida con una entrada del mismo valor en otra cuenta tuya,
 * con hasta 3 días de diferencia, cuando al menos una de las dos parece transferencia o pago de tarjeta.
 */
export function splitInternalTransfers(txs: Tx[]): { external: Tx[]; internal: Tx[] } {
  const credits = txs.filter((t) => t.amountMinor > 0).sort((a, b) => a.postedOn.localeCompare(b.postedOn));
  const used = new Set<Tx>();
  const internal = new Set<Tx>();
  const debits = txs.filter((t) => t.amountMinor < 0).sort((a, b) => a.postedOn.localeCompare(b.postedOn));
  for (const d of debits) {
    const dFlow = flowOf(d.description, d.amountMinor);
    for (const c of credits) {
      if (used.has(c) || c.accountId === d.accountId || c.amountMinor !== -d.amountMinor) continue;
      const gap = Math.abs(daysBetween(d.postedOn, c.postedOn));
      if (gap > 3) continue;
      const cFlow = flowOf(c.description, c.amountMinor);
      const looksInternal = dFlow === 'transferencia' || dFlow === 'pago_tarjeta' || cFlow === 'transferencia';
      if (!looksInternal) continue;
      used.add(c);
      internal.add(c);
      internal.add(d);
      break;
    }
  }
  return { external: txs.filter((t) => !internal.has(t)), internal: [...internal] };
}
