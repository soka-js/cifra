import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ACTIVE_MERCHANT_COOKIE, createSession, destroySession } from '@/lib/auth/session';
import { ensureDemoEcosystemSeeded } from '@/lib/demo-seed';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const role = body.role === 'negocio' || body.role === 'merchant' ? 'negocio' : 'persona';

    await destroySession();
    const ids = await ensureDemoEcosystemSeeded(false);

    if (role === 'negocio') {
      await createSession(ids.rosaUserId);
      const jar = await cookies();
      jar.set(ACTIVE_MERCHANT_COOKIE, ids.espigaMerchantId, {
        path: '/',
        sameSite: 'lax',
        maxAge: 30 * 86_400,
      });
      return NextResponse.json({ ok: true, role: 'negocio', target: '/negocio/cuadre' });
    } else {
      await createSession(ids.marianaUserId);
      return NextResponse.json({ ok: true, role: 'persona', target: '/app' });
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error al cambiar sesión demo' }, { status: 500 });
  }
}
