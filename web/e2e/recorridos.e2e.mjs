// Los cuatro caminos de alguien que no conoce CIFRA, en un celular de 390x844, medidos:
//
//   1. QR      de abrir `/` a ver su cifra, sin cuenta.
//   2. Persona de "Guardar mi cifra" a su Hoy con cuenta, y todo lo que encuentra en el menú.
//   3. Tendero de `/negocio` sin sesión a su primera oferta publicada, y todo lo que encuentra.
//   4. Caja    la persona saca su código y el tendero lo valida.
//
// Por cada camino cuenta pantallas, toques, campos escritos y segundos (los de la máquina: sirven
// para comparar antes y después, no para decir cuánto tarda una persona). Por cada pantalla del
// menú mide el alto en pantallas de celular y cuántas cosas se pueden tocar.
//
// La corre `npm run e2e` (necesita la base local de pruebas). Con E2E_SHOTS_DIR guarda capturas y
// un `recorridos.json` con las medidas.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { BASE, PHONE, launch, pesos, shot, stepper } from './lib.mjs';

const DB = process.env.TEST_DATABASE_URL;
assert.ok(DB && /@(127\.0\.0\.1|localhost)[:/].*_test$/.test(DB), 'Esta prueba se corre con `npm run e2e` contra la base local de pruebas.');
const sql = postgres(DB, { max: 1, prepare: false, onnotice: () => {} });

const TAG = process.env.RECORRIDO_TAG ?? 'r';
const PASSWORD = 'ClaveLocal-12345';
const stamp = Date.now().toString(36);
const { step, finish } = stepper(`Recorridos de alguien nuevo en ${BASE} (390x844)`);
const browser = await launch();

/** Cuenta lo que hace una persona en un camino. Un desplegable vale dos toques: abrir y elegir. */
function camino(nombre) {
  const m = { camino: nombre, pantallas: 0, toques: 0, campos: 0, segundos: 0 };
  const t0 = Date.now();
  return {
    m,
    pantalla: async (page, name) => {
      m.pantallas += 1;
      await shot(page, `${TAG}-${name}`);
    },
    tap: async (locator) => {
      m.toques += 1;
      await locator.click();
    },
    check: async (locator) => {
      m.toques += 1;
      await locator.check();
    },
    select: async (locator, value) => {
      m.toques += 2;
      await locator.selectOption(value);
    },
    fill: async (locator, value) => {
      m.toques += 1;
      m.campos += 1;
      await locator.fill(value);
    },
    done: () => {
      m.segundos = Math.round((Date.now() - t0) / 100) / 10;
      return m;
    },
  };
}

/** Qué tan larga y qué tan cargada es una pantalla. */
async function medir(page, ruta) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
  return page.evaluate((r) => {
    const visible = (el) => {
      const b = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const main = document.querySelector('main') ?? document.body;
    const tocables = [...main.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary')].filter(visible);
    return {
      ruta: r,
      titulo: (document.querySelector('h1')?.textContent ?? '').trim().slice(0, 70),
      pantallas: Math.round((document.documentElement.scrollHeight / window.innerHeight) * 10) / 10,
      tocables: tocables.length,
      palabras: (main.innerText.match(/\S+/g) ?? []).length,
    };
  }, ruta);
}

const medidas = { caminos: [], pantallas: [], menus: {} };

// ============================================================================================
// 1. Del QR a la cifra, sin cuenta
// ============================================================================================
const personaCtx = await browser.newContext(PHONE);
const p = await personaCtx.newPage();
const personaEmail = `nueva.${stamp}@prueba.local`;
const IN = { balance: 1_200_000, rent: 450_000, daily: 25_000 };

await step('1. del QR a la cifra, sin cuenta', async () => {
  const c = camino('1. QR a la cifra (sin cuenta)');
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await c.pantalla(p, '1a-inicio');
  await c.check(p.locator('input[name="frequency"][value="quincenal"]'));
  await c.tap(p.locator('#btn-probar-seguir'));
  await c.pantalla(p, '1b-saldo');
  await c.fill(p.locator('#pc-balance'), String(IN.balance));
  await c.tap(p.locator('#btn-probar-seguir'));
  await c.pantalla(p, '1c-fijos');
  await c.tap(p.getByRole('button', { name: 'Arriendo' }));
  await c.fill(p.locator('li:has(input[name="fixedName"]) input[inputmode="numeric"]').first(), String(IN.rent));
  const tomorrow = await p.evaluate(() => new Date(Date.now() - 5 * 3_600_000 + 86_400_000).getUTCDate());
  await c.select(p.locator('select[name="fixedDay"]').first(), String(tomorrow));
  await c.tap(p.locator('#btn-probar-seguir'));
  await c.pantalla(p, '1d-dia-a-dia');
  await c.fill(p.locator('#pc-daily'), String(IN.daily));
  await c.tap(p.locator('#btn-probar-ver'));
  await p.waitForSelector('[data-testid="cifra"]');
  await c.pantalla(p, '1e-cifra');
  await shot(p, `${TAG}-1e-cifra-completa`, { fullPage: true });
  medidas.caminos.push(c.done());
});

// ============================================================================================
// 2. Guardar la cifra y conocer la app
// ============================================================================================
await step('2. guarda su cifra con una cuenta y llega a su Hoy', async () => {
  const c = camino('2. De la cifra al Hoy con cuenta');
  await Promise.all([p.waitForURL((u) => u.pathname === '/registro'), c.tap(p.locator('#btn-probar-guardar'))]);
  await p.waitForLoadState('networkidle');
  await c.pantalla(p, '2a-registro');
  await c.fill(p.locator('#name'), 'Laura Nueva');
  await c.fill(p.locator('#email'), personaEmail);
  await c.fill(p.locator('#password'), PASSWORD);
  await c.check(p.locator('#consent'));
  await c.tap(p.locator('#btn-signup-submit'));
  await p.waitForURL((u) => u.pathname === '/app', { timeout: 45_000 });
  await p.waitForLoadState('networkidle');
  await c.pantalla(p, '2b-hoy');
  await shot(p, `${TAG}-2b-hoy-completo`, { fullPage: true });
  assert.ok((await p.locator('main').innerText()).includes(pesos(IN.balance)));
  medidas.caminos.push(c.done());
});

await step('2b. lo que encuentra la persona en el menú', async () => {
  medidas.menus.persona = await p.evaluate(() => ({
    abajo: [...document.querySelectorAll('nav[aria-label="Secciones principales"] a')].map((a) => a.textContent.trim()),
    arriba: [...document.querySelectorAll('[data-testid="app-top-bar"] a')].map((a) => a.getAttribute('aria-label') ?? a.textContent.trim()).filter(Boolean),
  }));
  const rutas = ['/app', '/app/gasto', '/app/movimientos', '/app/ofertas', '/app/cobros', '/app/avisos', '/app/ajustes', '/app/datos', '/app/cierre', '/app/datos/importar'];
  for (const ruta of rutas) {
    const m = await medir(p, ruta);
    medidas.pantallas.push({ quien: 'persona', ...m });
    await shot(p, `${TAG}-2-persona${ruta.replace(/\//g, '-')}`, { fullPage: true });
  }
});

// ============================================================================================
// 3. El tendero, de /negocio a su primera oferta
// ============================================================================================
const shopCtx = await browser.newContext(PHONE);
const s = await shopCtx.newPage();
const shopEmail = `tienda.${stamp}@prueba.local`;
const shopName = `Café Recorrido ${stamp}`;

await step('3. el tendero abre /negocio, registra su negocio y publica su primera oferta', async () => {
  const c = camino('3. Tendero: de /negocio a la primera oferta');
  await s.goto(`${BASE}/negocio`, { waitUntil: 'networkidle' });
  await c.pantalla(s, '3a-unirse');
  await shot(s, `${TAG}-3a-unirse-completa`, { fullPage: true });
  await c.fill(s.locator('#businessName'), shopName);
  await c.select(s.locator('#businessCategory'), 'cafeteria');
  await c.select(s.locator('#zoneSlug'), 'las-aguas');
  await c.fill(s.locator('#address'), 'Cra 3 # 18-45');
  await c.fill(s.locator('#typicalTicket'), '20000');
  await c.tap(s.locator('#btn-negocio-seguir'));
  await s.locator('#ownerName').waitFor({ state: 'visible' });
  await c.pantalla(s, '3b-tus-datos');
  await c.fill(s.locator('#ownerName'), 'Carlos Tendero');
  await c.fill(s.locator('#whatsapp'), '3105550000');
  await c.fill(s.locator('#email'), shopEmail);
  await c.fill(s.locator('#password'), PASSWORD);
  await c.check(s.locator('#consent'));
  await Promise.all([
    s.waitForURL((u) => u.pathname === '/negocio/ofertas', { timeout: 30_000 }),
    c.tap(s.locator('form button[type="submit"]').last()),
  ]);
  await s.waitForLoadState('networkidle');
  await c.pantalla(s, '3c-primera-oferta');
  await shot(s, `${TAG}-3c-primera-oferta-completa`, { fullPage: true });
  await c.fill(s.locator('#offer-title'), '10 % en café y pan del día');
  await Promise.all([
    s.waitForURL((u) => u.pathname === '/negocio', { timeout: 30_000 }),
    c.tap(s.locator('form:has(#offer-title) button[type="submit"]')),
  ]);
  await s.waitForLoadState('networkidle');
  await c.pantalla(s, '3d-resumen');
  medidas.caminos.push(c.done());
});

await step('3b. lo que encuentra el tendero en el menú', async () => {
  medidas.menus.tendero = await s.evaluate(() => ({
    abajo: [...document.querySelectorAll('nav[aria-label="Secciones de tu negocio"] a')].map((a) => a.textContent.trim()),
    arriba: [...document.querySelectorAll('[data-testid="app-top-bar"] a')].map((a) => a.getAttribute('aria-label') ?? a.textContent.trim()).filter(Boolean),
  }));
  const rutas = ['/negocio', '/negocio/caja', '/negocio/cuadre', '/negocio/ofertas', '/negocio/vitrina', '/negocio/informe', '/negocio/cuenta', '/negocio/perfil'];
  for (const ruta of rutas) {
    const m = await medir(s, ruta);
    medidas.pantallas.push({ quien: 'tendero', ...m });
    await shot(s, `${TAG}-3-tendero${ruta.replace(/\//g, '-')}`, { fullPage: true });
  }
});

// ============================================================================================
// 4. La caja: la persona saca su código y el tendero lo valida
// ============================================================================================
let code = '';
await step('4. la persona saca su código y el tendero lo cobra en caja', async () => {
  const c = camino('4. Caja: del código de la persona a la venta registrada');
  // La persona: desde su Hoy hasta tener el código en pantalla.
  await p.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  await c.tap(p.locator('nav[aria-label="Secciones principales"] a[href="/app/ofertas"]'));
  await p.waitForURL((u) => u.pathname === '/app/ofertas');
  await p.waitForLoadState('networkidle');
  await c.pantalla(p, '4a-ofertas');
  await c.tap(p.getByRole('button', { name: /Generar código/ }).first());
  let row;
  for (let i = 0; i < 40 && !row; i++) {
    [row] = await sql`select c.code from offer_codes c join users u on u.id = c.user_id
                    where u.email = ${personaEmail} and c.status = 'pendiente' order by c.created_at desc limit 1`;
    if (!row) await p.waitForTimeout(250);
  }
  assert.ok(row, 'debe existir un código pendiente de la persona');
  code = row.code;
  await p.getByText(code, { exact: false }).first().waitFor({ timeout: 15_000 });
  await c.pantalla(p, '4b-codigo');
  // El tendero: desde su resumen hasta la venta registrada.
  await s.goto(`${BASE}/negocio`, { waitUntil: 'networkidle' });
  await c.tap(s.locator('nav[aria-label="Secciones de tu negocio"] a[href="/negocio/caja"]'));
  await s.waitForURL((u) => u.pathname === '/negocio/caja');
  await s.waitForLoadState('networkidle');
  await c.pantalla(s, '4c-caja');
  await c.fill(s.locator('#pos-code'), code);
  await c.tap(s.getByRole('button', { name: /Verificar código/ }));
  await s.waitForSelector('#grossAmount');
  await c.pantalla(s, '4d-caja-monto');
  await c.fill(s.locator('#grossAmount'), '20000');
  await c.tap(s.locator('form:has(#grossAmount) button[type="submit"]'));
  await s.getByText('Venta registrada', { exact: false }).first().waitFor({ timeout: 30_000 });
  await c.pantalla(s, '4e-caja-cobrado');
  await shot(s, `${TAG}-4e-caja-cobrado-completa`, { fullPage: true });
  medidas.caminos.push(c.done());
});

await browser.close();
await sql.end();

console.log('\nCaminos');
console.table(medidas.caminos);
console.log('Menús:', JSON.stringify(medidas.menus));
console.log('Pantallas del menú');
console.table(medidas.pantallas);
if (process.env.E2E_SHOTS_DIR) {
  writeFileSync(path.join(path.resolve(process.env.E2E_SHOTS_DIR), `${TAG}-recorridos.json`), JSON.stringify(medidas, null, 2));
}
finish();
