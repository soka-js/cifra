-- CIFRA v3: Valor diario real para Persona + Micronegocio + Cross-Reference horario

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "spent_hour" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "capture_method" text DEFAULT 'extracto' NOT NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "paid_cycle_charges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "charge_key" text NOT NULL,
  "label" text NOT NULL,
  "cycle_end" date NOT NULL,
  "amount_minor" bigint NOT NULL,
  "paid_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "paid_cycle_charges_unique" ON "paid_cycle_charges" USING btree ("user_id","charge_key","cycle_end");--> statement-breakpoint

ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "featured_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "daily_break_even_minor" bigint DEFAULT 40000000 NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "monthly_fixed_cost_minor" bigint DEFAULT 450000000 NOT NULL;--> statement-breakpoint

ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "is_flash" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "start_hour" integer;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "end_hour" integer;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "active_days" integer[] DEFAULT '{0,1,2,3,4,5,6}'::integer[] NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "stock_limit" integer;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "stock_remaining" integer;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "unit_cost_minor" bigint;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "merchant_ledger_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "merchant_id" uuid NOT NULL REFERENCES "merchants"("id") ON DELETE cascade,
  "entry_on" date NOT NULL,
  "kind" text NOT NULL,
  "category_label" text NOT NULL,
  "supplier_name" text,
  "amount_minor" bigint NOT NULL,
  "note" text,
  "ref_redemption_id" uuid UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "merchant_ledger_date_idx" ON "merchant_ledger_entries" USING btree ("merchant_id","entry_on");
