import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import * as merchantActions from '@/app/actions/merchant';
import * as v3Actions from '@/app/actions/v3';
import * as adminActions from '@/app/admin/actions';
import * as appActions from '@/app/app/actions';
import {
  getCurrentUser,
  getMerchantAccess,
  getSessionContext,
  isAdmin,
  requireAdmin,
  requireUser,
  startDemoView,
} from '@/lib/auth/session';
import { randomToken, sha256 } from '@/lib/crypto';
import { loadRankedOffersForUser } from '@/lib/data';
import { db } from '@/lib/db';
import { merchants, offerCodes, offers, sessions, users } from '@/lib/db/schema';
import { DEMO_PERSONA_EMAIL, DEMO_PRIMARY_MERCHANT_SLUG, ensureDemoEcosystemSeeded } from '@/lib/demo-seed';
import { fd, jar, run } from './fake-next';
import { ADMIN_EMAIL, buildWorld, createUser, loginAs, truncateAll, victimSnapshot, type World } from './world';

/**
 * Las tres reglas de seguridad del brief, como pruebas:
 *   - ninguna identidad sin sesión (no existe usuario por defecto);
 *   - el admin sale solo de ADMIN_EMAILS;
 *   - la demo está aislada y solo se abre desde /admin.
 */

let w: World;

beforeEach(async () => {
  await truncateAll();
  w = await buildWorld();
});

const demoUsersCount = async () =>
  Number((await db.execute<{ n: number }>(sql`select count(*)::int as n from users where is_demo`))[0]?.n ?? 0);

async function currentSessionRow() {
  const token = jar.get('cf_session');
  if (!token) return null;
  const [row] = await db.select().from(sessions).where(eq(sessions.id, sha256(token))).limit(1);
  return row ?? null;
}

describe('sesión: sale solo de la cookie', () => {
  it('sin cookie no hay usuario, aunque exista la persona de la demo en la base', async () => {
    await ensureDemoEcosystemSeeded(false);
    expect(await demoUsersCount()).toBeGreaterThan(0);
    await loginAs(null);
    expect(await getCurrentUser()).toBeNull();
    expect(await getSessionContext()).toBeNull();
    expect(await getMerchantAccess()).toBeNull();
    expect((await run(() => requireUser())).redirect).toBe('/entrar');
  });

  it('una visita sin sesión no siembra la demo ni crea usuarios', async () => {
    await loginAs(null);
    const before = Number((await db.execute<{ n: number }>(sql`select count(*)::int as n from users`))[0]?.n);
    await getCurrentUser();
    await getMerchantAccess();
    const after = Number((await db.execute<{ n: number }>(sql`select count(*)::int as n from users`))[0]?.n);
    expect(after).toBe(before);
    expect(await demoUsersCount()).toBe(0);
  });

  it('un token inventado no abre sesión', async () => {
    jar.clear();
    jar.set('cf_session', randomToken());
    expect(await getCurrentUser()).toBeNull();
  });

  it('una sesión vencida no abre sesión', async () => {
    const token = randomToken();
    await db.insert(sessions).values({ id: sha256(token), userId: w.victim.id, expiresAt: new Date(Date.now() - 1000) });
    jar.clear();
    jar.set('cf_session', token);
    expect(await getCurrentUser()).toBeNull();
  });

  it('una sesión válida devuelve a su dueño y a nadie más', async () => {
    await loginAs(w.victim);
    expect((await getCurrentUser())?.id).toBe(w.victim.id);
    const ctx = await getSessionContext();
    expect(ctx?.realUser.id).toBe(w.victim.id);
    expect(ctx?.demoView).toBe(false);
  });

  it('un usuario de demostración nunca es dueño de una sesión, aunque exista la fila', async () => {
    const ids = await ensureDemoEcosystemSeeded(false);
    await loginAs({ id: ids.marianaUserId });
    expect(await getCurrentUser()).toBeNull();
  });
});

describe('negocio: se entra solo por membresía', () => {
  it('la dueña entra a su negocio', async () => {
    await loginAs(w.victimOwner);
    expect((await getMerchantAccess())?.merchant.id).toBe(w.victimMerchant.id);
  });

  it('una persona sin negocio no obtiene ninguno', async () => {
    await loginAs(w.plain);
    expect(await getMerchantAccess()).toBeNull();
  });

  it('el admin NO opera negocios ajenos', async () => {
    await loginAs(w.admin);
    expect(await getMerchantAccess()).toBeNull();
  });

  it('la cookie de negocio activo no sirve para entrar a un negocio ajeno', async () => {
    await loginAs(w.attacker);
    jar.set('cf_merchant', w.victimMerchant.id);
    expect((await getMerchantAccess())?.merchant.id).toBe(w.attackerMerchant.id);
  });
});

describe('admin: sale solo de ADMIN_EMAILS', () => {
  it('correo en ADMIN_EMAILS y verificado: es admin', async () => {
    expect(isAdmin(w.admin)).toBe(true);
    await loginAs(w.admin);
    expect((await run(() => requireAdmin())).result).toMatchObject({ id: w.admin.id });
  });

  it('role = admin en la base, con correo fuera de ADMIN_EMAILS: NO es admin', async () => {
    const [promoted] = await db.update(users).set({ role: 'admin' }).where(eq(users.id, w.plain.id)).returning();
    expect(promoted!.role).toBe('admin');
    expect(isAdmin(promoted!)).toBe(false);
    await loginAs(promoted!);
    expect((await run(() => requireAdmin())).notFound).toBe(true);
  });

  it('correo de ADMIN_EMAILS sin verificar: NO es admin (el registro no comprueba de quién es el correo)', async () => {
    const [unverified] = await db.update(users).set({ emailVerifiedAt: null }).where(eq(users.id, w.admin.id)).returning();
    expect(unverified!.email).toBe(ADMIN_EMAIL);
    expect(isAdmin(unverified!)).toBe(false);
    await loginAs(unverified!);
    expect((await run(() => requireAdmin())).notFound).toBe(true);
  });

  it('un usuario de demostración nunca es admin', () => {
    expect(isAdmin({ ...w.admin, isDemo: true })).toBe(false);
  });

  it('sin sesión, /admin manda a entrar', async () => {
    await loginAs(null);
    expect((await run(() => requireAdmin())).redirect).toBe('/entrar?next=/admin');
  });
});

describe('admin/actions.ts#openDemoAs', () => {
  it('sin sesión: manda a entrar y no siembra la demo', async () => {
    await loginAs(null);
    expect((await run(() => adminActions.openDemoAs(fd({ role: 'persona' })))).redirect).toMatch(/^\/entrar/);
    expect(await demoUsersCount()).toBe(0);
  });

  it('una persona normal: 404, no siembra la demo y su sesión no queda viendo como nadie', async () => {
    await loginAs(w.attacker);
    expect((await run(() => adminActions.openDemoAs(fd({ role: 'persona' })))).notFound).toBe(true);
    expect(await demoUsersCount()).toBe(0);
    expect((await currentSessionRow())?.actingAsUserId).toBeNull();
    expect((await getCurrentUser())?.id).toBe(w.attacker.id);
  });

  it('el admin abre la demo como persona: ve los datos de ejemplo y sigue siendo él mismo por debajo', async () => {
    await loginAs(w.admin);
    expect((await run(() => adminActions.openDemoAs(fd({ role: 'persona' })))).redirect).toBe('/app');
    const ctx = await getSessionContext();
    expect(ctx?.demoView).toBe(true);
    expect(ctx?.user.email).toBe(DEMO_PERSONA_EMAIL);
    expect(ctx?.user.isDemo).toBe(true);
    expect(ctx?.realUser.id).toBe(w.admin.id);
    // Sigue pudiendo entrar a /admin sin salir de la demo.
    expect((await run(() => requireAdmin())).result).toMatchObject({ id: w.admin.id });
  });

  it('el admin abre la demo como tendero: entra al negocio de ejemplo y a ningún negocio real', async () => {
    await loginAs(w.admin);
    expect((await run(() => adminActions.openDemoAs(fd({ role: 'tendero' })))).redirect).toBe('/negocio');
    const access = await getMerchantAccess();
    expect(access?.merchant.slug).toBe(DEMO_PRIMARY_MERCHANT_SLUG);
    expect(access?.merchant.isDemo).toBe(true);
    expect(access?.allMerchants.every((m) => m.id !== w.victimMerchant.id)).toBe(true);
  });

  it('lo que se hace en la demo se escribe sobre el usuario de ejemplo, no sobre el admin ni sobre datos reales', async () => {
    await loginAs(w.admin);
    await run(() => adminActions.openDemoAs(fd({ role: 'persona' })));
    const demoUser = (await getCurrentUser())!;
    const realBefore = await victimSnapshot(w);
    await run(() => appActions.saveBuffer({ status: 'idle' }, fd({ buffer: '123000' })));
    const [demoAfter] = await db.select().from(users).where(eq(users.id, demoUser.id));
    const [adminAfter] = await db.select().from(users).where(eq(users.id, w.admin.id));
    expect(demoAfter!.bufferMinor).toBe(123_000_00);
    expect(adminAfter!.bufferMinor).toBe(w.admin.bufferMinor);
    expect(await victimSnapshot(w)).toBe(realBefore);
  });

  it('los usuarios de demostración no tienen clave ni rol, y ninguno es admin', async () => {
    await ensureDemoEcosystemSeeded(false);
    const demo = await db.select().from(users).where(eq(users.isDemo, true));
    expect(demo.length).toBeGreaterThan(0);
    for (const u of demo) {
      expect(u.passwordHash, `${u.email} no debe tener clave`).toBeNull();
      expect(u.role).toBe('user');
      expect(isAdmin(u)).toBe(false);
    }
    expect(demo.some((u) => u.email === 'admin@cifra.co')).toBe(false);
  });

  it('"ver como" solo acepta usuarios de demostración: no sirve para suplantar a una persona real', async () => {
    await loginAs(w.admin);
    const outcome = await run(() => startDemoView(w.victim.id));
    expect(outcome.error).toBeInstanceOf(Error);
    expect((await currentSessionRow())?.actingAsUserId).toBeNull();
    expect((await getCurrentUser())?.id).toBe(w.admin.id);
  });

  it('si alguien escribe a mano "ver como" hacia una persona real, se ignora', async () => {
    await loginAs(w.admin);
    const row = (await currentSessionRow())!;
    await db.update(sessions).set({ actingAsUserId: w.victim.id }).where(eq(sessions.id, row.id));
    const ctx = await getSessionContext();
    expect(ctx?.demoView).toBe(false);
    expect(ctx?.user.id).toBe(w.admin.id);
  });

  it('si alguien escribe a mano "ver como" en la sesión de un no-admin, se ignora', async () => {
    const ids = await ensureDemoEcosystemSeeded(false);
    await loginAs(w.attacker);
    const row = (await currentSessionRow())!;
    await db.update(sessions).set({ actingAsUserId: ids.marianaUserId }).where(eq(sessions.id, row.id));
    const ctx = await getSessionContext();
    expect(ctx?.demoView).toBe(false);
    expect(ctx?.user.id).toBe(w.attacker.id);
  });

  it('si el admin deja de estar en ADMIN_EMAILS, la demo abierta deja de verse', async () => {
    await loginAs(w.admin);
    await run(() => adminActions.openDemoAs(fd({ role: 'persona' })));
    const saved = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = 'otra@prueba.local';
    try {
      const ctx = await getSessionContext();
      expect(ctx?.demoView).toBe(false);
      expect(ctx?.user.id).toBe(w.admin.id);
    } finally {
      process.env.ADMIN_EMAILS = saved;
    }
  });
});

describe('admin/actions.ts#exitDemo', () => {
  it('sin sesión: manda a entrar', async () => {
    await loginAs(null);
    expect((await run(() => adminActions.exitDemo())).redirect).toBe('/entrar');
  });

  it('el admin sale de la demo y vuelve a ser él mismo', async () => {
    await loginAs(w.admin);
    await run(() => adminActions.openDemoAs(fd({ role: 'persona' })));
    expect((await getSessionContext())?.demoView).toBe(true);
    expect((await run(() => adminActions.exitDemo())).redirect).toBe('/admin');
    const ctx = await getSessionContext();
    expect(ctx?.demoView).toBe(false);
    expect(ctx?.user.id).toBe(w.admin.id);
  });

  it('una persona normal que la llame no gana ni pierde nada', async () => {
    await loginAs(w.attacker);
    expect((await run(() => adminActions.exitDemo())).redirect).toBe('/app');
    expect((await getCurrentUser())?.id).toBe(w.attacker.id);
  });
});

describe('admin/actions.ts#resetDemoData', () => {
  it('sin sesión o sin ser admin: no borra ni siembra nada', async () => {
    const ids = await ensureDemoEcosystemSeeded(false);
    await loginAs(null);
    expect((await run(() => adminActions.resetDemoData())).redirect).toMatch(/^\/entrar/);
    await loginAs(w.attacker);
    expect((await run(() => adminActions.resetDemoData())).notFound).toBe(true);
    const [still] = await db.select({ id: users.id }).from(users).where(eq(users.id, ids.marianaUserId));
    expect(still?.id).toBe(ids.marianaUserId);
  });

  it('el admin la reinicia: se rehace solo lo de ejemplo y no se toca ningún dato real', async () => {
    const ids = await ensureDemoEcosystemSeeded(false);
    const realBefore = await victimSnapshot(w);
    await loginAs(w.admin);
    await run(() => adminActions.openDemoAs(fd({ role: 'persona' })));
    expect((await run(() => adminActions.resetDemoData())).redirect).toBe('/admin?demo=reiniciada');

    const [old] = await db.select({ id: users.id }).from(users).where(eq(users.id, ids.marianaUserId));
    expect(old, 'el usuario de ejemplo anterior se borró').toBeUndefined();
    const [fresh] = await db.select().from(users).where(eq(users.email, DEMO_PERSONA_EMAIL));
    expect(fresh?.isDemo).toBe(true);
    expect(await victimSnapshot(w)).toBe(realBefore);
    // El admin conserva su sesión y ya no está viendo la demo.
    const ctx = await getSessionContext();
    expect(ctx?.realUser.id).toBe(w.admin.id);
    expect(ctx?.demoView).toBe(false);
  });
});

describe('aislamiento entre lo real y la demo', () => {
  it('una persona real no ve ofertas de negocios de ejemplo, y la persona de ejemplo no ve ofertas reales', async () => {
    const ids = await ensureDemoEcosystemSeeded(false);
    const demoMerchantIds = new Set(
      (await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.isDemo, true))).map((m) => m.id),
    );
    expect(demoMerchantIds.size).toBeGreaterThan(0);

    const forReal = await loadRankedOffersForUser(w.victim);
    expect(forReal.some((r) => demoMerchantIds.has(r.offer.merchantId))).toBe(false);

    const [mariana] = await db.select().from(users).where(eq(users.id, ids.marianaUserId));
    const forDemo = await loadRankedOffersForUser(mariana!);
    expect(forDemo.length).toBeGreaterThan(0);
    expect(forDemo.every((r) => demoMerchantIds.has(r.offer.merchantId))).toBe(true);
  });

  it('una persona real no puede reclamar una oferta de ejemplo aunque conozca su id', async () => {
    await ensureDemoEcosystemSeeded(false);
    const [demoOffer] = await db
      .select({ id: offers.id })
      .from(offers)
      .innerJoin(merchants, eq(merchants.id, offers.merchantId))
      .where(eq(merchants.isDemo, true))
      .limit(1);
    await loginAs(w.attacker);
    const inline = await run(() => v3Actions.claimOfferCodeInlineAction(demoOffer!.id));
    expect((inline.result as { ok: boolean }).ok).toBe(false);
    await run(() => merchantActions.claimOfferCode(fd({ offerId: demoOffer!.id })));
    const codes = await db.select({ id: offerCodes.id }).from(offerCodes).where(eq(offerCodes.userId, w.attacker.id));
    expect(codes).toHaveLength(0);
  });

  it('quien mira la demo no puede reclamar una oferta real', async () => {
    await loginAs(w.admin);
    await run(() => adminActions.openDemoAs(fd({ role: 'persona' })));
    const demoUser = (await getCurrentUser())!;
    const inline = await run(() => v3Actions.claimOfferCodeInlineAction(w.victimOffer2.id));
    expect((inline.result as { ok: boolean }).ok).toBe(false);
    const codes = await db.select({ id: offerCodes.id }).from(offerCodes).where(eq(offerCodes.userId, demoUser.id));
    const real = codes.length
      ? await db.select({ id: offerCodes.id }).from(offerCodes).where(eq(offerCodes.merchantId, w.victimMerchant.id))
      : [];
    expect(real.filter((c) => codes.some((d) => d.id === c.id))).toHaveLength(0);
  });

  it('en la demo no se puede borrar la cuenta (borraría al usuario de ejemplo y cerraría la sesión del admin)', async () => {
    await loginAs(w.admin);
    await run(() => adminActions.openDemoAs(fd({ role: 'persona' })));
    const demoUser = (await getCurrentUser())!;
    const outcome = await run(() => appActions.deleteAccount({ status: 'idle' }, fd({ confirm: 'BORRAR' })));
    expect((outcome.result as { status: string }).status).toBe('error');
    const [still] = await db.select({ id: users.id }).from(users).where(eq(users.id, demoUser.id));
    expect(still?.id).toBe(demoUser.id);
    expect((await getSessionContext())?.realUser.id).toBe(w.admin.id);
  });

  it('una persona nueva no puede registrarse como usuario de demostración', async () => {
    const fresh = await createUser();
    expect(fresh.isDemo).toBe(false);
    expect(fresh.role).toBe('user');
  });
});
