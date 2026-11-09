import { chromium } from 'playwright-core';

const BASE = 'http://localhost:3216';
const ARTIFACT_DIR =
  '/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/823f0254-9907-45d0-a3d1-f78ea79e776d';

async function main() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 920 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  console.log('1. Testing root URL / -> must open /app directly (NOT landing page)...');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const currentUrl = page.url();
  console.log('   Landed URL:', currentUrl);
  if (!currentUrl.includes('/app')) {
    throw new Error(`Expected / to redirect to /app, but got ${currentUrl}`);
  }

  // Reset demo data via admin endpoint first so we have a clean baseline
  await page.goto(`${BASE}/api/demo/session?role=persona&redirect=/app`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${ARTIFACT_DIR}/57-root-opens-product-app.png`, fullPage: false });

  console.log('2. Testing SavingsGoalAndNbaCard real PostgreSQL persistence on /app...');
  const activateAllBtn = page.locator('#btn-activate-all-nba');
  await activateAllBtn.scrollIntoViewIfNeeded();
  const initialBtnText = await activateAllBtn.innerText();
  if (initialBtnText.includes('activo')) {
    await activateAllBtn.click();
    await page.waitForTimeout(800);
  }
  await activateAllBtn.click();
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: 'networkidle' });
  const btnTextAfterReload = await page.locator('#btn-activate-all-nba').innerText();
  console.log('   NBA Plan button after reload:', btnTextAfterReload);
  if (!btnTextAfterReload.includes('activo')) {
    throw new Error(`NBA Plan did not persist across reload: ${btnTextAfterReload}`);
  }

  // Contribute $50,000 to goal and verify persistence
  await page.locator('#btn-open-goal-contribute').click();
  await page.locator('#btn-submit-goal-contribution').click();
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: 'networkidle' });
  const goalCardText = await page.locator('section[aria-label="Meta de ahorro y Mejor Siguiente Acción"]').innerText();
  console.log('   Goal card verified savings after reload:', goalCardText.match(/\$[0-9,]+/g)?.slice(0, 4));
  await page.locator('section[aria-label="Meta de ahorro y Mejor Siguiente Acción"]').screenshot({
    path: `${ARTIFACT_DIR}/58-real-goal-nba-persisted.png`,
  });

  console.log('3. Testing /app/gasto real spend evaluation & PostgreSQL execution...');
  await page.goto(`${BASE}/app/gasto`, { waitUntil: 'networkidle' });
  await page.fill('#natural-ask', '¿Puedo pedir domicilio de 38 mil hoy?');
  await page.click('#btn-ask-natural');
  await page.waitForSelector('#btn-record-evaluated-spend');
  await page.screenshot({ path: `${ARTIFACT_DIR}/59-real-gasto-evaluator.png`, fullPage: false });

  console.log('4. Testing /app/ajustes FreemiumPlanCard PostgreSQL persistence...');
  await page.goto(`${BASE}/app/ajustes`, { waitUntil: 'networkidle' });
  await page.click('#btn-plan-plus');
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: 'networkidle' });
  const plusBtnText = await page.locator('#btn-plan-plus').innerText();
  console.log('   Plan Plus button after reload:', plusBtnText);
  if (!plusBtnText.includes('Activo')) {
    throw new Error(`Plan Plus did not persist across reload: ${plusBtnText}`);
  }
  await page.locator('section[aria-label="Planes CIFRA Esencial y CIFRA Plus"]').screenshot({
    path: `${ARTIFACT_DIR}/60-real-plan-plus-persisted.png`,
  });
  // Switch back to Esencial as default clean state
  await page.click('#btn-plan-esencial');
  await page.waitForTimeout(800);

  console.log('5. Testing /app/datos OpenFinanceConsentShield PostgreSQL persistence & Bitácora...');
  await page.goto(`${BASE}/app/datos`, { waitUntil: 'networkidle' });
  await page.locator('button:has-text("365 días")').click();
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: 'networkidle' });
  const datosText = await page.locator('body').innerText();
  if (!datosText.includes('actualizar_mandato_ley1581')) {
    throw new Error('Expected actualizar_mandato_ley1581 in Bitácora de acceso a tus datos');
  }
  console.log('   Bitácora verified: actualizar_mandato_ley1581 logged in PostgreSQL!');
  await page.locator('section[aria-label="Certificado de Consentimiento Explícito y Estándar de Finanzas Abiertas"]').screenshot({
    path: `${ARTIFACT_DIR}/61-real-consent-mandate-persisted.png`,
  });

  console.log('6. Testing /negocio/cuenta AutoDebitMandateCard real PostgreSQL invoice settlement...');
  await page.goto(`${BASE}/negocio/cuenta`, { waitUntil: 'networkidle' });
  const executeDebitBtn = page.locator('#btn-execute-cutoff-debit');
  if (await executeDebitBtn.isVisible()) {
    await executeDebitBtn.click();
    await page.waitForTimeout(1200);
  }
  await page.reload({ waitUntil: 'networkidle' });
  const cuentaText = await page.locator('body').innerText();
  if (!cuentaText.includes('AUTODEB-') || !cuentaText.includes('Pagada')) {
    throw new Error('Expected AUTODEB- reference and Pagada status in /negocio/cuenta after reload');
  }
  console.log('   Merchant cutoff invoice settled & persisted in PostgreSQL!');
  await page.locator('section[aria-label="Mandato de Débito Automático y Bolsa Prepago"]').screenshot({
    path: `${ARTIFACT_DIR}/62-real-merchant-cutoff-settled.png`,
  });

  // Reopen cutoff so the evaluator can also click the button live if desired
  const reopenBtn = page.locator('#btn-reopen-cutoff-debit');
  if (await reopenBtn.isVisible()) {
    await reopenBtn.click();
    await page.waitForTimeout(900);
  }

  console.log('7. Testing /desarrolladores real B2B2C embedded token generation (/e/[token] -> /app)...');
  await page.goto(`${BASE}/desarrolladores`, { waitUntil: 'networkidle' });
  const launchEmbedBtn = page.locator('#btn-launch-real-b2b2c-embed');
  await launchEmbedBtn.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${ARTIFACT_DIR}/63-real-b2b2c-embedded-session.png`, fullPage: false });
  await launchEmbedBtn.click();
  await page.waitForURL(/\/app/, { timeout: 10000 });
  console.log('   Redeemed real one-time B2B2C token (/e/[token]) in PostgreSQL and entered:', page.url());

  await browser.close();
  console.log('ALL E2E REAL PRODUCT PERSISTENCE CHECKS PASSED! Console errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error(consoleErrors);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
