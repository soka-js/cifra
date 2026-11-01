import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { __cifraSql?: postgres.Sql };

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  // prepare: false para funcionar detras de poolers en modo transaccion (Neon pooled, PgBouncer).
  return postgres(url, { prepare: false, max: process.env.NODE_ENV === 'production' ? 5 : 10 });
}

const sql = globalForDb.__cifraSql ?? client();
if (process.env.NODE_ENV !== 'production') globalForDb.__cifraSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
