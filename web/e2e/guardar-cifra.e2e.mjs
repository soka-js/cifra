// Del QR a la cuenta: la persona calcula su cifra sin cuenta, toca "Guardar mi cifra", crea la
// cuenta y llega a su Hoy con la MISMA cifra, sin volver a escribir nada.
// La corre `npm run e2e` (necesita la base local de pruebas).
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { BASE, PHONE, finalPath, launch, pesos, shot, stepper, toNumber } from './lib.mjs';

const DB = process.env.TEST_DATABASE_URL;
assert.ok(DB && /@(127\.0\.0\.1|localhost)[:/].*_test$/.test(DB), 'Esta prueba se corre con `npm run e2e` contra la base local de pruebas.');
const sql = postgres(DB, { max: 1, prepare: false, onnotice: () => {} });

const IN = { balance: 1_234_567, rent: 654_321, daily: 23_456 };
const email = `guardar.${Date.now().toString(36)}@prueba.local`;
const { step, finish } = stepper(`Guardar la cifra de la prueba en una cuenta nueva, en ${BASE} (390x844)`);

const browser = await launch();
const ctx = await browser.newContext(PHONE);
const page = await ctx.newPage();
let cifra = 0;
let tomorrow = 0;

await step('calcula su cifra sin cuenta', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.locator('input[name="frequency"][value="quincenal"]').check();
  await page.click('#btn-probar-seguir');
  await page.fill('#pc-balance', String(IN.balance));
  await page.click('#btn-probar-seguir');
  await page.getByRole('button', { name: 'Arriendo' }).click();
  await page.locator('li:has(input[name="fixedName"]) input[inputmode="numeric"]').first().fill(String(IN.rent));
  tomorrow = await page.evaluate(() => new Date(Date.now() - 5 * 3_600_000 + 86_400_000).getUTCDate());
  await page.locator('select[name="fixedDay"]').first().selectOption(String(tomorrow));
  await page.click('#btn-probar-seguir');
  await page.fill('#pc-daily', String(IN.daily));
  await page.click('#btn-probar-ver');
  await page.waitForSelector('[data-testid="cifra"]');
  cifra = toNumber(await page.textContent('[data-testid="cifra"]'));
  assert.ok(cifra > 0);
});

await step('"Guardar mi cifra" lleva a crear la cuenta, y la página dice para qué', async () => {
  await Promise.all([page.waitForURL((u) => u.pathname === '/registro'), page.click('#btn-probar-guardar')]);
  assert.equal(finalPath(page), '/registro?desde=prueba');
  assert.match(await page.locator('h1').first().innerText(), /Guarda tu cifra/);
  await shot(page, 'e4-guardar-1-registro');
});

await step('crea la cuenta y llega a su Hoy sin pasar por las preguntas otra vez', async () => {
  await page.fill('#name', 'Laura Guarda');
  await page.fill('#email', email);
  await page.fill('#password', 'ClaveLocal-12345');
  await page.check('#consent');
  await page.click('#btn-signup-submit');
  await page.waitForURL((u) => u.pathname === '/app', { timeout: 45_000 });
  await page.waitForLoadState('networkidle');
  // Si hubiera tenido que contestar de nuevo, se habría quedado en /app/bienvenida.
  assert.equal(new URL(page.url()).pathname, '/app');
});

await step('el Hoy muestra la misma cifra y la misma resta', async () => {
  const text = await page.locator('main').innerText();
  for (const amount of [cifra, IN.balance, IN.rent, IN.daily]) {
    assert.ok(text.includes(pesos(amount)), `el Hoy no muestra ${pesos(amount)}`);
  }
  await shot(page, 'e4-guardar-2-hoy');
});

await step('en la cuenta quedó exactamente lo que escribió', async () => {
  const [user] = await sql`select id, income_frequency, income_days, daily_spend_minor, onboarded_at from users where email = ${email}`;
  assert.equal(user.income_frequency, 'quincenal');
  assert.deepEqual(user.income_days, [15, 30]);
  assert.equal(Number(user.daily_spend_minor), IN.daily * 100);
  assert.ok(user.onboarded_at);
  const accounts = await sql`select balance_minor from accounts where user_id = ${user.id}`;
  assert.deepEqual(accounts.map((a) => Number(a.balance_minor)), [IN.balance * 100]);
  const fixed = await sql`select name, amount_minor, day_of_month from commitments where user_id = ${user.id}`;
  assert.deepEqual(
    fixed.map((f) => [f.name, Number(f.amount_minor), f.day_of_month]),
    [['Arriendo', IN.rent * 100, tomorrow]],
  );
});

await step('lo que quedó en el dispositivo se borra: no se vuelve a guardar al recargar', async () => {
  assert.equal(await page.evaluate(() => sessionStorage.getItem('cifra:prueba')), null);
  await page.goto(`${BASE}/app/bienvenida`, { waitUntil: 'networkidle' });
  const [{ n }] = await sql`select count(*)::int as n from accounts a join users u on u.id = a.user_id where u.email = ${email}`;
  assert.equal(n, 1, 'no debe duplicar la cuenta de saldo');
});

await browser.close();
await sql.end();
finish();
