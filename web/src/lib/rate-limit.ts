import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from './db';

/**
 * Cuenta intentos por llave en una ventana fija guardada en Postgres, para que funcione
 * igual con varias instancias serverless. Devuelve false si ya se pasó del límite.
 */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else rate_limits.window_start end
    returning count`);
  const count = Number(rows[0]?.count ?? 1);
  return count <= limit;
}
