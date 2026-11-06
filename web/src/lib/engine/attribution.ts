import { daysBetween } from './dates';
import { cleanDescription, stripAccents, type Category } from './merchant';
import type { Tx } from './types';
import { distanceKm, formatDistance } from '../zones';

/** Alfabeto sin caracteres ambiguos (sin 0, O, 1, I, L) para dictar o digitar fácil en mostrador. */
const SAFE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateRedemptionCode(length = 6, randomBytes?: Uint8Array): string {
  const bytes = randomBytes ?? crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SAFE_ALPHABET[bytes[i]! % SAFE_ALPHABET.length];
  }
  return out;
}

export interface SplitInput {
  grossAmountMinor: number;
  discountKind: 'percent' | 'fixed';
  discountPercent?: number | null;
  discountFixedMinor?: number | null;
  maxDiscountMinor?: number | null;
  minPurchaseMinor?: number;
  /** Comisión de CIFRA en puntos básicos (500 = 5,00 % sobre el valor cobrado en caja, según G.10 y J.3). */
  commissionBps?: number;
  channel?: 'propio' | 'aliado';
  /** Reparto al aliado en puntos básicos (3000 = 30,00 % de la comisión de CIFRA, según J.3). */
  partnerShareBps?: number;
}

export interface RedemptionSplit {
  eligibleByAmount: boolean;
  grossAmountMinor: number;
  discountMinor: number;
  netPaidByUserMinor: number;
  commissionBps: number;
  cifraCommissionMinor: number;
  partnerShareMinor: number;
  cifraNetRevenueMinor: number;
  merchantNetKeepMinor: number;
  /** Costo total de adquirir el cliente = descuento + comisión ($2.900 sobre $20.000 en G.10). */
  totalMerchantCacMinor: number;
  /** Costo de adquisición expresado como % del ticket original (14,5 % en el ejemplo de G.10). */
  effectiveCacPercent: number;
}

/**
 * Calcula al centavo el reparto exacto de una venta atribuida según G.10 y J.3:
 * Ejemplo de referencia del documento:
 * - Ticket original: $20.000
 * - Descuento negocio (10 %): $2.000 -> Persona paga $18.000
 * - Comisión CIFRA (5 % de $18.000): $900 -> Negocio conserva $17.100
 * - Costo total de adquirir ese cliente: $2.900 (14,5 % del ticket original), pagado después de vender.
 * - Si viene por canal aliado B2B2C: aliado recibe 30 % de $900 = $270; CIFRA conserva $630.
 */
export function computeRedemptionSplit(input: SplitInput): RedemptionSplit {
  const gross = Math.max(0, Math.round(input.grossAmountMinor));
  const minPurchase = Math.max(0, input.minPurchaseMinor ?? 0);
  const commissionBps = input.commissionBps ?? 500;
  const channel = input.channel ?? 'propio';
  const partnerShareBps = input.partnerShareBps ?? 3000;

  if (gross < minPurchase || gross === 0) {
    return {
      eligibleByAmount: false,
      grossAmountMinor: gross,
      discountMinor: 0,
      netPaidByUserMinor: gross,
      commissionBps,
      cifraCommissionMinor: 0,
      partnerShareMinor: 0,
      cifraNetRevenueMinor: 0,
      merchantNetKeepMinor: gross,
      totalMerchantCacMinor: 0,
      effectiveCacPercent: 0,
    };
  }

  let rawDiscount = 0;
  if (input.discountKind === 'percent') {
    const pct = Math.max(0, Math.min(90, input.discountPercent ?? 0));
    rawDiscount = Math.round((gross * pct) / 100);
  } else {
    rawDiscount = Math.max(0, input.discountFixedMinor ?? 0);
  }

  if (input.maxDiscountMinor && input.maxDiscountMinor > 0) {
    rawDiscount = Math.min(rawDiscount, input.maxDiscountMinor);
  }
  const discountMinor = Math.min(gross, rawDiscount);
  const netPaidByUserMinor = gross - discountMinor;
  const cifraCommissionMinor = Math.round((netPaidByUserMinor * commissionBps) / 10_000);
  const partnerShareMinor =
    channel === 'aliado' ? Math.round((cifraCommissionMinor * partnerShareBps) / 10_000) : 0;
  const cifraNetRevenueMinor = cifraCommissionMinor - partnerShareMinor;
  const merchantNetKeepMinor = netPaidByUserMinor - cifraCommissionMinor;
  const totalMerchantCacMinor = discountMinor + cifraCommissionMinor;
  const effectiveCacPercent = gross > 0 ? Number(((totalMerchantCacMinor / gross) * 100).toFixed(1)) : 0;

  return {
    eligibleByAmount: true,
    grossAmountMinor: gross,
    discountMinor,
    netPaidByUserMinor,
    commissionBps,
    cifraCommissionMinor,
    partnerShareMinor,
    cifraNetRevenueMinor,
    merchantNetKeepMinor,
    totalMerchantCacMinor,
    effectiveCacPercent,
  };
}

export function computeDiscountMinor(input: {
  grossAmountMinor: number;
  discountKind: 'percent' | 'fixed';
  discountPercent?: number | null;
  discountFixedMinor?: number | null;
  maxDiscountMinor?: number | null;
  minPurchaseMinor?: number;
}): number {
  return computeRedemptionSplit(input).discountMinor;
}

/**
 * Hash determinístico FNV-1a (0..99) por par (persona, comercio) para asignar grupos de control (holdout)
 * sin sesgo y de forma consistente entre sesiones (Control de canibalización #2, G.10).
 */
export function holdoutBucket(userId: string, merchantId: string): number {
  const str = `${userId}:${merchantId}`;
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export function isInHoldoutGroup(userId: string, merchantId: string, holdoutPercent: number): boolean {
  if (holdoutPercent <= 0) return false;
  if (holdoutPercent >= 100) return true;
  return holdoutBucket(userId, merchantId) < holdoutPercent;
}

/** Verifica si la descripción de un extracto bancario corresponde a este micronegocio. */
export function matchesMerchantKeywords(description: string, matchKeywords: string[]): boolean {
  if (!matchKeywords.length) return false;
  const norm = stripAccents(description).toUpperCase().replace(/\s+/g, ' ');
  const cleaned = cleanDescription(description);
  for (const kw of matchKeywords) {
    const k = stripAccents(kw).toUpperCase().replace(/\s+/g, ' ').trim();
    if (k.length < 3) continue;
    if (norm.includes(k) || cleaned.includes(k)) return true;
  }
  return false;
}

export interface CandidateOffer {
  id: string;
  merchantId: string;
  merchantName: string;
  merchantSlug: string;
  merchantCategory: string;
  neighborhood: string;
  zoneSlug: string;
  address: string;
  hoursText: string | null;
  lat: number;
  lng: number;
  typicalTicketMinor: number;
  commissionBps: number;
  matchKeywords: string[];
  title: string;
  description: string | null;
  targetCategory: string;
  discountKind: 'percent' | 'fixed';
  discountPercent: number | null;
  discountFixedMinor: number | null;
  maxDiscountMinor: number | null;
  minPurchaseMinor: number;
  newCustomersOnly: boolean;
  exclusivityDays: number;
  holdoutPercent: number;
  monthlyCapRedemptions: number | null;
  monthlyRedemptionsUsed: number;
  validFrom: string;
  validUntil: string;
  activeHoursText: string | null;
}

export interface OfferEligibility {
  eligible: boolean;
  isNewCustomer: boolean;
  inHoldout: boolean;
  reasonIfIneligible?: 'fuera_de_vigencia' | 'cupo_mensual_lleno' | 'grupo_control' | 'ya_cliente_reciente';
}

export function evaluateOfferEligibility(params: {
  today: string;
  userId: string;
  offer: CandidateOffer;
  userTransactions: Tx[];
  priorMerchantRedemptionDates: string[];
  bypassHoldoutForDemo?: boolean;
}): OfferEligibility {
  const { today, userId, offer, userTransactions, priorMerchantRedemptionDates, bypassHoldoutForDemo } = params;

  if (today < offer.validFrom || today > offer.validUntil) {
    return { eligible: false, isNewCustomer: false, inHoldout: false, reasonIfIneligible: 'fuera_de_vigencia' };
  }
  if (offer.monthlyCapRedemptions !== null && offer.monthlyRedemptionsUsed >= offer.monthlyCapRedemptions) {
    return { eligible: false, isNewCustomer: false, inHoldout: false, reasonIfIneligible: 'cupo_mensual_lleno' };
  }

  const recentRedemption = priorMerchantRedemptionDates.some(
    (d) => daysBetween(d, today) >= 0 && daysBetween(d, today) <= offer.exclusivityDays,
  );
  const recentBankPurchase = userTransactions.some(
    (t) =>
      t.amountMinor < 0 &&
      daysBetween(t.postedOn, today) >= 0 &&
      daysBetween(t.postedOn, today) <= offer.exclusivityDays &&
      matchesMerchantKeywords(t.description, offer.matchKeywords),
  );
  const isNewCustomer = !recentRedemption && !recentBankPurchase;

  if (offer.newCustomersOnly && !isNewCustomer) {
    return { eligible: false, isNewCustomer: false, inHoldout: false, reasonIfIneligible: 'ya_cliente_reciente' };
  }

  const inHoldout = !bypassHoldoutForDemo && isInHoldoutGroup(userId, offer.merchantId, offer.holdoutPercent);
  if (inHoldout) {
    return { eligible: false, isNewCustomer, inHoldout: true, reasonIfIneligible: 'grupo_control' };
  }

  return { eligible: true, isNewCustomer, inHoldout: false };
}

export interface RankedOffer {
  offer: CandidateOffer;
  isNewCustomer: boolean;
  distanceKm: number | null;
  distanceLabel: string;
  estimatedSavingsMinor: number;
  categoryMonthlySpendMinor: number;
  whyRelevant: string;
  score: number;
}

/**
 * Ordena y explica las ofertas disponibles para una persona según su patrón real de gasto,
 * cercanía geográfica y ahorro estimado en pesos (G.6: filtrado contextual por patrón y lugar).
 */
export function rankOffersForUser(params: {
  today: string;
  userId: string;
  userLat?: number | null;
  userLng?: number | null;
  userZoneSlug?: string | null;
  spendByCategory30d: Partial<Record<Category, number>>;
  userTransactions: Tx[];
  redemptionsByMerchant: Record<string, string[]>;
  offers: CandidateOffer[];
  bypassHoldoutForDemo?: boolean;
}): RankedOffer[] {
  const ranked: RankedOffer[] = [];
  for (const offer of params.offers) {
    const elig = evaluateOfferEligibility({
      today: params.today,
      userId: params.userId,
      offer,
      userTransactions: params.userTransactions,
      priorMerchantRedemptionDates: params.redemptionsByMerchant[offer.merchantId] ?? [],
      bypassHoldoutForDemo: params.bypassHoldoutForDemo,
    });
    if (!elig.eligible) continue;

    const split = computeRedemptionSplit({
      grossAmountMinor: Math.max(offer.typicalTicketMinor, offer.minPurchaseMinor || 2000000),
      discountKind: offer.discountKind,
      discountPercent: offer.discountPercent,
      discountFixedMinor: offer.discountFixedMinor,
      maxDiscountMinor: offer.maxDiscountMinor,
      minPurchaseMinor: offer.minPurchaseMinor,
      commissionBps: offer.commissionBps,
    });

    const dKm =
      params.userLat != null && params.userLng != null
        ? distanceKm(params.userLat, params.userLng, offer.lat, offer.lng)
        : null;
    const distanceLabel = dKm !== null ? formatDistance(dKm) : offer.neighborhood;
    const catSpend = params.spendByCategory30d[offer.targetCategory as Category] ?? 0;
    const sameZone = params.userZoneSlug ? offer.zoneSlug === params.userZoneSlug : false;

    const reasons: string[] = [];
    if (dKm !== null && dKm <= 2.5) reasons.push(distanceLabel);
    else if (sameZone) reasons.push(`En tu zona (${offer.neighborhood})`);
    else reasons.push(offer.neighborhood);

    if (catSpend >= 50_000_00) {
      reasons.push('Categoría donde ya compras cada mes');
    } else if (elig.isNewCustomer && offer.newCustomersOnly) {
      reasons.push('Beneficio de primera visita');
    }

    // Puntaje: relevancia por hábito de gasto + cercanía + tamaño del ahorro en pesos.
    const proximityBoost = dKm !== null ? Math.max(0, 40 - dKm * 10) : sameZone ? 25 : 8;
    const categoryBoost = Math.min(35, catSpend / 15_000_00);
    const savingsBoost = Math.min(25, split.discountMinor / 2_000_00);
    const score = proximityBoost + categoryBoost + savingsBoost;

    ranked.push({
      offer,
      isNewCustomer: elig.isNewCustomer,
      distanceKm: dKm,
      distanceLabel,
      estimatedSavingsMinor: split.discountMinor,
      categoryMonthlySpendMinor: catSpend,
      whyRelevant: reasons.join(' · '),
      score,
    });
  }

  return ranked.sort((a, b) => b.score - a.score);
}

export interface MerchantRedemptionRecord {
  id: string;
  userId: string;
  redeemedOn: string;
  grossAmountMinor: number;
  discountMinor: number;
  netPaidByUserMinor: number;
  cifraCommissionMinor: number;
  merchantNetKeepMinor: number;
  isNewCustomer: boolean;
}

export interface OrganicVisitObservation {
  userId: string;
  postedOn: string;
  amountMinor: number;
  inHoldout: boolean;
}

export interface MerchantFourMetricsReport {
  periodLabel: string;
  /** Cifra 1 (G.10): Redenciones verificadas con la oferta activa. */
  redemptionsCount: number;
  /** Cifra 2 (G.10): Venta atribuida bruta y neta. */
  grossAttributedSalesMinor: number;
  netCollectedSalesMinor: number;
  merchantNetKeptMinor: number;
  /** Cifra 3 (G.10): Clientes nuevos frente a recurrentes con oferta. */
  newCustomersCount: number;
  repeatOfferCustomersCount: number;
  /** Cifra 4 (G.10): Retorno sin descuento (volvieron a comprar después sin usar oferta). */
  organicReturnCustomersCount: number;
  organicReturnSalesMinor: number;
  /** Costos transparentes para el tendero. */
  discountsGrantedMinor: number;
  cifraCommissionMinor: number;
  totalAcquisitionCostMinor: number;
  averageCostPerNewCustomerMinor: number;
  /** Comparativo contra grupo de control (control de canibalización). */
  holdoutOrganicBuyersCount: number;
  whatsappSummary: string;
}

/**
 * Produce las 4 cifras exactas del informe mensual de una página definido en G.10,
 * incluyendo el retorno sin descuento detectado en extractos posteriores.
 */
export function computeMerchantReport(params: {
  merchantName: string;
  periodLabel: string;
  redemptions: MerchantRedemptionRecord[];
  organicObservations: OrganicVisitObservation[];
  formatMoney: (minor: number) => string;
}): MerchantFourMetricsReport {
  const { merchantName, periodLabel, redemptions, organicObservations, formatMoney } = params;

  const redemptionsCount = redemptions.length;
  const grossAttributedSalesMinor = redemptions.reduce((s, r) => s + r.grossAmountMinor, 0);
  const discountsGrantedMinor = redemptions.reduce((s, r) => s + r.discountMinor, 0);
  const netCollectedSalesMinor = redemptions.reduce((s, r) => s + r.netPaidByUserMinor, 0);
  const cifraCommissionMinor = redemptions.reduce((s, r) => s + r.cifraCommissionMinor, 0);
  const merchantNetKeptMinor = redemptions.reduce((s, r) => s + r.merchantNetKeepMinor, 0);

  const firstRedemptionByUser = new Map<string, string>();
  const newCustomerUsers = new Set<string>();
  const repeatUsers = new Set<string>();

  const sorted = [...redemptions].sort((a, b) => a.redeemedOn.localeCompare(b.redeemedOn));
  for (const r of sorted) {
    if (!firstRedemptionByUser.has(r.userId)) {
      firstRedemptionByUser.set(r.userId, r.redeemedOn);
    }
    if (r.isNewCustomer) newCustomerUsers.add(r.userId);
    else repeatUsers.add(r.userId);
  }

  // Retorno sin descuento: usuarios que primero conocieron el negocio con oferta y volvieron en una fecha posterior sin oferta.
  const organicReturnUsers = new Set<string>();
  let organicReturnSalesMinor = 0;
  const holdoutBuyers = new Set<string>();

  for (const obs of organicObservations) {
    if (obs.inHoldout) {
      holdoutBuyers.add(obs.userId);
      continue;
    }
    const firstRedeem = firstRedemptionByUser.get(obs.userId);
    if (firstRedeem && obs.postedOn > firstRedeem) {
      organicReturnUsers.add(obs.userId);
      organicReturnSalesMinor += Math.abs(obs.amountMinor);
    }
  }

  const newCustomersCount = newCustomerUsers.size;
  const repeatOfferCustomersCount = repeatUsers.size;
  const organicReturnCustomersCount = organicReturnUsers.size;
  const totalAcquisitionCostMinor = discountsGrantedMinor + cifraCommissionMinor;
  const averageCostPerNewCustomerMinor =
    newCustomersCount > 0 ? Math.round(totalAcquisitionCostMinor / newCustomersCount) : 0;

  const whatsappSummary = [
    `*Resumen CIFRA · ${merchantName} (${periodLabel})*`,
    `• Ventas por ofertas CIFRA: *${redemptionsCount}* (${formatMoney(grossAttributedSalesMinor)} en ventas)`,
    `• Clientes nuevos que no te compraban antes: *${newCustomersCount}*`,
    `• Clientes que volvieron después SIN descuento: *${organicReturnCustomersCount}*${organicReturnSalesMinor > 0 ? ` (${formatMoney(organicReturnSalesMinor)} adicionales)` : ''}`,
    `• Te quedaron libres en caja: *${formatMoney(merchantNetKeptMinor)}*`,
    `• Comisión CIFRA (5 % sobre cobro en caja): *${formatMoney(cifraCommissionMinor)}*`,
  ].join('\n');

  return {
    periodLabel,
    redemptionsCount,
    grossAttributedSalesMinor,
    netCollectedSalesMinor,
    merchantNetKeptMinor,
    newCustomersCount,
    repeatOfferCustomersCount,
    organicReturnCustomersCount,
    organicReturnSalesMinor,
    discountsGrantedMinor,
    cifraCommissionMinor,
    totalAcquisitionCostMinor,
    averageCostPerNewCustomerMinor,
    holdoutOrganicBuyersCount: holdoutBuyers.size,
    whatsappSummary,
  };
}
