import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Pruebas de integración: llaman las acciones del servidor y los manejadores de ruta contra un
 * Postgres local de verdad (devdb, base cifra_test). Requieren `cd devdb && npm start`.
 *
 * La URL sale de TEST_DATABASE_URL o, si no está, de la base local por defecto. El arranque
 * (test/integration/global-setup.ts) se niega a correr contra cualquier base que no sea local
 * y terminada en "_test", porque borra el esquema completo.
 */
process.env.TEST_DATABASE_URL ??= 'postgres://cifra:cifra_local@127.0.0.1:54329/cifra_test';
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/integration/**/*.itest.ts'],
    environment: 'node',
    globalSetup: ['./test/integration/global-setup.ts'],
    setupFiles: ['./test/integration/setup.ts'],
    // Una sola base compartida: los archivos corren uno tras otro.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      TEST_DATABASE_URL,
      ADMIN_EMAILS: 'admin@prueba.local',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      CRON_SECRET: 'secreto-cron-de-prueba',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      RESEND_API_KEY: '',
      SMTP_URL: '',
    },
  },
});
