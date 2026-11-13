-- CIFRA producto-v1, Etapa 2: cada número tiene recibo.
-- La meta diaria de ventas y los costos fijos del negocio los escribe el tendero. Hasta ahora, un
-- negocio nuevo quedaba con una meta de $400.000 y costos de $4.500.000 que nadie escribió.
-- 1) Estructura: las dos columnas pueden quedar vacías y no tienen valor por defecto.
-- 2) Saneamiento autorizado por SOKA el 2026-11-12: en negocios reales (no demo), los valores
--    iguales a los de fábrica se vacían. Los negocios de la demo conservan los suyos.

ALTER TABLE "merchants" ALTER COLUMN "daily_break_even_minor" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "merchants" ALTER COLUMN "daily_break_even_minor" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ALTER COLUMN "monthly_fixed_cost_minor" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "merchants" ALTER COLUMN "monthly_fixed_cost_minor" DROP NOT NULL;--> statement-breakpoint

UPDATE "merchants" SET "daily_break_even_minor" = NULL
  WHERE "is_demo" = false AND "daily_break_even_minor" = 40000000;--> statement-breakpoint
UPDATE "merchants" SET "monthly_fixed_cost_minor" = NULL
  WHERE "is_demo" = false AND "monthly_fixed_cost_minor" = 450000000;
