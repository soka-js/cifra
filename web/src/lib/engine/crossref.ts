import { computeRedemptionSplit } from './attribution';
import { categoryOf, type UserCategoryOverride } from './merchant';
import { splitInternalTransfers } from './transfers';
import type { RawTx } from './types';

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type TimeBand = 'manana' | 'almuerzo' | 'tarde' | 'noche';
export type MapTimeFilter = 'ahora' | 'todas' | TimeBand;

export const TIME_BAND_META: Record<TimeBand, { label: string; shortLabel: string; startHour: number; endHour: number }> = {
  manana: { label: 'Mañana (6 a. m. – 11 a. m.)', shortLabel: 'Mañana', startHour: 6, endHour: 11 },
  almuerzo: { label: 'Mediodía (11 a. m. – 3 p. m.)', shortLabel: 'Mediodía', startHour: 11, endHour: 15 },
  tarde: { label: 'Tarde (3 p. m. – 7 p. m.)', shortLabel: 'Tarde', startHour: 15, endHour: 19 },
  noche: { label: 'Noche (7 p. m. – 11 p. m.)', shortLabel: 'Noche', startHour: 19, endHour: 23 },
};

export function hourToTimeBand(hour: number): TimeBand {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 6 && h < 11) return 'manana';
  if (h >= 11 && h < 15) return 'almuerzo';
  if (h >= 15 && h < 19) return 'tarde';
  return 'noche';
}

export interface CategoryHabit {
  category: string;
  txCount: number;
  totalSpentMinor: number;
  avgTicketMinor: number;
  bandCounts: Record<TimeBand, number>;
  dominantBand: TimeBand;
}

export interface UserConsumptionProfile {
  byCategory: Record<string, CategoryHabit>;
  topCategories: string[];
}

export interface ProfileInputTx extends RawTx {
  spentHour?: number | null;
}

function inferBandFromDescription(description: string, spentHour?: number | null): TimeBand {
  if (spentHour !== null && spentHour !== undefined && Number.isFinite(spentHour)) {
    return hourToTimeBand(spentHour);
  }
  const upper = description.toUpperCase();
  if (/\b(PANADERIA|CAFE|TOSTAO|JUAN VALDEZ|STARBUCKS|DESAYUNO)\b/.test(upper)) return 'manana';
  if (/\b(CORRIENTAZO|ALMUERZO|CREPES|WOK|FRISBY|SUBWAY|EL CORRAL)\b/.test(upper)) return 'almuerzo';
  if (/\b(RAPPI|DIDI FOOD|UBER EATS|PIZZA|BAR|CINE)\b/.test(upper)) return 'noche';
  return 'tarde';
}

/**
 * Construye el perfil real de consumo del usuario (categorías + ticket promedio + franjas horarias habituales)
 * exclusivamente a partir de sus movimientos locales, sin compartir nada con comercios.
 */
export function buildUserConsumptionProfile(
  txs: ProfileInputTx[],
  overrides?: Record<string, UserCategoryOverride>,
): UserConsumptionProfile {
  const hourLookup = new Map<string, number | null>();
  for (const t of txs) {
    hourLookup.set(`${t.postedOn}:${t.amountMinor}:${t.description}`, t.spentHour ?? null);
  }

  const { external: clean } = splitInternalTransfers(txs);
  const byCategory: Record<string, CategoryHabit> = {};

  for (const t of clean) {
    if (t.amountMinor >= 0) continue;
    const cat = categoryOf(t.description, t.amountMinor, overrides);
    if (['pagos_tarjeta', 'transferencias', 'efectivo', 'ingresos'].includes(cat)) continue;

    const abs = Math.abs(t.amountMinor);
    const hr = hourLookup.get(`${t.postedOn}:${t.amountMinor}:${t.description}`);
    const band = inferBandFromDescription(t.description, hr);

    const existing = byCategory[cat] ?? {
      category: cat,
      txCount: 0,
      totalSpentMinor: 0,
      avgTicketMinor: 0,
      bandCounts: { manana: 0, almuerzo: 0, tarde: 0, noche: 0 },
      dominantBand: band,
    };

    existing.txCount += 1;
    existing.totalSpentMinor += abs;
    existing.bandCounts[band] += 1;
    byCategory[cat] = existing;
  }

  for (const h of Object.values(byCategory)) {
    h.avgTicketMinor = Math.round(h.totalSpentMinor / Math.max(1, h.txCount));
    const bands: TimeBand[] = ['manana', 'almuerzo', 'tarde', 'noche'];
    h.dominantBand = bands.reduce((best, b) => (h.bandCounts[b] > h.bandCounts[best] ? b : best), 'almuerzo' as TimeBand);
  }

  const topCategories = Object.values(byCategory)
    .sort((a, b) => b.totalSpentMinor - a.totalSpentMinor)
    .map((c) => c.category);

  return { byCategory, topCategories };
}

export interface SmartMapOfferInput {
  offerId: string;
  merchantId: string;
  merchantSlug: string;
  merchantName: string;
  businessCategory: string;
  neighborhood: string;
  address: string;
  hoursText: string | null;
  lat: number;
  lng: number;
  typicalTicketMinor: number;
  title: string;
  description: string | null;
  targetCategory: string;
  discountKind: 'percent' | 'fixed';
  discountPercent: number | null;
  discountFixedMinor: number | null;
  minPurchaseMinor: number;
  isFlash: boolean;
  startHour: number | null;
  endHour: number | null;
  activeDays: number[];
  stockLimit: number | null;
  stockRemaining: number | null;
  activeHoursText: string | null;
  estimatedSavingsMinor: number;
  newCustomersOnly: boolean;
}

export interface CrossReferencedOffer extends SmartMapOfferInput {
  distanceMeters: number | null;
  walkMinutes: number | null;
  isActiveNow: boolean;
  activeBands: TimeBand[];
  windowLabel: string;
  habitMatched: boolean;
  habitTimeMatched: boolean;
  userAvgTicketMinor: number | null;
  vsHabitualSavingsMinor: number;
  crossScore: number;
  whyThisMatches: string;
}

export function isHourWithinWindow(hour: number, startHour: number | null, endHour: number | null): boolean {
  if (startHour === null || endHour === null) return true;
  const h = ((hour % 24) + 24) % 24;
  if (startHour <= endHour) {
    return h >= startHour && h < endHour;
  }
  // Ventana que cruza medianoche (ej. 20 a 2)
  return h >= startHour || h < endHour;
}

function formatHour12(h: number): string {
  const norm = ((h % 24) + 24) % 24;
  if (norm === 0) return '12:00 a. m.';
  if (norm === 12) return '12:00 m.';
  if (norm < 12) return `${norm}:00 a. m.`;
  return `${norm - 12}:00 p. m.`;
}

function bandsForOffer(startHour: number | null, endHour: number | null): TimeBand[] {
  if (startHour === null || endHour === null) {
    return ['manana', 'almuerzo', 'tarde', 'noche'];
  }
  const bands: TimeBand[] = [];
  for (const [band, meta] of Object.entries(TIME_BAND_META) as Array<[TimeBand, (typeof TIME_BAND_META)[TimeBand]]>) {
    for (let h = meta.startHour; h < meta.endHour; h++) {
      if (isHourWithinWindow(h, startHour, endHour)) {
        bands.push(band);
        break;
      }
    }
  }
  return bands.length > 0 ? bands : ['tarde'];
}

/**
 * Cruza gastos reales del usuario × cercanía GPS × franja horaria activa × cupos relámpago.
 */
export function crossReferenceOffers(params: {
  offers: SmartMapOfferInput[];
  profile: UserConsumptionProfile;
  userLat: number | null;
  userLng: number | null;
  currentHour: number;
  dayOfWeek: number;
  filter: MapTimeFilter;
  categoryFilter?: string | null;
}): CrossReferencedOffer[] {
  const currentBand = hourToTimeBand(params.currentHour);
  const results: CrossReferencedOffer[] = [];

  for (const offer of params.offers) {
    if (params.categoryFilter && offer.targetCategory !== params.categoryFilter) continue;
    if (offer.stockRemaining !== null && offer.stockRemaining <= 0) continue;

    const dayAllowed =
      !offer.activeDays || offer.activeDays.length === 0 || offer.activeDays.includes(params.dayOfWeek);
    const inHourNow = isHourWithinWindow(params.currentHour, offer.startHour, offer.endHour);
    const isActiveNow = dayAllowed && inHourNow;
    const activeBands = bandsForOffer(offer.startHour, offer.endHour);

    if (params.filter === 'ahora' && !isActiveNow) continue;
    if (
      params.filter !== 'ahora' &&
      params.filter !== 'todas' &&
      !activeBands.includes(params.filter)
    ) {
      continue;
    }

    const distanceMeters =
      params.userLat !== null && params.userLng !== null
        ? Math.round(haversineMeters(params.userLat, params.userLng, offer.lat, offer.lng))
        : null;
    const walkMinutes = distanceMeters !== null ? Math.max(1, Math.round(distanceMeters / 78)) : null;

    const habit = params.profile.byCategory[offer.targetCategory];
    const habitMatched = Boolean(habit && habit.txCount >= 1);
    const targetBandForCheck =
      params.filter !== 'ahora' && params.filter !== 'todas' ? params.filter : currentBand;
    const habitTimeMatched = Boolean(habit && habit.bandCounts[targetBandForCheck] >= 1);

    const netOfferTicket = Math.max(0, offer.typicalTicketMinor - offer.estimatedSavingsMinor);
    const comparableHabitTicket = habit
      ? Math.min(habit.avgTicketMinor, Math.round(offer.typicalTicketMinor * 1.45))
      : 0;
    const vsHabitualSavingsMinor =
      comparableHabitTicket > netOfferTicket
        ? Math.max(offer.estimatedSavingsMinor, comparableHabitTicket - netOfferTicket)
        : offer.estimatedSavingsMinor;

    // Puntaje compuesto 0..100
    let score = 20;
    if (isActiveNow) score += 20;
    if (offer.isFlash && isActiveNow) score += 18;
    if (habitMatched) score += 20;
    if (habitTimeMatched) score += 12;
    if (distanceMeters !== null) {
      if (distanceMeters <= 400) score += 20;
      else if (distanceMeters <= 1200) score += 14;
      else if (distanceMeters <= 2500) score += 7;
    }
    score = Math.min(100, score);

    const windowLabel =
      offer.startHour !== null && offer.endHour !== null
        ? `${formatHour12(offer.startHour)} – ${formatHour12(offer.endHour)}`
        : offer.activeHoursText || 'Todo el día en horario del local';

    const reasons: string[] = [];
    if (offer.isFlash && isActiveNow) {
      reasons.push(
        offer.stockRemaining !== null
          ? `Oferta por horas activa (${offer.stockRemaining} cupos hoy)`
          : 'Oferta por horas activa ahora',
      );
    }
    if (habitMatched && habit) {
      reasons.push(
        habitTimeMatched
          ? `Cruza con tus compras habituales de ${TIME_BAND_META[targetBandForCheck].shortLabel.toLowerCase()}`
          : `Categoría donde sueles gastar (${habit.txCount} compras recientes)`,
      );
    }
    if (walkMinutes !== null && distanceMeters !== null && distanceMeters <= 2500) {
      reasons.push(`A ${walkMinutes} min caminando (${distanceMeters} m)`);
    }

    results.push({
      ...offer,
      distanceMeters,
      walkMinutes,
      isActiveNow,
      activeBands,
      windowLabel,
      habitMatched,
      habitTimeMatched,
      userAvgTicketMinor: habit?.avgTicketMinor ?? null,
      vsHabitualSavingsMinor,
      crossScore: score,
      whyThisMatches: reasons.join(' · ') || 'Comercio independiente de tu zona',
    });
  }

  return results.sort((a, b) => {
    if (b.crossScore !== a.crossScore) return b.crossScore - a.crossScore;
    if (a.distanceMeters !== null && b.distanceMeters !== null) {
      return a.distanceMeters - b.distanceMeters;
    }
    return b.vsHabitualSavingsMinor - a.vsHabitualSavingsMinor;
  });
}

// ---------------------------------------------------------------------------
// Herramientas de valor Día 1 para el Tendero: Margen Honesto y Punto de Equilibrio
// ---------------------------------------------------------------------------

export interface HonestMarginResult {
  regularPriceMinor: number;
  unitCostMinor: number;
  regularProfitMinor: number;
  /** Venta por la app de domicilios del tendero, con la comisión que él escribe (0 si no la escribe). */
  deliveryAppCommissionMinor: number;
  deliveryAppProfitMinor: number;
  /** Primera visita con oferta CIFRA (descuento al vecino + 5 % sobre lo cobrado). */
  cifraCustomerPaysMinor: number;
  cifraCommissionMinor: number;
  cifraNetInRegisterMinor: number;
  cifraFirstVisitProfitMinor: number;
  /** Segunda visita cuando el vecino regresa sin descuento ni comisión. */
  cifraRepeatVisitProfitMinor: number;
  repeatOrganicProfitMinor: number;
  /** Diferencia limpia frente a vender por app de domicilios en la primera visita. */
  advantageVsAppMinor: number;
  advantageVsDeliveryMinor: number;
  isLosingMoney: boolean;
}

export function computeHonestMerchantMargin(input: {
  regularPriceMinor?: number;
  salePriceMinor?: number;
  unitCostMinor: number;
  discountKind: 'percent' | 'fixed';
  discountPercent?: number | null;
  discountFixedMinor?: number | null;
  commissionBps?: number;
  deliveryAppCommissionPct?: number;
}): HonestMarginResult {
  const price = Math.max(0, Math.round(input.regularPriceMinor ?? input.salePriceMinor ?? 0));
  const cost = Math.max(0, Math.round(input.unitCostMinor));
  // La comisión de la app la escribe el tendero; si no la escribe, no se supone ninguna.
  const appPct = input.deliveryAppCommissionPct ?? 0;

  const split = computeRedemptionSplit({
    grossAmountMinor: price,
    discountKind: input.discountKind,
    discountPercent: input.discountPercent,
    discountFixedMinor: input.discountFixedMinor,
    commissionBps: input.commissionBps ?? 500,
    channel: 'propio',
  });

  const regularProfitMinor = price - cost;
  const deliveryAppCommissionMinor = Math.round((price * appPct) / 100);
  const deliveryAppProfitMinor = price - deliveryAppCommissionMinor - cost;

  const cifraFirstVisitProfitMinor = split.merchantNetKeepMinor - cost;
  const cifraRepeatVisitProfitMinor = regularProfitMinor;
  const advantageVsApp = cifraFirstVisitProfitMinor - deliveryAppProfitMinor;

  return {
    regularPriceMinor: price,
    unitCostMinor: cost,
    regularProfitMinor,
    deliveryAppCommissionMinor,
    deliveryAppProfitMinor,
    cifraCustomerPaysMinor: split.netPaidByUserMinor,
    cifraCommissionMinor: split.cifraCommissionMinor,
    cifraNetInRegisterMinor: split.merchantNetKeepMinor,
    cifraFirstVisitProfitMinor,
    cifraRepeatVisitProfitMinor,
    repeatOrganicProfitMinor: regularProfitMinor,
    advantageVsAppMinor: advantageVsApp,
    advantageVsDeliveryMinor: advantageVsApp,
    isLosingMoney: cifraFirstVisitProfitMinor < 0,
  };
}

export interface LedgerEntryInput {
  entryOn: string;
  kind: string;
  categoryLabel: string;
  supplierName?: string | null;
  amountMinor: number;
}

export interface SupplyCostAlert {
  categoryLabel: string;
  supplierName: string | null;
  currentMonthMinor: number;
  previousMonthMinor: number;
  increasePct: number;
  // Aliases para UI de Cuadre:
  recent30dMinor: number;
  prev30dMinor: number;
  deltaPct: number;
}

export interface MerchantBreakEvenSummary {
  /** La meta diaria que escribió el tendero; null mientras no la escriba (y entonces no hay avance ni brecha). */
  dailyBreakEvenMinor: number | null;
  todaySalesMinor: number;
  todayCifraSalesMinor: number;
  todayCounterSalesMinor: number;
  todayExpensesMinor: number;
  todaySuppliesMinor: number;
  gapTodayMinor: number;
  gapToBreakEvenMinor: number;
  todayProgressPct: number;
  progressPct: number;
  reachedBreakEven: boolean;
  needsFlashBoost: boolean;
  monthSalesMinor: number;
  monthSuppliesMinor: number;
  monthFixedExpensesMinor: number;
  monthNetOperatingMinor: number;
  monthOperatingMarginMinor: number;
  supplyAlerts: SupplyCostAlert[];
  supplyInflationAlerts: SupplyCostAlert[];
}

export function computeMerchantBreakEven(input: {
  today: string;
  dailyBreakEvenMinor: number | null;
  entries: LedgerEntryInput[];
}): MerchantBreakEvenSummary {
  const monthPrefix = input.today.slice(0, 7);
  const [yStr, mStr] = monthPrefix.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const prevPrefix =
    m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;

  let todaySalesMinor = 0;
  let todayCifraSalesMinor = 0;
  let todayExpensesMinor = 0;
  let todaySuppliesMinor = 0;

  let monthSalesMinor = 0;
  let monthSuppliesMinor = 0;
  let monthFixedExpensesMinor = 0;

  const currSupplyByCat = new Map<string, { total: number; supplier: string | null }>();
  const prevSupplyByCat = new Map<string, number>();

  for (const e of input.entries) {
    const amt = Math.max(0, e.amountMinor);
    const isSale = e.kind === 'venta_mostrador' || e.kind === 'venta_cifra';

    if (e.entryOn === input.today) {
      if (isSale) {
        todaySalesMinor += amt;
        if (e.kind === 'venta_cifra') todayCifraSalesMinor += amt;
      } else {
        todayExpensesMinor += amt;
        if (e.kind === 'insumos') {
          todaySuppliesMinor += amt;
        }
      }
    }

    if (e.entryOn.startsWith(monthPrefix)) {
      if (isSale) {
        monthSalesMinor += amt;
      } else if (e.kind === 'insumos') {
        monthSuppliesMinor += amt;
        const key = e.categoryLabel.trim();
        const cur = currSupplyByCat.get(key) ?? { total: 0, supplier: e.supplierName ?? null };
        cur.total += amt;
        if (!cur.supplier && e.supplierName) cur.supplier = e.supplierName;
        currSupplyByCat.set(key, cur);
      } else {
        monthFixedExpensesMinor += amt;
      }
    } else if (e.entryOn.startsWith(prevPrefix) && e.kind === 'insumos') {
      const key = e.categoryLabel.trim();
      prevSupplyByCat.set(key, (prevSupplyByCat.get(key) ?? 0) + amt);
    }
  }

  // Sin meta escrita por el tendero no hay brecha ni porcentaje: no se inventa una meta.
  const target = input.dailyBreakEvenMinor && input.dailyBreakEvenMinor > 0 ? input.dailyBreakEvenMinor : null;
  const gapTodayMinor = target === null ? 0 : Math.max(0, target - todaySalesMinor);
  const todayProgressPct = target === null ? 0 : Math.min(150, Math.round((todaySalesMinor / target) * 100));
  const reachedBreakEven = target !== null && todaySalesMinor >= target;
  const todayCounterSalesMinor = Math.max(0, todaySalesMinor - todayCifraSalesMinor);

  const supplyAlerts: SupplyCostAlert[] = [];
  for (const [cat, cur] of currSupplyByCat.entries()) {
    const prev = prevSupplyByCat.get(cat) ?? 0;
    if (prev >= 20_000_00 && cur.total > prev * 1.12) {
      const incPct = Math.round(((cur.total - prev) / prev) * 100);
      supplyAlerts.push({
        categoryLabel: cat,
        supplierName: cur.supplier,
        currentMonthMinor: cur.total,
        previousMonthMinor: prev,
        increasePct: incPct,
        recent30dMinor: cur.total,
        prev30dMinor: prev,
        deltaPct: incPct,
      });
    }
  }
  supplyAlerts.sort((a, b) => b.increasePct - a.increasePct);

  const monthOperatingMarginMinor = monthSalesMinor - monthSuppliesMinor - monthFixedExpensesMinor;

  return {
    dailyBreakEvenMinor: target,
    todaySalesMinor,
    todayCifraSalesMinor,
    todayCounterSalesMinor,
    todayExpensesMinor,
    todaySuppliesMinor,
    gapTodayMinor,
    gapToBreakEvenMinor: gapTodayMinor,
    todayProgressPct,
    progressPct: todayProgressPct,
    reachedBreakEven,
    needsFlashBoost: gapTodayMinor > 0,
    monthSalesMinor,
    monthSuppliesMinor,
    monthFixedExpensesMinor,
    monthNetOperatingMinor: monthOperatingMarginMinor,
    monthOperatingMarginMinor,
    supplyAlerts,
    supplyInflationAlerts: supplyAlerts,
  };
}
