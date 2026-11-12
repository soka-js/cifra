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

  const opt6 = options.find((o) => o.installments === 6);
  const opt12 = options.find((o) => o.installments === 12);
  const plainAdvice =
    cleanAmount === 0
      ? 'Escribe un monto para comparar contado frente a cuotas.'
      : `A 6 cuotas le regalas intereses equivalentes a varios almuerzos${
          opt12 ? `, y a 12 cuotas pagas un sobrecosto importante` : ''
        }. Si no es emergencia, págalo de contado o a 1 sola cuota después de tu fecha de corte.`;

  void opt6;
  return {
    amountMinor: cleanAmount,
    annualEffectiveRatePct,
    monthlyRatePct: Math.round(r * 10000) / 100,
    options,
    plainAdvice,
  };
}

export interface MoneyLeakInsight {
  id: 'sobrecosto_domicilios' | 'cobros_bancarios' | 'impulsos_finde' | 'hormiga_frecuente';
  title: string;
  monthlyLossMinor: number;
  recoverableMonthlyMinor: number;
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
 * Radiografía de Fugas con Nombre Propio (últimos 30 días):
 * 1) Recargos ocultos en apps de domicilio
 * 2) Cobros bancarios e impuestos evitables (cuota manejo, 4x1000, seguros)
 * 3) Picos de gasto nocturno / viernes-sábado
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

  // 1. Sobrecosto en apps de domicilio (~26 % entre envío, tarifa de servicio y sobreprecio de carta)
  const deliveryTxs = recent.filter((t) => DELIVERY_APPS_RE.test(t.description));
  if (deliveryTxs.length >= 2) {
    const grossMinor = deliveryTxs.reduce((s, t) => s + Math.abs(t.amountMinor), 0);
    const hiddenFeesMinor = deliveryTxs.reduce(
      (s, t) => s + Math.max(6_500_00, Math.round(Math.abs(t.amountMinor) * 0.26)),
      0,
    );
    const grossFormatted = cop(grossMinor);
    leaks.push({
      id: 'sobrecosto_domicilios',
      title: 'Recargos ocultos en apps de domicilio',
      monthlyLossMinor: hiddenFeesMinor,
      recoverableMonthlyMinor: Math.round(hiddenFeesMinor * 0.65),
      evidence: `${deliveryTxs.length} pedidos en los últimos 30 días (gasto total pagado en apps: ${grossFormatted}).`,
      concreteAction:
        'Cambiando la mitad de tus pedidos a locales independientes a menos de 4 cuadras te ahorras envío, tarifa de servicio y sobreprecio de menú.',
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
        title: 'Cuotas bancarias, 4x1000 o seguros evitables',
        monthlyLossMinor: feesMinor,
        recoverableMonthlyMinor: Math.round(feesMinor * 0.8),
        evidence: `${bankFeeTxs.length} cobros financieros detectados este mes (${identifyMerchant(bankFeeTxs[0]!.description, input.overrides).name}).`,
        concreteAction:
          'Marca tu cuenta principal como exenta del 4x1000 en la app de tu banco y pide exoneración de cuota de manejo o cambia a plan $0.',
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
      id: 'impulsos_finde',
      title: 'Pico de gasto en noches y viernes–sábado',
      monthlyLossMinor: weekendNightMinor,
      recoverableMonthlyMinor: Math.round(weekendNightMinor * 0.3),
      evidence: `${weekendNightCount} compras concentradas en viernes, sábado o después de las 7:00 p. m.`,
      concreteAction:
        'Pon un tope previo antes del viernes a las 6:00 p. m. en ¿Puedo? y aprovecha ofertas de tarde en tu cuadra antes de la hora pico.',
      neighborhoodCategory: 'comida',
    });
  }

  return leaks.sort((a, b) => b.recoverableMonthlyMinor - a.recoverableMonthlyMinor);
}
