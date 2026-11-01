'use server';

import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { recordEvent, readUtm } from '@/lib/analytics/server';
import { allow } from '@/lib/rate-limit';

export type LeadState =
  | { status: 'idle' }
  | { status: 'ok' }
  | { status: 'error'; message?: string; fields?: Record<string, string> };

const Lead = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
  email: z.string().trim().toLowerCase().email('Revisa el correo.').max(200),
  organization: z.string().trim().min(2, 'Escribe el nombre de la entidad.').max(160),
  role: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  members: z.string().trim().max(40).optional(),
  message: z.string().trim().max(1000).optional(),
  consent: z.literal('on', { error: 'Necesitamos tu autorización para contactarte.' }),
});

export async function submitLead(_prev: LeadState, form: FormData): Promise<LeadState> {
  if (String(form.get('website') ?? '')) return { status: 'ok' };
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'local';
  if (!(await allow(`lead:${ip}`, 5, 3600))) {
    return { status: 'error', message: 'Recibimos varios formularios desde tu conexión. Intenta de nuevo en una hora.' };
  }
  const raw = Object.fromEntries(['name', 'email', 'organization', 'role', 'phone', 'members', 'message', 'consent'].map((k) => [k, form.get(k) ?? undefined]));
  const parsed = Lead.safeParse({ ...raw, consent: raw.consent ?? '' });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fields[key]) fields[key] = issue.message;
    }
    return { status: 'error', fields };
  }
  const jar = await cookies();
  const { consent: _c, ...data } = parsed.data;
  await db.insert(leads).values({
    kind: 'entidad',
    ...data,
    role: data.role || null,
    phone: data.phone || null,
    members: data.members || null,
    message: data.message || null,
    visitorId: jar.get('cf_vid')?.value ?? null,
    variant: jar.get('cf_ab')?.value ?? null,
    utm: readUtm(jar.get('cf_utm')?.value),
  });
  await recordEvent('generate_lead', { path: '/' });
  return { status: 'ok' };
}
