import { chromium } from 'playwright-core';
import path from 'node:path';

const BASE = 'http://localhost:3215';
const ARTIFACTS =
  '/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/823f0254-9907-45d0-a3d1-f78ea79e776d';

const FORBIDDEN_PATTERNS = [
  /prototipo/i,
  /proyecto acad[eé]mico/i,
  /todav[ií]a no son usuarias/i,
  /jurados\s*\/\s*inversionistas/i,
  /Llenar comprobante de prueba \(Demo\)/i,
  /Explorar cuenta de ejemplo/i,
  /Ver el mostrador de Rosa en vivo/i,
  /\$[0-9]+\.[0-9]{3}\b/, // Dot-formatted COP currency (excluding bank SMS raw examples with ',00')
];

async function checkPageClean(page, routeLabel) {
  const bodyText = await page.locator('body').innerText();
  const issues = [];
  for (const re of FORBIDDEN_PATTERNS) {
    const match = bodyText.match(re);
    if (match) {
      issues.push(`${routeLabel}: matched forbidden pattern ${re} -> "${match[0]}"`);
    }
  }
  return issues;
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 920 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  const allIssues = [];

  // 1. Public Landing Page
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  allIssues.push(...(await checkPageClean(page, 'GET /')));
  await page.screenshot({ path: path.join(ARTIFACTS, '51-audit-landing-production.png'), fullPage: false });
  // Scroll down to testimonials to screenshot
  await page.locator('#la-prueba').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ARTIFACTS, '52-audit-landing-testimonios.png'), fullPage: false });

  // 2. Legal Pages (/privacidad, /terminos) & B2B2C (/desarrolladores)
  for (const r of ['/privacidad', '/terminos', '/desarrolladores', '/b/panaderia-la-espiga']) {
    await page.goto(`${BASE}${r}`, { waitUntil: 'networkidle' });
    allIssues.push(...(await checkPageClean(page, `GET ${r}`)));
  }
  await page.goto(`${BASE}/privacidad`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACTS, '53-audit-privacidad-production.png'), fullPage: false });

  // 3. Authenticate as Mariana (Persona) and audit all /app/* routes
  await page.goto(`${BASE}/api/demo/session?role=persona`, { waitUntil: 'networkidle' });
  const personaRoutes = [
    '/app',
    '/app/gasto',
    '/app/movimientos',
    '/app/ofertas',
    '/app/cobros',
    '/app/cierre',
    '/app/datos',
    '/app/datos/importar',
    '/app/avisos',
    '/app/ajustes',
  ];

  for (const r of personaRoutes) {
    await page.goto(`${BASE}${r}`, { waitUntil: 'networkidle' });
    allIssues.push(...(await checkPageClean(page, `Persona ${r}`)));
  }

  // Capture /app/movimientos (Fugas & Dashboard) and /app/ofertas (Realistic per-visit savings)
  await page.goto(`${BASE}/app/movimientos`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACTS, '54-audit-movimientos-clean.png'), fullPage: false });

  await page.goto(`${BASE}/app/ofertas`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACTS, '55-audit-ofertas-realistic-savings.png'), fullPage: false });

  // 4. Authenticate as Rosa (Negocio) and audit all /negocio/* routes
  await page.goto(`${BASE}/api/demo/session?role=negocio`, { waitUntil: 'networkidle' });
  const merchantRoutes = [
    '/negocio',
    '/negocio/caja',
    '/negocio/cuadre',
    '/negocio/ofertas',
    '/negocio/vitrina',
    '/negocio/informe',
    '/negocio/cuenta',
    '/negocio/perfil',
  ];

  for (const r of merchantRoutes) {
    await page.goto(`${BASE}${r}`, { waitUntil: 'networkidle' });
    allIssues.push(...(await checkPageClean(page, `Negocio ${r}`)));
  }

  await page.goto(`${BASE}/negocio/cuenta`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACTS, '56-audit-negocio-cuenta-clean.png'), fullPage: false });

  await browser.close();

  console.log('=== FULL APP AUDIT RESULTS ===');
  console.log('Routes audited:', 1 + 4 + personaRoutes.length + merchantRoutes.length);
  console.log('Forbidden copy / currency issues found:', allIssues.length);
  if (allIssues.length > 0) {
    console.error(allIssues.join('\n'));
    process.exit(1);
  }
  console.log('Runtime pageerrors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error(consoleErrors.join('\n'));
    process.exit(1);
  }
  console.log('ALL 23 ROUTES PASSED 100% PRODUCTION AUDIT!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
