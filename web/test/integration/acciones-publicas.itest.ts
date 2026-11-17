import { and, eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as authActions from '@/app/actions/auth';
import * as leadActions from '@/app/actions/leads';
import * as merchantActions from '@/app/actions/merchant';
import * as adminActions from '@/app/admin/actions';
import { hashPassword } from '@/lib/auth/password';
import { getCurrentUser, getMerchantAccess, getSessionContext, isAdmin, requireAdmin } from '@/lib/auth/session';
import { randomToken, sha256 } from '@/lib/crypto';
import { db } from '@/lib/db';
import {
  leads,
  merchantInvites,
  merchantMembers,
  merchants,
  passwordResetTokens,
  sessions,
  users,
} from '@/lib/db/schema';
import { fd, jar, run } from './fake-next';
import { ADMIN_EMAIL, buildWorld, createUser, loginAs, truncateAll, victimSnapshot, type World } from './world';

/**
 * Acciones que no exigen sesión (o cuyo permiso no es "recurso de otra persona").
 * Como cualquiera puede llamarlas, lo que se prueba es que no regalen identidad ni permisos:
 * que registrarse no dé admin, que un usuario de ejemplo no pueda entrar, que cambiar la clave
 * cierre las sesiones viejas y que registrar un negocio no toque negocios ajenos.
 */

let w: World;
const idle = { status: 'idle' } as const;
const PASSWORD = 'clave-larga-de-prueba';

beforeEach(async () => {
  await truncateAll();
  w = await buildWorld();
  await loginAs(null);
});

const count = async (table: string) =>
  Number((await db.execute<{ n: number }>(sql.raw(`select count(*)::int as n from "${table}"`)))[0]?.n ?? 0);

async function insertResetToken(userId: string): Promise<string> {
  const token = randomToken();
  await db
    .insert(passwordResetTokens)
    .values({ tokenHash: sha256(token), userId, expiresAt: new Date(Date.now() + 3_600_000) });
  return token;
}

describe('actions/auth.ts#signup', () => {
  const form = (over: Record<string, string> = {}) =>
    fd({ name: 'Laura', email: 'laura@prueba.local', password: PASSWORD, consent: 'on', ...over });

  it('crea una persona normal, sin rol ni marca de demo, y le abre sesión a ella', async () => {
    const outcome = await run(() => authActions.signup(idle, form()));
    expect(outcome.redirect).toBe('/app/bienvenida?nuevo=1');
    const me = await getCurrentUser();
    expect(me?.email).toBe('laura@prueba.local');
    expect(me?.role).toBe('user');
    expect(me?.isDemo).toBe(false);
    expect(me?.emailVerifiedAt).toBeNull();
  });

  it('registrarse con un correo de ADMIN_EMAILS que nadie ha verificado NO da acceso de admin', async () => {
    await db.delete(users).where(eq(users.email, ADMIN_EMAIL));
    await run(() => authActions.signup(idle, form({ email: ADMIN_EMAIL })));
    const me = await getCurrentUser();
    expect(me?.email).toBe(ADMIN_EMAIL);
    expect(isAdmin(me)).toBe(false);
    expect((await run(() => requireAdmin())).notFound).toBe(true);
  });

  it('no deja tomar un correo que ya tiene cuenta', async () => {
    const before = await count('users');
    const outcome = await run(() => authActions.signup(idle, form({ email: 'VICTIMA@prueba.local' })));
    expect((outcome.result as { status: string }).status).toBe('error');
    expect(await count('users')).toBe(before);
    expect(await getCurrentUser()).toBeNull();
  });

  it('sin autorización de datos no crea la cuenta', async () => {
    const before = await count('users');
    const outcome = await run(() => authActions.signup(idle, fd({ name: 'Laura', email: 'laura@prueba.local', password: PASSWORD })));
    expect((outcome.result as { status: string }).status).toBe('error');
    expect(await count('users')).toBe(before);
  });
});

describe('actions/auth.ts#login', () => {
  beforeEach(async () => {
    await db.update(users).set({ passwordHash: await hashPassword(PASSWORD) }).where(eq(users.id, w.victim.id));
  });

  it('con la clave correcta abre la sesión de esa persona', async () => {
    const outcome = await run(() => authActions.login(idle, fd({ email: 'victima@prueba.local', password: PASSWORD })));
    expect(outcome.redirect).toBe('/app');
    expect((await getCurrentUser())?.id).toBe(w.victim.id);
  });

  it('con la clave equivocada no abre sesión', async () => {
    const outcome = await run(() => authActions.login(idle, fd({ email: 'victima@prueba.local', password: 'otra-clave-larga' })));
    expect((outcome.result as { status: string }).status).toBe('error');
    expect(await getCurrentUser()).toBeNull();
    expect(jar.has('cf_session')).toBe(false);
  });

  it('un usuario de demostración no entra ni con una clave válida guardada (dato viejo)', async () => {
    const demo = await createUser({ email: 'mariana.demo@cifra.co', isDemo: true, passwordHash: await hashPassword(PASSWORD) });
    const outcome = await run(() => authActions.login(idle, fd({ email: demo.email!, password: PASSWORD })));
    expect((outcome.result as { status: string }).status).toBe('error');
    expect(jar.has('cf_session')).toBe(false);
    expect(await db.select().from(sessions).where(eq(sessions.userId, demo.id))).toHaveLength(0);
  });

  it('no sigue un "next" hacia otro dominio', async () => {
    const outcome = await run(() =>
      authActions.login(idle, fd({ email: 'victima@prueba.local', password: PASSWORD, next: '//evil.example/robo' })),
    );
    expect(outcome.redirect).toBe('/app');
  });
});

describe('actions/auth.ts#requestPasswordReset', () => {
  it('para una persona real crea un enlace de un solo uso', async () => {
    const outcome = await run(() => authActions.requestPasswordReset(idle, fd({ email: 'victima@prueba.local' })));
    expect((outcome.result as { status: string }).status).toBe('ok');
    expect(await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, w.victim.id))).toHaveLength(1);
  });

  it('responde igual si el correo no existe (no revela quién tiene cuenta)', async () => {
    const a = await run(() => authActions.requestPasswordReset(idle, fd({ email: 'victima@prueba.local' })));
    const b = await run(() => authActions.requestPasswordReset(idle, fd({ email: 'nadie@prueba.local' })));
    expect((b.result as { message: string }).message).toBe((a.result as { message: string }).message);
    expect(await count('password_reset_tokens')).toBe(1);
  });

  it('nunca crea un enlace para un usuario de demostración', async () => {
    const demo = await createUser({ email: 'mariana.demo@cifra.co', isDemo: true });
    await run(() => authActions.requestPasswordReset(idle, fd({ email: demo.email! })));
    expect(await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, demo.id))).toHaveLength(0);
  });

  describe('en producción, cuando el correo no sale', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('RESEND_API_KEY', '');
      vi.stubEnv('SMTP_HOST', '');
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('le dice claro a la persona que no se pudo enviar y no deja un enlace vivo', async () => {
      const outcome = await run(() => authActions.requestPasswordReset(idle, fd({ email: 'victima@prueba.local' })));
      const result = outcome.result as { status: string; message?: string; devResetUrl?: string };
      expect(result.status).toBe('error');
      expect(result.message).toMatch(/No pudimos enviarte el correo/);
      expect(result.devResetUrl).toBeUndefined();
      expect(await count('password_reset_tokens')).toBe(0);
    });

    it('para un correo sin cuenta responde lo de siempre (no intenta enviar nada)', async () => {
      const outcome = await run(() => authActions.requestPasswordReset(idle, fd({ email: 'nadie@prueba.local' })));
      expect((outcome.result as { status: string }).status).toBe('ok');
    });
  });
});

describe('actions/auth.ts#resetPassword', () => {
  it('cambia la clave, verifica el correo y cierra las sesiones abiertas con la clave anterior', async () => {
    await loginAs(w.victim);
    const oldToken = jar.get('cf_session')!;
    await loginAs(null);
    const token = await insertResetToken(w.victim.id);

    const outcome = await run(() => authActions.resetPassword(idle, fd({ token, password: 'una-clave-nueva-larga' })));
    expect(outcome.redirect).toBe('/app');

    const [after] = await db.select().from(users).where(eq(users.id, w.victim.id));
    expect(after!.passwordHash).not.toBeNull();
    expect(after!.emailVerifiedAt).not.toBeNull();
    expect((await getCurrentUser())?.id).toBe(w.victim.id);
    // La sesión vieja ya no existe.
    expect(await db.select().from(sessions).where(eq(sessions.id, sha256(oldToken)))).toHaveLength(0);
  });

  it('un enlace ya usado no sirve otra vez', async () => {
    const token = await insertResetToken(w.victim.id);
    await run(() => authActions.resetPassword(idle, fd({ token, password: 'una-clave-nueva-larga' })));
    await loginAs(null);
    const again = await run(() => authActions.resetPassword(idle, fd({ token, password: 'otra-clave-aun-mas-larga' })));
    expect((again.result as { status: string }).status).toBe('error');
    expect(await getCurrentUser()).toBeNull();
  });

  it('un enlace de un usuario de demostración no abre sesión ni le pone clave', async () => {
    const demo = await createUser({ email: 'mariana.demo@cifra.co', isDemo: true });
    const token = await insertResetToken(demo.id);
    const outcome = await run(() => authActions.resetPassword(idle, fd({ token, password: 'una-clave-nueva-larga' })));
    expect((outcome.result as { status: string }).status).toBe('error');
    const [after] = await db.select().from(users).where(eq(users.id, demo.id));
    expect(after!.passwordHash).toBeNull();
    expect(jar.has('cf_session')).toBe(false);
  });

  it('el dueño real de un correo de ADMIN_EMAILS recupera el acceso de admin al usar su enlace', async () => {
    await db.update(users).set({ emailVerifiedAt: null }).where(eq(users.id, w.admin.id));
    const token = await insertResetToken(w.admin.id);
    await run(() => authActions.resetPassword(idle, fd({ token, password: 'una-clave-nueva-larga' })));
    expect(isAdmin(await getCurrentUser())).toBe(true);
  });
});

describe('actions/auth.ts#logout', () => {
  it('borra la sesión del servidor, no solo la cookie', async () => {
    await loginAs(w.victim);
    const token = jar.get('cf_session')!;
    expect((await run(() => authActions.logout())).redirect).toBe('/entrar');
    expect(jar.has('cf_session')).toBe(false);
    expect(await db.select().from(sessions).where(eq(sessions.id, sha256(token)))).toHaveLength(0);
    // Reusar el token viejo no revive la sesión.
    jar.set('cf_session', token);
    expect(await getCurrentUser()).toBeNull();
  });

  it('salir estando en la demo cierra del todo la sesión del admin', async () => {
    await loginAs(w.admin);
    await run(() => adminActions.openDemoAs(fd({ role: 'persona' })));
    await run(() => authActions.logout());
    expect(await getSessionContext()).toBeNull();
  });
});

describe('actions/leads.ts#submitLead', () => {
  const form = (over: Record<string, string> = {}) =>
    fd({ name: 'Ana Gómez', email: 'ana@coop.local', organization: 'Cooperativa X', consent: 'on', ...over });

  it('cualquiera puede dejar sus datos de contacto, y eso no toca nada más', async () => {
    const before = await victimSnapshot(w);
    const outcome = await run(() => leadActions.submitLead(idle, form()));
    expect((outcome.result as { status: string }).status).toBe('ok');
    expect(await db.select().from(leads)).toHaveLength(1);
    expect(await victimSnapshot(w)).toBe(before);
    expect(await getCurrentUser()).toBeNull();
  });

  it('el campo trampa para bots responde ok sin guardar nada', async () => {
    const outcome = await run(() => leadActions.submitLead(idle, form({ website: 'http://spam.example' })));
    expect((outcome.result as { status: string }).status).toBe('ok');
    expect(await db.select().from(leads)).toHaveLength(0);
  });

  it('sin autorización de contacto no guarda', async () => {
    const outcome = await run(() =>
      leadActions.submitLead(idle, fd({ name: 'Ana Gómez', email: 'ana@coop.local', organization: 'Cooperativa X' })),
    );
    expect((outcome.result as { status: string }).status).toBe('error');
    expect(await db.select().from(leads)).toHaveLength(0);
  });
});

describe('actions/merchant.ts#redeemMerchantInvite', () => {
  async function invite(merchantId: string) {
    const token = randomToken(20);
    await db
      .insert(merchantInvites)
      .values({ tokenHash: sha256(token), merchantId, expiresAt: new Date(Date.now() + 86_400_000) });
    return token;
  }

  it('un enlace inventado no da acceso a ningún negocio', async () => {
    await loginAs(w.attacker);
    const outcome = await run(() => merchantActions.redeemMerchantInvite(idle, fd({ token: randomToken(20) })));
    expect((outcome.result as { status: string }).status).toBe('error');
    expect((await getMerchantAccess())?.merchant.id).toBe(w.attackerMerchant.id);
    expect(await db.select().from(merchantMembers).where(eq(merchantMembers.merchantId, w.victimMerchant.id))).toHaveLength(1);
  });

  it('un enlace válido da acceso solo al negocio del enlace', async () => {
    const token = await invite(w.victimMerchant.id);
    await loginAs(w.plain);
    const outcome = await run(() => merchantActions.redeemMerchantInvite(idle, fd({ token })));
    expect(outcome.redirect).toBe('/negocio?activado=1');
    const mine = await db.select().from(merchantMembers).where(eq(merchantMembers.userId, w.plain.id));
    expect(mine.map((m) => m.merchantId)).toEqual([w.victimMerchant.id]);
  });

  it('el enlace sirve una sola vez', async () => {
    const token = await invite(w.victimMerchant.id);
    await loginAs(w.plain);
    await run(() => merchantActions.redeemMerchantInvite(idle, fd({ token })));
    await loginAs(w.attacker);
    const again = await run(() => merchantActions.redeemMerchantInvite(idle, fd({ token })));
    expect((again.result as { status: string }).status).toBe('error');
    expect(
      await db
        .select()
        .from(merchantMembers)
        .where(and(eq(merchantMembers.userId, w.attacker.id), eq(merchantMembers.merchantId, w.victimMerchant.id))),
    ).toHaveLength(0);
  });

  it('sin sesión crea la cuenta de quien abre el enlace y no toma una cuenta existente', async () => {
    const token = await invite(w.victimMerchant.id);
    const taken = await run(() =>
      merchantActions.redeemMerchantInvite(idle, fd({ token, email: 'victima@prueba.local', password: PASSWORD, consent: 'on' })),
    );
    expect((taken.result as { status: string }).status).toBe('error');
    expect(await getCurrentUser()).toBeNull();

    const outcome = await run(() =>
      merchantActions.redeemMerchantInvite(idle, fd({ token, email: 'tendera@prueba.local', password: PASSWORD, consent: 'on' })),
    );
    expect(outcome.redirect).toBe('/negocio?activado=1');
    expect((await getCurrentUser())?.email).toBe('tendera@prueba.local');
  });

  it('sin la autorización de datos, o con una clave corta, no crea la cuenta ni usa el enlace', async () => {
    const token = await invite(w.victimMerchant.id);
    const usersBefore = await count('users');
    const noConsent = await run(() =>
      merchantActions.redeemMerchantInvite(idle, fd({ token, email: 'tendera@prueba.local', password: PASSWORD })),
    );
    expect(noConsent.result).toMatchObject({ status: 'error', message: expect.stringMatching(/autorización/) });
    const shortKey = await run(() =>
      merchantActions.redeemMerchantInvite(idle, fd({ token, email: 'tendera@prueba.local', password: 'corta-123', consent: 'on' })),
    );
    expect(shortKey.result).toMatchObject({ status: 'error', message: expect.stringMatching(/10 caracteres/) });
    expect(await count('users')).toBe(usersBefore);
    expect(await getCurrentUser()).toBeNull();
    const [inv] = await db.select().from(merchantInvites).where(eq(merchantInvites.tokenHash, sha256(token)));
    expect(inv!.usedAt).toBeNull();
  });

  it('desde la demo no se puede quedar de dueño de un negocio real', async () => {
    const token = await invite(w.victimMerchant.id);
    await loginAs(w.admin);
    await run(() => adminActions.openDemoAs(fd({ role: 'persona' })));
    const demoUser = (await getCurrentUser())!;
    const outcome = await run(() => merchantActions.redeemMerchantInvite(idle, fd({ token })));
    expect((outcome.result as { status: string }).status).toBe('error');
    expect(
      await db
        .select()
        .from(merchantMembers)
        .where(and(eq(merchantMembers.userId, demoUser.id), eq(merchantMembers.merchantId, w.victimMerchant.id))),
    ).toHaveLength(0);
  });
});

describe('actions/merchant.ts#selfRegisterMerchant', () => {
  const form = (over: Record<string, string> = {}) =>
    fd({
      businessName: 'Café de Prueba',
      ownerName: 'Carlos Tendero',
      whatsapp: '3105550000',
      businessCategory: 'cafeteria',
      zoneSlug: 'las-aguas',
      address: 'Cra 3 # 18-45',
      typicalTicket: '20000',
      ...over,
    });

  it('un tendero sin sesión crea su cuenta y SU negocio, y no toca ningún negocio ajeno', async () => {
    const before = await victimSnapshot(w);
    const outcome = await run(() =>
      merchantActions.selfRegisterMerchant(idle, form({ email: 'carlos@prueba.local', password: PASSWORD, consent: 'on' })),
    );
    expect(outcome.redirect).toBe('/negocio/ofertas?bienvenida=1');
    const me = await getCurrentUser();
    expect(me?.email).toBe('carlos@prueba.local');
    const access = await getMerchantAccess();
    expect(access?.merchant.name).toBe('Café de Prueba');
    expect(access?.merchant.isDemo).toBe(false);
    expect(access?.allMerchants).toHaveLength(1);
    expect(await victimSnapshot(w)).toBe(before);
  });

  it('sin la autorización de datos no crea la cuenta ni el negocio', async () => {
    const [usersBefore, merchantsBefore] = [await count('users'), await count('merchants')];
    const outcome = await run(() =>
      merchantActions.selfRegisterMerchant(idle, form({ email: 'carlos@prueba.local', password: PASSWORD })),
    );
    expect(outcome.result).toMatchObject({ status: 'error', message: expect.stringMatching(/autorización/) });
    expect(await count('users')).toBe(usersBefore);
    expect(await count('merchants')).toBe(merchantsBefore);
    expect(await getCurrentUser()).toBeNull();
  });

  it('no inventa un horario: si el tendero no lo escribe, queda vacío', async () => {
    await loginAs(w.plain);
    await run(() => merchantActions.selfRegisterMerchant(idle, form()));
    const [created] = await db.select().from(merchants).where(eq(merchants.name, 'Café de Prueba'));
    expect(created!.hoursText).toBeNull();
  });

  it('con sesión, el negocio queda a nombre de quien está en sesión', async () => {
    await loginAs(w.plain);
    await run(() => merchantActions.selfRegisterMerchant(idle, form()));
    const [created] = await db.select().from(merchants).where(eq(merchants.name, 'Café de Prueba'));
    const members = await db.select().from(merchantMembers).where(eq(merchantMembers.merchantId, created!.id));
    expect(members.map((m) => m.userId)).toEqual([w.plain.id]);
  });

  it('sin sesión no deja usar el correo de una cuenta existente', async () => {
    const before = await count('merchants');
    const outcome = await run(() =>
      merchantActions.selfRegisterMerchant(idle, form({ email: 'victima@prueba.local', password: PASSWORD, consent: 'on' })),
    );
    expect(outcome.result).toMatchObject({ status: 'error', message: expect.stringMatching(/ya tiene cuenta/) });
    expect(await count('merchants')).toBe(before);
    expect(await getCurrentUser()).toBeNull();
  });
});

describe('actions/merchant.ts#switchActiveMerchant', () => {
  it('sin sesión manda a entrar', async () => {
    const outcome = await run(() => merchantActions.switchActiveMerchant(fd({ merchantId: w.victimMerchant.id })));
    expect(outcome.redirect).toBe('/entrar');
  });

  it('pedir un negocio ajeno no cambia el negocio activo ni deja la cookie', async () => {
    await loginAs(w.attacker);
    await run(() => merchantActions.switchActiveMerchant(fd({ merchantId: w.victimMerchant.id })));
    expect(jar.get('cf_merchant')).toBeUndefined();
    expect((await getMerchantAccess())?.merchant.id).toBe(w.attackerMerchant.id);
  });

  it('la dueña sí puede elegir su propio negocio', async () => {
    await loginAs(w.victimOwner);
    await run(() => merchantActions.switchActiveMerchant(fd({ merchantId: w.victimMerchant.id })));
    expect(jar.get('cf_merchant')).toBe(w.victimMerchant.id);
  });
});
