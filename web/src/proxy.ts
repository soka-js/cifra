import { NextResponse, type NextRequest } from 'next/server';

const YEAR = 60 * 60 * 24 * 365;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

/**
 * - Asigna un id anónimo de visitante y la variante A/B del titular de la landing (cookies propias).
 * - Guarda los UTM de la primera visita para atribuir registros y contactos a su fuente.
 * - Manda a /entrar a quien abre /app o /negocio (salvo /negocio/activar) sin sesión.
 */
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const isProtectedApp = pathname.startsWith('/app');
  const isProtectedMerchant =
    pathname.startsWith('/negocio') &&
    !pathname.startsWith('/negocio/activar') &&
    !pathname.startsWith('/negocio/unirse');

  const isExplicitlyLoggedOut =
    request.cookies.get('cf_logged_out')?.value === '1' && !request.cookies.get('cf_session');

  if ((isProtectedApp || isProtectedMerchant) && isExplicitlyLoggedOut) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    url.search = isProtectedMerchant ? `?next=${encodeURIComponent(pathname)}` : '';
    return NextResponse.redirect(url);
  }

  const secure = request.nextUrl.protocol === 'https:';
  const forced = searchParams.get('v');
  const existing = request.cookies.get('cf_ab')?.value;
  // ?v=A o ?v=B fuerza una variante (para revisar ambas); si no, se sortea 50/50 una sola vez.
  const variant =
    forced === 'A' || forced === 'B' ? forced : existing === 'A' || existing === 'B' ? existing : Math.random() < 0.5 ? 'A' : 'B';

  // La variante viaja en un encabezado para que la primera respuesta ya la use.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-cf-ab', variant);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (variant !== existing) {
    response.cookies.set('cf_ab', variant, { maxAge: 60 * 60 * 24 * 90, sameSite: 'lax', secure, path: '/' });
  }
  if (!request.cookies.get('cf_vid')) {
    response.cookies.set('cf_vid', crypto.randomUUID(), { maxAge: YEAR, sameSite: 'lax', secure, path: '/' });
  }
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = searchParams.get(k);
    if (v) utm[k] = v.slice(0, 120);
  }
  if (Object.keys(utm).length && !request.cookies.get('cf_utm')) {
    response.cookies.set('cf_utm', JSON.stringify(utm), { maxAge: 60 * 60 * 24 * 90, sameSite: 'lax', secure, path: '/' });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|api/|.*\\.(?:png|jpg|svg|webp|ico|txt|xml)$).*)'],
};
