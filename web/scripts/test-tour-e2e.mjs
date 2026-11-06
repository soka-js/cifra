import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3200';
const OUT_DIR = '/tmp/v3-screenshots';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  console.log('🚀 Starting CIFRA Demo Auto-Tour E2E Verification...');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--headless=new'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 880 },
    locale: 'es-CO',
  });

  const page = await context.newPage();

  // 1. Visitar /demo
  console.log('📍 1. Navigating to /demo Hub...');
  await page.goto(`${BASE_URL}/demo`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/25-demo-hub-autotour-banner.png`, fullPage: false });
  console.log('📸 Saved 25-demo-hub-autotour-banner.png');

  // 2. Probar previsualizador interactivo en el Hub
  console.log('📍 2. Testing Hub Tour Previewer...');
  const tabNegocio = page.locator('button:has-text("Tendero (5)")').first();
  if (await tabNegocio.isVisible()) {
    await tabNegocio.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT_DIR}/26-demo-hub-preview-tendero.png`, fullPage: false });
    console.log('📸 Saved 26-demo-hub-preview-tendero.png');
  }

  // 3. Iniciar Recorrido Completo desde el botón principal
  console.log('📍 3. Launching Full Live Auto-Tour...');
  const launchBtn = page.locator('button:has-text("Iniciar Recorrido Completo")');
  await launchBtn.click();
  await page.waitForNavigation({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Verificar que el dock del tour esté visible en /app
  const tourCard = page.locator('aside[aria-label="Recorrido guiado de la demostración"]');
  await tourCard.waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: `${OUT_DIR}/27-tour-step1-persona-hoy.png`, fullPage: false });
  console.log('📸 Saved 27-tour-step1-persona-hoy.png');

  // 4. Pausar auto-avance y avanzar manualmente a Paso 3 (¿Puedo?)
  console.log('📍 4. Navigating forward in tour to ¿Puedo? (/app/gasto)...');
  const nextBtn = page.locator('button:has-text("Siguiente")');
  await nextBtn.click(); // Paso 2
  await page.waitForTimeout(1000);

  await nextBtn.click(); // Paso 3
  await page.waitForNavigation({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/28-tour-step3-puedo-simulation.png`, fullPage: false });
  console.log('📸 Saved 28-tour-step3-puedo-simulation.png');

  // 5. Saltar al lado del Tendero (Paso 5: Cuadre del local)
  console.log('📍 5. Testing automatic role switch to Tendero (Rosa)...');
  const seeAllBtn = page.locator('button:has-text("Ver todos")');
  await seeAllBtn.click();
  await page.waitForTimeout(500);

  const step5Btn = page.locator('button:has-text("Cuadre Diario, Punto de Equilibrio y Costos")');
  await step5Btn.click();
  await page.waitForNavigation({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  await page.screenshot({ path: `${OUT_DIR}/29-tour-step5-tendero-cuadre.png`, fullPage: false });
  console.log('📸 Saved 29-tour-step5-tendero-cuadre.png');

  // 6. Avanzar al Paso 6 (Margen y Ofertas)
  console.log('📍 6. Advancing to Paso 6 (Margen y Ofertas Relámpago)...');
  const nextBtn2 = page.locator('button:has-text("Siguiente")');
  await nextBtn2.click();
  await page.waitForNavigation({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: `${OUT_DIR}/30-tour-step6-tendero-ofertas.png`, fullPage: false });
  console.log('📸 Saved 30-tour-step6-tendero-ofertas.png');

  console.log('🎉 ALL AUTO-TOUR E2E VERIFICATIONS PASSED SUCCESSFULLY!');
  await browser.close();
}

run().catch((err) => {
  console.error('❌ Error during tour E2E verification:', err);
  process.exit(1);
});
