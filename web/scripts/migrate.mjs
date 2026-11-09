// Aplica las migraciones de ./drizzle. En Vercel corre antes de `next build`.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL: no se pueden aplicar migraciones.');
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS app_preferences jsonb DEFAULT '{}'::jsonb NOT NULL`;
  await sql`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS mandate_config jsonb DEFAULT '{}'::jsonb NOT NULL`;
  console.log('Migraciones aplicadas (incluyendo columnas JSONB V3/Karol).');
} finally {
  await sql.end();
}
