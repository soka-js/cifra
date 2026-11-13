-- CIFRA producto-v1: para la Semana de la Innovación, toda persona ve las ofertas.
-- Hasta ahora cada oferta nueva dejaba por fuera al 10 % de las personas (grupo de control para
-- medir ventas nuevas). SOKA pidió apagarlo el 2026-11-12, también en las ofertas que ya existen.

ALTER TABLE "offers" ALTER COLUMN "holdout_percent" SET DEFAULT 0;--> statement-breakpoint
UPDATE "offers" SET "holdout_percent" = 0 WHERE "holdout_percent" <> 0;
