// Capturas de la landing publicada para la entrega de la actividad de tracción.
// Uso, desde la raíz del repo: node scripts/capturas.mjs
// Deja los archivos en entrega/. Requiere `npx playwright install chromium` una vez.

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SITIO = 'https://cifra-neon.vercel.app';
const SALIDA = fileURLToPath(new URL('../entrega/', import.meta.url));

const CAPTURAS = [
  { archivo: 'landing-escritorio-A.png', v: 'A', ancho: 1440, alto: 900 },
  { archivo: 'landing-escritorio-B.png', v: 'B', ancho: 1440, alto: 900, pdf: 'landing-escritorio-B.pdf' },
  { archivo: 'landing-tablet-B.png', v: 'B', ancho: 820, alto: 1180 },
  { archivo: 'landing-movil-B.png', v: 'B', ancho: 390, alto: 844 },
  // Sin cookie de consentimiento, para que salga el banner; solo la primera pantalla.
  { archivo: 'landing-consentimiento.png', v: 'B', ancho: 1440, alto: 900, conBanner: true },
];

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Baja en pasos hasta el final para que next/image cargue las fotos diferidas, y vuelve arriba. */
async function cargarTodo(page) {
  let y = 0;
  for (;;) {
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    if (y >= total) break;
    y += Math.round(page.viewportSize().height * 0.7);
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await espera(250);
  }
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollTo(0, 0));
  await espera(400);
}

/** Falla si alguna imagen no terminó de cargar, para no entregar fotos en blanco. */
async function verificarImagenes(page) {
  const rotas = await page.evaluate(() =>
    [...document.images].filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.currentSrc || img.src),
  );
  if (rotas.length) throw new Error(`Imágenes sin cargar: ${rotas.join(', ')}`);
}

await mkdir(SALIDA, { recursive: true });
const browser = await chromium.launch();

for (const c of CAPTURAS) {
  // Contexto nuevo en cada captura para que no se arrastren cookies.
  const context = await browser.newContext({ viewport: { width: c.ancho, height: c.alto }, deviceScaleFactor: 1 });
  if (!c.conBanner) {
    await context.addCookies([{ name: 'cf_consent', value: 'no', domain: 'cifra-neon.vercel.app', path: '/' }]);
  }
  // Estas visitas no deben contar en la analítica que se reporta en la misma entrega.
  await context.route('**/api/events', (route) => route.abort());
  await context.route(/google-analytics\.com|googletagmanager\.com/, (route) => route.abort());

  const page = await context.newPage();
  await page.goto(`${SITIO}/?v=${c.v}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  if (c.conBanner) {
    // El recibo del hero entra con animación; se espera a que termine para no capturarlo a medias.
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 10_000 });
    await espera(300);
    await page.screenshot({ path: join(SALIDA, c.archivo) });
  } else {
    await cargarTodo(page);
    await verificarImagenes(page);
    await page.screenshot({ path: join(SALIDA, c.archivo), fullPage: true });
    if (c.pdf) {
      // Una sola página larga con el ancho de escritorio, igual a la captura.
      await page.emulateMedia({ media: 'screen' });
      // Las sombras grandes con desenfoque salen como recuadros grises en varios visores de PDF.
      await page.addStyleTag({ content: '*, *::before, *::after { box-shadow: none !important; }' });
      const alto = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.pdf({
        path: join(SALIDA, c.pdf),
        width: `${c.ancho}px`,
        height: `${alto}px`,
        printBackground: true,
        pageRanges: '1',
      });
    }
  }
  console.log('listo', c.archivo, c.pdf ?? '');
  await context.close();
}

await browser.close();
