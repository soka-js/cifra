import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** Montos en centavos de peso (enteros). Negativo = sale plata, positivo = entra. */
const money = (name: string) => bigint(name, { mode: 'number' });

export const incomeFrequency = pgEnum('income_frequency', ['mensual', 'quincenal', 'semanal', 'irregular']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email'),
    passwordHash: text('password_hash'),
    name: text('name'),
    partnerId: uuid('partner_id').references(() => partners.id, { onDelete: 'cascade' }),
    partnerMemberId: text('partner_member_id'),
    incomeFrequency: incomeFrequency('income_frequency'),
    /** Días del mes en que entra el ingreso: [30] mensual, [15, 30] quincenal. Para semanal, día de la semana 1-7. */
    incomeDays: integer('income_days').array(),
    bufferMinor: money('buffer_minor').notNull().default(0),
    onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
    consentVersion: text('consent_version'),
    consentAt: timestamp('consent_at', { withTimezone: true }),
    signupVariant: text('signup_variant'),
    signupUtm: jsonb('signup_utm').$type<Record<string, string>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(sql`lower(${t.email})`).where(sql`${t.email} is not null`),
    uniqueIndex('users_partner_member_unique')
      .on(t.partnerId, t.partnerMemberId)
      .where(sql`${t.partnerId} is not null`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 del token que va en la cookie; el token en claro nunca se guarda. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const partners = pgTable('partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const partnerApiKeys = pgTable('partner_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  partnerId: uuid('partner_id')
    .notNull()
    .references(() => partners.id, { onDelete: 'cascade' }),
  /** Primeros caracteres visibles, para reconocer la llave sin guardarla. */
  prefix: text('prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const embedTokens = pgTable('embed_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  partnerId: uuid('partner_id')
    .notNull()
    .references(() => partners.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});

export const sourceKind = pgEnum('source_kind', ['entidad_aliada', 'extracto', 'finanzas_abiertas', 'manual']);
export const sourceStatus = pgEnum('source_status', ['activa', 'revocada', 'vencida']);

/**
 * De dónde vienen los datos. Cada cuenta pertenece a una fuente, y la pantalla
 * "Tus datos" muestra exactamente esto: entidad, tipo de fuente, qué datos trae y desde cuándo.
 */
export const dataSources = pgTable(
  'data_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: sourceKind('kind').notNull(),
    entityName: text('entity_name').notNull(),
    partnerId: uuid('partner_id').references(() => partners.id, { onDelete: 'set null' }),
    /** Qué trae: 'saldos', 'movimientos'. */
    scopes: text('scopes').array().notNull(),
    status: sourceStatus('status').notNull().default('activa'),
    consentRef: text('consent_ref'),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    /** Rango de fechas cubierto por los movimientos importados. */
    coverageFrom: date('coverage_from'),
    coverageTo: date('coverage_to'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('data_sources_user_idx').on(t.userId)],
);

export const accountKind = pgEnum('account_kind', ['ahorros', 'corriente', 'billetera', 'tarjeta_credito', 'otra']);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    externalId: text('external_id'),
    kind: accountKind('kind').notNull().default('ahorros'),
    name: text('name').notNull(),
    mask: text('mask'),
    balanceMinor: money('balance_minor'),
    balanceAt: timestamp('balance_at', { withTimezone: true }),
    includeInCifra: boolean('include_in_cifra').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('accounts_user_idx').on(t.userId),
    uniqueIndex('accounts_source_external_unique')
      .on(t.sourceId, t.externalId)
      .where(sql`${t.externalId} is not null`),
  ],
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    externalId: text('external_id'),
    postedOn: date('posted_on', { mode: 'string' }).notNull(),
    description: text('description').notNull(),
    amountMinor: money('amount_minor').notNull(),
    /** Huella para no duplicar al volver a subir el mismo extracto. */
    dedupeKey: text('dedupe_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('transactions_user_date_idx').on(t.userId, t.postedOn),
    uniqueIndex('transactions_account_dedupe_unique').on(t.accountId, t.dedupeKey),
  ],
);

export const recurringMark = pgEnum('recurring_mark', ['lo_uso', 'no_lo_uso', 'no_es_fijo']);

/** Lo que la persona dice de un cobro que se repite. La serie se calcula; la marca se guarda. */
export const recurringMarks = pgTable(
  'recurring_marks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    merchantKey: text('merchant_key').notNull(),
    mark: recurringMark('mark').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('recurring_marks_pk').on(t.userId, t.merchantKey)],
);

/** Compromisos que no aparecen en los movimientos (por ejemplo, un arriendo que se paga en efectivo). */
export const commitments = pgTable(
  'commitments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    amountMinor: money('amount_minor').notNull(),
    dayOfMonth: integer('day_of_month').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('commitments_user_idx').on(t.userId)],
);

/** Registro de quién tocó los datos de la persona (entidad aliada, la persona misma). */
export const accessLog = pgTable(
  'access_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('access_log_user_idx').on(t.userId, t.at)],
);

/** Analítica propia de la landing y del embudo. Sin datos personales: un id anónimo por navegador. */
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    visitorId: text('visitor_id').notNull(),
    userId: uuid('user_id'),
    name: text('name').notNull(),
    path: text('path'),
    variant: text('variant'),
    props: jsonb('props').$type<Record<string, string | number | boolean | null>>(),
    utm: jsonb('utm').$type<Record<string, string>>(),
    referrer: text('referrer'),
    device: text('device'),
  },
  (t) => [index('events_name_at_idx').on(t.name, t.at), index('events_visitor_idx').on(t.visitorId)],
);

export const leadKind = pgEnum('lead_kind', ['entidad']);

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: leadKind('kind').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  organization: text('organization').notNull(),
  role: text('role'),
  members: text('members'),
  message: text('message'),
  visitorId: text('visitor_id'),
  variant: text('variant'),
  utm: jsonb('utm').$type<Record<string, string>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Límite de intentos por ventana (ingreso, registro, formularios). */
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull(),
});

export type User = typeof users.$inferSelect;
export type DataSource = typeof dataSources.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
