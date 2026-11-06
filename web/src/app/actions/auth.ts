'use server';

import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { passwordResetTokens, users } from '@/lib/db/schema';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession, destroySession } from '@/lib/auth/session';
import { readUtm, recordEvent } from '@/lib/analytics/server';
import { randomToken, sha256 } from '@/lib/crypto';
import { renderCifraEmail, sendEmail } from '@/lib/notify/email';
import { allow } from '@/lib/rate-limit';
import { CONSENT_VERSION } from '@/lib/format';
import { getZoneBySlug } from '@/lib/zones';

export type AuthState =
  | { status: 'idle' }
  | { status: 'ok'; message: string; devResetUrl?: string }
  | { status: 'error'; message?: string; fields?: Record<string, string>; values?: Record<string, string> };

async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'local';
}

function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  return trimmed.slice(0, 200);
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
  zoneSlug: z.string().trim().max(40).optional(),
  consent: z.literal('on', { error: 'Para calcular tu cifra necesitamos tu autorización.' }),
});

export async function signup(_prev: AuthState, form: FormData): Promise<AuthState> {
  const values = {
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    zoneSlug: String(form.get('zoneSlug') ?? ''),
  };
  if (!(await allow(`signup:${await clientIp()}`, 12, 3600))) {
    return { status: 'error', message: 'Demasiados registros desde tu conexión. Intenta en una hora.', values };
  }
  const parsed = Signup.safeParse({
    ...values,
    password: form.get('password') ?? '',
    consent: form.get('consent') ?? '',
  });
  if (!parsed.success) return { status: 'error', fields: fieldErrors(parsed.error.issues), values };
  const { name, email, password, zoneSlug } = parsed.data;
  const existing = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  if (existing.length) {
    return { status: 'error', fields: { email: 'Ya hay una cuenta con este correo. Entra con tu contraseña.' }, values };
  }
  const jar = await cookies();
  const zone = zoneSlug && zoneSlug !== 'otra' ? getZoneBySlug(zoneSlug) : null;
  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash: await hashPassword(password),
      zoneSlug: zone ? zone.slug : null,
      lat: zone ? zone.lat : null,
      lng: zone ? zone.lng : null,
      consentVersion: CONSENT_VERSION,
      consentAt: new Date(),
      signupVariant: jar.get('cf_ab')?.value ?? null,
      signupUtm: readUtm(jar.get('cf_utm')?.value),
    })
    .returning({ id: users.id });
  await createSession(user!.id);
  await recordEvent('sign_up', { path: '/registro' }, user!.id);
  const next = safeNextPath(form.get('next'));
  redirect(next ?? '/app/bienvenida?nuevo=1');
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
  if (!(await allow(`login:${email}`, 10, 900)) || !(await allow(`login-ip:${ip}`, 40, 900))) {
    return { status: 'error', message: 'Demasiados intentos. Espera 15 minutos y vuelve a intentar.', values };
  }
  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  const ok = user?.passwordHash ? await verifyPassword(user.passwordHash, password) : false;
  if (!user || !ok) return { status: 'error', message: 'El correo o la contraseña no coinciden.', values };
  await createSession(user.id);
  const next = safeNextPath(form.get('next'));
  if (next) redirect(next);
  redirect(user.onboardedAt ? '/app' : '/app/bienvenida');
}

export async function requestPasswordReset(_prev: AuthState, form: FormData): Promise<AuthState> {
  const emailRaw = String(form.get('email') ?? '').trim().toLowerCase();
  const parsedEmail = z.string().email('Escribe un correo válido.').safeParse(emailRaw);
  if (!parsedEmail.success) {
    return { status: 'error', fields: { email: 'Escribe el correo con el que creaste tu cuenta.' }, values: { email: emailRaw } };
  }
  const ip = await clientIp();
  if (!(await allow(`pwd-reset:${ip}`, 8, 900))) {
    return { status: 'error', message: 'Demasiadas solicitudes seguidas. Intenta en unos minutos.', values: { email: emailRaw } };
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(sql`lower(${users.email}) = ${parsedEmail.data}`)
    .limit(1);

  let devResetUrl: string | undefined;
  if (user && user.email) {
    const token = randomToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(passwordResetTokens).values({
      tokenHash: sha256(token),
      userId: user.id,
      expiresAt,
    });

    const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const resetUrl = `${site.replace(/\/$/, '')}/restablecer/${token}`;
    const mail = renderCifraEmail({
      heading: 'Restablece tu contraseña en CIFRA',
      bodyParagraphs: [
        `Hola${user.name ? `, ${user.name.split(' ')[0]}` : ''}. Recibimos una solicitud para cambiar la contraseña de tu cuenta.`,
        'Este enlace es válido durante 60 minutos y solo se puede usar una vez. Si no fuiste tú, puedes ignorar este mensaje.',
      ],
      ctaLabel: 'Crear nueva contraseña',
      ctaUrl: resetUrl,
    });
    const sent = await sendEmail({
      to: user.email,
      subject: 'Restablece tu contraseña en CIFRA',
      html: mail.html,
      text: mail.text,
    });
    if (!sent.sent && process.env.NODE_ENV !== 'production') {
      devResetUrl = `/restablecer/${token}`;
    }
  }

  return {
    status: 'ok',
    message: 'Si existe una cuenta con ese correo, te enviamos un enlace válido por 60 minutos para crear una nueva contraseña.',
    devResetUrl,
  };
}

const ResetSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(10, 'Usa al menos 10 caracteres.').max(200),
});

export async function resetPassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = ResetSchema.safeParse({
    token: String(form.get('token') ?? ''),
    password: String(form.get('password') ?? ''),
  });
  if (!parsed.success) {
    return { status: 'error', fields: fieldErrors(parsed.error.issues) };
  }

  const hash = sha256(parsed.data.token);
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, hash), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())))
    .limit(1);

  if (!row) {
    return { status: 'error', message: 'Este enlace ya venció o ya fue utilizado. Solicita uno nuevo.' };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.tokenHash, hash));
  await createSession(row.userId);
  redirect('/app');
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect('/');
}

export async function markOnboarded(userId: string) {
  await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, userId));
}
