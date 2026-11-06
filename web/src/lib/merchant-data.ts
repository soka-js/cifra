import 'server-only';
import { and, desc, eq, gte, gt, lt, ne } from 'drizzle-orm';
import QRCode from 'qrcode';
import { db } from './db';
import {
  merchantInvoices,
  merchantPayments,
  merchants,
  offerCodes,
  offers,
  partners,
  redemptions,
  transactions,
  users,
  type Merchant,
  type User,
} from './db/schema';
import {
  computeMerchantReport,
  isInHoldoutGroup,
  matchesMerchantKeywords,
  type MerchantFourMetricsReport,
  type MerchantRedemptionRecord,
  type OrganicVisitObservation,
} from './engine/attribution';
import { addDays, todayInBogota } from './engine/dates';
import {
  evaluateMerchantBillingHealth,
  computeCycleSummary,
  getCurrentCommissionCycle,
  type MerchantBillingHealth,
  type CycleSummary,
} from './engine/commission-cycle';
import { cop } from './format';
import { bogotaDate, loadRankedOffersForUser } from './data';

const MONTH_NAMES: Record<string, string> = {
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

export function formatPeriodMonth(periodMonth: string): string {
  const [y, m] = periodMonth.split('-');
  return `${MONTH_NAMES[m ?? ''] ?? m} de ${y}`;
}

export function currentPeriodMonth(): string {
  return todayInBogota().slice(0, 7);
}

function monthBoundsUtc(periodMonth: string): { start: Date; end: Date; startDate: string; endDate: string } {
  const [yStr, mStr] = periodMonth.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const startDate = `${yStr}-${mStr}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endDate = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;
  return {
    start: new Date(`${startDate}T00:00:00-05:00`),
    end: new Date(`${ny}-${String(nm).padStart(2, '0')}-01T00:00:00-05:00`),
    startDate,
    endDate,
  };
}

/**
 * Sincroniza el estado de cuenta mensual abierto de un negocio a partir de sus redenciones válidas.
 */
export async function syncMerchantInvoice(merchantId: string, periodMonth = currentPeriodMonth()) {
  const { start, end, endDate } = monthBoundsUtc(periodMonth);
  const validRedemptions = await db
    .select()
    .from(redemptions)
    .where(
      and(
        eq(redemptions.merchantId, merchantId),
        ne(redemptions.status, 'anulada'),
        gte(redemptions.redeemedAt, start),
        lt(redemptions.redeemedAt, end),
      ),
    );

  const redemptionsCount = validRedemptions.length;
  const grossSalesMinor = validRedemptions.reduce((s, r) => s + r.grossAmountMinor, 0);
  const discountsGrantedMinor = validRedemptions.reduce((s, r) => s + r.discountMinor, 0);
  const netSalesMinor = validRedemptions.reduce((s, r) => s + r.netPaidByUserMinor, 0);
  const commissionTotalMinor = validRedemptions.reduce((s, r) => s + r.cifraCommissionMinor, 0);
  const dueOn = addDays(endDate, 5);

  const [existing] = await db
    .select()
    .from(merchantInvoices)
    .where(and(eq(merchantInvoices.merchantId, merchantId), eq(merchantInvoices.periodMonth, periodMonth)))
    .limit(1);

  if (!existing && redemptionsCount === 0) return null;

  if (!existing) {
    const [created] = await db
      .insert(merchantInvoices)
      .values({
        merchantId,
        periodMonth,
        redemptionsCount,
        grossSalesMinor,
        discountsGrantedMinor,
        netSalesMinor,
        commissionTotalMinor,
        dueOn,
        status: 'abierta',
      })
      .returning();
    return created ?? null;
  }

  // Si ya está pagada o en verificación, respetamos el estado pero actualizamos totales si sigue abierta.
  if (existing.status === 'abierta' || existing.status === 'pendiente_pago') {
    const [updated] = await db
      .update(merchantInvoices)
      .set({
        redemptionsCount,
        grossSalesMinor,
        discountsGrantedMinor,
        netSalesMinor,
        commissionTotalMinor,
        dueOn: existing.dueOn ?? dueOn,
      })
      .where(eq(merchantInvoices.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  return existing;
}

export interface MerchantDashboardData {
  periodMonth: string;
  periodLabel: string;
  report: MerchantFourMetricsReport;
  offers: Array<typeof offers.$inferSelect>;
  recentRedemptions: Array<{
    id: string;
    redeemedAt: Date;
    grossAmountMinor: number;
    discountMinor: number;
    netPaidByUserMinor: number;
    cifraCommissionMinor: number;
    merchantNetKeepMinor: number;
    isNewCustomer: boolean;
    status: string;
    userConfirmedAt: Date | null;
    offerTitle: string;
    customerFirstName: string;
  }>;
  invoices: Array<typeof merchantInvoices.$inferSelect>;
  payments: Array<typeof merchantPayments.$inferSelect>;
  billingHealth: MerchantBillingHealth;
  cycleSummary: CycleSummary;
}

export async function loadMerchantDashboard(
  merchant: Merchant,
  periodMonth = currentPeriodMonth(),
): Promise<MerchantDashboardData> {
  await syncMerchantInvoice(merchant.id, periodMonth);
  const { start, end } = monthBoundsUtc(periodMonth);
  const since120 = addDays(todayInBogota(), -120);

  const [merchantOffers, allValidRedemptions, recentJoin, candidateTxs, invoices, payments] = await Promise.all([
    db.select().from(offers).where(eq(offers.merchantId, merchant.id)).orderBy(desc(offers.createdAt)),
    db
      .select()
      .from(redemptions)
      .where(and(eq(redemptions.merchantId, merchant.id), ne(redemptions.status, 'anulada')))
      .orderBy(desc(redemptions.redeemedAt)),
    db
      .select({
        redemption: redemptions,
        offerTitle: offers.title,
        userName: users.name,
      })
      .from(redemptions)
      .innerJoin(offers, eq(offers.id, redemptions.offerId))
      .innerJoin(users, eq(users.id, redemptions.userId))
      .where(eq(redemptions.merchantId, merchant.id))
      .orderBy(desc(redemptions.redeemedAt))
      .limit(25),
    merchant.matchKeywords.length > 0
      ? db
          .select({
            userId: transactions.userId,
            postedOn: transactions.postedOn,
            description: transactions.description,
            amountMinor: transactions.amountMinor,
          })
          .from(transactions)
          .innerJoin(users, eq(users.id, transactions.userId))
          .where(and(gte(transactions.postedOn, since120), eq(users.isDemo, merchant.isDemo)))
          .limit(2500)
      : Promise.resolve([]),
    db
      .select()
      .from(merchantInvoices)
      .where(eq(merchantInvoices.merchantId, merchant.id))
      .orderBy(desc(merchantInvoices.periodMonth)),
    db
      .select()
      .from(merchantPayments)
      .where(eq(merchantPayments.merchantId, merchant.id))
      .orderBy(desc(merchantPayments.createdAt)),
  ]);

  const periodRedemptions = allValidRedemptions.filter(
    (r) => r.redeemedAt >= start && r.redeemedAt < end,
  );

  // Fechas en que hubo redención con oferta para no confundir la visita con oferta con un retorno sin descuento.
  const redeemedDayKeys = new Set(
    allValidRedemptions.map((r) => `${r.userId}:${bogotaDate(r.redeemedAt)}`),
  );

  const holdoutPct = merchantOffers[0]?.holdoutPercent ?? 10;
  const organicObservations: OrganicVisitObservation[] = [];
  for (const tx of candidateTxs) {
    if (tx.amountMinor >= 0) continue;
    if (!matchesMerchantKeywords(tx.description, merchant.matchKeywords)) continue;
    if (redeemedDayKeys.has(`${tx.userId}:${tx.postedOn}`)) continue;
    organicObservations.push({
      userId: tx.userId,
      postedOn: tx.postedOn,
      amountMinor: tx.amountMinor,
      inHoldout: isInHoldoutGroup(tx.userId, merchant.id, holdoutPct),
    });
  }

  // Para medir retorno orgánico incluimos redenciones del periodo e inmediatamente previas que volvieron en el mes.
  const reportRecords: MerchantRedemptionRecord[] = periodRedemptions.map((r) => ({
    id: r.id,
    userId: r.userId,
    redeemedOn: bogotaDate(r.redeemedAt),
    grossAmountMinor: r.grossAmountMinor,
    discountMinor: r.discountMinor,
    netPaidByUserMinor: r.netPaidByUserMinor,
    cifraCommissionMinor: r.cifraCommissionMinor,
    merchantNetKeepMinor: r.merchantNetKeepMinor,
    isNewCustomer: r.isNewCustomer,
  }));

  const periodLabel = formatPeriodMonth(periodMonth);
  const report = computeMerchantReport({
    merchantName: merchant.name,
    periodLabel,
    redemptions: reportRecords,
    organicObservations,
    formatMoney: (minor) => cop(minor),
  });

  const todayIso = todayInBogota();
  const activeCycle = getCurrentCommissionCycle(todayIso);
  const cycleRedemptions = allValidRedemptions.filter((r) => {
    const d = bogotaDate(r.redeemedAt);
    return d >= activeCycle.startDate && d <= activeCycle.cutDate;
  });
  const cycleSummary = computeCycleSummary(
    cycleRedemptions.length > 0 ? cycleRedemptions : periodRedemptions,
  );
  const billingHealth = evaluateMerchantBillingHealth(invoices, todayIso);

  return {
    periodMonth,
    periodLabel,
    report,
    offers: merchantOffers,
    recentRedemptions: recentJoin.map(({ redemption: r, offerTitle, userName }) => ({
      id: r.id,
      redeemedAt: r.redeemedAt,
      grossAmountMinor: r.grossAmountMinor,
      discountMinor: r.discountMinor,
      netPaidByUserMinor: r.netPaidByUserMinor,
      cifraCommissionMinor: r.cifraCommissionMinor,
      merchantNetKeepMinor: r.merchantNetKeepMinor,
      isNewCustomer: r.isNewCustomer,
      status: r.status,
      userConfirmedAt: r.userConfirmedAt,
      offerTitle,
      customerFirstName: userName ? userName.split(' ')[0]! : 'Cliente CIFRA',
    })),
    invoices,
    payments,
    billingHealth,
    cycleSummary,
  };
}

export interface ActiveCodeView {
  id: string;
  offerId: string;
  code: string;
  qrSvg: string;
  expiresAtIso: string;
}

export interface UserRedemptionView {
  id: string;
  merchantName: string;
  offerTitle: string;
  redeemedOn: string;
  grossAmountMinor: number;
  discountMinor: number;
  netPaidByUserMinor: number;
  confirmed: boolean;
  disputed: boolean;
}

export async function loadPersonaOffersBundle(user: User) {
  const now = new Date();
  const [ranked, activeCodeRows, userRedeems] = await Promise.all([
    loadRankedOffersForUser(user),
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
    db
      .select({
        r: redemptions,
        merchantName: merchants.name,
        offerTitle: offers.title,
      })
      .from(redemptions)
      .innerJoin(merchants, eq(merchants.id, redemptions.merchantId))
      .innerJoin(offers, eq(offers.id, redemptions.offerId))
      .where(eq(redemptions.userId, user.id))
      .orderBy(desc(redemptions.redeemedAt))
      .limit(10),
  ]);

  const activeCodes: Record<string, ActiveCodeView> = {};
  for (const row of activeCodeRows) {
    const qrPayload = `CIFRA:${row.code}:${row.qrToken}`;
    const qrSvg = await QRCode.toString(qrPayload, {
      type: 'svg',
      margin: 1,
      width: 180,
      color: { dark: '#101D1A', light: '#FFFFFF' },
    });
    activeCodes[row.offerId] = {
      id: row.id,
      offerId: row.offerId,
      code: row.code,
      qrSvg,
      expiresAtIso: row.expiresAt.toISOString(),
    };
  }

  const recentRedemptions: UserRedemptionView[] = userRedeems.map(({ r, merchantName, offerTitle }) => ({
    id: r.id,
    merchantName,
    offerTitle,
    redeemedOn: bogotaDate(r.redeemedAt),
    grossAmountMinor: r.grossAmountMinor,
    discountMinor: r.discountMinor,
    netPaidByUserMinor: r.netPaidByUserMinor,
    confirmed: Boolean(r.userConfirmedAt),
    disputed: Boolean(r.disputedAt),
  }));

  return { ranked, activeCodes, recentRedemptions };
}

export async function generateBrebQrSvg(brebKey: string): Promise<string> {
  return QRCode.toString(`BREB:${brebKey}`, {
    type: 'svg',
    margin: 1,
    width: 170,
    color: { dark: '#101D1A', light: '#FFFFFF' },
  });
}

export async function getPartnerShareBps(partnerId: string | null): Promise<number> {
  if (!partnerId) return 0;
  const [p] = await db.select({ bps: partners.revenueShareBps }).from(partners).where(eq(partners.id, partnerId)).limit(1);
  return p?.bps ?? 3000;
}
