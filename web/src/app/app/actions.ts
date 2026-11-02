'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { accounts, commitments, dataSources, recurringMarks, transactions, users } from '@/lib/db/schema';
import { requireUser, destroySession } from '@/lib/auth/session';
import { logAccess } from '@/lib/data';
import { parsePesosInput } from '@/lib/format';
import { setBalance } from '@/lib/ingest';

export type FormState = { status: 'idle' } | { status: 'ok'; message?: string } | { status: 'error'; message: string };

const Income = z.object({
  frequency: z.enum(['mensual', 'quincenal', 'semanal', 'irregular']),
  day1: z.coerce.number().int().min(1).max(31).optional(),
  day2: z.coerce.number().int().min(1).max(31).optional(),
  weekday: z.coerce.number().int().min(1).max(7).optional(),
});

function incomeDaysFrom(data: z.infer<typeof Income>): number[] | null {
  if (data.frequency === 'mensual') return data.day1 ? [data.day1] : null;
  if (data.frequency === 'quincenal') {
    const days = [data.day1 ?? 15, data.day2 ?? 30].sort((a, b) => a - b);
    return days[0] === days[1] ? null : days;
  }
  if (data.frequency === 'semanal') return data.weekday ? [data.weekday] : null;
  return [];
}

function formIncome(form: FormData) {
  const opt = (k: string) => {
    const v = form.get(k);
    return v === null || v === '' ? undefined : v;
  };
  return Income.safeParse({ frequency: form.get('frequency'), day1: opt('day1'), day2: opt('day2'), weekday: opt('weekday') });
}

export async function saveOnboarding(form: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = formIncome(form);
  if (parsed.success) {
    const days = incomeDaysFrom(parsed.data);
    await db
      .update(users)
      .set({ incomeFrequency: parsed.data.frequency, incomeDays: days, onboardedAt: new Date() })
      .where(eq(users.id, user.id));
  } else {
    await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, user.id));
  }
  const hasData = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, user.id)).limit(1);
  redirect(hasData.length ? '/app' : '/app/datos/importar?primera=1');
}

export async function saveIncome(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = formIncome(form);
  if (!parsed.success) return { status: 'error', message: 'Revisa la frecuencia y los días de pago.' };
  const days = incomeDaysFrom(parsed.data);
  if (parsed.data.frequency !== 'irregular' && !days) return { status: 'error', message: 'Elige el día o los días en que te pagan.' };
  await db.update(users).set({ incomeFrequency: parsed.data.frequency, incomeDays: days }).where(eq(users.id, user.id));
  revalidatePath('/app', 'layout');
  return { status: 'ok', message: 'Guardado.' };
}

export async function saveBuffer(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = String(form.get('buffer') ?? '').trim();
  const minor = raw === '' || raw === '0' ? 0 : parsePesosInput(raw);
  if (minor === null) return { status: 'error', message: 'Escribe un monto en pesos, por ejemplo 200.000, o 0.' };
  await db.update(users).set({ bufferMinor: minor }).where(eq(users.id, user.id));
  revalidatePath('/app', 'layout');
  return { status: 'ok', message: 'Guardado.' };
}

export async function addCommitment(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(form.get('name') ?? '').trim().slice(0, 60);
  const amount = parsePesosInput(String(form.get('amount') ?? ''));
  const day = Number(form.get('day'));
  if (!name || amount === null || !Number.isInteger(day) || day < 1 || day > 31) {
    return { status: 'error', message: 'Escribe el nombre, el monto y el día del mes (1 a 31).' };
  }
  const count = await db.select({ id: commitments.id }).from(commitments).where(eq(commitments.userId, user.id));
  if (count.length >= 20) return { status: 'error', message: 'Puedes tener hasta 20 compromisos.' };
  await db.insert(commitments).values({ userId: user.id, name, amountMinor: amount, dayOfMonth: day });
  revalidatePath('/app', 'layout');
  return { status: 'ok', message: `Agregamos "${name}".` };
}

export async function removeCommitment(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(form.get('id') ?? '');
  await db.delete(commitments).where(and(eq(commitments.id, id), eq(commitments.userId, user.id)));
  revalidatePath('/app', 'layout');
}

export async function markRecurring(form: FormData): Promise<void> {
  const user = await requireUser();
  const key = String(form.get('key') ?? '').slice(0, 120);
  const mark = z.enum(['lo_uso', 'no_lo_uso', 'no_es_fijo', 'quitar']).safeParse(form.get('mark'));
  if (!key || !mark.success) return;
  if (mark.data === 'quitar') {
    await db.delete(recurringMarks).where(and(eq(recurringMarks.userId, user.id), eq(recurringMarks.merchantKey, key)));
  } else {
    await db
      .insert(recurringMarks)
      .values({ userId: user.id, merchantKey: key, mark: mark.data })
      .onConflictDoUpdate({ target: [recurringMarks.userId, recurringMarks.merchantKey], set: { mark: mark.data, updatedAt: new Date() } });
  }
  revalidatePath('/app', 'layout');
}

export async function updateBalance(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const accountId = String(form.get('accountId') ?? '');
  const raw = String(form.get('balance') ?? '').trim();
  const negative = raw.startsWith('-');
  const minor = parsePesosInput(raw.replace(/^-/, ''));
  if (minor === null && raw.replace(/^-/, '') !== '0') return { status: 'error', message: 'Escribe el saldo en pesos, por ejemplo 1.250.000.' };
  const [acct] = await db.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, user.id))).limit(1);
  if (!acct) return { status: 'error', message: 'No encontramos esa cuenta.' };
  await setBalance(user.id, acct.id, negative ? -(minor ?? 0) : (minor ?? 0));
  await logAccess(user.id, 'tú', 'actualizaste el saldo', { cuenta: acct.name });
  revalidatePath('/app', 'layout');
  return { status: 'ok', message: 'Saldo actualizado.' };
}

export async function toggleAccount(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(form.get('accountId') ?? '');
  const include = form.get('include') === 'si';
  await db.update(accounts).set({ includeInCifra: include }).where(and(eq(accounts.id, id), eq(accounts.userId, user.id)));
  revalidatePath('/app', 'layout');
}

export async function deleteSource(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(form.get('sourceId') ?? '');
  const [src] = await db.select().from(dataSources).where(and(eq(dataSources.id, id), eq(dataSources.userId, user.id))).limit(1);
  if (!src) return;
  // Borra la fuente, sus cuentas y sus movimientos (en cascada).
  await db.delete(dataSources).where(eq(dataSources.id, src.id));
  await logAccess(user.id, 'tú', 'borraste una fuente de datos', { entidad: src.entityName });
  revalidatePath('/app', 'layout');
  redirect('/app/datos?borrada=1');
}

export async function deleteAccount(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (String(form.get('confirm') ?? '').trim().toUpperCase() !== 'BORRAR') {
    return { status: 'error', message: 'Escribe BORRAR para confirmar.' };
  }
  await destroySession();
  // La cascada elimina sesiones, fuentes, cuentas, movimientos, marcas, compromisos y registro de acceso.
  await db.delete(users).where(eq(users.id, user.id));
  redirect('/?cuenta=borrada');
}

export async function toggleExcluded(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(form.get('id') ?? '');
  const exclude = form.get('exclude') === 'si';
  await db
    .update(transactions)
    .set({ excluded: exclude })
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
  revalidatePath('/app', 'layout');
}
