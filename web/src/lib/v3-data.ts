import 'server-only';
import { and, desc, eq, gt, gte, inArray } from 'drizzle-orm';
import QRCode from 'qrcode';
import { db } from './db';
import {
  accounts,
  dataSources,
  merchantLedgerEntries,
  merchants,
  offerCodes,
  offers,
  paidCycleCharges,
  transactions,
  type Merchant,
  type PaidCycleCharge,
  type User,
} from './db/schema';
import { computeDiscountMinor } from './engine/attribution';
import type { CifraResult } from './engine/cifra';
import {
  buildUserConsumptionProfile,
  computeMerchantBreakEven,
  type MerchantBreakEvenSummary,
  type SmartMapOfferInput,
  type UserConsumptionProfile,
} from './engine/crossref';
import {
  computeDailyPulse,
  detectMoneyLeaks,
  type DailyPulse,
  type MoneyLeakInsight,
} from './engine/daily-value';
import { addDays, todayInBogota } from './engine/dates';
import { flowOf } from './engine/merchant';
import { loadCategoryOverrides } from './ingest';
import { getZoneBySlug } from './zones';

export function currentBogotaHour(d = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(d);
  const hr = Number(parts.find((p) => p.type === 'hour')?.value ?? '12');
  return Number.isFinite(hr) ? hr % 24 : 12;
}

export function currentBogotaDayOfWeek(today = todayInBogota()): number {
  return new Date(`${today}T12:00:00Z`).getUTCDay();
}

export interface PersonaDailyValueBundle {
  pulse: DailyPulse;
  paidCharges: PaidCycleCharge[];
  leaks: MoneyLeakInsight[];
  captureAccounts: Array<{ id: string; name: string; balanceMinor: number | null }>;
}

export async function loadPersonaDailyValueBundle(
  user: User,
  cifra: CifraResult,
): Promise<PersonaDailyValueBundle> {
  const today = todayInBogota();
  const since60 = addDays(today, -60);

  const [txs, paidRows, accts, overrides] = await Promise.all([
    db
      .select({
        accountId: transactions.accountId,
        postedOn: transactions.postedOn,
        description: transactions.description,
        amountMinor: transactions.amountMinor,
        spentHour: transactions.spentHour,
      })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      .where(
        and(
          eq(transactions.userId, user.id),
          gte(transactions.postedOn, since60),
          eq(accounts.includeInCifra, true),
          eq(transactions.excluded, false),
        ),
      ),
    cifra.nextIncomeOn
      ? db
          .select()
          .from(paidCycleCharges)
          .where(and(eq(paidCycleCharges.userId, user.id), eq(paidCycleCharges.cycleEnd, cifra.nextIncomeOn)))
      : Promise.resolve([]),
    db
      .select({ account: accounts, status: dataSources.status, sourceKind: dataSources.kind })
      .from(accounts)
      .innerJoin(dataSources, eq(dataSources.id, accounts.sourceId))
      .where(eq(accounts.userId, user.id)),
    loadCategoryOverrides(user.id),
  ]);

  const fixedKeys = new Set(cifra.recurring.filter((r) => r.active).map((r) => r.merchantKey));
  let todaySpentMinor = 0;
  let todayTxCount = 0;
  for (const t of txs) {
    if (t.postedOn !== today || t.amountMinor >= 0) continue;
    const f = flowOf(t.description, t.amountMinor);
    if (f !== 'gasto') continue;
    // Excluir cobros fijos mensuales ya reservados para no distorsionar el tope variable diario
    const isFixed = [...fixedKeys].some((k) => t.description.toLowerCase().includes(k.replace(/_/g, ' ')));
    if (isFixed) continue;
    todaySpentMinor += Math.abs(t.amountMinor);
    todayTxCount += 1;
  }

  const pulse = computeDailyPulse({
    safeAvailableMinor: cifra.availableMinor,
    dailyVariableBaselineMinor: cifra.dailyVariableMinor,
    daysUntilNextIncome: cifra.daysLeft,
    todaySpentMinor,
    todayTxCount,
  });

  const leaks = detectMoneyLeaks({ txs, today, overrides });

  const captureAccounts = accts
    .filter((a) => a.status === 'activa' && a.sourceKind !== 'entidad_aliada' && a.account.kind !== 'tarjeta_credito')
    .map((a) => ({
      id: a.account.id,
      name: a.account.name,
      balanceMinor: a.account.balanceMinor,
    }));

  return {
    pulse,
    paidCharges: paidRows,
    leaks,
    captureAccounts,
  };
}

export interface SmartMapPendingCode {
  code: string;
  qrDataUrl: string;
  expiresAtIso: string;
}

export interface SmartMapBundle {
  profile: UserConsumptionProfile;
  offers: SmartMapOfferInput[];
  defaultLat: number;
  defaultLng: number;
  zoneLabel: string;
  currentHour: number;
  dayOfWeek: number;
  pendingCodesByOfferId: Record<string, SmartMapPendingCode>;
}

export async function loadSmartMapBundle(user: User): Promise<SmartMapBundle> {
  const today = todayInBogota();
  const since90 = addDays(today, -90);
  const now = new Date();

  const [txs, offerRows, pendingCodes, overrides] = await Promise.all([
    db
      .select({
        accountId: transactions.accountId,
        postedOn: transactions.postedOn,
        description: transactions.description,
        amountMinor: transactions.amountMinor,
        spentHour: transactions.spentHour,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, user.id), gte(transactions.postedOn, since90), eq(transactions.excluded, false))),
    db
      .select({ offer: offers, merchant: merchants })
      .from(offers)
      .innerJoin(merchants, eq(merchants.id, offers.merchantId))
      .where(
        and(
          eq(offers.status, 'activa'),
          inArray(merchants.stage, ['activo', 'con_oferta']),
          eq(merchants.isDemo, user.isDemo),
        ),
      ),
    db
      .select()
      .from(offerCodes)
      .where(
        and(
          eq(offerCodes.userId, user.id),
          eq(offerCodes.status, 'pendiente'),
          gt(offerCodes.expiresAt, now),
        ),
      ),
    loadCategoryOverrides(user.id),
  ]);

  const profile = buildUserConsumptionProfile(txs, overrides);
  const zone = getZoneBySlug(user.zoneSlug ?? 'chapinero');
  const defaultLat = user.lat ?? zone?.lat ?? 4.6432;
  const defaultLng = user.lng ?? zone?.lng ?? -74.0631;

  const validOffers: SmartMapOfferInput[] = offerRows
    .filter(({ offer }) => offer.validFrom <= today && offer.validUntil >= today)
    .map(({ offer, merchant }) => {
      const estSavings = computeDiscountMinor({
        grossAmountMinor: merchant.typicalTicketMinor,
        discountKind: offer.discountKind,
        discountPercent: offer.discountPercent,
        discountFixedMinor: offer.discountFixedMinor,
        maxDiscountMinor: offer.maxDiscountMinor,
      });
      return {
        offerId: offer.id,
        merchantId: merchant.id,
        merchantSlug: merchant.slug,
        merchantName: merchant.name,
        businessCategory: merchant.businessCategory,
        neighborhood: merchant.neighborhood,
        address: merchant.address,
        hoursText: merchant.hoursText,
        lat: merchant.lat,
        lng: merchant.lng,
        typicalTicketMinor: merchant.typicalTicketMinor,
        title: offer.title,
        description: offer.description,
        targetCategory: offer.targetCategory,
        discountKind: offer.discountKind,
        discountPercent: offer.discountPercent,
        discountFixedMinor: offer.discountFixedMinor,
        minPurchaseMinor: offer.minPurchaseMinor,
        isFlash: offer.isFlash,
        startHour: offer.startHour,
        endHour: offer.endHour,
        activeDays: offer.activeDays ?? [0, 1, 2, 3, 4, 5, 6],
        stockLimit: offer.stockLimit,
        stockRemaining: offer.stockRemaining,
        activeHoursText: offer.activeHoursText,
        estimatedSavingsMinor: estSavings,
        newCustomersOnly: offer.newCustomersOnly,
      };
    });

  const pendingCodesByOfferId: Record<string, SmartMapPendingCode> = {};
  for (const c of pendingCodes) {
    const qrPayload = `CIFRA:${c.code}:${c.qrToken}`;
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      margin: 1,
      width: 196,
      color: { dark: '#101D1A', light: '#FFFFFF' },
    });
    pendingCodesByOfferId[c.offerId] = {
      code: c.code,
      qrDataUrl,
      expiresAtIso: c.expiresAt.toISOString(),
    };
  }

  return {
    profile,
    offers: validOffers,
    defaultLat,
    defaultLng,
    zoneLabel: zone?.name ?? 'Bogotá',
    currentHour: currentBogotaHour(now),
    dayOfWeek: currentBogotaDayOfWeek(today),
    pendingCodesByOfferId,
  };
}

export interface MerchantBreakEvenPageData {
  today: string;
  summary: MerchantBreakEvenSummary;
  recentEntries: Array<typeof merchantLedgerEntries.$inferSelect>;
  activeFlashCount: number;
}

export async function loadMerchantBreakEvenData(merchant: Merchant): Promise<MerchantBreakEvenPageData> {
  const today = todayInBogota();
  const since65 = addDays(today, -65);

  const [entries, activeOffers] = await Promise.all([
    db
      .select()
      .from(merchantLedgerEntries)
      .where(and(eq(merchantLedgerEntries.merchantId, merchant.id), gte(merchantLedgerEntries.entryOn, since65)))
      .orderBy(desc(merchantLedgerEntries.entryOn), desc(merchantLedgerEntries.createdAt))
      .limit(200),
    db
      .select()
      .from(offers)
      .where(and(eq(offers.merchantId, merchant.id), eq(offers.status, 'activa'))),
  ]);

  const summary = computeMerchantBreakEven({
    today,
    dailyBreakEvenMinor: merchant.dailyBreakEvenMinor,
    entries,
  });

  return {
    today,
    summary,
    recentEntries: entries.slice(0, 25),
    activeFlashCount: activeOffers.filter((o) => o.isFlash).length,
  };
}
