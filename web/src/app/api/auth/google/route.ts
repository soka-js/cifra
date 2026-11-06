import { NextResponse, type NextRequest } from 'next/server';
import { randomToken } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL('/entrar?oauth=no_configurado', req.url));
  }
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin).replace(/\/$/, '');
  const redirectUri = `${site}/api/auth/google/callback`;
  const state = randomToken(16);
  const next = req.nextUrl.searchParams.get('next') ?? '';

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');

  const res = NextResponse.redirect(authUrl);
  const secure = req.nextUrl.protocol === 'https:';
  res.cookies.set('cf_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure, maxAge: 600, path: '/' });
  if (next.startsWith('/') && !next.startsWith('//')) {
    res.cookies.set('cf_oauth_next', next, { httpOnly: true, sameSite: 'lax', secure, maxAge: 600, path: '/' });
  }
  return res;
}
