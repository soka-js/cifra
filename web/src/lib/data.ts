import 'server-only';
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from './db';
import {
  accessLog,
  accounts,
  commitments,
  dataSources,
  notifications,
  recurringMarks,
  savingsEvents,
  transactions,
  users,
  type User,
} from './db/schema';
import { computeCifra, type CifraResult, type RecurringMarkValue } from './engine/cifra';
import { addDays, todayInBogota } from './engine/dates';
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
        and(eq(transactions.userId, user.id), gte(transactions.postedOn, since), eq(accounts.includeInCifra, true), eq(transactions.excluded, false)),
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
    commitments: comms.map((c) => ({ id: c.id, name: c.name, amountMinor: c.amountMinor, dayOfMonth: c.dayOfMonth, notSameAs: c.notSameAs })),
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

export async function loadAccessLog(userId: string, limit = 12) {
  return db.select().from(accessLog).where(eq(accessLog.userId, userId)).orderBy(desc(accessLog.at)).limit(limit);
}

export async function logAccess(userId: string, actor: string, action: string, detail: Record<string, unknown> = {}) {
  await db.insert(accessLog).values({ userId, actor, action, detail });
}
