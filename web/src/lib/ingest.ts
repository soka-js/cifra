import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { accounts, dataSources, merchantCatalog, transactions, userCategoryRules } from './db/schema';
import { sha256 } from './crypto';
import { categoryOf, identifyMerchant, type Category, type UserCategoryOverride } from './engine/merchant';

export interface IncomingTx {
  postedOn: string;
  description: string;
  amountMinor: number;
  externalId?: string | null;
}

function normDesc(s: string) {
  return s.toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Llave para no duplicar movimientos. Con id externo (entidad aliada) se usa ese id.
 * En extractos se usa fecha + valor + descripción + número de repetición dentro del archivo,
 * así dos cafés iguales el mismo día cuentan dos veces, pero subir el mismo extracto otra vez no duplica nada.
 */
export function dedupeKeys(txs: IncomingTx[]): string[] {
  const seen = new Map<string, number>();
  return txs.map((t) => {
    if (t.externalId) return `ext:${t.externalId}`;
    const base = `${t.postedOn}|${t.amountMinor}|${normDesc(t.description)}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return sha256(`${base}|${n}`);
  });
}

export async function loadCategoryOverrides(userId: string): Promise<Record<string, UserCategoryOverride>> {
  const [globalRows, userRows] = await Promise.all([
    db.select().from(merchantCatalog).where(eq(merchantCatalog.verified, true)),
    db.select().from(userCategoryRules).where(eq(userCategoryRules.userId, userId)),
  ]);
  const map: Record<string, UserCategoryOverride> = {};
  for (const g of globalRows) {
    map[g.merchantKey] = { category: g.category as Category, customName: g.displayName };
  }
  for (const r of userRows) {
    map[r.merchantKey] = { category: r.category as Category, customName: r.customName };
  }
  return map;
}

export async function ingestTransactions(userId: string, accountId: string, sourceId: string, txs: IncomingTx[]) {
  if (!txs.length) return { inserted: 0, duplicates: 0 };
  const [keys, overrides] = await Promise.all([Promise.resolve(dedupeKeys(txs)), loadCategoryOverrides(userId)]);
  let inserted = 0;
  for (let i = 0; i < txs.length; i += 500) {
    const chunk = txs.slice(i, i + 500).map((t, j) => {
      const m = identifyMerchant(t.description, overrides);
      const cat = categoryOf(t.description, t.amountMinor, overrides);
      const hasUserRule = Boolean(overrides[m.key]);
      return {
        userId,
        accountId,
        externalId: t.externalId ?? null,
        postedOn: t.postedOn,
        description: t.description.slice(0, 300),
        amountMinor: t.amountMinor,
        merchantKey: m.key,
        merchantName: m.name,
        category: cat,
        categorySource: hasUserRule ? 'user_rule' : 'auto',
        dedupeKey: keys[i + j]!,
      };
    });
    const res = await db.insert(transactions).values(chunk).onConflictDoNothing().returning({ id: transactions.id });
    inserted += res.length;
  }
  const dates = txs.map((t) => t.postedOn).sort();
  await db
    .update(dataSources)
    .set({
      lastSyncAt: new Date(),
      coverageFrom: sql`least(coalesce(${dataSources.coverageFrom}, ${dates[0]}::date), ${dates[0]}::date)`,
      coverageTo: sql`greatest(coalesce(${dataSources.coverageTo}, ${dates[dates.length - 1]}::date), ${dates[dates.length - 1]}::date)`,
    })
    .where(and(eq(dataSources.id, sourceId), eq(dataSources.userId, userId)));
  return { inserted, duplicates: txs.length - inserted };
}

export async function setBalance(userId: string, accountId: string, balanceMinor: number, at: Date = new Date()) {
  await db
    .update(accounts)
    .set({ balanceMinor, balanceAt: at })
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
}
