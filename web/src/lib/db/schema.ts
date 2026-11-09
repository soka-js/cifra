import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  doublePrecision,
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
export const userRole = pgEnum('user_role', ['user', 'admin']);

export interface UserConsentMandateConfig {
  durationDays: 90 | 180 | 365;
  scopeRecurring: boolean;
  scopeGeoNba: boolean;
  scopeFutureOpenFinanceApi: boolean;
  updatedAtIso: string;
  mandateHash: string;
}

export interface UserAppPreferences {
  goalPresetId?: string;
  goalTitle?: string;
  goalCategoryLabel?: string;
  goalTargetMinor?: number;
  goalSavedBaseMinor?: number;
  goalMonthlyPaceMinor?: number;
  committedNbaIds?: string[];
  planTier?: 'esencial' | 'plus';
  consentMandate?: UserConsentMandateConfig;
}

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email'),
    passwordHash: text('password_hash'),
    name: text('name'),
    role: userRole('role').notNull().default('user'),
    isDemo: boolean('is_demo').notNull().default(false),
    partnerId: uuid('partner_id').references(() => partners.id, { onDelete: 'cascade' }),
    partnerMemberId: text('partner_member_id'),
    incomeFrequency: incomeFrequency('income_frequency'),
    /** Días del mes en que entra el ingreso: [30] mensual, [15, 30] quincenal. Para semanal, día de la semana 1-7. */
    incomeDays: integer('income_days').array(),
    bufferMinor: money('buffer_minor').notNull().default(0),
    /** Gasto del día a día que la persona escribió (modo rápido). Se usa mientras no haya tres semanas de movimientos. */
    dailySpendMinor: money('daily_spend_minor'),
    /** Zona o barrio principal en Bogotá (ej. 'chapinero', 'las-aguas', 'teusaquillo') para cruzar ofertas cercanas. */
    zoneSlug: text('zone_slug'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
    /** Instante en que vio su primera cifra lista: mide el criterio "< 5 minutos hasta la primera cifra". */
    firstCifraAt: timestamp('first_cifra_at', { withTimezone: true }),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    consentVersion: text('consent_version'),
    consentAt: timestamp('consent_at', { withTimezone: true }),
    signupVariant: text('signup_variant'),
    signupUtm: jsonb('signup_utm').$type<Record<string, string>>(),
    /** Preferencias persistidas de producto (meta activa, NBA comprometidas, plan Esencial/Plus, mandato Ley 1581). */
    appPreferences: jsonb('app_preferences').$type<UserAppPreferences>().notNull().default(sql`'{}'::jsonb`),
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

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('oauth_provider_account_unique').on(t.provider, t.providerAccountId),
    index('oauth_user_idx').on(t.userId),
  ],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('password_reset_user_idx').on(t.userId)],
);

export const partners = pgTable('partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  /** Reparto de comisión en puntos básicos (3000 = 30 % para el aliado B2B2C según J.3). */
  revenueShareBps: integer('revenue_share_bps').notNull().default(3000),
  contactEmail: text('contact_email'),
  active: boolean('active').notNull().default(true),
  isDemo: boolean('is_demo').notNull().default(false),
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
    /** Comercio normalizado y categoría persistida (permiten corrección en 1 toque y cruces rápidos). */
    merchantKey: text('merchant_key'),
    merchantName: text('merchant_name'),
    category: text('category'),
    categorySource: text('category_source').notNull().default('auto'),
    /** Hora local en Bogotá (0..23) cuando se conoce por SMS, comprobante, captura rápida o Caja POS. */
    spentHour: integer('spent_hour'),
    /** Canal de captura: 'extracto' | 'rapido' | 'sms_banco' | 'comprobante' | 'caja_cifra'. */
    captureMethod: text('capture_method').notNull().default('extracto'),
    /** Huella para no duplicar al volver a subir el mismo extracto. */
    dedupeKey: text('dedupe_key').notNull(),
    /** La persona decidió que este movimiento no cuente en la cifra (por ejemplo, una compra única que ya pasó). */
    excluded: boolean('excluded').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('transactions_user_date_idx').on(t.userId, t.postedOn),
    index('transactions_user_merchant_idx').on(t.userId, t.merchantKey),
    uniqueIndex('transactions_account_dedupe_unique').on(t.accountId, t.dedupeKey),
  ],
);

/** Regla personal cuando la persona corrige la categoría de un comercio en un toque (H.1.1). */
export const userCategoryRules = pgTable(
  'user_category_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    merchantKey: text('merchant_key').notNull(),
    customName: text('custom_name'),
    category: text('category').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('user_category_rules_pk').on(t.userId, t.merchantKey)],
);

/** Diccionario global de comercios colombianos que aprende de las correcciones (Ventaja Injusta, H.5). */
export const merchantCatalog = pgTable('merchant_catalog', {
  merchantKey: text('merchant_key').primaryKey(),
  displayName: text('display_name').notNull(),
  category: text('category').notNull(),
  aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
  cancelUrl: text('cancel_url'),
  cancelSteps: jsonb('cancel_steps').$type<string[]>(),
  votesCount: integer('votes_count').notNull().default(1),
  verified: boolean('verified').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

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
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    savedMonthlyMinor: money('saved_monthly_minor'),
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
    /** Cobros detectados que la persona dijo que no son este compromiso (para no volver a preguntar). */
    notSameAs: text('not_same_as').array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('commitments_user_idx').on(t.userId)],
);

/** Checklist de cobros intocables de la quincena que la persona ya marcó como pagados en el ciclo actual. */
export const paidCycleCharges = pgTable(
  'paid_cycle_charges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    chargeKey: text('charge_key').notNull(),
    label: text('label').notNull(),
    cycleEnd: date('cycle_end', { mode: 'string' }).notNull(),
    amountMinor: money('amount_minor').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('paid_cycle_charges_unique').on(t.userId, t.chargeKey, t.cycleEnd)],
);

export const savingsKind = pgEnum('savings_kind', ['cobro_cancelado', 'oferta_redimida', 'comision_evitada']);

/** Pesos ahorrados reales y verificables por la persona (recurrentes cancelados + ofertas redimidas). */
export const savingsEvents = pgTable(
  'savings_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: savingsKind('kind').notNull(),
    amountMinor: money('amount_minor').notNull(),
    referenceKey: text('reference_key').notNull(),
    label: text('label').notNull(),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('savings_events_user_date_idx').on(t.userId, t.occurredOn),
    uniqueIndex('savings_events_user_ref_unique').on(t.userId, t.kind, t.referenceKey),
  ],
);

/** Resumen comparativo al cerrar un ciclo de ingreso (Etapa 7 del mapa de recorrido C.5). */
export const cycleSnapshots = pgTable(
  'cycle_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cycleStart: date('cycle_start', { mode: 'string' }).notNull(),
    cycleEnd: date('cycle_end', { mode: 'string' }).notNull(),
    incomeMinor: money('income_minor').notNull().default(0),
    fixedMinor: money('fixed_minor').notNull().default(0),
    variableMinor: money('variable_minor').notNull().default(0),
    savedMinor: money('saved_minor').notNull().default(0),
    closingAvailableMinor: money('closing_available_minor').notNull().default(0),
    topCategories: jsonb('top_categories').$type<Array<{ category: string; amountMinor: number }>>(),
    committedAction: text('committed_action'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('cycle_snapshots_user_period_unique').on(t.userId, t.cycleStart, t.cycleEnd)],
);

// ---------------------------------------------------------------------------
// Lado B2B: Micronegocio de barrio (Rosa), Ofertas, Atribución y Comisiones
// ---------------------------------------------------------------------------

export const merchantBusinessCategory = pgEnum('merchant_business_category', [
  'panaderia',
  'tienda',
  'cafeteria',
  'restaurante',
  'fruver',
  'papeleria',
  'drogueria',
  'peluqueria',
  'servicios',
  'otro',
]);

export const merchantStage = pgEnum('merchant_stage', [
  'prospecto',
  'invitado',
  'activo',
  'con_oferta',
  'pausado',
]);

export interface MerchantFeaturedItem {
  name: string;
  priceMinor: number;
  costMinor?: number;
  tag?: string;
}

export interface MerchantMandateConfig {
  collectionMethod: 'debito_automatico' | 'bolsa_prepago';
  mandateActive: boolean;
  selectedChannel: 'breb' | 'nequi' | 'bancolombia_ach';
  safetyCapMinor: number;
  prepaidBalanceMinor: number;
  lastAutoSettledAtIso?: string;
  lastAutoSettledRef?: string;
  lastAutoSettledAmountMinor?: number;
}

export const merchants = pgTable(
  'merchants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    businessCategory: merchantBusinessCategory('business_category').notNull().default('tienda'),
    targetSpendCategory: text('target_spend_category').notNull().default('comida'),
    description: text('description'),
    ownerName: text('owner_name').notNull(),
    whatsapp: text('whatsapp').notNull(),
    email: text('email'),
    address: text('address').notNull(),
    neighborhood: text('neighborhood').notNull(),
    zoneSlug: text('zone_slug').notNull().default('chapinero'),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    hoursText: text('hours_text'),
    typicalTicketMinor: money('typical_ticket_minor').notNull().default(2000000),
    /** Productos estrella visibles en la vitrina pública /b/[slug] y calculadora de margen. */
    featuredItems: jsonb('featured_items').$type<MerchantFeaturedItem[]>().notNull().default(sql`'[]'::jsonb`),
    /** Meta diaria de ventas en centavos para cubrir arriendo + servicios + insumos (punto de equilibrio). */
    dailyBreakEvenMinor: money('daily_break_even_minor').notNull().default(40000000),
    /** Costos fijos mensuales del local (arriendo, luz, gas, internet, ayuda) en centavos. */
    monthlyFixedCostMinor: money('monthly_fixed_cost_minor').notNull().default(450000000),
    /** Comisión de CIFRA en puntos básicos sobre el pago neto de la venta atribuida (500 = 5,00 % en G.10 y J.3). */
    commissionBps: integer('commission_bps').notNull().default(500),
    /** Palabras clave que aparecen en extractos bancarios para medir compras previas y retorno sin descuento. */
    matchKeywords: text('match_keywords').array().notNull().default(sql`'{}'::text[]`),
    brebKey: text('breb_key'),
    nequiNumber: text('nequi_number'),
    /** Configuración de mandato de débito automático quincenal y bolsa prepago en PostgreSQL. */
    mandateConfig: jsonb('mandate_config').$type<MerchantMandateConfig>().notNull().default(sql`'{}'::jsonb`),
    stage: merchantStage('stage').notNull().default('prospecto'),
    acquiredBy: text('acquired_by'),
    /** Costo de activación de calle (J.4: $25.000 COP = 2_500_000 centavos). */
    acquisitionCostMinor: money('acquisition_cost_minor').notNull().default(2500000),
    isDemo: boolean('is_demo').notNull().default(false),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('merchants_zone_idx').on(t.zoneSlug, t.stage)],
);

export const merchantMemberRole = pgEnum('merchant_member_role', ['owner', 'cashier']);

export const merchantMembers = pgTable(
  'merchant_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: merchantMemberRole('role').notNull().default('owner'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('merchant_members_unique').on(t.merchantId, t.userId),
    index('merchant_members_user_idx').on(t.userId),
  ],
);

export const merchantInvites = pgTable(
  'merchant_invites',
  {
    tokenHash: text('token_hash').primaryKey(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('merchant_invites_merchant_idx').on(t.merchantId)],
);

export const discountKind = pgEnum('discount_kind', ['percent', 'fixed']);
export const offerStatus = pgEnum('offer_status', ['borrador', 'activa', 'pausada', 'vencida', 'rechazada']);

export const offers = pgTable(
  'offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    targetCategory: text('target_category').notNull().default('comida'),
    discountKind: discountKind('discount_kind').notNull().default('percent'),
    /** Porcentaje entero (ej. 10 = 10 %) cuando discountKind = 'percent'. */
    discountPercent: integer('discount_percent'),
    /** Descuento fijo en centavos cuando discountKind = 'fixed'. */
    discountFixedMinor: money('discount_fixed_minor'),
    maxDiscountMinor: money('max_discount_minor'),
    minPurchaseMinor: money('min_purchase_minor').notNull().default(0),
    /** Control de canibalización #1 (G.10): restringir oferta a quien no compró ahí en los últimos N días. */
    newCustomersOnly: boolean('new_customers_only').notNull().default(true),
    exclusivityDays: integer('exclusivity_days').notNull().default(60),
    /** Control de canibalización #2 (G.10): % de audiencia retenida como grupo de control sin oferta (ej. 10 %). */
    holdoutPercent: integer('holdout_percent').notNull().default(10),
    monthlyCapRedemptions: integer('monthly_cap_redemptions'),
    /** Oferta Relámpago de horas muertas / cero merma con ventana horaria y cupos vivos. */
    isFlash: boolean('is_flash').notNull().default(false),
    startHour: integer('start_hour'),
    endHour: integer('end_hour'),
    activeDays: integer('active_days').array().notNull().default(sql`'{0,1,2,3,4,5,6}'::integer[]`),
    stockLimit: integer('stock_limit'),
    stockRemaining: integer('stock_remaining'),
    /** Costo estimado de insumos del producto/combo para proteger el margen real del tendero. */
    unitCostMinor: money('unit_cost_minor'),
    validFrom: date('valid_from', { mode: 'string' }).notNull(),
    validUntil: date('valid_until', { mode: 'string' }).notNull(),
    activeHoursText: text('active_hours_text'),
    status: offerStatus('status').notNull().default('activa'),
    /** Si es renovación de una campaña anterior, enlaza la campaña previa para medir el umbral de 50 % a 3 meses. */
    renewedFromOfferId: uuid('renewed_from_offer_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('offers_merchant_status_idx').on(t.merchantId, t.status)],
);

/** Libro diario del tendero: ventas de mostrador, gastos de insumos y costos fijos del local (/negocio/cuadre). */
export const merchantLedgerEntries = pgTable(
  'merchant_ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    entryOn: date('entry_on', { mode: 'string' }).notNull(),
    /** 'venta_mostrador' | 'venta_cifra' | 'insumos' | 'servicios_arriendo' | 'nomina_otros' */
    kind: text('kind').notNull(),
    categoryLabel: text('category_label').notNull(),
    supplierName: text('supplier_name'),
    amountMinor: money('amount_minor').notNull(),
    note: text('note'),
    refRedemptionId: uuid('ref_redemption_id').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('merchant_ledger_date_idx').on(t.merchantId, t.entryOn)],
);

export const offerCodeStatus = pgEnum('offer_code_status', ['pendiente', 'redimido', 'vencido', 'cancelado']);
export const attributionChannel = pgEnum('attribution_channel', ['propio', 'aliado']);

export const offerCodes = pgTable(
  'offer_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    offerId: uuid('offer_id')
      .notNull()
      .references(() => offers.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Código corto legible en caja (6 caracteres sin ambigüedad, ej. "7K4M9P"). */
    code: text('code').notNull(),
    /** Token aleatorio incluido en el QR para escaneo directo desde la caja del negocio. */
    qrToken: text('qr_token').notNull().unique(),
    wasNewCustomer: boolean('was_new_customer').notNull().default(true),
    channel: attributionChannel('channel').notNull().default('propio'),
    partnerId: uuid('partner_id').references(() => partners.id, { onDelete: 'set null' }),
    status: offerCodeStatus('status').notNull().default('pendiente'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('offer_codes_code_idx').on(t.code, t.status),
    index('offer_codes_user_idx').on(t.userId, t.createdAt),
    index('offer_codes_merchant_idx').on(t.merchantId, t.status),
  ],
);

export const invoiceStatus = pgEnum('invoice_status', [
  'abierta',
  'pendiente_pago',
  'en_verificacion',
  'pagada',
  'anulada',
]);

export const merchantInvoices = pgTable(
  'merchant_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    /** Mes facturado en formato AAAA-MM (ej. '2026-11'). */
    periodMonth: text('period_month').notNull(),
    redemptionsCount: integer('redemptions_count').notNull().default(0),
    grossSalesMinor: money('gross_sales_minor').notNull().default(0),
    discountsGrantedMinor: money('discounts_granted_minor').notNull().default(0),
    netSalesMinor: money('net_sales_minor').notNull().default(0),
    commissionTotalMinor: money('commission_total_minor').notNull().default(0),
    status: invoiceStatus('status').notNull().default('abierta'),
    dueOn: date('due_on', { mode: 'string' }),
    reportSnapshot: jsonb('report_snapshot').$type<Record<string, unknown>>(),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('merchant_invoices_period_unique').on(t.merchantId, t.periodMonth)],
);

export const redemptionStatus = pgEnum('redemption_status', ['valida', 'en_revision', 'anulada']);

export const redemptions = pgTable(
  'redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    offerCodeId: uuid('offer_code_id')
      .notNull()
      .unique()
      .references(() => offerCodes.id, { onDelete: 'cascade' }),
    offerId: uuid('offer_id')
      .notNull()
      .references(() => offers.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    validatedByUserId: uuid('validated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    channel: attributionChannel('channel').notNull().default('propio'),
    partnerId: uuid('partner_id').references(() => partners.id, { onDelete: 'set null' }),
    /** Valor original del ticket antes del descuento (ej. $20.000). */
    grossAmountMinor: money('gross_amount_minor').notNull(),
    /** Descuento asumido por el comercio (ej. 10 % = $2.000). */
    discountMinor: money('discount_minor').notNull(),
    /** Lo que paga la persona en caja (ej. $18.000). */
    netPaidByUserMinor: money('net_paid_by_user_minor').notNull(),
    commissionBps: integer('commission_bps').notNull().default(500),
    /** Comisión de CIFRA: 5 % de la venta cobrada ($900 sobre $18.000 en G.10). */
    cifraCommissionMinor: money('cifra_commission_minor').notNull(),
    /** Reparto al aliado B2B2C si aplica (30 % de $900 = $270 en J.3; $0 en canal propio). */
    partnerShareMinor: money('partner_share_minor').notNull().default(0),
    cifraNetRevenueMinor: money('cifra_net_revenue_minor').notNull(),
    /** Lo que le queda neto al negocio ($17.100 en el ejemplo de G.10). */
    merchantNetKeepMinor: money('merchant_net_keep_minor').notNull(),
    isNewCustomer: boolean('is_new_customer').notNull().default(true),
    userConfirmedAt: timestamp('user_confirmed_at', { withTimezone: true }),
    disputedAt: timestamp('disputed_at', { withTimezone: true }),
    disputeReason: text('dispute_reason'),
    status: redemptionStatus('status').notNull().default('valida'),
    invoiceId: uuid('invoice_id').references(() => merchantInvoices.id, { onDelete: 'set null' }),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('redemptions_merchant_date_idx').on(t.merchantId, t.redeemedAt),
    index('redemptions_user_date_idx').on(t.userId, t.redeemedAt),
    index('redemptions_partner_idx').on(t.partnerId, t.redeemedAt),
  ],
);

export const paymentMethod = pgEnum('payment_method', ['breb', 'nequi', 'transferencia', 'wompi']);
export const paymentStatus = pgEnum('payment_status', ['reportado', 'aprobado', 'rechazado']);

export const merchantPayments = pgTable(
  'merchant_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => merchantInvoices.id, { onDelete: 'cascade' }),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    method: paymentMethod('method').notNull().default('breb'),
    amountMinor: money('amount_minor').notNull(),
    reference: text('reference').notNull(),
    note: text('note'),
    wompiTransactionId: text('wompi_transaction_id'),
    status: paymentStatus('status').notNull().default('reportado'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('merchant_payments_invoice_idx').on(t.invoiceId)],
);

// ---------------------------------------------------------------------------
// Avisos, Retención, Bitácora y Analítica
// ---------------------------------------------------------------------------

export const notificationKind = pgEnum('notification_kind', [
  'desviacion_patron',
  'cobro_recurrente',
  'oferta_cercana',
  'cierre_ciclo',
  'redencion_confirmada',
  'sistema',
]);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: notificationKind('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    actionUrl: text('action_url'),
    dedupeKey: text('dedupe_key'),
    readAt: timestamp('read_at', { withTimezone: true }),
    emailedAt: timestamp('emailed_at', { withTimezone: true }),
    pushedAt: timestamp('pushed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId, t.createdAt),
    uniqueIndex('notifications_user_dedupe_unique')
      .on(t.userId, t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null`),
  ],
);

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('push_subscriptions_user_idx').on(t.userId)],
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

export const leadKind = pgEnum('lead_kind', ['entidad', 'negocio']);

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
export type Merchant = typeof merchants.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type OfferCode = typeof offerCodes.$inferSelect;
export type Redemption = typeof redemptions.$inferSelect;
export type MerchantInvoice = typeof merchantInvoices.$inferSelect;
export type MerchantPayment = typeof merchantPayments.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type PaidCycleCharge = typeof paidCycleCharges.$inferSelect;
export type MerchantLedgerEntry = typeof merchantLedgerEntries.$inferSelect;

