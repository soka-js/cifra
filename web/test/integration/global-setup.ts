import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { testDatabaseUrl } from './db-url';

/** Deja la base de pruebas vacía y con todas las migraciones aplicadas, una vez por corrida. */
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await sql.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await sql.unsafe('CREATE SCHEMA public');
    await migrate(drizzle(sql), { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const message = `No se pudo preparar la base de pruebas (${reason}). ¿Está corriendo devdb? (cd devdb && npm start)`;
    // Vitest a veces no logra imprimir un error lanzado aquí; se escribe antes para que se vea siempre.
    console.error(`
${message}
`);
    throw new Error(message);
  } finally {
    await sql.end();
  }
}
