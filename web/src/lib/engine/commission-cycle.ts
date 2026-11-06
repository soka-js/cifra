/**
 * Motor de Liquidación y Cortes Consolidados de Comisiones CIFRA (B2B).
 *
 * Implementa la recomendación crítica de Karol Benavides (Head Fiskil Latam, ex-Belvo):
 * - Elimina la fricción de micro-cobros por venta individual ($900 cada vez) que causan
 *   deserción del tendero y fuga de ingresos para CIFRA.
 * - Centraliza las ventas con código CIFRA en un corte quincenal consolidado (1.ª quincena: 1-15,
 *   2.ª quincena: 16-fin de mes) con 5 días de gracia para liquidar.
 * - Aplica política de protección mutua: si un corte supera los 5 días de gracia en mora,
 *   las ofertas relámpago se pausan preventivamente para garantizar el recaudo de CIFRA
 *   sin generar deudas descontroladas para el micronegocio.
 */

import { addDays, daysBetween, daysInMonth, shortDate, todayInBogota } from './dates';
import { cop } from '../format';

export type CycleStatus = 'al_dia' | 'pendiente_pago' | 'en_verificacion' | 'en_mora';

export interface CommissionCycleBounds {
  cycleId: string;
  cycleType: 'quincenal' | 'mensual';
  label: string;
  monthIso: string;
  startDate: string;
  cutDate: string;
  graceDueDate: string;
  daysUntilCut: number;
  isCutClosed: boolean;
}

export interface CycleSummary {
  salesCount: number;
  grossSalesMinor: number;
  discountsGrantedMinor: number;
  collectedInCashMinor: number;
  accumulatedCommissionMinor: number;
  merchantNetKeepMinor: number;
  averageTicketMinor: number;
}

export interface MerchantBillingHealth {
  status: CycleStatus;
  statusLabel: string;
  canPublishOffers: boolean;
  lockReason: string | null;
  overdueAmountMinor: number;
  pendingAmountMinor: number;
  graceDaysRemaining: number;
  activeCycle: CommissionCycleBounds;
}

const MONTH_NAMES_FULL: Record<string, string> = {
  '01': 'enero',
  '02': 'febrero',
  '03': 'marzo',
  '04': 'abril',
  '05': 'mayo',
  '06': 'junio',
  '07': 'julio',
  '08': 'agosto',
  '09': 'septiembre',
  '10': 'octubre',
  '11': 'noviembre',
  '12': 'diciembre',
};

/**
 * Calcula los límites exactos del ciclo quincenal en curso para una fecha dada (por defecto hoy en Bogotá).
 */
export function getCurrentCommissionCycle(referenceIso: string = todayInBogota()): CommissionCycleBounds {
  const [yStr, mStr, dStr] = referenceIso.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);

  const monthIso = `${yStr}-${mStr}`;
  const monthName = MONTH_NAMES_FULL[mStr!] ?? mStr;
  const lastDay = daysInMonth(year, month);

  const isFirstHalf = day <= 15;
  const cycleId = isFirstHalf ? `${monthIso}-Q1` : `${monthIso}-Q2`;
  const label = isFirstHalf
    ? `1.ª Quincena de ${monthName} ${year} (1 - 15 ${shortDate(`${monthIso}-15`).split(' ')[1]})`
    : `2.ª Quincena de ${monthName} ${year} (16 - ${lastDay} ${shortDate(`${monthIso}-${lastDay}`).split(' ')[1]})`;

  const startDate = isFirstHalf ? `${monthIso}-01` : `${monthIso}-16`;
  const cutDate = isFirstHalf ? `${monthIso}-15` : `${monthIso}-${String(lastDay).padStart(2, '0')}`;
  const graceDueDate = addDays(cutDate, 5);

  const daysUntilCut = Math.max(0, daysBetween(referenceIso, cutDate));
  const isCutClosed = referenceIso > cutDate;

  return {
    cycleId,
    cycleType: 'quincenal',
    label,
    monthIso,
    startDate,
    cutDate,
    graceDueDate,
    daysUntilCut,
    isCutClosed,
  };
}

/**
 * Calcula el resumen acumulado en centavos a partir de una lista de redenciones atribuidas.
 */
export function computeCycleSummary(
  redemptionsList: Array<{
    grossAmountMinor: number;
    discountMinor: number;
    netPaidByUserMinor: number;
    cifraCommissionMinor: number;
    merchantNetKeepMinor: number;
  }>,
): CycleSummary {
  const salesCount = redemptionsList.length;
  const grossSalesMinor = redemptionsList.reduce((acc, r) => acc + (r.grossAmountMinor || 0), 0);
  const discountsGrantedMinor = redemptionsList.reduce((acc, r) => acc + (r.discountMinor || 0), 0);
  const collectedInCashMinor = redemptionsList.reduce((acc, r) => acc + (r.netPaidByUserMinor || 0), 0);
  const accumulatedCommissionMinor = redemptionsList.reduce((acc, r) => acc + (r.cifraCommissionMinor || 0), 0);
  const merchantNetKeepMinor = redemptionsList.reduce((acc, r) => acc + (r.merchantNetKeepMinor || 0), 0);
  const averageTicketMinor = salesCount > 0 ? Math.round(collectedInCashMinor / salesCount) : 0;

  return {
    salesCount,
    grossSalesMinor,
    discountsGrantedMinor,
    collectedInCashMinor,
    accumulatedCommissionMinor,
    merchantNetKeepMinor,
    averageTicketMinor,
  };
}

export interface InvoiceLike {
  id: string;
  periodMonth: string;
  dueOn: string | null;
  commissionTotalMinor: number;
  status: string;
}

/**
 * Evalúa la salud financiera del negocio frente a CIFRA (morosidad, gracia, recaudo garantizado).
 * Si hay un corte vencido > 5 días, activa la pausa preventiva de ofertas para asegurar que CIFRA reciba el pago.
 */
export function evaluateMerchantBillingHealth(
  invoices: InvoiceLike[],
  referenceIso: string = todayInBogota(),
): MerchantBillingHealth {
  const activeCycle = getCurrentCommissionCycle(referenceIso);

  let overdueAmountMinor = 0;
  let pendingAmountMinor = 0;
  let hasInVerification = false;
  let minGraceDaysRemaining = 999;

  for (const inv of invoices) {
    if (inv.status === 'pagada' || inv.status === 'anulada') {
      continue;
    }

    if (inv.status === 'en_verificacion') {
      hasInVerification = true;
      continue;
    }

    if (inv.commissionTotalMinor <= 0) {
      continue;
    }

    const dueDate = inv.dueOn || addDays(inv.periodMonth + '-28', 5);
    const diff = daysBetween(referenceIso, dueDate);

    if (diff < 0) {
      // Pasó la fecha límite de gracia (mora)
      overdueAmountMinor += inv.commissionTotalMinor;
    } else {
      // Dentro del periodo de gracia
      pendingAmountMinor += inv.commissionTotalMinor;
      if (diff < minGraceDaysRemaining) {
        minGraceDaysRemaining = diff;
      }
    }
  }

  if (overdueAmountMinor > 0) {
    return {
      status: 'en_mora',
      statusLabel: 'Corte vencido — Pausa preventiva',
      canPublishOffers: false,
      lockReason: `Tienes un corte de comisión pendiente por ${cop(overdueAmountMinor)} con más de 5 días de vencimiento. Para cuidar las cuentas claras de tu negocio y de CIFRA, la emisión de nuevas ofertas está en pausa hasta reportar el comprobante de liquidación.`,
      overdueAmountMinor,
      pendingAmountMinor,
      graceDaysRemaining: 0,
      activeCycle,
    };
  }

  if (hasInVerification && pendingAmountMinor === 0) {
    return {
      status: 'en_verificacion',
      statusLabel: 'Comprobante en verificación',
      canPublishOffers: true,
      lockReason: null,
      overdueAmountMinor: 0,
      pendingAmountMinor: 0,
      graceDaysRemaining: minGraceDaysRemaining === 999 ? 5 : minGraceDaysRemaining,
      activeCycle,
    };
  }

  if (pendingAmountMinor > 0) {
    return {
      status: 'pendiente_pago',
      statusLabel: 'Corte por liquidar (Periodo de gracia)',
      canPublishOffers: true,
      lockReason: null,
      overdueAmountMinor: 0,
      pendingAmountMinor,
      graceDaysRemaining: minGraceDaysRemaining === 999 ? 5 : minGraceDaysRemaining,
      activeCycle,
    };
  }

  return {
    status: 'al_dia',
    statusLabel: 'Al día',
    canPublishOffers: true,
    lockReason: null,
    overdueAmountMinor: 0,
    pendingAmountMinor: 0,
    graceDaysRemaining: 5,
    activeCycle,
  };
}

/**
 * Política oficial de recaudo para el tendero (tranquilidad operativa).
 */
export const COMMISSION_POLICY = {
  feePercent: 5,
  model: 'Corte consolidado quincenal',
  guaranteeText:
    'Cero cobros sorpresa y cero micro-pagos por cliente: No te cobramos $900 tras cada venta ni tienes que sacar tu celular cada vez que atiendes a alguien. Todo se acumula en un solo corte quincenal consolidado con 5 días calendario de gracia para liquidar por Bre-B, Nequi o débito automático.',
  delinquencyRule:
    'Protección mutua de recaudo: si un corte acumulado supera 5 días calendario de mora, las ofertas relámpago se pausan de forma preventiva para que no acumules cobros pendientes. Al registrar tu liquidación por Bre-B o Nequi, tus ofertas vuelven a activarse al instante.',
};
