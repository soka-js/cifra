// Demo local con un solo comando (plan B de docs/producto/DEMO.md):
//   cd web && npm run demo
// Levanta la base local de devdb si no está corriendo, aplica las migraciones a cifra_dev, compila
// y abre la app en http://localhost:3000. Ctrl+C la apaga. Se niega a correr contra una base que no
// sea la local: nunca toca producción.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const devdb = path.resolve(web, '..', 'devdb');
const DB_PORT = 54329;
const APP_PORT = 3000;

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// 1. Solo la base local, leída de web/.env.local (no de las variables de la terminal).
const envFile = path.join(web, '.env.local');
if (!existsSync(envFile)) fail('Falta web/.env.local. Cópialo de web/.env.example.');
const match = readFileSync(envFile, 'utf8').match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)/m);
if (!match) fail('web/.env.local no tiene DATABASE_URL.');
const dbUrl = match[1].trim();
let parsed;
try {
  parsed = new URL(dbUrl);
} catch {
  fail('La DATABASE_URL de web/.env.local no se puede leer.');
}
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || Number(parsed.port) !== DB_PORT) {
  fail(`La DATABASE_URL de web/.env.local no es la base local (127.0.0.1:${DB_PORT}). Este comando solo corre contra devdb.`);
}
const env = { ...process.env, DATABASE_URL: dbUrl, DATABASE_URL_UNPOOLED: '' };
for (const k of ['VERCEL', 'VERCEL_ENV', 'CI']) delete env[k];

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port });
    s.once('connect', () => (s.end(), resolve(true)));
    s.once('error', () => resolve(false));
  });
}

const children = [];
function shutdown(code = 0) {
  for (const c of children) {
    if (c.exitCode === null) c.kill('SIGINT');
  }
  setTimeout(() => process.exit(code), 1500);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function run(label, cmd, args, cwd) {
  console.log(`\n→ ${label}`);
  const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`\n✗ Falló: ${label}`);
    shutdown(1);
    return false;
  }
  return true;
}

// 2. Base local.
if (await portOpen(DB_PORT)) {
  console.log(`→ La base local ya está corriendo en 127.0.0.1:${DB_PORT}.`);
} else {
  if (!existsSync(path.join(devdb, 'node_modules'))) {
    if (!run('Instalando devdb (solo la primera vez)', 'npm', ['install'], devdb)) process.exit(1);
  }
  console.log('→ Levantando la base local (devdb)...');
  const db = spawn('npm', ['start'], { cwd: devdb, env, stdio: ['ignore', 'inherit', 'inherit'], shell: process.platform === 'win32' });
  children.push(db);
  let up = false;
  for (let i = 0; i < 120 && !up; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    up = await portOpen(DB_PORT);
  }
  if (!up) {
    console.error('✗ La base local no arrancó en 2 minutos. Prueba "npm run stop" dentro de devdb y vuelve a intentar.');
    shutdown(1);
  }
}

// 3. Migraciones, compilación y app.
if (run('Aplicando migraciones a la base local', 'node', ['scripts/migrate.mjs'], web) && run('Compilando la app (tarda un minuto)', 'npx', ['next', 'build'], web)) {
  if (await portOpen(APP_PORT)) {
    console.error(`✗ El puerto ${APP_PORT} está ocupado. Cierra la otra app (por ejemplo "npm run dev") y vuelve a intentar.`);
    shutdown(1);
  } else {
    const app = spawn('npx', ['next', 'start', '-p', String(APP_PORT)], { cwd: web, env, stdio: 'inherit', shell: process.platform === 'win32' });
    children.push(app);
    app.on('exit', (code) => shutdown(code ?? 0));
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await portOpen(APP_PORT)) {
        console.log(`\n✓ Lista: abre http://localhost:${APP_PORT} (Ctrl+C para apagar)\n`);
        break;
      }
    }
  }
}
