// Postgres local desechable para CIFRA: desarrollo (cifra_dev) y pruebas (cifra_test).
// Solo escucha en 127.0.0.1 y guarda todo en devdb/data (ignorado por Git). Nunca toca producción.
//
//   cd devdb && npm install && npm start      -> deja el servidor corriendo (Ctrl+C para apagarlo)
//   npm run reset                             -> borra devdb/data y arranca de cero
//   npm run stop                              -> apaga un servidor que haya quedado abierto
import EmbeddedPostgres from 'embedded-postgres';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, 'data');
const pidFile = path.join(dataDir, 'postmaster.pid');
const port = Number(process.env.DEVDB_PORT ?? 54329);
const USER = 'cifra';
const PASSWORD = 'cifra_local';
const DATABASES = ['cifra_dev', 'cifra_test'];

/**
 * Si una corrida anterior murió sin apagar Postgres (pasa en Windows al cerrar la terminal),
 * queda un servidor huérfano ocupando el puerto. Se apaga antes de arrancar de nuevo.
 */
async function stopOrphan() {
  if (!existsSync(pidFile)) return;
  try {
    const os = process.platform === 'win32' ? 'windows' : process.platform;
    const { pg_ctl } = await import(`@embedded-postgres/${os}-${process.arch}`);
    execFileSync(pg_ctl, ['stop', '-D', dataDir, '-m', 'fast', '-w', '-t', '15'], { stdio: 'ignore' });
  } catch {
    // No había servidor vivo o no respondió: se resuelve abajo.
  }
  if (process.platform === 'win32') {
    // En Windows pueden quedar procesos hijos sosteniendo el puerto aunque el principal ya no exista.
    // Solo se cierran los postgres.exe lanzados desde ESTA carpeta devdb.
    const marker = path.join(here, 'node_modules', '@embedded-postgres').replace(/\\/g, '/');
    const script =
      `Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" | ` +
      `Where-Object { $_.CommandLine -and $_.CommandLine.Replace('\\','/').Contains('${marker}') } | ` +
      `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    try {
      execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'ignore' });
    } catch {
      // Sin PowerShell disponible: si el puerto sigue ocupado, el arranque lo dirá.
    }
  }
  rmSync(pidFile, { force: true });
  console.log('devdb: se apagó un servidor que había quedado abierto.');
}

async function run() {
  if (process.argv.includes('--reset') && existsSync(dataDir)) {
    rmSync(dataDir, { recursive: true, force: true });
    console.log('devdb: datos locales borrados.');
  }

  const fresh = !existsSync(path.join(dataDir, 'PG_VERSION'));
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: USER,
    password: PASSWORD,
    port,
    persistent: true,
    onLog: () => {},
    onError: (e) => console.error('[devdb]', String(e).slice(0, 300)),
  });

  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) {
    for (const name of DATABASES) await pg.createDatabase(name);
  }

  console.log('devdb lista. Usa en web/.env.local:');
  console.log(`  DATABASE_URL=postgres://${USER}:${PASSWORD}@127.0.0.1:${port}/cifra_dev`);
  console.log(`  (pruebas) postgres://${USER}:${PASSWORD}@127.0.0.1:${port}/cifra_test`);

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await pg.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => {}, 1 << 30);
}

await stopOrphan();
if (!process.argv.includes('--stop')) await run();
