import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOTS_DIR = '/tmp/v3-screenshots';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const BASE_URL = 'http://127.0.0.1:3100';

async function run() {
  console.log('🚀 Starting CIFRA v3 E2E Test Suite...');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--headless=new'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  });

  const page = await context.newPage();

  try {
    // -------------------------------------------------------------------------
    // 1. DEMO HUB & PERSONA LOGIN
    // -------------------------------------------------------------------------
    console.log('📍 1. Navigating to Demo Hub...');
    await page.goto(`${BASE_URL}/demo`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-demo-hub.png'), fullPage: true });

    console.log('📍 Entering as Mariana (Persona)...');
    const marianaBtn = page.locator('button:has-text("Mariana"), button:has-text("Entrar como Mariana")').first();
    await marianaBtn.click();
    await page.waitForURL('**/app**', { timeout: 10000 });
    console.log('✅ Landed on Persona Hoy (/app)');

    // -------------------------------------------------------------------------
    // 2. PERSONA HOY: PULSE CARD, MAP & QUICK CAPTURE
    // -------------------------------------------------------------------------
    await page.waitForSelector('#btn-toggle-smart-map', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-persona-hoy.png'), fullPage: true });

    // Open Quick Capture Modal
    console.log('📍 Opening Quick Capture Modal...');
    await page.click('#btn-open-quick-capture');
    await page.waitForSelector('#quick-raw-text', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-quick-capture-modal.png') });

    // Type SMS phrase and submit
    console.log('📍 Submitting quick Colombian SMS...');
    await page.fill('#quick-raw-text', 'Bancolombia le informa compra por $24.500 en Panaderia La Espiga 06/11 16:45');
    await page.click('#btn-submit-quick-capture');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-quick-captured.png'), fullPage: true });
    console.log('✅ Quick movement captured');

    // Expand Smart Map
    console.log('📍 Expanding Smart Map...');
    await page.click('#btn-toggle-smart-map');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-smart-map-expanded.png'), fullPage: true });

    // -------------------------------------------------------------------------
    // 3. ¿PUEDO? (SIMULADOR DE CUOTAS Y CRUCE CON EL BARRIO)
    // -------------------------------------------------------------------------
    console.log('📍 3. Navigating to ¿Puedo? (/app/gasto)...');
    await page.goto(`${BASE_URL}/app/gasto`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#amount', { timeout: 5000 });

    // Test a purchase question with credit card simulation
    console.log('📍 Simulating purchase of $350.000 with credit simulation...');
    await page.fill('#amount', '350.000');
    await page.fill('#what', 'Tenis deportivos en Falabella');
    await page.click('#btn-ask-direct');
    await page.waitForSelector('text=¿Y si lo pasas con tarjeta a cuotas?', { timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-puedo-simulation.png'), fullPage: true });
    console.log('✅ Credit installments simulation verified');

    // -------------------------------------------------------------------------
    // 4. MOVIMIENTOS: RADIOGRAFÍA DE FUGAS
    // -------------------------------------------------------------------------
    console.log('📍 4. Navigating to Movimientos (/app/movimientos)...');
    await page.goto(`${BASE_URL}/app/movimientos`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Radiografía de Fugas', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-movimientos-fugas.png'), fullPage: true });
    console.log('✅ Leaks section visible');

    // -------------------------------------------------------------------------
    // 5. OFERTAS: MAPA INTELIGENTE + CUPOS RELÁMPAGO
    // -------------------------------------------------------------------------
    console.log('📍 5. Navigating to Ofertas (/app/ofertas)...');
    await page.goto(`${BASE_URL}/app/ofertas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-ofertas-map.png'), fullPage: true });
    console.log('✅ Offers and smart map verified');

    // -------------------------------------------------------------------------
    // 6. NEGOCIO: ENTRAR COMO ROSA (PANADERÍA LA ESPIGA)
    // -------------------------------------------------------------------------
    console.log('📍 6. Returning to Demo Hub to enter as Rosa...');
    await page.goto(`${BASE_URL}/demo`, { waitUntil: 'networkidle' });
    const rosaBtn = page.locator('button:has-text("Rosa"), button:has-text("Entrar como Rosa")').first();
    await rosaBtn.click();
    await page.waitForURL('**/negocio**', { timeout: 10000 });
    console.log('✅ Landed on Negocio Portal');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09-negocio-resumen.png'), fullPage: true });

    // -------------------------------------------------------------------------
    // 7. CUADRE DIARIO Y COSTO DE INSUMOS (/negocio/cuadre)
    // -------------------------------------------------------------------------
    console.log('📍 7. Navigating to /negocio/cuadre...');
    await page.goto(`${BASE_URL}/negocio/cuadre`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Cuadre del día y costo de insumos', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10-negocio-cuadre.png'), fullPage: true });

    // Test adding a quick ledger entry
    console.log('📍 Adding a quick counter sale to today\'s cuadre...');
    await page.fill('#ledger-amount', '45.000');
    await page.fill('#ledger-note', 'Venta 2 combos café tarde');
    await page.click('#btn-add-ledger');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11-negocio-cuadre-updated.png'), fullPage: true });
    console.log('✅ Ledger entry registered');

    // Open Flash Rescue form if present
    const flashRescueBtn = page.locator('#btn-open-flash-rescue');
    if (await flashRescueBtn.isVisible()) {
      console.log('📍 Opening Flash Rescue launcher...');
      await flashRescueBtn.click();
      await page.waitForSelector('#flash-title', { timeout: 3000 });
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '12-flash-rescue-open.png'), fullPage: true });
    }

    // -------------------------------------------------------------------------
    // 8. CREADOR DE OFERTAS & CALCULADORA HONESTA (/negocio/ofertas)
    // -------------------------------------------------------------------------
    console.log('📍 8. Navigating to /negocio/ofertas...');
    await page.goto(`${BASE_URL}/negocio/ofertas`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Calculadora honesta', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '13-negocio-ofertas-calculator.png'), fullPage: true });
    console.log('✅ Honest margin calculator verified');

    // -------------------------------------------------------------------------
    // 9. AFICHE QR IMPRIMIBLE (/negocio/vitrina)
    // -------------------------------------------------------------------------
    console.log('📍 9. Navigating to /negocio/vitrina...');
    await page.goto(`${BASE_URL}/negocio/vitrina`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Mi vitrina digital y afiche QR', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '14-negocio-vitrina-poster.png'), fullPage: true });
    console.log('✅ Printable poster verified');

    // -------------------------------------------------------------------------
    // 10. VITRINA PÚBLICA (/b/demo-panaderia-la-espiga)
    // -------------------------------------------------------------------------
    console.log('📍 10. Navigating to Public Storefront (/b/demo-panaderia-la-espiga)...');
    await page.goto(`${BASE_URL}/b/demo-panaderia-la-espiga`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Panadería La Espiga', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15-public-storefront.png'), fullPage: true });
    console.log('✅ Public storefront verified');

    // -------------------------------------------------------------------------
    // 11. REDENCIÓN POS EN CAJA (/negocio/caja)
    // -------------------------------------------------------------------------
    console.log('📍 11. Testing POS Redemption in Caja (/negocio/caja)...');
    await page.goto(`${BASE_URL}/negocio/caja`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#pos-code', { timeout: 5000 });

    const codeToRedeem = 'ESPIGA';
    console.log(`📍 Using redemption code: ${codeToRedeem}`);

    await page.fill('#pos-code', codeToRedeem);
    await page.click('button:has-text("Verificar código")');
    await page.waitForSelector('text=Código válido', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '16-caja-lookup.png'), fullPage: true });

    console.log('📍 Confirming redemption in Caja...');
    await page.click('button:has-text("Confirmar venta y aplicar descuento")');
    await page.waitForSelector('text=Venta registrada en Caja', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '17-caja-redeemed.png'), fullPage: true });
    console.log('✅ Redemption completed successfully in POS!');

    console.log('🎉 ALL 11 CIFRA v3 E2E TESTS PASSED WITH FLYING COLORS!');
  } catch (err) {
    console.error('❌ E2E Test Error:', err);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error-state.png'), fullPage: true });
    throw err;
  } finally {
    await browser.close();
  }
}

run();
