'use server';

import { eq, sql } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession, destroySession } from '@/lib/auth/session';
import { readUtm, recordEvent } from '@/lib/analytics/server';
import { allow } from '@/lib/rate-limit';
import { CONSENT_VERSION } from '@/lib/format';

export type AuthState = { status: 'idle' } | { status: 'error'; message?: string; fields?: Record<string, string>; values?: Record<string, string> };

async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'local';
}

function fieldErrors(issues: z.core.$ZodIssue[]) {
  const fields: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0]);
    if (!fields[k]) fields[k] = i.message;
  }
  return fields;
}

const Signup = z.object({
  name: z.string().trim().min(1, 'Escribe tu nombre.').max(80),
  email: z.string().trim().toLowerCase().email('Revisa el correo.').max(200),
  password: z.string().min(10, 'Usa al menos 10 caracteres.').max(200),
  consent: z.literal('on', { error: 'Para calcular tu cifra necesitamos tu autorización.' }),
});

export async function signup(_prev: AuthState, form: FormData): Promise<AuthState> {
  const values = { name: String(form.get('name') ?? ''), email: String(form.get('email') ?? '') };
  if (!(await allow(`signup:${await clientIp()}`, 10, 3600))) {
    return { status: 'error', message: 'Demasiados registros desde tu conexión. Intenta en una hora.', values };
  }
  const parsed = Signup.safeParse({ ...values, password: form.get('password') ?? '', consent: form.get('consent') ?? '' });
  if (!parsed.success) return { status: 'error', fields: fieldErrors(parsed.error.issues), values };
  const { name, email, password } = parsed.data;
  const existing = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  if (existing.length) {
    return { status: 'error', fields: { email: 'Ya hay una cuenta con este correo. Entra con tu contraseña.' }, values };
  }
  const jar = await cookies();
  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash: await hashPassword(password),
      consentVersion: CONSENT_VERSION,
      consentAt: new Date(),
      signupVariant: jar.get('cf_ab')?.value ?? null,
      signupUtm: readUtm(jar.get('cf_utm')?.value),
    })
    .returning({ id: users.id });
  await createSession(user!.id);
  await recordEvent('sign_up', { path: '/registro' }, user!.id);
  redirect('/app/bienvenida');
}

const Login = z.object({
  email: z.string().trim().toLowerCase().email('Revisa el correo.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
});

export async function login(_prev: AuthState, form: FormData): Promise<AuthState> {
  const values = { email: String(form.get('email') ?? '') };
  const parsed = Login.safeParse({ email: values.email, password: form.get('password') ?? '' });
  if (!parsed.success) return { status: 'error', fields: fieldErrors(parsed.error.issues), values };
  const { email, password } = parsed.data;
  const ip = await clientIp();
  if (!(await allow(`login:${email}`, 8, 900)) || !(await allow(`login-ip:${ip}`, 30, 900))) {
    return { status: 'error', message: 'Demasiados intentos. Espera 15 minutos y vuelve a intentar.', values };
  }
  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  const ok = user?.passwordHash ? await verifyPassword(user.passwordHash, password) : false;
  if (!user || !ok) return { status: 'error', message: 'El correo o la contraseña no coinciden.', values };
  await createSession(user.id);
  redirect(user.onboardedAt ? '/app' : '/app/bienvenida');
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect('/');
}

export async function markOnboarded(userId: string) {
  await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, userId));
}
