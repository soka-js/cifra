// Prueba de punta a punta de las reglas de seguridad y de los recorridos clave, en un celular
// de 390x844. La corre `npm run e2e` (ver run.mjs), que prepara la base local y levanta la app.
//
//   A. Un visitante sin sesión no ve ningún dato.
//   B. Los datos viejos (usuario demo con la clave publicada, role = admin) ya no abren nada.
//   C. Una persona nueva llega a su cifra y no puede entrar a /admin ni a un negocio.
//   D. El admin sale solo de ADMIN_EMAILS + correo verificado, y la demo se abre solo desde /admin.
//   E. Un tendero nuevo se registra solo, publica una oferta y valida un código en caja.
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import postgres from 'postgres';
import { BASE, PHONE, finalPath, launch, pesos, shot, stepper } from './lib.mjs';

const DB = process.env.TEST_DATABASE_URL;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
assert.ok(DB && ADMIN_EMAIL, 'Esta prueba se corre con `npm run e2e`, que prepara la base y la app.');
assert.ok(/@(127\.0\.0\.1|localhost)[:/].*_test$/.test(DB), 'Solo contra una base local terminada en _test.');

const sql = postgres(DB, { max: 2, prepare: false, onnotice: () => {} });
const PASSWORD = 'ClaveLocal-12345';
const stamp = Date.now().toString(36);
const { step, finish } = stepper(`Seguridad y recorridos clave en ${BASE} (390x844)`);
const browser = await launch();

async function signup(page, { name, email, zone = 'las-aguas', next }) {
  await page.goto(`${BASE}/registro${next ? `?next=${encodeURIComponent(next)}` : ''}`, { waitUntil: 'networkidle' });
  await page.fill('#name', name);
  await page.fill('#email', email);
  await page.fill('#password', PASSWORD);
  await page.selectOption('#zoneSlug', zone);
  await page.check('#consent');
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/registro'), { timeout: 30_000 }), page.click('#btn-signup-submit')]);
  await page.waitForLoadState('networkidle');
}

// ============================================================================================
// A. Visitante sin sesión
// ============================================================================================
const anon = await browser.newContext(PHONE);
const a = await anon.newPage();

await step('A1. sin sesión, las páginas privadas llevan a entrar', async () => {
  const expected = {
    '/app': '/entrar',
    '/app/datos': '/entrar?next=%2Fapp%2Fdatos',
    '/app/movimientos': '/entrar?next=%2Fapp%2Fmovimientos',
    '/app/gasto': '/entrar?next=%2Fapp%2Fgasto',
    '/app/ofertas': '/entrar?next=%2Fapp%2Fofertas',
    '/app/cobros': '/entrar?next=%2Fapp%2Fcobros',
    '/app/ajustes': '/entrar?next=%2Fapp%2Fajustes',
    '/negocio/caja': '/entrar?next=%2Fnegocio%2Fcaja',
    '/negocio/cuenta': '/entrar?next=%2Fnegocio%2Fcuenta',
    '/negocio/ofertas': '/entrar?next=%2Fnegocio%2Fofertas',
    '/admin': '/entrar?next=%2Fadmin',
    '/admin/presentacion': '/entrar?next=%2Fadmin%2Fpresentacion',
  };
  for (const [from, to] of Object.entries(expected)) {
    await a.goto(BASE + from, { waitUntil: 'domcontentloaded' });
    assert.equal(finalPath(a), to, `${from} terminó en ${finalPath(a)}`);
  }
});

await step('A2. sin sesión, /negocio lleva al registro de negocio (un tendero nuevo sí puede entrar)', async () => {
  await a.goto(`${BASE}/negocio`, { waitUntil: 'domcontentloaded' });
  assert.equal(finalPath(a), '/negocio/unirse');
});

await step('A3. sin sesión, las API no entregan datos', async () => {
  const exp = await anon.request.get(`${BASE}/api/export?format=json`);
  assert.equal(exp.status(), 401);
  assert.ok(!(await exp.text()).includes('@'), 'la respuesta de /api/export no debe traer correos');
  assert.equal((await anon.request.post(`${BASE}/api/import`, { data: {} })).status(), 401);
  assert.equal((await anon.request.post(`${BASE}/api/push/subscribe`, { data: {} })).status(), 401);
  assert.equal((await anon.request.get(`${BASE}/api/cron/daily`)).status(), 401);
});

await step('A4. la puerta de demo no existe: /api/demo/session y /demo responden 404', async () => {
  for (const p of ['/api/demo/session?role=admin', '/api/demo/session?role=persona&redirect=/app', '/demo']) {
    const res = await anon.request.get(BASE + p, { maxRedirects: 0 });
    assert.equal(res.status(), 404, `${p} respondió ${res.status()}`);
  }
  assert.equal((await anon.cookies()).some((c) => c.name === 'cf_session'), false, 'no debe quedar ninguna sesión');
});

await step('A5. /entrar ya no ofrece accesos de un clic ni publica credenciales', async () => {
  await a.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' });
  const text = await a.locator('body').innerText();
  for (const word of ['Mariana', 'La Espiga', 'Consola Admin', 'CifraDemo', '1 clic']) {
    assert.ok(!text.includes(word), `/entrar todavía muestra "${word}"`);
  }
  await shot(a, 'e1-entrar-sin-accesos');
});

await step('A6. una cookie de sesión inventada no abre nada', async () => {
  const forged = await browser.newContext(PHONE);
  await forged.addCookies([{ name: 'cf_session', value: randomBytes(32).toString('base64url'), url: BASE }]);
  const f = await forged.newPage();
  await f.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' });
  assert.equal(finalPath(f), '/entrar');
  await f.goto(`${BASE}/negocio/caja`, { waitUntil: 'domcontentloaded' });
  assert.ok(finalPath(f).startsWith('/entrar'), finalPath(f));
  await f.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  assert.ok(finalPath(f).startsWith('/entrar'), finalPath(f));
  assert.equal((await forged.request.get(`${BASE}/api/export`)).status(), 401);
  await forged.close();
});

await step('A7. lo público sigue abierto', async () => {
  for (const p of ['/', '/entrar', '/registro', '/negocio/unirse', '/privacidad', '/terminos']) {
    const res = await a.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    assert.equal(res.status(), 200, `${p} respondió ${res.status()}`);
    assert.equal(new URL(a.url()).pathname, p);
  }
});

// ============================================================================================
// B. Datos viejos que ya no deben abrir nada
// ============================================================================================
await step('B1. el admin demo con la clave que estaba publicada ya no puede entrar', async () => {
  // Así quedó la base de quien visitó la versión anterior: un usuario demo, admin, con clave pública.
  await sql`insert into users (email, name, password_hash, role, is_demo)
            values ('admin@cifra.co', 'Admin demo viejo', ${await hash('CifraDemo2026!')}, 'admin', true)`;
  await a.goto(`${BASE}/entrar?next=/admin`, { waitUntil: 'networkidle' });
  await a.fill('#email', 'admin@cifra.co');
  await a.fill('#password', 'CifraDemo2026!');
  await a.locator('form button[type="submit"]').click();
  // (Next agrega su propio elemento con role=alert para anunciar rutas; por eso se busca el del formulario.)
  const alert = a.locator('form p[role="alert"]');
  await alert.waitFor({ timeout: 15_000 });
  assert.match(await alert.innerText(), /no coinciden/);
  assert.equal(new URL(a.url()).pathname, '/entrar');
  assert.equal((await anon.cookies()).some((c) => c.name === 'cf_session'), false);
});

await step('B2. una persona con role = admin en la base, fuera de ADMIN_EMAILS, no entra a /admin', async () => {
  const email = `rol-admin.${stamp}@prueba.local`;
  await sql`insert into users (email, name, password_hash, role, onboarded_at, email_verified_at)
            values (${email}, 'Rol admin en base', ${await hash(PASSWORD)}, 'admin', now(), now())`;
  const ctx = await browser.newContext(PHONE);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' });
  await p.fill('#email', email);
  await p.fill('#password', PASSWORD);
  await Promise.all([p.waitForURL((u) => u.pathname.startsWith('/app'), { timeout: 30_000 }), p.locator('form button[type="submit"]').click()]);
  const res = await p.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  assert.equal(res.status(), 404);
  await ctx.close();
});
await anon.close();

// ============================================================================================
// C. Persona nueva
// ============================================================================================
const personaCtx = await browser.newContext(PHONE);
const p = await personaCtx.newPage();
const personaEmail = `persona.${stamp}@prueba.local`;

await step('C1. una persona nueva crea su cuenta y llega a su cifra con sus propios números', async () => {
  await signup(p, { name: 'Ana Persona', email: personaEmail });
  assert.equal(new URL(p.url()).pathname, '/app/bienvenida');
  await p.click('#btn-start-quick');
  await p.locator('input[name="frequency"][value="quincenal"]').check();
  await p.click('#btn-qs-next');
  await p.fill('#qs-balance', '1200000');
  await p.click('#btn-qs-next');
  await p.click('#btn-qs-next');
  await p.fill('#qs-daily', '25000');
  await Promise.all([p.waitForURL((u) => u.pathname === '/app', { timeout: 30_000 }), p.click('#btn-qs-submit')]);
  await p.waitForLoadState('networkidle');
  const text = await p.locator('main').innerText();
  assert.ok(text.includes(pesos(1_200_000)), 'el Hoy debe mostrar el saldo escrito, con punto de miles');
  assert.ok(text.includes(`${pesos(25_000)} por día`), 'el Hoy debe mostrar el gasto diario escrito');
  const commas = text.match(/\$\d{1,3}(,\d{3})+/g) ?? [];
  assert.deepEqual(commas, [], 'no debe quedar ningún monto con coma');
});

await step('C2. esa persona no entra a /admin (404) ni tiene negocio', async () => {
  const res = await p.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  assert.equal(res.status(), 404);
  await p.goto(`${BASE}/negocio`, { waitUntil: 'domcontentloaded' });
  assert.equal(finalPath(p), '/negocio/registro');
});

await step('C3. su descarga de datos trae solo lo suyo', async () => {
  const res = await personaCtx.request.get(`${BASE}/api/export?format=json`);
  assert.equal(res.status(), 200);
  const data = await res.json();
  assert.equal(data.profile.email, personaEmail);
  assert.ok(data.accounts.length >= 1 && data.accounts.every((acc) => acc.userId === data.profile.id));
});

// ============================================================================================
// D. Admin y demo
// ============================================================================================
const adminCtx = await browser.newContext(PHONE);
const ad = await adminCtx.newPage();

await step('D1. registrarse con el correo de ADMIN_EMAILS no da acceso a /admin', async () => {
  await signup(ad, { name: 'Admin de prueba', email: ADMIN_EMAIL, zone: 'chapinero' });
  const res = await ad.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  assert.equal(res.status(), 404, 'un correo sin verificar no debe abrir /admin');
});

await step('D2. al verificar el correo con el enlace de cambio de clave, /admin abre', async () => {
  // El enlace llega por correo; aquí se crea igual que lo crea la app (solo se guarda su hash).
  const token = randomBytes(32).toString('base64url');
  const [user] = await sql`select id from users where email = ${ADMIN_EMAIL}`;
  await sql`insert into password_reset_tokens (token_hash, user_id, expires_at)
            values (${createHash('sha256').update(token).digest('hex')}, ${user.id}, now() + interval '1 hour')`;
  await ad.goto(`${BASE}/restablecer/${token}`, { waitUntil: 'networkidle' });
  await ad.fill('#new-password', `${PASSWORD}-nueva`);
  await Promise.all([ad.waitForURL((u) => u.pathname.startsWith('/app'), { timeout: 30_000 }), ad.click('#btn-reset-password')]);
  const res = await ad.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  assert.equal(res.status(), 200);
  const text = await ad.locator('body').innerText();
  assert.ok(text.includes('Demo con datos de ejemplo'));
  for (const word of ['CifraDemo', 'Credenciales', 'mariana.demo@cifra.co']) {
    assert.ok(!text.includes(word), `/admin todavía muestra "${word}"`);
  }
  await shot(ad, 'e1-admin-lanzador-demo');
});

await step('D3. el admin abre la demo como persona: franja de demo y datos de ejemplo', async () => {
  await Promise.all([ad.waitForURL((u) => u.pathname === '/app', { timeout: 60_000 }), ad.click('#btn-demo-persona')]);
  await ad.waitForLoadState('networkidle');
  const bar = ad.locator('[data-testid="demo-bar"]');
  assert.ok(await bar.isVisible(), 'la franja de demo debe verse');
  assert.match(await bar.innerText(), /datos de ejemplo/);
  const data = await (await adminCtx.request.get(`${BASE}/api/export?format=json`)).json();
  assert.equal(data.profile.email, 'mariana.demo@cifra.co', 'lo que se ve y se descarga es de la persona de ejemplo');
  await shot(ad, 'e1-demo-persona');
});

await step('D4. dentro de la demo se ve la vitrina de un negocio de ejemplo', async () => {
  const res = await ad.goto(`${BASE}/b/demo-panaderia-la-espiga`, { waitUntil: 'domcontentloaded' });
  assert.equal(res.status(), 200);
});

await step('D5. pasa a tendero con un toque: negocio de ejemplo, misma franja', async () => {
  await ad.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  await Promise.all([
    ad.waitForURL((u) => u.pathname === '/negocio', { timeout: 60_000 }),
    ad.locator('[data-testid="demo-bar"]').getByRole('button', { name: 'Tendero' }).click(),
  ]);
  await ad.waitForLoadState('networkidle');
  assert.match(await ad.locator('h1').first().innerText(), /Panadería La Espiga/);
  assert.ok(await ad.locator('[data-testid="demo-bar"]').isVisible());
  await shot(ad, 'e1-demo-tendero');
});

await step('D6. sale de la demo y vuelve a ser el admin', async () => {
  await Promise.all([
    ad.waitForURL((u) => u.pathname === '/admin', { timeout: 60_000 }),
    ad.locator('[data-testid="demo-bar"]').getByRole('button', { name: 'Salir' }).click(),
  ]);
  const data = await (await adminCtx.request.get(`${BASE}/api/export?format=json`)).json();
  assert.equal(data.profile.email, ADMIN_EMAIL);
  await ad.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  assert.equal(await ad.locator('[data-testid="demo-bar"]').count(), 0, 'fuera de la demo no hay franja');
});

await step('D7. nadie más ve la demo: vitrina 404 para un visitante y para una persona con cuenta', async () => {
  const visitor = await browser.newContext(PHONE);
  const res = await visitor.request.get(`${BASE}/b/demo-panaderia-la-espiga`);
  assert.equal(res.status(), 404);
  await visitor.close();
  assert.equal((await personaCtx.request.get(`${BASE}/b/demo-panaderia-la-espiga`)).status(), 404);
  await p.goto(`${BASE}/app/ofertas`, { waitUntil: 'networkidle' });
  const text = await p.locator('main').innerText();
  for (const demoName of ['La Espiga', 'Café Tostión', 'Fruver El Parque']) {
    assert.ok(!text.includes(demoName), `una persona real ve el negocio de ejemplo "${demoName}"`);
  }
});

await step('D8. los usuarios de ejemplo quedaron sin clave y sin rol en la base', async () => {
  const rows = await sql`select email, role, password_hash from users where is_demo and email <> 'admin@cifra.co'`;
  assert.ok(rows.length >= 4, `esperaba la siembra de la demo, hay ${rows.length} usuarios`);
  for (const r of rows) {
    assert.equal(r.password_hash, null, `${r.email} tiene clave`);
    assert.equal(r.role, 'user', `${r.email} tiene rol ${r.role}`);
  }
});
await adminCtx.close();

// ============================================================================================
// E. Tendero nuevo, desde cero hasta la caja
// ============================================================================================
const shopCtx = await browser.newContext(PHONE);
const s = await shopCtx.newPage();
const shopEmail = `tendero.${stamp}@prueba.local`;
const shopName = `Café E2E ${stamp}`;
let code = '';

await step('E1. un tendero sin cuenta abre /negocio y registra su negocio él solo', async () => {
  await s.goto(`${BASE}/negocio`, { waitUntil: 'networkidle' });
  assert.equal(finalPath(s), '/negocio/unirse');
  await s.fill('#businessName', shopName);
  await s.selectOption('#businessCategory', 'cafeteria');
  await s.fill('#ownerName', 'Carlos Tendero');
  await s.fill('#whatsapp', '3105550000');
  await s.selectOption('#zoneSlug', 'las-aguas');
  await s.fill('#address', 'Cra 3 # 18-45');
  await s.fill('#email', shopEmail);
  await s.fill('#password', PASSWORD);
  await Promise.all([
    s.waitForURL((u) => u.pathname === '/negocio/ofertas', { timeout: 30_000 }),
    s.locator('form button[type="submit"]').last().click(),
  ]);
  await s.waitForLoadState('networkidle');
});

await step('E2. publica su primera oferta', async () => {
  await s.fill('#offer-title', '10 % en café y pan del día');
  await Promise.all([
    s.waitForURL((u) => u.pathname === '/negocio', { timeout: 30_000 }),
    s.locator('form:has(#offer-title) button[type="submit"]').click(),
  ]);
  await s.waitForLoadState('networkidle');
  assert.match(await s.locator('h1').first().innerText(), new RegExp(shopName));
  // La oferta nace con un grupo de control del 10 % (personas a las que no se les muestra, para
  // medir). Se apaga aquí para que la persona de la prueba siempre pueda reclamarla.
  await sql`update offers set holdout_percent = 0
            where merchant_id in (select id from merchants where name = ${shopName})`;
});

await step('E3. su cuenta no muestra mandatos ni canales de pago inventados', async () => {
  await s.goto(`${BASE}/negocio/cuenta`, { waitUntil: 'networkidle' });
  const text = await s.locator('main').innerText();
  for (const fake of ['Mandato', '@laespiga', '312 456 7890', '4821', '300 555 0199', '@cifrapagos', 'Bolsa Prepago']) {
    assert.ok(!text.includes(fake), `la cuenta del negocio todavía muestra "${fake}"`);
  }
});

await step('E4. una persona ve la oferta y genera su código', async () => {
  await p.goto(`${BASE}/app/ofertas`, { waitUntil: 'networkidle' });
  assert.ok((await p.locator('main').innerText()).includes(shopName), 'la persona debe ver el negocio nuevo');
  await p.getByRole('button', { name: /Generar código/ }).first().click();
  // La acción corre en el servidor: se espera a que el código exista antes de leerlo.
  let row;
  for (let i = 0; i < 40 && !row; i++) {
    [row] = await sql`select c.code from offer_codes c join users u on u.id = c.user_id
                    where u.email = ${personaEmail} and c.status = 'pendiente' order by c.created_at desc limit 1`;
    if (!row) await p.waitForTimeout(250);
  }
  assert.ok(row, 'debe existir un código pendiente de la persona');
  await p.getByText(row.code, { exact: false }).first().waitFor({ timeout: 15_000 });
  code = row.code;
  assert.ok((await p.locator('main').innerText()).includes(code), 'la persona debe ver su código en pantalla');
});

await step('E5. el tendero valida el código en caja: cobra $18.000, comisión $900, le quedan $17.100', async () => {
  await s.goto(`${BASE}/negocio/caja`, { waitUntil: 'networkidle' });
  await s.fill('#pos-code', code);
  await s.getByRole('button', { name: /Verificar código/ }).click();
  await s.waitForSelector('#grossAmount');
  await s.fill('#grossAmount', '20000');
  await s.locator('form:has(#grossAmount) button[type="submit"]').click();
  await s.getByText('Venta registrada', { exact: false }).first().waitFor({ timeout: 30_000 });
  const text = await s.locator('main').innerText();
  for (const amount of [18_000, 900, 17_100, 20_000, 2_000]) {
    assert.ok(text.includes(pesos(amount)), `la caja no muestra ${pesos(amount)}`);
  }
  await shot(s, 'e1-caja-cobrado', { fullPage: true });
});

await step('E6. el mismo código no sirve dos veces', async () => {
  await s.goto(`${BASE}/negocio/caja`, { waitUntil: 'networkidle' });
  await s.fill('#pos-code', code);
  await s.getByRole('button', { name: /Verificar código/ }).click();
  await s.getByText('ya fue usado', { exact: false }).first().waitFor({ timeout: 15_000 });
});

await step('E7. a la persona le llega el aviso del ahorro', async () => {
  await p.goto(`${BASE}/app/avisos`, { waitUntil: 'networkidle' });
  const text = await p.locator('main').innerText();
  assert.ok(text.includes(`Ahorraste ${pesos(2_000)}`), text.slice(0, 300));
});

await browser.close();
await sql.end();
finish();
