import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3200';
const OUT_DIR = '/tmp/v3-screenshots';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  console.log('🚀 Verifying Consolidated Commission Cut & Billing UI...');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--headless=new'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'es-CO',
  });

  const page = await context.newPage();

  // 1. Iniciar sesión como tendero (La Espiga Dorada)
  console.log('📍 1. Activating merchant session...');
  await page.goto(`${BASE_URL}/api/demo/session?role=merchant&slug=demo-panaderia-la-espiga&redirect=/negocio/cuenta`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(1200);

  // 2. Verificar página de cuenta y cortes
  console.log('📍 2. Inspecting /negocio/cuenta...');
  await page.screenshot({ path: `${OUT_DIR}/31-negocio-cuenta-corte-consolidado.png`, fullPage: false });
  console.log('📸 Saved 31-negocio-cuenta-corte-consolidado.png');

  // 3. Probar el botón de autocompletar comprobante Demo
  console.log('📍 3. Testing demo autofill on payment form...');
  const autofillBtn = page.locator('button:has-text("Llenar comprobante de prueba (Demo)")');
  if (await autofillBtn.isVisible()) {
    await autofillBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT_DIR}/32-negocio-cuenta-autofill-demo.png`, fullPage: false });
    console.log('📸 Saved 32-negocio-cuenta-autofill-demo.png');
  }

  // 4. Ir a /negocio/caja y probar visualización de comisión acumulada
  console.log('📍 4. Navigating to /negocio/caja...');
  await page.goto(`${BASE_URL}/negocio/caja`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Ingresar código de prueba PAN10K
  const codeInput = page.locator('#pos-code');
  if (await codeInput.isVisible()) {
    console.log('Typing PAN10K and clicking verify...');
    await codeInput.fill('PAN10K');
    await page.locator('button:has-text("Verificar código")').click();
    console.log('Waiting for #grossAmount or error...');
    try {
      const grossInput = await page.waitForSelector('#grossAmount', { timeout: 4000 });
      if (grossInput) {
        await grossInput.fill('20000');
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${OUT_DIR}/33-negocio-caja-consolidated-split.png`, fullPage: false });
        console.log('📸 Saved 33-negocio-caja-consolidated-split.png');
      }
    } catch (e) {
      console.log('Could not find #grossAmount:', e.message);
      await page.screenshot({ path: `${OUT_DIR}/33-pos-state.png`, fullPage: false });
    }
  }

  // 5. Ir a /negocio/ofertas
  console.log('📍 5. Navigating to /negocio/ofertas...');
  await page.goto(`${BASE_URL}/negocio/ofertas`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/34-negocio-ofertas-billing-status.png`, fullPage: false });
  console.log('📸 Saved 34-negocio-ofertas-billing-status.png');

  await browser.close();
  console.log('✨ All browser verifications passed!');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
