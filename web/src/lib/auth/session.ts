import 'server-only';
import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { db } from '../db';
import { merchantMembers, merchants, sessions, users, type Merchant, type User } from '../db/schema';
import { randomToken, sha256 } from '../crypto';
import { siteUrl } from '../site';

/**
 * Identidad y permisos de CIFRA. Reglas que este archivo garantiza:
 *
 * 1. La sesión sale SOLO de la cookie `cf_session`. Sin cookie válida no hay usuario: no existe
 *    ningún usuario por defecto.
 * 2. El admin sale SOLO de `ADMIN_EMAILS`, con el correo verificado. La columna `users.role` no cuenta.
 * 3. Un usuario de demostración (`is_demo`) nunca es dueño de una sesión. A la demo se llega solo
 *    cuando un admin real activa "ver como" sobre su propia sesión (`sessions.acting_as_user_id`).
 * 4. A un negocio se entra solo por membresía (`merchant_members`).
 */

export const SESSION_COOKIE = 'cf_session';
export const ACTIVE_MERCHANT_COOKIE = 'cf_merchant';
const SESSION_DAYS = 30;

export interface SessionContext {
  /** Hash del token de la cookie: identifica la fila de la sesión. */
  sessionId: string;
  /** Quien inició sesión de verdad. Los permisos de admin se deciden solo con este usuario. */
  realUser: User;
  /**
   * Usuario con el que se leen y escriben los datos: el real, o el de demostración si un admin
   * está "viendo como".
   */
  user: User;
  /** true mientras un admin mira la demo. */
  demoView: boolean;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Con la dirección de la rama, la vista previa (https) también recibe la cookie solo por https.
    secure: process.env.NODE_ENV === 'production' && siteUrl().startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Admin = correo en ADMIN_EMAILS + correo verificado + no es usuario de demostración.
 * El correo verificado importa: el registro no comprueba que el correo sea de quien lo escribe,
 * así que sin esta condición cualquiera podría registrarse con el correo de un admin.
 */
export function isAdmin(user: User | null | undefined): boolean {
  if (!user || user.isDemo) return false;
  if (!user.email || !user.emailVerifiedAt) return false;
  return adminEmails().includes(user.email.toLowerCase());
}

export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = sha256(token);
  const [row] = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  // Un usuario de demostración nunca es dueño de una sesión (regla 3).
  if (row.user.isDemo) return null;

  if (row.session.expiresAt.getTime() - Date.now() < 15 * 86_400_000) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) })
      .where(eq(sessions.id, id));
  }

  // "Ver como": vale solo si quien mira sigue siendo admin y el destino es de demostración.
  // Se revisa en cada petición, no solo al activarlo.
  let acting: User | null = null;
  if (row.session.actingAsUserId && isAdmin(row.user)) {
    const [target] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, row.session.actingAsUserId), eq(users.isDemo, true)))
      .limit(1);
    acting = target ?? null;
  }

  return { sessionId: id, realUser: row.user, user: acting ?? row.user, demoView: acting !== null };
});

/** Usuario efectivo de la petición, o null si no hay sesión. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  return (await getSessionContext())?.user ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar');
  return user;
}

/**
 * Exige un admin real. Sin sesión manda a entrar; con sesión pero sin permiso responde 404
 * para no confirmar que la ruta existe.
 */
export async function requireAdmin(): Promise<User> {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/entrar?next=/admin');
  if (!isAdmin(ctx.realUser)) notFound();
  return ctx.realUser;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
  jar.delete(ACTIVE_MERCHANT_COOKIE);
}

/** Cierra todas las sesiones de una persona (por ejemplo, al cambiar la clave). */
export async function destroyAllSessionsOf(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// ---------------------------------------------------------------------------
// Demo: "ver como" un usuario de demostración. Solo un admin real, solo sobre su propia sesión.
// ---------------------------------------------------------------------------

export async function startDemoView(targetUserId: string): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx || !isAdmin(ctx.realUser)) throw new Error('Acceso administrativo requerido.');
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, targetUserId), eq(users.isDemo, true)))
    .limit(1);
  if (!target) throw new Error('Solo se puede ver la app como un usuario de demostración.');
  await db.update(sessions).set({ actingAsUserId: target.id }).where(eq(sessions.id, ctx.sessionId));
  (await cookies()).delete(ACTIVE_MERCHANT_COOKIE);
}

export async function stopDemoView(): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx) return;
  await db.update(sessions).set({ actingAsUserId: null }).where(eq(sessions.id, ctx.sessionId));
  (await cookies()).delete(ACTIVE_MERCHANT_COOKIE);
}

// ---------------------------------------------------------------------------
// Negocio: acceso solo por membresía.
// ---------------------------------------------------------------------------

export interface MerchantAccess {
  user: User;
  merchant: Merchant;
  role: 'owner' | 'cashier';
  allMerchants: Array<{ id: string; name: string; neighborhood: string; role: 'owner' | 'cashier' }>;
}

/** Negocio activo de quien está en sesión, entre los negocios de los que es miembro. Nada más. */
export const getMerchantAccess = cache(async (): Promise<MerchantAccess | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const memberships = await db
    .select({ merchant: merchants, role: merchantMembers.role })
    .from(merchantMembers)
    .innerJoin(merchants, eq(merchants.id, merchantMembers.merchantId))
    .where(eq(merchantMembers.userId, user.id));
  if (memberships.length === 0) return null;

  const preferredId = (await cookies()).get(ACTIVE_MERCHANT_COOKIE)?.value;
  const chosen = memberships.find((m) => m.merchant.id === preferredId) ?? memberships[0]!;
  return {
    user,
    merchant: chosen.merchant,
    role: chosen.role,
    allMerchants: memberships.map((m) => ({
      id: m.merchant.id,
      name: m.merchant.name,
      neighborhood: m.merchant.neighborhood,
      role: m.role,
    })),
  };
});

export async function requireMerchantAccess(): Promise<MerchantAccess> {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?next=/negocio');
  const access = await getMerchantAccess();
  if (!access) redirect('/negocio/registro');
  return access;
}
