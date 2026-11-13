-- CIFRA producto-v1, Etapa 1: cerrar la puerta.
-- 1) Estructura: correo verificado (requisito para ser admin) y "ver como" de la demo sobre la sesión del admin.
-- 2) Saneamiento autorizado por SOKA el 2026-11-11: nadie conserva rol de admin en la base y los
--    usuarios de demostración quedan sin ninguna forma de iniciar sesión. No borra datos de producto.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "acting_as_user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_acting_as_user_id_users_id_fk"
    FOREIGN KEY ("acting_as_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- El rol de la base ya no otorga nada (el admin sale solo de ADMIN_EMAILS). Se limpia para que no confunda.
UPDATE "users" SET "role" = 'user' WHERE "role" <> 'user';--> statement-breakpoint

-- Los usuarios demo tenían una clave publicada en /admin. Quedan sin clave, sin sesiones abiertas
-- y sin ningún otro camino de entrada: a la demo solo se llega desde /admin.
UPDATE "users" SET "password_hash" = NULL WHERE "is_demo" = true;--> statement-breakpoint
DELETE FROM "sessions" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "is_demo" = true);--> statement-breakpoint
DELETE FROM "oauth_accounts" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "is_demo" = true);--> statement-breakpoint
DELETE FROM "password_reset_tokens" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "is_demo" = true);--> statement-breakpoint
DELETE FROM "embed_tokens" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "is_demo" = true);
