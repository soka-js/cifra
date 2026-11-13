// Corre todas las pruebas de punta a punta contra la app compilada y una base LOCAL desechable.
//
//   Requisitos: devdb corriendo (cd devdb && npm start) y la app compilada (npm run build).
//   Uso:        npm run e2e
//               E2E_SHOTS_DIR=../docs/producto/evidencia npm run e2e   (guarda capturas)
//
// Qué hace: vacía y migra la base cifra_test, levanta `next start` en el puerto 3100 apuntando a
// esa base, corre cada archivo *.e2e.mjs y apaga el servidor. Se niega a tocar cualquier base que
// no sea local y terminada en "_test".
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '..');
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;
const DB = process.env.TEST_DATABASE_URL ?? 'postgres://cifra:cifra_local@127.0.0.1:54329/cifra_test';
const ADMIN_EMAIL = 'admin.e2e@prueba.local';

function assertLocalTestDatabase(url) {
  const u = new URL(url);
  const name = u.pathname.replace(/^\//, '');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) || !name.endsWith('_test')) {
    throw new Error(`Las pruebas de punta a punta solo corren contra una base local terminada en "_test" (recibí ${u.hostname}/${name}).`);
  }
}

async function resetDatabase() {
  const sql = postgres(DB, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await sql.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await sql.unsafe('CREATE SCHEMA public');
    await migrate(drizzle(sql), { migrationsFolder: path.join(web, 'drizzle') });
  } finally {
    await sql.end();
  }
}

async function waitForServer(timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(`${BASE_URL}/entrar`, { redirect: 'manual' });
      if (res.status === 200) return;
    } catch {
      // todavía no escucha
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`La app no respondió en ${BASE_URL} después de ${timeoutMs / 1000} s.`);
}

function runFile(file, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file], { cwd: web, env, stdio: 'inherit' });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

assertLocalTestDatabase(DB);
if (!existsSync(path.join(web, '.next', 'BUILD_ID'))) {
  console.error('Falta compilar la app: corre `npm run build` antes de `npm run e2e`.');
  process.exit(1);
}

try {
  await resetDatabase();
} catch (err) {
  console.error(`No se pudo preparar la base de pruebas (${err.message}). ¿Está corriendo devdb? (cd devdb && npm start)`);
  process.exit(1);
}

const env = {
  ...process.env,
  DATABASE_URL: DB,
  TEST_DATABASE_URL: DB,
  ADMIN_EMAILS: ADMIN_EMAIL,
  E2E_ADMIN_EMAIL: ADMIN_EMAIL,
  CRON_SECRET: 'secreto-cron-e2e',
  BASE_URL,
  // Sin servicios externos: ni Google ni correo.
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  RESEND_API_KEY: '',
  SMTP_URL: '',
};

const server = spawn(process.execPath, [path.join(web, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(PORT)], {
  cwd: web,
  env,
  stdio: ['ignore', 'ignore', 'inherit'],
});

let exitCode = 0;
try {
  await waitForServer();
  const only = process.argv.slice(2);
  const files = readdirSync(here)
    .filter((f) => f.endsWith('.e2e.mjs'))
    .filter((f) => only.length === 0 || only.some((o) => f.includes(o)))
    .sort();
  const results = [];
  for (const file of files) {
    console.log(`\n━━ ${file}`);
    const code = await runFile(path.join(here, file), env);
    results.push([file, code]);
    if (code !== 0) exitCode = 1;
  }
  console.log('\n━━ Resumen');
  for (const [file, code] of results) console.log(`  ${code === 0 ? 'ok   ' : 'FALLA'} ${file}`);
} catch (err) {
  console.error(err.message);
  exitCode = 1;
} finally {
  server.kill();
}
process.exit(exitCode);
