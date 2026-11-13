// El Hoy de una persona nueva, en un celular de 390x844: un solo número con su recibo.
// La corre `npm run e2e` (necesita la base local de pruebas).
//
// Con los datos del brief (saldo $1.200.000, $25.000 al día, pago quincenal) comprueba:
//   1. El Hoy cabe en dos pantallas.
//   2. Prueba de recibo: todo monto visible se deriva de esos datos. Ningún otro número.
//   3. Hay una sola respuesta a "cuánto por día".
//   4. "¿Puedo gastar?" se contesta ahí mismo, contra la misma cifra.
//   5. Anotar un gasto baja la cifra exactamente en ese monto.
//   6. No queda jerga del equipo ni el selector Persona/Negocio.
//   7. Nada flotante tapa "Preguntar" ni "Anotar un gasto".
import assert from 'node:assert/strict';
import { BASE, PHONE, launch, pesos, shot, stepper, toNumber } from './lib.mjs';

assert.ok(process.env.TEST_DATABASE_URL, 'Esta prueba se corre con `npm run e2e`.');
const IN = { balance: 1_200_000, daily: 25_000 };
const email = `hoy.${Date.now().toString(36)}@prueba.local`;
const { step, finish } = stepper(`El Hoy de una persona nueva en ${BASE} (390x844)`);

const browser = await launch();
const ctx = await browser.newContext(PHONE);
const page = await ctx.newPage();
let cifra = 0;
let days = 0;

await step('una persona nueva llega a su Hoy con los datos del brief', async () => {
  await page.goto(`${BASE}/registro`, { waitUntil: 'networkidle' });
  await page.fill('#name', 'Mariana Nueva');
  await page.fill('#email', email);
  await page.fill('#password', 'ClaveLocal-12345');
  await page.check('#consent');
  await Promise.all([page.waitForURL((u) => u.pathname === '/app/bienvenida'), page.click('#btn-signup-submit')]);
  await page.click('#btn-start-quick');
  await page.locator('input[name="frequency"][value="quincenal"]').check();
  await page.click('#btn-qs-next');
  await page.fill('#qs-balance', String(IN.balance));
  await page.click('#btn-qs-next');
  await page.click('#btn-qs-next');
  await page.fill('#qs-daily', String(IN.daily));
  await Promise.all([page.waitForURL((u) => u.pathname === '/app', { timeout: 30_000 }), page.click('#btn-qs-submit')]);
  await page.waitForLoadState('networkidle');
});

await step('el Hoy cabe en dos pantallas de celular', async () => {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const screens = height / 844;
  console.log(`       mide ${screens.toFixed(2)} pantallas (${height} px)`);
  assert.ok(screens <= 2, `mide ${screens.toFixed(2)} pantallas`);
  await shot(page, 'e3-hoy-1-arriba');
  await shot(page, 'e3-hoy-2-completo', { fullPage: true });
});

await step('la cifra dice "Puedes gastar hasta el…" y la resta cierra exacta', async () => {
  assert.match(await page.textContent('#cifra-label'), /^Puedes gastar hasta el \d+ \w+$/);
  cifra = toNumber(await page.textContent('[data-testid="cifra"]'));
  const main = await page.locator('main').innerText();
  const m = main.match(/por día × (\d+) día/);
  assert.ok(m, 'el recibo debe decir cuántos días proyecta');
  days = Number(m[1]);
  assert.equal(cifra, IN.balance - IN.daily * days, `con ${days} días esperaba ${pesos(IN.balance - IN.daily * days)}`);
});

await step('prueba de recibo: todo monto en pantalla sale de los datos de la persona', async () => {
  const main = await page.locator('main').innerText();
  const shown = [...new Set((main.match(/\$\s?[\d.]+\d|\$\d/g) ?? []).map(toNumber))];
  const derived = new Set([IN.balance, IN.daily, IN.daily * days, cifra, Math.floor(cifra / days), 0]);
  const strangers = shown.filter((n) => !derived.has(n));
  assert.deepEqual(strangers, [], `montos sin recibo en el Hoy: ${strangers.map(pesos).join(', ')}`);
  assert.ok(shown.length >= 4, 'esperaba ver al menos saldo, día a día, proyección y cifra');
});

await step('hay una sola respuesta a "cuánto por día"', async () => {
  const main = await page.locator('main').innerText();
  const perDayPhrases = main.match(/por día durante/g) ?? [];
  assert.equal(perDayPhrases.length, 1);
  assert.ok(main.includes(`${pesos(Math.floor(cifra / days))} por día durante ${days}`));
  for (const gone of ['tope', 'Tope', 'mañana tu']) assert.ok(!main.includes(gone), `todavía aparece "${gone}"`);
});

await step('no queda jerga del equipo ni el selector Persona/Negocio', async () => {
  const body = await page.locator('body').innerText();
  for (const word of ['NBA', 'B2B', 'relámpago', 'Relámpago', 'ntocable', 'jugada', 'isión', 'hormiga', 'Santa Marta', 'Negocio']) {
    assert.ok(!body.includes(word), `el Hoy todavía muestra "${word}"`);
  }
});

await step('nada flotante tapa "Preguntar" ni "Anotar un gasto"', async () => {
  await page.evaluate(() => window.scrollTo(0, 0));
  const covered = await page.evaluate(() => {
    const problems = [];
    // Dentro del contenido no debe haber nada fijo: solo la barra de arriba y la de abajo flotan.
    for (const el of document.querySelectorAll('main *')) {
      if (getComputedStyle(el).position === 'fixed') problems.push(`elemento fijo dentro del contenido: ${el.outerHTML.slice(0, 80)}`);
    }
    // La franja visible queda entre la barra de arriba y la navegación de abajo.
    const top = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    const bottom = document.querySelector('nav[aria-label="Secciones principales"]')?.getBoundingClientRect().top ?? window.innerHeight;
    for (const id of ['btn-ask-hoy', 'btn-anotar-gasto']) {
      const el = document.getElementById(id);
      if (!el) { problems.push(`no está #${id}`); continue; }
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (y < top || y > bottom) continue; // fuera de la franja visible: se ve al desplazar
      const hit = document.elementFromPoint(x, y);
      if (!hit || !el.contains(hit)) problems.push(`#${id} queda tapado por ${hit?.outerHTML.slice(0, 80)}`);
    }
    return problems;
  });
  assert.deepEqual(covered, []);
});

await step('"¿Puedo gastar?" se contesta ahí mismo, contra la misma cifra', async () => {
  await page.fill('#ask-hoy', '120000');
  await page.click('#btn-ask-hoy');
  const yes = await page.textContent('[data-testid="respuesta-puedo"]');
  assert.ok(yes.startsWith('Sí') && yes.includes(pesos(cifra - 120_000)), yes);
  await page.fill('#ask-hoy', String(cifra + 50_000));
  await page.click('#btn-ask-hoy');
  const no = await page.textContent('[data-testid="respuesta-puedo"]');
  assert.ok(/no te alcanza/i.test(no) && no.includes(pesos(50_000)), no);
  await page.locator('#ask-hoy').scrollIntoViewIfNeeded();
  await shot(page, 'e3-hoy-3-puedo');
});

await step('anotar un gasto de $18.000 baja la cifra exactamente $18.000', async () => {
  await page.click('#btn-anotar-gasto');
  await page.fill('#quick-raw-text', 'almuerzo 18000');
  await page.click('#btn-submit-quick-capture');
  await page.getByText('Listo: anotamos', { exact: false }).first().waitFor({ timeout: 20_000 });
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  const after = toNumber(await page.textContent('[data-testid="cifra"]'));
  assert.equal(after, cifra - 18_000, `la cifra pasó de ${pesos(cifra)} a ${pesos(after)}`);
});

await step('el modo discreto oculta la cifra', async () => {
  await page.click('#btn-cifra-privacy-toggle');
  assert.equal(await page.locator('[data-testid="cifra"]').count(), 0);
  await page.click('#btn-cifra-privacy-toggle');
  assert.equal(await page.locator('[data-testid="cifra"]').count(), 1);
});

await browser.close();
finish();
