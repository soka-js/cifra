// Prueba de punta a punta de la página pública: del QR a la cifra sin crear cuenta.
//
//   Requiere la app corriendo (npm run build && npm run start, o npm run dev). No necesita base
//   de datos: esta pantalla calcula en el navegador.
//
//   npm run e2e:prueba
//   BASE_URL=http://localhost:3100 E2E_SHOTS_DIR=../docs/producto/evidencia npm run e2e:prueba
//
// Comprueba, en un celular de 390x844:
//   1. La primera pregunta y su botón se ven sin desplazar.
//   2. La resta que se muestra cierra exacta con lo que la persona escribió (prueba de recibo).
//   3. Todo monto en pantalla se deriva de esos datos: no aparece ningún otro número.
//   4. "¿Puedo gastar?" responde contra la misma cifra.
//   5. Ningún monto sale del navegador antes de guardar.
import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const CHANNEL = process.env.E2E_BROWSER_CHANNEL ?? 'chrome';
const SHOTS = process.env.E2E_SHOTS_DIR ? path.resolve(process.env.E2E_SHOTS_DIR) : null;

// Montos fáciles de reconocer si se colaran en una petición o en otro lugar de la pantalla.
const IN = { balance: 1_234_567, rent: 654_321, daily: 23_456, guess: 987_654, ask: 111_222 };

const pesos = (n) => `$${Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const toNumber = (text) => Number(text.replace(/[^\d]/g, ''));

let failures = 0;
async function step(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`  FALLA ${name}\n       ${String(err.message ?? err).split('\n').join('\n       ')}`);
  }
}

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1.5,
  isMobile: true,
  hasTouch: true,
  locale: 'es-CO',
  timezoneId: 'America/Bogota',
});
// sendBeacon envía un Blob que no se puede leer desde aquí; al desactivarlo, la analítica usa
// fetch con exactamente el mismo cuerpo y así se puede revisar qué sale.
await ctx.addInitScript(() => {
  navigator.sendBeacon = () => false;
});
const page = await ctx.newPage();
const sent = [];
page.on('request', (req) => {
  if (req.method() !== 'GET') sent.push({ url: req.url().replace(BASE, ''), body: req.postData() });
});
const shot = async (name, opts = {}) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.jpg`), type: 'jpeg', quality: 62, ...opts });
};

console.log(`Prueba sin cuenta en ${BASE} (390x844)`);

await step('la raíz es pública: responde 200 sin sesión y no redirige', async () => {
  const res = await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  assert.equal(res.status(), 200);
  assert.equal(new URL(page.url()).pathname, '/');
});

await step('la primera pregunta y su botón se ven sin desplazar', async () => {
  const bottom = await page.locator('#btn-probar-seguir').evaluate((el) => el.getBoundingClientRect().bottom);
  assert.ok(bottom <= 844, `el botón "Seguir" termina en ${Math.round(bottom)} px (la pantalla mide 844)`);
  await shot('e4-prueba-1-inicio');
});

await step('no deja avanzar sin responder', async () => {
  await page.click('#btn-probar-seguir');
  assert.match(await page.locator('form [role="alert"]').innerText(), /cada cuánto te pagan/i);
});

const startedAt = Date.now();
await step('responde las cuatro preguntas', async () => {
  await page.locator('input[name="frequency"][value="quincenal"]').check();
  await page.click('#btn-probar-seguir');
  await page.fill('#pc-balance', String(IN.balance));
  await page.click('#btn-probar-seguir');
  await page.getByRole('button', { name: 'Arriendo' }).click();
  await page.locator('li:has(input[name="fixedName"]) input[inputmode="numeric"]').first().fill(String(IN.rent));
  // Un día de cobro que siempre cae antes del próximo pago: mañana.
  const tomorrow = await page.evaluate(() => new Date(Date.now() - 5 * 3_600_000 + 86_400_000).getUTCDate());
  await page.locator('select[name="fixedDay"]').first().selectOption(String(tomorrow));
  await page.click('#btn-probar-seguir');
  await page.fill('#pc-daily', String(IN.daily));
  await page.fill('#pc-guess', String(IN.guess));
  await page.click('#btn-probar-ver');
  await page.waitForSelector('[data-testid="cifra"]');
});
const scriptMs = Date.now() - startedAt;

let cifra = 0;
let days = 0;
await step('la resta cierra exacta: saldo − fijos − día a día = cifra', async () => {
  const receipt = await page.locator('section[aria-labelledby="pc-result"] dl').innerText();
  const m = receipt.match(/por día × (\d+) día/);
  assert.ok(m, `no encontré los días en el recibo: ${receipt}`);
  days = Number(m[1]);
  const shown = toNumber(await page.textContent('[data-testid="cifra"]'));
  const negative = /te faltan/i.test(await page.textContent('#pc-result'));
  cifra = negative ? -shown : shown;

  // Mañana siempre es antes del próximo pago, salvo que el pago sea mañana mismo: en ese caso el cobro también cuenta.
  const expected = IN.balance - IN.rent - IN.daily * days;
  assert.equal(cifra, expected, `esperaba ${pesos(expected)} con ${days} días; la pantalla muestra ${pesos(cifra)}`);
  for (const amount of [IN.balance, IN.rent, IN.daily, IN.daily * days]) {
    assert.ok(receipt.includes(pesos(amount)), `el recibo no muestra ${pesos(amount)}:\n${receipt}`);
  }
  await shot('e4-prueba-2-resultado', { fullPage: true });
});

await step('todo monto en pantalla sale de lo que la persona escribió', async () => {
  const text = await page.locator('section[aria-labelledby="pc-result"]').innerText();
  const shown = [...new Set((text.match(/\$\s?[\d.]+\d/g) ?? []).map(toNumber))];
  const derived = new Set([
    IN.balance,
    IN.rent,
    IN.daily,
    IN.daily * days,
    Math.abs(cifra),
    Math.max(0, Math.floor(cifra / days)), // por día
    IN.guess,
    Math.abs(IN.guess - cifra), // diferencia con lo que creía
    0,
  ]);
  const strangers = shown.filter((n) => !derived.has(n));
  assert.deepEqual(strangers, [], `montos sin recibo: ${strangers.map(pesos).join(', ')}`);
});

await step('dice cuánto se alejó de lo que creía', async () => {
  const gap = await page.textContent('[data-testid="brecha"]');
  assert.ok(gap.includes(pesos(IN.guess)), gap);
  assert.ok(gap.includes(pesos(Math.abs(IN.guess - cifra))), gap);
  assert.match(gap, IN.guess > cifra ? /menos de lo que pensabas/ : /más de lo que pensabas/);
});

await step('"¿Puedo gastar?" responde contra la misma cifra', async () => {
  await page.fill('#ask-prueba', String(IN.ask));
  await page.click('#btn-ask-prueba');
  const answer = await page.textContent('[data-testid="respuesta-puedo"]');
  const left = cifra - IN.ask;
  if (left >= 0) assert.ok(answer.includes(pesos(left)), `esperaba que quedaran ${pesos(left)}: ${answer}`);
  else assert.ok(answer.includes(pesos(-left)) && /no te alcanza/i.test(answer), answer);
  await page.locator('#ask-prueba').scrollIntoViewIfNeeded();
  await shot('e4-prueba-3-puedo');
});

await step('ningún monto sale del navegador', async () => {
  await page.waitForTimeout(800);
  assert.ok(sent.length > 0, 'esperaba al menos los eventos anónimos de uso');
  for (const r of sent) assert.ok(typeof r.body === 'string', `no pude leer el cuerpo de ${r.url}`);
  // Un monto son cuatro dígitos o más. Lo único que se envía son nombres de evento, estados y conteos.
  const digits = sent.flatMap((r) => `${r.url} ${r.body}`.match(/\d[\d.,]{3,}/g) ?? []);
  assert.deepEqual(digits, [], `peticiones con números largos:\n${sent.map((r) => `${r.url} ${r.body}`).join('\n')}`);
  assert.deepEqual([...new Set(sent.map((r) => r.url))], ['/api/events']);
});

await step('lo escrito queda solo en el dispositivo, listo para guardar con una cuenta', async () => {
  const stored = JSON.parse(await page.evaluate(() => sessionStorage.getItem('cifra:prueba')));
  assert.equal(stored.balanceMinor, IN.balance * 100);
  assert.equal(stored.dailyMinor, IN.daily * 100);
  assert.equal(stored.fixed[0].amountMinor, IN.rent * 100);
  assert.equal(await page.getAttribute('#btn-probar-guardar', 'href'), '/registro?desde=prueba');
});

await step('"Cambiar mis datos" conserva lo escrito', async () => {
  await page.getByRole('button', { name: 'Cambiar mis datos' }).click();
  await page.click('#btn-probar-seguir');
  assert.equal(await page.inputValue('#pc-balance'), pesos(IN.balance).slice(1));
});

await browser.close();
console.log(`\n${failures === 0 ? 'Todo en verde' : `${failures} falla(s)`}. Las cuatro respuestas, escritas por el guion: ${scriptMs} ms.`);
process.exit(failures === 0 ? 0 : 1);
