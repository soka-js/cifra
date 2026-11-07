import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ACTIVE_MERCHANT_COOKIE, createSession, destroySession } from '@/lib/auth/session';
import { ensureDemoEcosystemSeeded } from '@/lib/demo-seed';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const role = body.role;

    await destroySession();
    const ids = await ensureDemoEcosystemSeeded(false);

    if (role === 'negocio' || role === 'merchant') {
      await createSession(ids.rosaUserId);
      const jar = await cookies();
      jar.set(ACTIVE_MERCHANT_COOKIE, ids.espigaMerchantId, {
        path: '/',
        sameSite: 'lax',
        maxAge: 30 * 86_400,
      });
      return NextResponse.json({ ok: true, role: 'negocio', target: '/negocio/cuadre' });
    } else if (role === 'admin') {
      await createSession(ids.adminUserId || ids.marianaUserId);
      return NextResponse.json({ ok: true, role: 'admin', target: '/admin?tab=dataroom' });
    } else if (role === 'aliado' || role === 'partner') {
      await createSession(ids.andresUserId || ids.marianaUserId);
      return NextResponse.json({ ok: true, role: 'aliado', target: '/admin?tab=aliados' });
    } else {
      await createSession(ids.marianaUserId);
      return NextResponse.json({ ok: true, role: 'persona', target: '/app' });
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error al cambiar sesión demo' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const role = url.searchParams.get('role');
    const redirectParam = url.searchParams.get('redirect');

    await destroySession();
    const ids = await ensureDemoEcosystemSeeded(false);

    let defaultTarget = '/app';
    if (role === 'negocio' || role === 'merchant') {
      await createSession(ids.rosaUserId);
      const jar = await cookies();
      jar.set(ACTIVE_MERCHANT_COOKIE, ids.espigaMerchantId, {
        path: '/',
        sameSite: 'lax',
        maxAge: 30 * 86_400,
      });
      defaultTarget = '/negocio/cuenta';
    } else if (role === 'admin') {
      await createSession(ids.adminUserId || ids.marianaUserId);
      defaultTarget = '/admin?tab=dataroom';
    } else if (role === 'aliado' || role === 'partner') {
      await createSession(ids.andresUserId || ids.marianaUserId);
      defaultTarget = '/admin?tab=aliados';
    } else {
      await createSession(ids.marianaUserId);
      defaultTarget = '/app';
    }

    const redirectTarget = redirectParam || defaultTarget;
    return NextResponse.redirect(new URL(redirectTarget, req.url));
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error al cambiar sesión demo' }, { status: 500 });
  }
}
