import 'server-only';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from './db';
import { accessLog, accounts, commitments, dataSources, recurringMarks, transactions, type User } from './db/schema';
import { computeCifra, type CifraResult, type RecurringMarkValue } from './engine/cifra';
import { addDays, todayInBogota } from './engine/dates';
import type { IncomeFrequency } from './engine/types';

/** Fecha en Bogotá (AAAA-MM-DD) de un instante. */
export function bogotaDate(d: Date): string {
  return todayInBogota(d);
}

/** Días de historia que se cargan para el motor: suficiente para cobros anuales recientes y el promedio diario. */
const HISTORY_DAYS = 400;

export async function loadCifra(user: User): Promise<CifraResult> {
  const today = todayInBogota();
  const since = addDays(today, -HISTORY_DAYS);
  const [accts, txs, comms, marks] = await Promise.all([
    db
      .select({ account: accounts, status: dataSources.status })
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
      .where(and(eq(transactions.userId, user.id), gte(transactions.postedOn, since), eq(accounts.includeInCifra, true))),
    db.select().from(commitments).where(eq(commitments.userId, user.id)),
    db.select().from(recurringMarks).where(eq(recurringMarks.userId, user.id)),
  ]);
  const active = accts.filter((a) => a.status === 'activa').map((a) => a.account);
  return computeCifra({
    today,
    accounts: active.map((a) => ({
      accountId: a.id,
      name: a.name,
      balanceMinor: a.balanceMinor,
      balanceOn: a.balanceAt ? bogotaDate(a.balanceAt) : null,
      includeInCifra: a.includeInCifra && a.kind !== 'tarjeta_credito',
    })),
    transactions: txs,
    income: { frequency: (user.incomeFrequency as IncomeFrequency | null) ?? null, days: user.incomeDays ?? null },
    bufferMinor: user.bufferMinor,
    commitments: comms.map((c) => ({ id: c.id, name: c.name, amountMinor: c.amountMinor, dayOfMonth: c.dayOfMonth })),
    marks: Object.fromEntries(marks.map((m) => [m.merchantKey, m.mark as RecurringMarkValue])),
  });
}

export async function loadMarks(userId: string): Promise<Record<string, RecurringMarkValue>> {
  const rows = await db.select().from(recurringMarks).where(eq(recurringMarks.userId, userId));
  return Object.fromEntries(rows.map((m) => [m.merchantKey, m.mark as RecurringMarkValue]));
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
