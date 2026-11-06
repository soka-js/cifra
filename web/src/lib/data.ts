import 'server-only';
import { and, desc, eq, gte, ilike, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from './db';
import {
  accessLog,
  accounts,
  commitments,
  cycleSnapshots,
  dataSources,
  merchants,
  notifications,
  offers,
  recurringMarks,
  redemptions,
  savingsEvents,
  transactions,
  users,
  type User,
} from './db/schema';
import {
  rankOffersForUser,
  type CandidateOffer,
  type RankedOffer,
} from './engine/attribution';
import { computeCifra, type CifraResult, type RecurringMarkValue } from './engine/cifra';
import { addDays, todayInBogota } from './engine/dates';
import {
  computeCategoryComparison,
  detectAntExpenses,
  detectSpendDeviation,
  type AntExpenseCluster,
  type CycleBreakdown,
  type SpendDeviationAlert,
} from './engine/insights';
import {
  categoryOf,
  flowOf,
  identifyMerchant,
  type Category,
} from './engine/merchant';
import { splitInternalTransfers } from './engine/transfers';
import type { IncomeFrequency } from './engine/types';
import { loadCategoryOverrides } from './ingest';

/** Fecha en Bogotá (AAAA-MM-DD) de un instante. */
export function bogotaDate(d: Date): string {
  return todayInBogota(d);
}

/** Días de historia que se cargan para el motor: suficiente para cobros anuales recientes y el promedio diario. */
const HISTORY_DAYS = 400;

export async function loadCifra(user: User): Promise<CifraResult> {
  const today = todayInBogota();
  const since = addDays(today, -HISTORY_DAYS);
  const [accts, txs, comms, marks, categoryOverrides] = await Promise.all([
    db
      .select({ account: accounts, status: dataSources.status, kind: dataSources.kind })
      .from(accounts)
      .innerJoin(dataSources, eq(dataSources.id, accounts.sourceId))
      .where(eq(accounts.userId, user.id)),
    db
      .select({
        accountId: transactions.accountId,
        postedOn: transactions.postedOn,
        description: transactions.description,
        amountMinor: transactions.amountMinor,
      })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      .where(
        and(
          eq(transactions.userId, user.id),
          gte(transactions.postedOn, since),
          eq(accounts.includeInCifra, true),
          eq(transactions.excluded, false),
        ),
      ),
    db.select().from(commitments).where(eq(commitments.userId, user.id)),
    db.select().from(recurringMarks).where(eq(recurringMarks.userId, user.id)),
    loadCategoryOverrides(user.id),
  ]);
  const active = accts.filter((a) => a.status === 'activa');
  const result = computeCifra({
    today,
    accounts: active.map(({ account: a, kind }) => ({
      accountId: a.id,
      name: a.name,
      balanceMinor: a.balanceMinor,
      balanceOn: a.balanceAt ? bogotaDate(a.balanceAt) : null,
      includeInCifra: a.includeInCifra && a.kind !== 'tarjeta_credito',
      editable: kind !== 'entidad_aliada',
    })),
    transactions: txs,
    income: { frequency: (user.incomeFrequency as IncomeFrequency | null) ?? null, days: user.incomeDays ?? null },
    bufferMinor: user.bufferMinor,
    declaredDailyMinor: user.dailySpendMinor ?? null,
    commitments: comms.map((c) => ({
      id: c.id,
      name: c.name,
      amountMinor: c.amountMinor,
      dayOfMonth: c.dayOfMonth,
      notSameAs: c.notSameAs,
    })),
    marks: Object.fromEntries(marks.map((m) => [m.merchantKey, m.mark as RecurringMarkValue])),
    categoryOverrides,
  });

  // Registra la primera vez que la persona tiene su cifra lista (métrica "< 5 minutos", H.1.1) y su actividad reciente.
  const now = new Date();
  const staleActivity = !user.lastActiveAt || now.getTime() - user.lastActiveAt.getTime() > 3_600_000;
  if (result.ready && !user.firstCifraAt) {
    await db.update(users).set({ firstCifraAt: now, lastActiveAt: now }).where(eq(users.id, user.id));
  } else if (staleActivity) {
    await db.update(users).set({ lastActiveAt: now }).where(eq(users.id, user.id));
  }

  return result;
}

export async function loadMarks(userId: string): Promise<Record<string, RecurringMarkValue>> {
  const rows = await db.select().from(recurringMarks).where(eq(recurringMarks.userId, userId));
  return Object.fromEntries(rows.map((m) => [m.merchantKey, m.mark as RecurringMarkValue]));
}

export interface RecurringMarkDetail {
  mark: RecurringMarkValue;
  cancelledAt: Date | null;
  savedMonthlyMinor: number | null;
}

export async function loadMarksDetailed(userId: string): Promise<Record<string, RecurringMarkDetail>> {
  const rows = await db.select().from(recurringMarks).where(eq(recurringMarks.userId, userId));
  return Object.fromEntries(
    rows.map((m) => [
      m.merchantKey,
      {
        mark: m.mark as RecurringMarkValue,
        cancelledAt: m.cancelledAt,
        savedMonthlyMinor: m.savedMonthlyMinor,
      },
    ]),
  );
}

export interface SavingsSummary {
  monthMinor: number;
  allTimeMinor: number;
  recent: Array<{
    id: string;
    kind: 'cobro_cancelado' | 'oferta_redimida' | 'comision_evitada';
    amountMinor: number;
    label: string;
    occurredOn: string;
  }>;
}

export async function loadSavingsSummary(userId: string): Promise<SavingsSummary> {
  const today = todayInBogota();
  const monthStart = `${today.slice(0, 7)}-01`;
  const rows = await db
    .select()
    .from(savingsEvents)
    .where(eq(savingsEvents.userId, userId))
    .orderBy(desc(savingsEvents.occurredOn), desc(savingsEvents.createdAt));

  let monthMinor = 0;
  let allTimeMinor = 0;
  for (const r of rows) {
    allTimeMinor += r.amountMinor;
    if (r.occurredOn >= monthStart) monthMinor += r.amountMinor;
  }
  return {
    monthMinor,
    allTimeMinor,
    recent: rows.slice(0, 8).map((r) => ({
      id: r.id,
      kind: r.kind,
      amountMinor: r.amountMinor,
      label: r.label,
      occurredOn: r.occurredOn,
    })),
  };
}

export async function loadSpendDeviation(user: User, cifra: CifraResult): Promise<SpendDeviationAlert> {
  const today = todayInBogota();
  const since = addDays(today, -45);
  const [txs, overrides] = await Promise.all([
    db
      .select({
        accountId: transactions.accountId,
        postedOn: transactions.postedOn,
        description: transactions.description,
        amountMinor: transactions.amountMinor,
      })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      .where(
        and(
          eq(transactions.userId, user.id),
          gte(transactions.postedOn, since),
          eq(accounts.includeInCifra, true),
          eq(transactions.excluded, false),
        ),
      ),
    loadCategoryOverrides(user.id),
  ]);

  const fixedKeys = new Set(cifra.recurring.filter((r) => r.active).map((r) => r.merchantKey));
  return detectSpendDeviation({
    rawTxs: txs,
    fixedMerchantKeys: fixedKeys,
    baselineDailyMinor: cifra.dailyVariableMinor,
    today,
    overrides,
  });
}

export async function loadRankedOffersForUser(user: User, limit?: number): Promise<RankedOffer[]> {
  const today = todayInBogota();
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00-05:00`);
  const since90 = addDays(today, -90);

  const [offerRows, monthRedeemCounts, userTxs, userRedemptions, overrides] = await Promise.all([
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
      .select({ offerId: redemptions.offerId, n: sql<number>`count(*)::int` })
      .from(redemptions)
      .where(and(ne(redemptions.status, 'anulada'), gte(redemptions.redeemedAt, monthStart)))
      .groupBy(redemptions.offerId),
    db
      .select({
        accountId: transactions.accountId,
        postedOn: transactions.postedOn,
        description: transactions.description,
        amountMinor: transactions.amountMinor,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, user.id), gte(transactions.postedOn, since90), eq(transactions.excluded, false))),
    db
      .select({ merchantId: redemptions.merchantId, redeemedAt: redemptions.redeemedAt })
      .from(redemptions)
      .where(and(eq(redemptions.userId, user.id), ne(redemptions.status, 'anulada'))),
    loadCategoryOverrides(user.id),
  ]);

  if (offerRows.length === 0) return [];

  const monthCountByOffer = new Map(monthRedeemCounts.map((c) => [c.offerId, c.n]));
  const redemptionsByMerchant: Record<string, string[]> = {};
  for (const r of userRedemptions) {
    const list = redemptionsByMerchant[r.merchantId] ?? [];
    list.push(bogotaDate(r.redeemedAt));
    redemptionsByMerchant[r.merchantId] = list;
  }

  const from30 = addDays(today, -30);
  const spendByCategory30d: Partial<Record<Category, number>> = {};
  const { external } = splitInternalTransfers(userTxs);
  for (const t of external) {
    if (t.amountMinor >= 0 || t.postedOn < from30) continue;
    if (flowOf(t.description, t.amountMinor) === 'pago_tarjeta') continue;
    const cat = categoryOf(t.description, t.amountMinor, overrides);
    spendByCategory30d[cat] = (spendByCategory30d[cat] ?? 0) + -t.amountMinor;
  }

  const candidates: CandidateOffer[] = offerRows.map(({ offer: o, merchant: m }) => ({
    id: o.id,
    merchantId: m.id,
    merchantName: m.name,
    merchantSlug: m.slug,
    merchantCategory: m.businessCategory,
    neighborhood: m.neighborhood,
    zoneSlug: m.zoneSlug,
    address: m.address,
    hoursText: m.hoursText,
    lat: m.lat,
    lng: m.lng,
    typicalTicketMinor: m.typicalTicketMinor,
    commissionBps: m.commissionBps,
    matchKeywords: m.matchKeywords,
    title: o.title,
    description: o.description,
    targetCategory: o.targetCategory,
    discountKind: o.discountKind,
    discountPercent: o.discountPercent,
    discountFixedMinor: o.discountFixedMinor,
    maxDiscountMinor: o.maxDiscountMinor,
    minPurchaseMinor: o.minPurchaseMinor,
    newCustomersOnly: o.newCustomersOnly,
    exclusivityDays: o.exclusivityDays,
    holdoutPercent: o.holdoutPercent,
    monthlyCapRedemptions: o.monthlyCapRedemptions,
    monthlyRedemptionsUsed: monthCountByOffer.get(o.id) ?? 0,
    validFrom: o.validFrom,
    validUntil: o.validUntil,
    activeHoursText: o.activeHoursText,
  }));

  const ranked = rankOffersForUser({
    today,
    userId: user.id,
    userLat: user.lat,
    userLng: user.lng,
    userZoneSlug: user.zoneSlug,
    spendByCategory30d,
    userTransactions: external,
    redemptionsByMerchant,
    offers: candidates,
    bypassHoldoutForDemo: user.isDemo,
  });

  return typeof limit === 'number' ? ranked.slice(0, limit) : ranked;
}

export interface EnrichedMovement {
  id: string;
  accountId: string;
  postedOn: string;
  description: string;
  amountMinor: number;
  excluded: boolean;
  entity: string;
  accountName: string;
  merchantKey: string;
  merchantName: string;
  category: Category;
  categorySource: string;
  isInternal: boolean;
}

export interface MovimientosInsightsData {
  breakdown: CycleBreakdown;
  antExpenses: AntExpenseCluster[];
  movements: EnrichedMovement[];
}

export async function loadMovimientosInsights(
  user: User,
  q = '',
  catFilter?: Category | null,
): Promise<MovimientosInsightsData> {
  const today = todayInBogota();
  const since = addDays(today, -90);
  const [rows, overrides] = await Promise.all([
    db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        postedOn: transactions.postedOn,
        description: transactions.description,
        amountMinor: transactions.amountMinor,
        excluded: transactions.excluded,
        merchantKey: transactions.merchantKey,
        merchantName: transactions.merchantName,
        category: transactions.category,
        categorySource: transactions.categorySource,
        accountName: accounts.name,
        entity: dataSources.entityName,
      })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      .innerJoin(dataSources, eq(dataSources.id, accounts.sourceId))
      .where(
        and(
          eq(transactions.userId, user.id),
          gte(transactions.postedOn, since),
          q ? ilike(transactions.description, `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`) : sql`true`,
        ),
      )
      .orderBy(desc(transactions.postedOn), desc(transactions.createdAt))
      .limit(500),
    loadCategoryOverrides(user.id),
  ]);

  const internalIds = new Set(splitInternalTransfers(rows).internal.map((t) => (t as (typeof rows)[number]).id));

  const nonExcluded = rows.filter((r) => !r.excluded);
  const breakdown = computeCategoryComparison(nonExcluded, today, 30, overrides);
  const antExpenses = detectAntExpenses(nonExcluded, today, overrides);

  const enriched: EnrichedMovement[] = [];
  for (const r of rows) {
    const m = identifyMerchant(r.description, overrides);
    const computedCat = categoryOf(r.description, r.amountMinor, overrides);
    const resolvedCat = overrides[m.key]?.category ?? ((r.category as Category | null) || computedCat);
    if (catFilter && resolvedCat !== catFilter) continue;
    enriched.push({
      id: r.id,
      accountId: r.accountId,
      postedOn: r.postedOn,
      description: r.description,
      amountMinor: r.amountMinor,
      excluded: r.excluded,
      entity: r.entity,
      accountName: r.accountName,
      merchantKey: r.merchantKey || m.key,
      merchantName: overrides[m.key]?.customName || r.merchantName || m.name,
      category: resolvedCat,
      categorySource: overrides[m.key] ? 'user_rule' : r.categorySource,
      isInternal: internalIds.has(r.id),
    });
  }

  return { breakdown, antExpenses, movements: enriched };
}

export async function loadCycleSnapshots(userId: string) {
  return db
    .select()
    .from(cycleSnapshots)
    .where(eq(cycleSnapshots.userId, userId))
    .orderBy(desc(cycleSnapshots.cycleEnd))
    .limit(12);
}

export async function loadNotifications(userId: string, limit = 30) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function loadUnreadNotificationsCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export interface SourceView {
  id: string;
  kind: 'entidad_aliada' | 'extracto' | 'finanzas_abiertas' | 'manual';
  entityName: string;
  scopes: string[];
  status: string;
  grantedAt: Date;
  lastSyncAt: Date | null;
  coverageFrom: string | null;
  coverageTo: string | null;
  accounts: Array<{
    id: string;
    name: string;
    kind: string;
    mask: string | null;
    balanceMinor: number | null;
    balanceAt: Date | null;
    includeInCifra: boolean;
    txCount: number;
  }>;
}

export async function loadSources(userId: string): Promise<SourceView[]> {
  const [sources, accts, counts] = await Promise.all([
    db.select().from(dataSources).where(eq(dataSources.userId, userId)).orderBy(desc(dataSources.createdAt)),
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db
      .select({ accountId: transactions.accountId, n: sql<number>`count(*)::int` })
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .groupBy(transactions.accountId),
  ]);
  const countBy = new Map(counts.map((c) => [c.accountId, c.n]));
  return sources.map((s) => ({
    id: s.id,
    kind: s.kind,
    entityName: s.entityName,
    scopes: s.scopes,
    status: s.status,
    grantedAt: s.grantedAt,
    lastSyncAt: s.lastSyncAt,
    coverageFrom: s.coverageFrom,
    coverageTo: s.coverageTo,
    accounts: accts
      .filter((a) => a.sourceId === s.id)
      .map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        mask: a.mask,
        balanceMinor: a.balanceMinor,
        balanceAt: a.balanceAt,
        includeInCifra: a.includeInCifra,
        txCount: countBy.get(a.id) ?? 0,
      })),
  }));
}

export async function loadAccessLog(userId: string, limit = 15) {
  return db.select().from(accessLog).where(eq(accessLog.userId, userId)).orderBy(desc(accessLog.at)).limit(limit);
}

export async function logAccess(userId: string, actor: string, action: string, detail: Record<string, unknown> = {}) {
  await db.insert(accessLog).values({ userId, actor, action, detail });
}
