'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACTIVE_MERCHANT_COOKIE, createSession, destroySession } from '@/lib/auth/session';
import { ensureDemoEcosystemSeeded } from '@/lib/demo-seed';

export async function enterDemoAsPersona(): Promise<void> {
  await destroySession();
  const ids = await ensureDemoEcosystemSeeded(false);
  await createSession(ids.marianaUserId);
  redirect('/app');
}

export async function enterDemoAsMerchant(): Promise<void> {
  await destroySession();
  const ids = await ensureDemoEcosystemSeeded(false);
  await createSession(ids.rosaUserId);
  const jar = await cookies();
  jar.set(ACTIVE_MERCHANT_COOKIE, ids.espigaMerchantId, {
    path: '/',
    sameSite: 'lax',
    maxAge: 30 * 86_400,
  });
  redirect('/negocio');
}

export async function enterDemoAsDataRoom(): Promise<void> {
  await destroySession();
  const ids = await ensureDemoEcosystemSeeded(false);
  await createSession(ids.marianaUserId);
  redirect('/admin?tab=dataroom&alcance=demo');
}

export async function resetDemoData(): Promise<void> {
  await destroySession();
  await ensureDemoEcosystemSeeded(true);
  redirect('/demo?reiniciado=1');
}
