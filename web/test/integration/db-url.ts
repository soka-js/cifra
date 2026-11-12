/**
 * Base de datos de las pruebas de integración. Regla del proyecto: producción, intocable.
 * Estas pruebas BORRAN el esquema completo antes de correr, así que solo aceptan una base
 * local (127.0.0.1 / localhost) cuyo nombre termine en `_test`. Cualquier otra URL las detiene.
 * El valor por defecto lo pone vitest.integration.config.ts.
 */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Falta TEST_DATABASE_URL. Corre las pruebas con `npm run test:int`.');
  assertLocalTestDatabase(url);
  return url;
}

export function assertLocalTestDatabase(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('TEST_DATABASE_URL no es una URL válida.');
  }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
  const name = parsed.pathname.replace(/^\//, '');
  if (!local || !name.endsWith('_test')) {
    throw new Error(
      `Las pruebas de integración solo corren contra una base local terminada en "_test". ` +
        `Recibí host "${parsed.hostname}" y base "${name}". Arranca devdb (cd devdb && npm start).`,
    );
  }
}
