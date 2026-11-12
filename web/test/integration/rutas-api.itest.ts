import { existsSync } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { GET as cronGet } from '@/app/api/cron/daily/route';
import { GET as exportGet } from '@/app/api/export/route';
import { POST as importPost } from '@/app/api/import/route';
import { DELETE as pushDelete, POST as pushPost } from '@/app/api/push/subscribe/route';
import { GET as memberCifraGet } from '@/app/api/v1/members/[memberId]/cifra/route';
import { GET as embedGet } from '@/app/e/[token]/route';
import * as adminActions from '@/app/admin/actions';
import { randomToken, sha256 } from '@/lib/crypto';
import { db } from '@/lib/db';
import { embedTokens, partners, sessions } from '@/lib/db/schema';
import { fd, jar, run } from './fake-next';
import { buildWorld, createUser, loginAs, truncateAll, victimSnapshot, type World } from './world';

/** Manejadores de ruta: ninguno entrega ni modifica datos sin sesión (o sin su llave propia). */

let w: World;
const url = (p: string) => `http://localhost:3000${p}`;

beforeEach(async () => {
  await truncateAll();
  w = await buildWorld();
  await loginAs(null);
});

describe('la puerta de demo ya no existe', () => {
  it('no hay ruta /api/demo/session ni página /demo en el código', () => {
    const app = path.resolve(process.cwd(), 'src', 'app');
    expect(existsSync(path.join(app, 'api', 'demo'))).toBe(false);
    expect(existsSync(path.join(app, 'demo'))).toBe(false);
  });
});

describe('GET /api/export', () => {
  it('sin sesión: 401 y ningún dato', async () => {
    const res = await exportGet(new NextRequest(url('/api/export?format=json')));
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain('@');
  });

  it('con sesión: entrega solo los datos de quien está en sesión', async () => {
    await loginAs(w.attacker);
    const res = await exportGet(new NextRequest(url('/api/export?format=json')));
    expect(res.status).toBe(200);
    const body = await res.text();
    const data = JSON.parse(body) as { profile: { id: string }; accounts: Array<{ userId: string }> };
    expect(data.profile.id).toBe(w.attacker.id);
    expect(data.accounts.every((a) => a.userId === w.attacker.id)).toBe(true);
    expect(body).not.toContain(w.victim.id);
    expect(body).not.toContain('victima@prueba.local');
  });
});

describe('POST /api/import', () => {
  const body = (accountId?: string) =>
    JSON.stringify({
      accountId: accountId ?? null,
      entityName: 'Bancolombia',
      accountKind: 'ahorros',
      accountName: 'Ahorros',
      mask: '1234',
      balanceMinor: 500_000_00,
      transactions: [{ postedOn: '2026-11-01', description: 'COMPRA PRUEBA', amountMinor: -10_000_00 }],
    });
  const post = (payload: string) =>
    importPost(new Request(url('/api/import'), { method: 'POST', body: payload, headers: { 'content-type': 'application/json' } }));

  it('sin sesión: 401 y no guarda nada', async () => {
    const before = await victimSnapshot(w);
    expect((await post(body())).status).toBe(401);
    expect(await victimSnapshot(w)).toBe(before);
  });

  it('no deja importar movimientos sobre la cuenta de otra persona', async () => {
    await loginAs(w.attacker);
    const before = await victimSnapshot(w);
    const res = await post(body(w.victimAccount.id));
    expect(res.status).toBe(404);
    expect(await victimSnapshot(w)).toBe(before);
  });
});

describe('/api/push/subscribe', () => {
  const sub = JSON.stringify({ endpoint: 'https://push.example/abc', keys: { p256dh: 'clave-p256dh-de-prueba', auth: 'auth-prueba' } });

  it('sin sesión: 401 al suscribir y al borrar', async () => {
    const post = await pushPost(new NextRequest(url('/api/push/subscribe'), { method: 'POST', body: sub }));
    expect(post.status).toBe(401);
    const del = await pushDelete(new NextRequest(url('/api/push/subscribe'), { method: 'DELETE', body: sub }));
    expect(del.status).toBe(401);
  });
});

describe('GET /api/cron/daily', () => {
  const call = (headers: Record<string, string> = {}) => cronGet(new NextRequest(url('/api/cron/daily'), { headers }));

  it('sin secreto ni sesión: 401', async () => {
    expect((await call()).status).toBe(401);
  });

  it('con un secreto equivocado: 401', async () => {
    expect((await call({ authorization: 'Bearer otro-secreto' })).status).toBe(401);
  });

  it('con sesión de una persona normal: 401', async () => {
    await loginAs(w.attacker);
    expect((await call()).status).toBe(401);
  });

  it('con el secreto correcto: corre', async () => {
    expect((await call({ authorization: 'Bearer secreto-cron-de-prueba' })).status).toBe(200);
  });

  it('con sesión de admin: corre, incluso mientras mira la demo', async () => {
    await loginAs(w.admin);
    expect((await call()).status).toBe(200);
    await run(() => adminActions.openDemoAs(fd({ role: 'persona' })));
    expect((await call()).status).toBe(200);
  });
});

describe('GET /e/[token] (enlace embebido de una entidad aliada)', () => {
  async function embedFor(userId: string) {
    const [partner] = await db.insert(partners).values({ name: 'Coop de prueba', slug: `coop-${randomToken(4)}` }).returning();
    const token = randomToken(24);
    await db
      .insert(embedTokens)
      .values({ tokenHash: sha256(token), userId, partnerId: partner!.id, expiresAt: new Date(Date.now() + 120_000) });
    return token;
  }
  const open = (token: string) => embedGet(new Request(url(`/e/${token}`)), { params: Promise.resolve({ token }) });

  it('un enlace inventado no abre sesión', async () => {
    const res = await open(randomToken(24));
    expect(res.headers.get('location')).toContain('/entrar?enlace=vencido');
    expect(jar.has('cf_session')).toBe(false);
  });

  it('un enlace válido abre la sesión de ese asociado y sirve una sola vez', async () => {
    const token = await embedFor(w.plain.id);
    const first = await open(token);
    expect(first.headers.get('location')).toContain('/app');
    expect(jar.has('cf_session')).toBe(true);
    jar.clear();
    const second = await open(token);
    expect(second.headers.get('location')).toContain('/entrar?enlace=vencido');
    expect(jar.has('cf_session')).toBe(false);
  });

  it('nunca abre sesión como un usuario de demostración', async () => {
    const demo = await createUser({ email: 'andres.demo@cifra.co', isDemo: true });
    const token = await embedFor(demo.id);
    const res = await open(token);
    expect(res.headers.get('location')).toContain('/entrar?enlace=invalido');
    expect(jar.has('cf_session')).toBe(false);
    expect(await db.select().from(sessions).where(eq(sessions.userId, demo.id))).toHaveLength(0);
  });
});

describe('API de aliados /api/v1', () => {
  it('sin llave de API: 401, aunque haya sesión de persona', async () => {
    await loginAs(w.attacker);
    const res = await memberCifraGet(new Request(url('/api/v1/members/abc/cifra')), {
      params: Promise.resolve({ memberId: 'abc' }),
    });
    expect(res.status).toBe(401);
  });

  it('con una llave inventada: 401', async () => {
    const res = await memberCifraGet(
      new Request(url('/api/v1/members/abc/cifra'), { headers: { authorization: `Bearer cfk_${randomToken(24)}` } }),
      { params: Promise.resolve({ memberId: 'abc' }) },
    );
    expect(res.status).toBe(401);
  });
});
