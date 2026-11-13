// Piezas comunes de las pruebas de punta a punta: un celular de 390x844, pasos con nombre y pesos.
import path from 'node:path';
import { chromium } from 'playwright-core';

export const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const CHANNEL = process.env.E2E_BROWSER_CHANNEL ?? 'chrome';
const SHOTS = process.env.E2E_SHOTS_DIR ? path.resolve(process.env.E2E_SHOTS_DIR) : null;

export const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1.5,
  isMobile: true,
  hasTouch: true,
  locale: 'es-CO',
  timezoneId: 'America/Bogota',
};

/** Usa el Chrome instalado en la máquina (playwright-core no trae navegador propio). */
export function launch() {
  return chromium.launch({ channel: CHANNEL, headless: true });
}

/** $1.234.567, igual que cop() en la app. */
export const pesos = (n) => `$${Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
export const toNumber = (text) => Number(String(text).replace(/[^\d]/g, ''));

/** Guarda una captura solo si se pidió con E2E_SHOTS_DIR. */
export async function shot(page, name, opts = {}) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.jpg`), type: 'jpeg', quality: 62, ...opts });
}

/** Pasos con nombre: cada uno se reporta como ok o FALLA y la corrida sigue hasta el final. */
export function stepper(title) {
  let failures = 0;
  let total = 0;
  console.log(title);
  return {
    async step(name, fn) {
      total += 1;
      try {
        await fn();
        console.log(`  ok   ${name}`);
      } catch (err) {
        failures += 1;
        console.log(`  FALLA ${name}\n       ${String(err?.message ?? err).split('\n').join('\n       ')}`);
      }
    },
    finish(extra = '') {
      console.log(`\n${failures === 0 ? `Todo en verde (${total} de ${total})` : `${failures} falla(s) de ${total}`}. ${extra}`.trimEnd());
      process.exit(failures === 0 ? 0 : 1);
    },
  };
}

/** Ruta final (path + query) después de seguir las redirecciones. */
export const finalPath = (page) => {
  const u = new URL(page.url());
  return u.pathname + u.search;
};
