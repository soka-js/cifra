CREATE TYPE "public"."attribution_channel" AS ENUM('propio', 'aliado');--> statement-breakpoint
CREATE TYPE "public"."discount_kind" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('abierta', 'pendiente_pago', 'en_verificacion', 'pagada', 'anulada');--> statement-breakpoint
CREATE TYPE "public"."merchant_business_category" AS ENUM('panaderia', 'tienda', 'cafeteria', 'restaurante', 'fruver', 'papeleria', 'drogueria', 'peluqueria', 'servicios', 'otro');--> statement-breakpoint
CREATE TYPE "public"."merchant_member_role" AS ENUM('owner', 'cashier');--> statement-breakpoint
CREATE TYPE "public"."merchant_stage" AS ENUM('prospecto', 'invitado', 'activo', 'con_oferta', 'pausado');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('desviacion_patron', 'cobro_recurrente', 'oferta_cercana', 'cierre_ciclo', 'redencion_confirmada', 'sistema');--> statement-breakpoint
CREATE TYPE "public"."offer_code_status" AS ENUM('pendiente', 'redimido', 'vencido', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('borrador', 'activa', 'pausada', 'vencida', 'rechazada');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('breb', 'nequi', 'transferencia', 'wompi');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('reportado', 'aprobado', 'rechazado');--> statement-breakpoint
CREATE TYPE "public"."redemption_status" AS ENUM('valida', 'en_revision', 'anulada');--> statement-breakpoint
CREATE TYPE "public"."savings_kind" AS ENUM('cobro_cancelado', 'oferta_redimida', 'comision_evitada');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
ALTER TYPE "public"."lead_kind" ADD VALUE IF NOT EXISTS 'negocio';--> statement-breakpoint
CREATE TABLE "cycle_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cycle_start" date NOT NULL,
	"cycle_end" date NOT NULL,
	"income_minor" bigint DEFAULT 0 NOT NULL,
	"fixed_minor" bigint DEFAULT 0 NOT NULL,
	"variable_minor" bigint DEFAULT 0 NOT NULL,
	"saved_minor" bigint DEFAULT 0 NOT NULL,
	"closing_available_minor" bigint DEFAULT 0 NOT NULL,
	"top_categories" jsonb,
	"committed_action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_catalog" (
	"merchant_key" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"category" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"cancel_url" text,
	"cancel_steps" jsonb,
	"votes_count" integer DEFAULT 1 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_invites" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"period_month" text NOT NULL,
	"redemptions_count" integer DEFAULT 0 NOT NULL,
	"gross_sales_minor" bigint DEFAULT 0 NOT NULL,
	"discounts_granted_minor" bigint DEFAULT 0 NOT NULL,
	"net_sales_minor" bigint DEFAULT 0 NOT NULL,
	"commission_total_minor" bigint DEFAULT 0 NOT NULL,
	"status" "invoice_status" DEFAULT 'abierta' NOT NULL,
	"due_on" date,
	"report_snapshot" jsonb,
	"issued_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "merchant_member_role" DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"method" "payment_method" DEFAULT 'breb' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"reference" text NOT NULL,
	"note" text,
	"wompi_transaction_id" text,
	"status" "payment_status" DEFAULT 'reportado' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"business_category" "merchant_business_category" DEFAULT 'tienda' NOT NULL,
	"target_spend_category" text DEFAULT 'comida' NOT NULL,
	"description" text,
	"owner_name" text NOT NULL,
	"whatsapp" text NOT NULL,
	"email" text,
	"address" text NOT NULL,
	"neighborhood" text NOT NULL,
	"zone_slug" text DEFAULT 'chapinero' NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"hours_text" text,
	"typical_ticket_minor" bigint DEFAULT 2000000 NOT NULL,
	"commission_bps" integer DEFAULT 500 NOT NULL,
	"match_keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"breb_key" text,
	"nequi_number" text,
	"stage" "merchant_stage" DEFAULT 'prospecto' NOT NULL,
	"acquired_by" text,
	"acquisition_cost_minor" bigint DEFAULT 2500000 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"action_url" text,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"pushed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"qr_token" text NOT NULL,
	"was_new_customer" boolean DEFAULT true NOT NULL,
	"channel" "attribution_channel" DEFAULT 'propio' NOT NULL,
	"partner_id" uuid,
	"status" "offer_code_status" DEFAULT 'pendiente' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_codes_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_category" text DEFAULT 'comida' NOT NULL,
	"discount_kind" "discount_kind" DEFAULT 'percent' NOT NULL,
	"discount_percent" integer,
	"discount_fixed_minor" bigint,
	"max_discount_minor" bigint,
	"min_purchase_minor" bigint DEFAULT 0 NOT NULL,
	"new_customers_only" boolean DEFAULT true NOT NULL,
	"exclusivity_days" integer DEFAULT 60 NOT NULL,
	"holdout_percent" integer DEFAULT 10 NOT NULL,
	"monthly_cap_redemptions" integer,
	"valid_from" date NOT NULL,
	"valid_until" date NOT NULL,
	"active_hours_text" text,
	"status" "offer_status" DEFAULT 'activa' NOT NULL,
	"renewed_from_offer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_code_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"validated_by_user_id" uuid,
	"channel" "attribution_channel" DEFAULT 'propio' NOT NULL,
	"partner_id" uuid,
	"gross_amount_minor" bigint NOT NULL,
	"discount_minor" bigint NOT NULL,
	"net_paid_by_user_minor" bigint NOT NULL,
	"commission_bps" integer DEFAULT 500 NOT NULL,
	"cifra_commission_minor" bigint NOT NULL,
	"partner_share_minor" bigint DEFAULT 0 NOT NULL,
	"cifra_net_revenue_minor" bigint NOT NULL,
	"merchant_net_keep_minor" bigint NOT NULL,
	"is_new_customer" boolean DEFAULT true NOT NULL,
	"user_confirmed_at" timestamp with time zone,
	"disputed_at" timestamp with time zone,
	"dispute_reason" text,
	"status" "redemption_status" DEFAULT 'valida' NOT NULL,
	"invoice_id" uuid,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redemptions_offer_code_id_unique" UNIQUE("offer_code_id")
);
--> statement-breakpoint
CREATE TABLE "savings_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "savings_kind" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"reference_key" text NOT NULL,
	"label" text NOT NULL,
	"occurred_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_category_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"merchant_key" text NOT NULL,
	"custom_name" text,
	"category" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "revenue_share_bps" integer DEFAULT 3000 NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_marks" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recurring_marks" ADD COLUMN "saved_monthly_minor" bigint;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "merchant_key" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "merchant_name" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "category_source" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "zone_slug" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "lng" double precision;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_cifra_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_active_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cycle_snapshots" ADD CONSTRAINT "cycle_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_invites" ADD CONSTRAINT "merchant_invites_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_invites" ADD CONSTRAINT "merchant_invites_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_invoices" ADD CONSTRAINT "merchant_invoices_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_members" ADD CONSTRAINT "merchant_members_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_members" ADD CONSTRAINT "merchant_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_payments" ADD CONSTRAINT "merchant_payments_invoice_id_merchant_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."merchant_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_payments" ADD CONSTRAINT "merchant_payments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_payments" ADD CONSTRAINT "merchant_payments_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_codes" ADD CONSTRAINT "offer_codes_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_codes" ADD CONSTRAINT "offer_codes_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_codes" ADD CONSTRAINT "offer_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_codes" ADD CONSTRAINT "offer_codes_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_offer_code_id_offer_codes_id_fk" FOREIGN KEY ("offer_code_id") REFERENCES "public"."offer_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_validated_by_user_id_users_id_fk" FOREIGN KEY ("validated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_invoice_id_merchant_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."merchant_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_events" ADD CONSTRAINT "savings_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_rules" ADD CONSTRAINT "user_category_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cycle_snapshots_user_period_unique" ON "cycle_snapshots" USING btree ("user_id","cycle_start","cycle_end");--> statement-breakpoint
CREATE INDEX "merchant_invites_merchant_idx" ON "merchant_invites" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_invoices_period_unique" ON "merchant_invoices" USING btree ("merchant_id","period_month");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_members_unique" ON "merchant_members" USING btree ("merchant_id","user_id");--> statement-breakpoint
CREATE INDEX "merchant_members_user_idx" ON "merchant_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "merchant_payments_invoice_idx" ON "merchant_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "merchants_zone_idx" ON "merchants" USING btree ("zone_slug","stage");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_dedupe_unique" ON "notifications" USING btree ("user_id","dedupe_key") WHERE "notifications"."dedupe_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_provider_account_unique" ON "oauth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "oauth_user_idx" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "offer_codes_code_idx" ON "offer_codes" USING btree ("code","status");--> statement-breakpoint
CREATE INDEX "offer_codes_user_idx" ON "offer_codes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "offer_codes_merchant_idx" ON "offer_codes" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "offers_merchant_status_idx" ON "offers" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "password_reset_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "redemptions_merchant_date_idx" ON "redemptions" USING btree ("merchant_id","redeemed_at");--> statement-breakpoint
CREATE INDEX "redemptions_user_date_idx" ON "redemptions" USING btree ("user_id","redeemed_at");--> statement-breakpoint
CREATE INDEX "redemptions_partner_idx" ON "redemptions" USING btree ("partner_id","redeemed_at");--> statement-breakpoint
CREATE INDEX "savings_events_user_date_idx" ON "savings_events" USING btree ("user_id","occurred_on");--> statement-breakpoint
CREATE UNIQUE INDEX "savings_events_user_ref_unique" ON "savings_events" USING btree ("user_id","kind","reference_key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_category_rules_pk" ON "user_category_rules" USING btree ("user_id","merchant_key");--> statement-breakpoint
CREATE INDEX "transactions_user_merchant_idx" ON "transactions" USING btree ("user_id","merchant_key");