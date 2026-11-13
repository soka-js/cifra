import { sql } from 'drizzle-orm';
import { randomToken, sha256 } from '@/lib/crypto';
import { db } from '@/lib/db';
import {
  accounts,
  commitments,
  dataSources,
  merchantCatalog,
  merchantInvoices,
  merchantLedgerEntries,
  merchantMembers,
  merchantPayments,
  merchants,
  notifications,
  offerCodes,
  offers,
  redemptions,
  sessions,
  transactions,
  users,
  type Merchant,
  type User,
} from '@/lib/db/schema';
import { addDays, todayInBogota } from '@/lib/engine/dates';
import { assertLocalTestDatabase } from './db-url';
import { jar } from './fake-next';

// Segunda guardia: este módulo vacía tablas. Solo contra la base local de pruebas.
assertLocalTestDatabase(process.env.DATABASE_URL ?? '');

/** Correo que el config de pruebas pone en ADMIN_EMAILS. */
export const ADMIN_EMAIL = 'admin@prueba.local';

/** Vacía todas las tablas de la base de pruebas. */
export async function truncateAll(): Promise<void> {
  const rows = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  const names = rows.map((r) => `"${r.tablename}"`).join(', ');
  if (names) await db.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
}

/** Abre sesión como esa persona en la petición simulada (o la deja sin sesión con null). */
export async function loginAs(user: { id: string } | null): Promise<void> {
  jar.clear();
  if (!user) return;
  const token = randomToken();
  await db.insert(sessions).values({
    id: sha256(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  jar.set('cf_session', token);
}

let seq = 0;

export async function createUser(over: Partial<typeof users.$inferInsert> = {}): Promise<User> {
  seq += 1;
  const [row] = await db
    .insert(users)
    .values({
      email: `persona${seq}@prueba.local`,
      name: `Persona ${seq}`,
      incomeFrequency: 'quincenal',
      incomeDays: [15, 30],
      onboardedAt: new Date(),
      consentVersion: 'prueba',
      consentAt: new Date(),
      ...over,
    })
    .returning();
  return row!;
}

export async function createAccountFor(userId: string, balanceMinor = 1_000_000_00) {
  const now = new Date();
  const [source] = await db
    .insert(dataSources)
    .values({ userId, kind: 'manual', entityName: 'Nequi', scopes: ['saldos'], status: 'activa', lastSyncAt: now })
    .returning();
  const [account] = await db
    .insert(accounts)
    .values({ userId, sourceId: source!.id, kind: 'otra', name: 'Saldo escrito a mano', balanceMinor, balanceAt: now })
    .returning();
  return { source: source!, account: account! };
}

export async function createMerchantFor(
  ownerId: string,
  over: Partial<typeof merchants.$inferInsert> = {},
): Promise<Merchant> {
  seq += 1;
  const [merchant] = await db
    .insert(merchants)
    .values({
      slug: `negocio-${seq}`,
      name: `Negocio ${seq}`,
      businessCategory: 'panaderia',
      ownerName: 'Dueño de prueba',
      whatsapp: '3001234567',
      address: 'Cra 1 # 2-3',
      neighborhood: 'Chapinero',
      zoneSlug: 'chapinero',
      lat: 4.6432,
      lng: -74.0631,
      stage: 'con_oferta',
      activatedAt: new Date(),
      ...over,
    })
    .returning();
  await db.insert(merchantMembers).values({ merchantId: merchant!.id, userId: ownerId, role: 'owner' });
  return merchant!;
}

export async function createOfferFor(merchantId: string, over: Partial<typeof offers.$inferInsert> = {}) {
  const today = todayInBogota();
  const [offer] = await db
    .insert(offers)
    .values({
      merchantId,
      title: '10 % en panadería',
      discountKind: 'percent',
      discountPercent: 10,
      newCustomersOnly: false,
      holdoutPercent: 0,
      validFrom: addDays(today, -1),
      validUntil: addDays(today, 30),
      status: 'activa',
      ...over,
    })
    .returning();
  return offer!;
}

export interface World {
  /** Persona cuyos datos se intentan tocar. */
  victim: User;
  victimSource: typeof dataSources.$inferSelect;
  victimAccount: typeof accounts.$inferSelect;
  victimTx: typeof transactions.$inferSelect;
  victimCommitment: typeof commitments.$inferSelect;
  victimNotification: typeof notifications.$inferSelect;
  /** Redención de la víctima en el negocio de la víctima (para confirmar, disputar o anular). */
  victimRedemption: typeof redemptions.$inferSelect;

  /** Dueña del negocio que se intenta tocar. */
  victimOwner: User;
  victimMerchant: Merchant;
  victimOffer: typeof offers.$inferSelect;
  /** Segunda oferta activa, sin códigos emitidos, para probar reclamos. */
  victimOffer2: typeof offers.$inferSelect;
  /** Código pendiente (de la víctima) en el negocio de la víctima, listo para cobrar en caja. */
  victimPendingCode: typeof offerCodes.$inferSelect;
  victimInvoice: typeof merchantInvoices.$inferSelect;
  victimPayment: typeof merchantPayments.$inferSelect;
  victimLedgerEntry: typeof merchantLedgerEntries.$inferSelect;

  /** Quien ataca: una persona con cuenta y negocio propios, pero ajena a todo lo anterior. */
  attacker: User;
  attackerAccount: typeof accounts.$inferSelect;
  attackerMerchant: Merchant;

  /** Persona sin negocio. */
  plain: User;
  /** Admin real: correo en ADMIN_EMAILS y verificado. */
  admin: User;
  /** Llave del diccionario de comercios, para la acción de curaduría. */
  catalogKey: string;
}

/** Construye un mundo nuevo y completo. Se llama después de truncateAll(). */
export async function buildWorld(): Promise<World> {
  const today = todayInBogota();
  const period = today.slice(0, 7);

  const victim = await createUser({ email: 'victima@prueba.local', name: 'Valentina Víctima' });
  const { source: victimSource, account: victimAccount } = await createAccountFor(victim.id);
  const [victimTx] = await db
    .insert(transactions)
    .values({
      userId: victim.id,
      accountId: victimAccount.id,
      postedOn: today,
      description: 'COMPRA TIENDAS D1 CHAPINERO',
      amountMinor: -20_000_00,
      merchantKey: 'tiendas_d1',
      merchantName: 'Tiendas D1',
      category: 'mercado',
      dedupeKey: 'tx-victima-1',
    })
    .returning();
  const [victimCommitment] = await db
    .insert(commitments)
    .values({ userId: victim.id, name: 'Arriendo', amountMinor: 650_000_00, dayOfMonth: 5 })
    .returning();
  const [victimNotification] = await db
    .insert(notifications)
    .values({ userId: victim.id, kind: 'sistema', title: 'Aviso de prueba', body: 'Cuerpo del aviso' })
    .returning();

  const victimOwner = await createUser({ email: 'duena@prueba.local', name: 'Rosa Dueña' });
  const victimMerchant = await createMerchantFor(victimOwner.id, { name: 'Panadería de la víctima' });
  const victimOffer = await createOfferFor(victimMerchant.id);
  const victimOffer2 = await createOfferFor(victimMerchant.id, { title: '15 % en cafés' });

  const [victimPendingCode] = await db
    .insert(offerCodes)
    .values({
      offerId: victimOffer.id,
      merchantId: victimMerchant.id,
      userId: victim.id,
      code: 'ABC234',
      qrToken: randomToken(16),
      status: 'pendiente',
      expiresAt: new Date(Date.now() + 30 * 60_000),
    })
    .returning();
  const [redeemedCode] = await db
    .insert(offerCodes)
    .values({
      offerId: victimOffer.id,
      merchantId: victimMerchant.id,
      userId: victim.id,
      code: 'XYZ789',
      qrToken: randomToken(16),
      status: 'redimido',
      expiresAt: new Date(Date.now() - 60_000),
      redeemedAt: new Date(),
    })
    .returning();
  const [victimInvoice] = await db
    .insert(merchantInvoices)
    .values({
      merchantId: victimMerchant.id,
      periodMonth: period,
      redemptionsCount: 1,
      grossSalesMinor: 20_000_00,
      discountsGrantedMinor: 2_000_00,
      netSalesMinor: 18_000_00,
      commissionTotalMinor: 900_00,
      status: 'abierta',
    })
    .returning();
  const [victimRedemption] = await db
    .insert(redemptions)
    .values({
      offerCodeId: redeemedCode!.id,
      offerId: victimOffer.id,
      merchantId: victimMerchant.id,
      userId: victim.id,
      validatedByUserId: victimOwner.id,
      grossAmountMinor: 20_000_00,
      discountMinor: 2_000_00,
      netPaidByUserMinor: 18_000_00,
      commissionBps: 500,
      cifraCommissionMinor: 900_00,
      cifraNetRevenueMinor: 900_00,
      merchantNetKeepMinor: 17_100_00,
      invoiceId: victimInvoice!.id,
    })
    .returning();
  const [victimPayment] = await db
    .insert(merchantPayments)
    .values({
      invoiceId: victimInvoice!.id,
      merchantId: victimMerchant.id,
      method: 'breb',
      amountMinor: 900_00,
      reference: 'COMPROBANTE-INICIAL',
      status: 'reportado',
    })
    .returning();
  const [victimLedgerEntry] = await db
    .insert(merchantLedgerEntries)
    .values({
      merchantId: victimMerchant.id,
      entryOn: today,
      kind: 'venta_mostrador',
      categoryLabel: 'Ventas de mostrador',
      amountMinor: 50_000_00,
    })
    .returning();

  const attacker = await createUser({ email: 'atacante@prueba.local', name: 'Andrés Atacante' });
  const { account: attackerAccount } = await createAccountFor(attacker.id, 300_000_00);
  const attackerMerchant = await createMerchantFor(attacker.id, { name: 'Negocio del atacante' });
  await createOfferFor(attackerMerchant.id, { title: 'Oferta del atacante' });

  const plain = await createUser({ email: 'sin-negocio@prueba.local', name: 'Pablo Sin Negocio' });
  await createAccountFor(plain.id, 100_000_00);
  const admin = await createUser({ email: ADMIN_EMAIL, name: 'Admin de prueba', emailVerifiedAt: new Date() });

  const catalogKey = 'tienda_prueba';
  await db
    .insert(merchantCatalog)
    .values({ merchantKey: catalogKey, displayName: 'Tienda de prueba', category: 'mercado', verified: false });

  return {
    victim,
    victimSource,
    victimAccount,
    victimTx: victimTx!,
    victimCommitment: victimCommitment!,
    victimNotification: victimNotification!,
    victimRedemption: victimRedemption!,
    victimOwner,
    victimMerchant,
    victimOffer,
    victimOffer2,
    victimPendingCode: victimPendingCode!,
    victimInvoice: victimInvoice!,
    victimPayment: victimPayment!,
    victimLedgerEntry: victimLedgerEntry!,
    attacker,
    attackerAccount,
    attackerMerchant,
    plain,
    admin,
    catalogKey,
  };
}

async function dump(query: ReturnType<typeof sql>): Promise<unknown> {
  const rows = await db.execute<{ data: unknown }>(query);
  return rows[0]?.data ?? [];
}

/**
 * Foto de todo lo que le pertenece a la víctima (la persona y el negocio). Si una llamada hecha
 * por otra persona, o sin sesión, cambia un solo campo de esta foto, la prueba falla.
 */
export async function victimSnapshot(w: World): Promise<string> {
  const people = sql`(${w.victim.id}::uuid, ${w.victimOwner.id}::uuid)`;
  const merchant = sql`${w.victimMerchant.id}::uuid`;
  const all = (table: string, where: ReturnType<typeof sql>) =>
    dump(
      sql`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb) as data from ${sql.raw(`"${table}"`)} t where ${where}`,
    );

  const personTables = [
    'data_sources',
    'accounts',
    'transactions',
    'commitments',
    'recurring_marks',
    'notifications',
    'savings_events',
    'cycle_snapshots',
    'user_category_rules',
    'paid_cycle_charges',
    'push_subscriptions',
    'access_log',
    'offer_codes',
    'oauth_accounts',
  ];
  const merchantTables = ['merchant_members', 'offers', 'merchant_invoices', 'merchant_payments', 'merchant_ledger_entries'];

  const out: Record<string, unknown> = {};
  out.users = await all('users', sql`t.id in ${people}`);
  for (const table of personTables) out[table] = await all(table, sql`t.user_id in ${people}`);
  out.merchants = await all('merchants', sql`t.id = ${merchant}`);
  for (const table of merchantTables) out[table] = await all(table, sql`t.merchant_id = ${merchant}`);
  out.redemptions = await all('redemptions', sql`t.user_id in ${people} or t.merchant_id = ${merchant}`);
  return JSON.stringify(out);
}

/** Foto de lo que solo un admin debería poder cambiar, más allá de la víctima. */
export async function globalSnapshot(): Promise<string> {
  const out: Record<string, unknown> = {};
  out.merchants = await dump(sql`select jsonb_agg(jsonb_build_array(id, stage) order by id) as data from merchants`);
  out.offers = await dump(sql`select jsonb_agg(jsonb_build_array(id, status) order by id) as data from offers`);
  out.invites = await dump(sql`select to_jsonb(count(*)) as data from merchant_invites`);
  out.partners = await dump(sql`select to_jsonb(count(*)) as data from partners`);
  out.partnerKeys = await dump(sql`select to_jsonb(count(*)) as data from partner_api_keys`);
  out.catalog = await dump(
    sql`select jsonb_agg(jsonb_build_array(merchant_key, verified) order by merchant_key) as data from merchant_catalog`,
  );
  out.invoices = await dump(sql`select jsonb_agg(jsonb_build_array(id, status) order by id) as data from merchant_invoices`);
  out.payments = await dump(sql`select jsonb_agg(jsonb_build_array(id, status) order by id) as data from merchant_payments`);
  out.redemptions = await dump(sql`select jsonb_agg(jsonb_build_array(id, status) order by id) as data from redemptions`);
  return JSON.stringify(out);
}
