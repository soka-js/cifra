import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from '../../proxy';

/**
 * Guardián de la regla "ninguna ruta muestra datos sin sesión".
 *
 * En Next.js un layout no protege a sus páginas: cada página se puede pedir por separado y el
 * layout no se vuelve a ejecutar al navegar. Por eso cada página privada y cada manejador de
 * ruta debe verificar la sesión por su cuenta. Esta prueba lee el código y falla si aparece una
 * página privada o un manejador que no lo haga.
 */

const APP = path.resolve(process.cwd(), 'src', 'app');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const rel = (file: string) => path.relative(APP, file).split(path.sep).join('/');
const all = walk(APP);

describe('cada página privada verifica la sesión por su cuenta', () => {
  const PRIVATE_DIRS = ['app/', 'admin/', 'negocio/(portal)/', 'negocio/registro/'];
  const pages = all.filter((f) => path.basename(f) === 'page.tsx').map(rel);
  const privatePages = pages.filter((p) => PRIVATE_DIRS.some((d) => p.startsWith(d)));

  it('hay páginas privadas que revisar', () => {
    expect(privatePages.length).toBeGreaterThan(15);
  });

  it.each(privatePages)('%s', (page) => {
    const source = readFileSync(path.join(APP, page), 'utf8');
    const guard = page.startsWith('admin/')
      ? /\brequireAdmin\(/
      : /\b(requireUser|requireMerchantAccess)\(/;
    expect(guard.test(source), `${page} debe llamar a su verificación de sesión`).toBe(true);
  });

  it('toda página que no es privada está en la lista de públicas revisadas', () => {
    // Si agregas una página fuera de las carpetas privadas, decide a conciencia que es pública.
    const PUBLIC = [
      'page.tsx', // la prueba sin cuenta
      'b/[slug]/page.tsx', // vitrina pública del negocio
      'desarrolladores/page.tsx',
      'entrar/page.tsx',
      'negocio/activar/[token]/page.tsx', // enlace de un solo uso
      'negocio/unirse/page.tsx', // registro de negocio
      'olvide-clave/page.tsx',
      'privacidad/page.tsx',
      'registro/page.tsx',
      'restablecer/[token]/page.tsx', // enlace de un solo uso
      'terminos/page.tsx',
    ];
    const others = pages.filter((p) => !PRIVATE_DIRS.some((d) => p.startsWith(d))).sort();
    expect(others).toEqual([...PUBLIC].sort());
  });
});

describe('cada manejador de ruta verifica quién llama', () => {
  /** Qué prueba de identidad usa cada manejador. Un manejador nuevo debe declararla aquí. */
  const CHECKS: Record<string, RegExp> = {
    'api/auth/google/route.ts': /cf_oauth_state/, // inicia el ingreso con Google; no entrega datos
    'api/auth/google/callback/route.ts': /state !== savedState/,
    'api/cron/daily/route.ts': /CRON_SECRET[\s\S]*isAdmin\(/,
    'api/events/route.ts': /VISITOR_COOKIE/, // analítica anónima: solo escribe eventos sin datos personales
    'api/export/route.ts': /getCurrentUser\(\)[\s\S]*status: 401/,
    'api/import/route.ts': /getCurrentUser\(\)[\s\S]*status: 401/,
    'api/push/subscribe/route.ts': /getCurrentUser\(\)[\s\S]*status: 401/,
    'api/v1/members/[memberId]/route.ts': /authenticatePartner\(/,
    'api/v1/members/[memberId]/accounts/[accountId]/route.ts': /authenticatePartner\(/,
    'api/v1/members/[memberId]/accounts/[accountId]/transactions/route.ts': /authenticatePartner\(/,
    'api/v1/members/[memberId]/cifra/route.ts': /authenticatePartner\(/,
    'api/v1/members/[memberId]/sessions/route.ts': /authenticatePartner\(/,
    'api/webhooks/wompi/route.ts': /WOMPI_EVENTS_SECRET[\s\S]*status: 401/,
    'e/[token]/route.ts': /embedTokens[\s\S]*isDemo/, // enlace de un solo uso; nunca para usuarios demo
  };
  const handlers = all.filter((f) => path.basename(f) === 'route.ts').map(rel).sort();

  it('no hay manejadores sin declarar', () => {
    expect(handlers).toEqual(Object.keys(CHECKS).sort());
  });

  it.each(handlers)('%s', (handler) => {
    const source = readFileSync(path.join(APP, handler), 'utf8');
    expect(CHECKS[handler]?.test(source), `${handler} debe conservar su verificación`).toBe(true);
  });

  it('la puerta de demo no vuelve', () => {
    expect(handlers.some((h) => h.includes('demo'))).toBe(false);
    expect(all.map(rel).some((f) => f.startsWith('demo/'))).toBe(false);
  });
});

describe('proxy: primer filtro sin cookie de sesión', () => {
  const go = (pathname: string, cookie?: string) =>
    proxy(
      new NextRequest(`http://localhost:3000${pathname}`, {
        headers: cookie ? { cookie: `cf_session=${cookie}` } : undefined,
      }),
    );
  const target = (pathname: string, cookie?: string) => {
    const res = go(pathname, cookie);
    const location = res.headers.get('location');
    return location ? new URL(location).pathname + new URL(location).search : null;
  };

  it('manda a entrar a quien abre el producto, el negocio o el admin sin cookie', () => {
    expect(target('/app')).toBe('/entrar');
    expect(target('/app/datos')).toBe('/entrar?next=%2Fapp%2Fdatos');
    expect(target('/negocio/caja')).toBe('/entrar?next=%2Fnegocio%2Fcaja');
    expect(target('/negocio/registro')).toBe('/entrar?next=%2Fnegocio%2Fregistro');
    expect(target('/admin')).toBe('/entrar?next=%2Fadmin');
    expect(target('/admin/presentacion')).toBe('/entrar?next=%2Fadmin%2Fpresentacion');
  });

  it('un tendero que llega por primera vez a /negocio va directo a registrar su negocio', () => {
    expect(target('/negocio')).toBe('/negocio/unirse');
  });

  it('deja pasar lo público', () => {
    for (const p of ['/', '/entrar', '/registro', '/negocio/unirse', '/negocio/activar/abc', '/b/mi-tienda', '/privacidad']) {
      expect(target(p), p).toBeNull();
    }
  });

  it('con cookie deja pasar: la verificación real la hace el servidor en cada página', () => {
    expect(target('/app', 'un-token-cualquiera')).toBeNull();
    expect(target('/admin', 'un-token-cualquiera')).toBeNull();
  });

  it('no confunde rutas que solo empiezan parecido', () => {
    expect(target('/aplicacion')).toBeNull();
    expect(target('/negocios')).toBeNull();
  });
});
