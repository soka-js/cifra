// Aplica las migraciones de ./drizzle. En Vercel corre antes de `next build`.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL: no se pueden aplicar migraciones.');
  process.exit(1);
}

// Huella de la base, sin usuario ni clave: el servidor (en Neon, el "ep-..." identifica la rama)
// y el nombre de la base. Queda en el log de compilación para comprobar contra qué base corrió.
function huella(raw) {
  if (!raw) return 'sin definir';
  try {
    const u = new URL(raw);
    return `${u.hostname.split('.')[0]} / ${u.pathname.replace(/^\//, '') || '(sin nombre)'}`;
  } catch {
    return 'no se pudo leer';
  }
}
const enVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
if (enVercel) {
  console.log(`[migraciones] entorno: ${process.env.VERCEL_ENV ?? 'desconocido'} · rama git: ${process.env.VERCEL_GIT_COMMIT_REF ?? 'desconocida'}`);
  console.log(`[migraciones] DATABASE_URL: ${huella(process.env.DATABASE_URL)}`);
  console.log(`[migraciones] DATABASE_URL_UNPOOLED: ${huella(process.env.DATABASE_URL_UNPOOLED)}`);
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  // fileURLToPath y no .pathname: en Windows .pathname devuelve "/C:/..." y drizzle no encuentra la carpeta.
  await migrate(drizzle(sql), { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  console.log('Migraciones aplicadas.');
} finally {
  await sql.end();
}
