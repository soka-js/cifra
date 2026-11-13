import { cop } from '../format';
import { addDays } from './dates';
import { categoryOf, identifyMerchant, type UserCategoryOverride } from './merchant';
import { splitInternalTransfers } from './transfers';
import type { RawTx } from './types';

export interface InstallmentOption {
  installments: number;
  monthlyPaymentMinor: number;
  totalPaidMinor: number;
  interestLostMinor: number;
  label: string;
  tag: string;
}

export interface CreditSimulationResult {
  amountMinor: number;
  annualEffectiveRatePct: number;
  monthlyRatePct: number;
  options: InstallmentOption[];
  plainAdvice: string;
}

/**
 * Simulador realista de tarjeta de crédito colombiana (Contado / 1 cuota al corte vs 3, 6 y 12 cuotas).
 * Usa conversión exacta de Tasa Efectiva Anual (E.A.) a Mes Vencido (M.V.): r = (1 + EA)^(1/12) - 1.
 */
export function simulateCreditInstallments(
  amountMinor: number,
  annualEffectiveRatePct = 30.8,
  installmentCounts: number[] = [1, 3, 6, 12],
): CreditSimulationResult {
  const cleanAmount = Math.max(0, Math.round(amountMinor));
  const ea = Math.max(0, annualEffectiveRatePct) / 100;
  const r = Math.pow(1 + ea, 1 / 12) - 1;

  const options: InstallmentOption[] = installmentCounts.map((n) => {
    if (n <= 1 || cleanAmount === 0 || r === 0) {
      return {
        installments: 1,
        monthlyPaymentMinor: cleanAmount,
        totalPaidMinor: cleanAmount,
        interestLostMinor: 0,
        label: '1 cuota (pago total al corte)',
        tag: '$0 intereses',
      };
    }

    const factor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const monthlyPaymentMinor = Math.round(cleanAmount * factor);
    const totalPaidMinor = monthlyPaymentMinor * n;
    const interestLostMinor = Math.max(0, totalPaidMinor - cleanAmount);

    return {
      installments: n,
      monthlyPaymentMinor,
      totalPaidMinor,
      interestLostMinor,
      label: `${n} cuotas`,
      tag: `+${Math.round((interestLostMinor / cleanAmount) * 100)} % en intereses`,
    };
  });

  // El consejo cita los intereses que acaba de calcular; ningún monto sale de otro lado.
  const withInterest = options.filter((o) => o.interestLostMinor > 0);
  const longest = withInterest[withInterest.length - 1];
  const plainAdvice =
    cleanAmount === 0
      ? 'Escribe un monto para comparar contado frente a cuotas.'
      : longest
        ? `A ${longest.installments} cuotas pagarías ${cop(longest.interestLostMinor)} más en intereses. Si no es una emergencia, págalo a 1 sola cuota, después de tu fecha de corte.`
        : 'Con esta tasa no pagas intereses en ninguna opción.';

  return {
    amountMinor: cleanAmount,
    annualEffectiveRatePct,
    monthlyRatePct: Math.round(r * 10000) / 100,
    options,
    plainAdvice,
  };
}

/**
 * Un gasto que se repite en los últimos 30 días. Solo lleva lo que está en los movimientos de la
 * persona (cuánto pagó y cuántas veces); no estima pérdidas ni ahorros posibles.
 */
export interface MoneyLeakInsight {
  id: 'domicilios_app' | 'cobros_bancarios' | 'noches_y_finde';
  title: string;
  /** Lo que la persona pagó por este concepto en los últimos 30 días (centavos, positivo). */
  amountMinor: number;
  /** Cuántos movimientos suman ese monto. */
  count: number;
  evidence: string;
  concreteAction: string;
  /** Categoría del barrio con la que se puede sustituir (si aplica). */
  neighborhoodCategory: string | null;
}

const DELIVERY_APPS_RE = /\b(RAPPI|DIDI\s*FOOD|UBER\s*EATS|DOMICILIOS|IFOOD)\b/i;
const BANK_FEES_RE = /\b(CUOTA\s+DE\s+MANEJO|4X1000|GMF|GRAVAMEN|IVA\s+COMISION|COMISION\s+RETIRO|SEGURO\s+TARJETA|ASISTENCIA)\b/i;

export interface LeakInputTx extends RawTx {
  spentHour?: number | null;
}

/**
 * Gastos que se repiten en los últimos 30 días, con lo que de verdad se pagó:
 * 1) Domicilios pedidos por app
 * 2) Cobros del banco (cuota de manejo, 4x1000, seguros)
 * 3) Compras de viernes, sábado o de noche
 * Un mismo movimiento puede aparecer en dos grupos (un domicilio un viernes), así que no se suman entre sí.
 */
export function detectMoneyLeaks(input: {
  txs: LeakInputTx[];
  today: string;
  overrides?: Record<string, UserCategoryOverride>;
}): MoneyLeakInsight[] {
  const since30 = addDays(input.today, -30);
  const { external: clean } = splitInternalTransfers(input.txs);
  const recent = clean.filter((t) => t.amountMinor < 0 && t.postedOn >= since30 && t.postedOn <= input.today);

  const leaks: MoneyLeakInsight[] = [];

  // 1. Domicilios por app
  const deliveryTxs = recent.filter((t) => DELIVERY_APPS_RE.test(t.description));
  if (deliveryTxs.length >= 2) {
    leaks.push({
      id: 'domicilios_app',
      title: 'Domicilios por app',
      amountMinor: deliveryTxs.reduce((s, t) => s + Math.abs(t.amountMinor), 0),
      count: deliveryTxs.length,
      evidence: `${deliveryTxs.length} pedidos en los últimos 30 días.`,
      concreteAction: 'Si cambias algunos por un local cerca, te ahorras el envío y la tarifa de servicio de la app.',
      neighborhoodCategory: 'comida',
    });
  }

  // 2. Cobros bancarios evitables (cuota manejo, 4x1000, seguros)
  const bankFeeTxs = recent.filter((t) => {
    const cat = categoryOf(t.description, t.amountMinor, input.overrides);
    return cat === 'comisiones' || BANK_FEES_RE.test(t.description);
  });
  if (bankFeeTxs.length >= 1) {
    const feesMinor = bankFeeTxs.reduce((s, t) => s + Math.abs(t.amountMinor), 0);
    if (feesMinor >= 5_000_00) {
      leaks.push({
        id: 'cobros_bancarios',
        title: 'Cuota de manejo, 4x1000 y seguros',
        amountMinor: feesMinor,
        count: bankFeeTxs.length,
        evidence: `${bankFeeTxs.length} ${bankFeeTxs.length === 1 ? 'cobro del banco' : 'cobros del banco'} en los últimos 30 días (por ejemplo, ${identifyMerchant(bankFeeTxs[0]!.description, input.overrides).name}).`,
        concreteAction:
          'Pregunta en tu banco por marcar tu cuenta principal como exenta del 4x1000 y por una cuenta sin cuota de manejo.',
        neighborhoodCategory: null,
      });
    }
  }

  // 3. Impulsos de viernes/sábado o noche (>= 7 p.m.)
  const origHourByKey = new Map<string, number | null>();
  for (const t of input.txs) {
    origHourByKey.set(`${t.postedOn}:${t.amountMinor}:${t.description}`, t.spentHour ?? null);
  }

  let weekendNightMinor = 0;
  let weekendNightCount = 0;
  for (const t of recent) {
    const cat = categoryOf(t.description, t.amountMinor, input.overrides);
    if (!['comida', 'ocio', 'transporte', 'compras'].includes(cat)) continue;
    const d = new Date(`${t.postedOn}T12:00:00Z`);
    const dow = d.getUTCDay(); // 5 = vie, 6 = sáb
    const hr = origHourByKey.get(`${t.postedOn}:${t.amountMinor}:${t.description}`);
    const isNight = hr !== null && hr !== undefined && hr >= 19;
    const isFriSat = dow === 5 || dow === 6;
    if (isNight || isFriSat) {
      weekendNightMinor += Math.abs(t.amountMinor);
      weekendNightCount += 1;
    }
  }

  if (weekendNightCount >= 3 && weekendNightMinor >= 60_000_00) {
    leaks.push({
      id: 'noches_y_finde',
      title: 'Viernes, sábado y noches',
      amountMinor: weekendNightMinor,
      count: weekendNightCount,
      evidence: `${weekendNightCount} compras de comida, salidas, transporte o compras en viernes, sábado o después de las 7:00 p. m.`,
      concreteAction: 'Antes del viernes, pregunta en ¿Puedo? cuánto te alcanza para el fin de semana.',
      neighborhoodCategory: 'comida',
    });
  }

  return leaks.sort((a, b) => b.amountMinor - a.amountMinor);
}
