import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { accounts, dataSources } from './db/schema';
import { todayInBogota } from './engine/dates';

/**
 * Saldos que la persona escribe a mano (modo rápido, efectivo, una billetera sin extracto).
 * Cada uno es una fuente "manual" con una cuenta, para que la pantalla de datos muestre de dónde sale.
 */
export async function createManualAccount(userId: string, opts: { entityName: string; name: string; balanceMinor: number }) {
  const now = new Date();
  const [source] = await db
    .insert(dataSources)
    .values({ userId, kind: 'manual', entityName: opts.entityName, scopes: ['saldos'], status: 'activa', lastSyncAt: now })
    .returning();
  const [account] = await db
    .insert(accounts)
    .values({ userId, sourceId: source!.id, kind: 'otra', name: opts.name, balanceMinor: opts.balanceMinor, balanceAt: now, includeInCifra: true })
    .returning();
  return account!;
}

/** Cuentas escritas a mano de la persona, con el nombre de su fuente. */
export async function listManualAccounts(userId: string) {
  return db
    .select({ id: accounts.id, name: accounts.name, balanceMinor: accounts.balanceMinor, sourceId: dataSources.id, entityName: dataSources.entityName })
    .from(accounts)
    .innerJoin(dataSources, eq(dataSources.id, accounts.sourceId))
    .where(and(eq(accounts.userId, userId), eq(dataSources.kind, 'manual')));
}

/**
 * Quita una cuenta escrita a mano porque un extracto la reemplaza. Si era la única de su fuente, se va la fuente.
 * Devuelve el nombre de la fuente, o null si la cuenta no era manual o no es de esta persona.
 */
export async function removeManualAccount(userId: string, accountId: string): Promise<string | null> {
  const [row] = await db
    .select({ account: accounts, source: dataSources })
    .from(accounts)
    .innerJoin(dataSources, eq(dataSources.id, accounts.sourceId))
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId), eq(dataSources.kind, 'manual')))
    .limit(1);
  if (!row) return null;
  const siblings = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.sourceId, row.source.id));
  if (siblings.length <= 1) await db.delete(dataSources).where(eq(dataSources.id, row.source.id));
  else await db.delete(accounts).where(eq(accounts.id, row.account.id));
  return row.source.entityName;
}

/**
 * Cuenta líquida editable de la persona donde se anotan movimientos rápidos. Si todavía no tiene
 * ninguna (no ha subido extracto ni escrito saldo), crea una fuente manual con una billetera en $0.
 *
 * Recibe un userId: por eso vive aquí y no en un archivo 'use server'. Quien llama debe pasar
 * siempre el id del usuario en sesión.
 */
export async function ensureEditableLiquidAccount(userId: string, preferredAccountId?: string | null) {
  const rows = await db
    .select({ account: accounts, status: dataSources.status, sourceKind: dataSources.kind })
    .from(accounts)
    .innerJoin(dataSources, eq(dataSources.id, accounts.sourceId))
    .where(eq(accounts.userId, userId));

  const editable = rows.filter(
    (r) => r.status === 'activa' && r.sourceKind !== 'entidad_aliada' && r.account.kind !== 'tarjeta_credito',
  );

  if (preferredAccountId) {
    const chosen = editable.find((e) => e.account.id === preferredAccountId);
    if (chosen) return chosen.account;
  }
  if (editable.length > 0) return editable[0]!.account;

  const now = new Date();
  const today = todayInBogota(now);
  const [src] = await db
    .insert(dataSources)
    .values({
      userId,
      kind: 'manual',
      entityName: 'Registro diario CIFRA',
      scopes: ['saldos', 'movimientos'],
      status: 'activa',
      lastSyncAt: now,
      coverageFrom: today,
      coverageTo: today,
    })
    .returning();

  const [acct] = await db
    .insert(accounts)
    .values({
      userId,
      sourceId: src!.id,
      kind: 'billetera',
      name: 'Billetera / Efectivo diario',
      balanceMinor: 0,
      balanceAt: now,
      includeInCifra: true,
    })
    .returning();

  return acct!;
}
