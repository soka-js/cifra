'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  accounts,
  commitments,
  cycleSnapshots,
  dataSources,
  merchantCatalog,
  notifications,
  recurringMarks,
  savingsEvents,
  transactions,
  userCategoryRules,
  users,
} from '@/lib/db/schema';
import { destroySession, getSessionContext, requireUser } from '@/lib/auth/session';
import { loadCifra, loadMovimientosInsights, loadSavingsSummary, logAccess } from '@/lib/data';
import { addDays, todayInBogota } from '@/lib/engine/dates';
import { EDITABLE_CATEGORIES, type Category } from '@/lib/engine/merchant';
import { parseBalanceInput, parsePesosInput, toDailyMinor } from '@/lib/format';
import { setBalance } from '@/lib/ingest';
import { createManualAccount, listManualAccounts } from '@/lib/manual';
import { recordEvent } from '@/lib/analytics/server';
import { getZoneBySlug } from '@/lib/zones';

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

export async function saveZonePreference(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = String(form.get('zoneSlug') ?? '').trim();
  if (!raw || raw === 'ninguna') {
    await db.update(users).set({ zoneSlug: null, lat: null, lng: null }).where(eq(users.id, user.id));
    await logAccess(user.id, 'tú', 'desactivaste tu zona para ofertas cercanas');
    revalidatePath('/app', 'layout');
    return { status: 'ok', message: 'Desactivamos la ubicación aproximada.' };
  }
  const zone = getZoneBySlug(raw);
  await db
    .update(users)
    .set({ zoneSlug: zone.slug, lat: zone.lat, lng: zone.lng })
    .where(eq(users.id, user.id));
  await logAccess(user.id, 'tú', 'actualizaste tu zona de barrio', { zona: zone.name });
  revalidatePath('/app', 'layout');
  return { status: 'ok', message: `Zona guardada: ${zone.name}.` };
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

/** "No, son distintos": el compromiso escrito no es ese cobro detectado. No se vuelve a preguntar. */
export async function keepCommitment(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(form.get('id') ?? '');
  const key = String(form.get('key') ?? '').slice(0, 120);
  if (!id || !key) return;
  await db
    .update(commitments)
    .set({ notSameAs: sql`array_append(${commitments.notSameAs}, ${key})` })
    .where(and(eq(commitments.id, id), eq(commitments.userId, user.id)));
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
      .onConflictDoUpdate({
        target: [recurringMarks.userId, recurringMarks.merchantKey],
        set: { mark: mark.data, updatedAt: new Date() },
      });
  }
  revalidatePath('/app', 'layout');
}

/**
 * Registra que la persona canceló de verdad un cobro recurrente que no usaba (H.1.3 e I.5 #5)
 * y suma ese ahorro mensual verificable a su contador de "pesos ahorrados con CIFRA".
 */
export async function confirmRecurringCancelled(form: FormData): Promise<void> {
  const user = await requireUser();
  const key = String(form.get('key') ?? '').trim().slice(0, 120);
  const name = String(form.get('name') ?? '').trim().slice(0, 80) || key;
  const monthlyMinor = Math.max(0, Math.round(Number(form.get('monthlyMinor') ?? 0)));
  if (!key || monthlyMinor <= 0) return;

  const today = todayInBogota();
  const now = new Date();

  await db
    .insert(recurringMarks)
    .values({
      userId: user.id,
      merchantKey: key,
      mark: 'no_lo_uso',
      cancelledAt: now,
      savedMonthlyMinor: monthlyMinor,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [recurringMarks.userId, recurringMarks.merchantKey],
      set: {
        mark: 'no_lo_uso',
        cancelledAt: now,
        savedMonthlyMinor: monthlyMinor,
        updatedAt: now,
      },
    });

  await db
    .insert(savingsEvents)
    .values({
      userId: user.id,
      kind: 'cobro_cancelado',
      amountMinor: monthlyMinor,
      referenceKey: `${key}:${today.slice(0, 7)}`,
      label: `Cancelaste ${name}`,
      occurredOn: today,
    })
    .onConflictDoUpdate({
      target: [savingsEvents.userId, savingsEvents.kind, savingsEvents.referenceKey],
      set: { amountMinor: monthlyMinor, label: `Cancelaste ${name}`, occurredOn: today },
    });

  await logAccess(user.id, 'tú', 'registraste la cancelación de un cobro fijo', { comercio: name });
  await recordEvent('cancel_recurring', { merchant: key, savedMinor: monthlyMinor }, user.id);
  revalidatePath('/app', 'layout');
}

/**
 * Corrección de categoría en un toque (H.1.1):
 * 1) Crea o actualiza la regla personal hacia adelante.
 * 2) Reclasifica hacia atrás todos los movimientos del mismo comercio.
 * 3) Alimenta el diccionario global de comercios colombianos (Ventaja injusta, H.5).
 */
export async function reclassifyMerchant(form: FormData): Promise<void> {
  const user = await requireUser();
  const merchantKey = String(form.get('merchantKey') ?? '').trim().slice(0, 120);
  const merchantName = String(form.get('merchantName') ?? '').trim().slice(0, 80);
  const categoryRaw = String(form.get('category') ?? '').trim() as Category;

  if (!merchantKey || !EDITABLE_CATEGORIES.includes(categoryRaw)) return;

  const now = new Date();
  await db
    .insert(userCategoryRules)
    .values({
      userId: user.id,
      merchantKey,
      customName: merchantName || null,
      category: categoryRaw,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userCategoryRules.userId, userCategoryRules.merchantKey],
      set: {
        customName: merchantName || null,
        category: categoryRaw,
        updatedAt: now,
      },
    });

  await db
    .update(transactions)
    .set({
      category: categoryRaw,
      merchantName: merchantName || undefined,
      categorySource: 'user_rule',
    })
    .where(and(eq(transactions.userId, user.id), eq(transactions.merchantKey, merchantKey)));

  if (merchantKey !== 'sin_nombre' && !user.isDemo) {
    await db
      .insert(merchantCatalog)
      .values({
        merchantKey,
        displayName: merchantName || merchantKey,
        category: categoryRaw,
        votesCount: 1,
        verified: false,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: merchantCatalog.merchantKey,
        set: {
          category: categoryRaw,
          votesCount: sql`${merchantCatalog.votesCount} + 1`,
          verified: sql`${merchantCatalog.votesCount} + 1 >= 3`,
          updatedAt: now,
        },
      });
  }

  await recordEvent('reclassify_category', { merchant: merchantKey, category: categoryRaw }, user.id);
  revalidatePath('/app', 'layout');
}

export async function saveCycleClosure(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const committedAction = String(form.get('committedAction') ?? '').trim().slice(0, 200);
  if (committedAction.length < 4) {
    return { status: 'error', message: 'Elige o escribe un compromiso concreto para el próximo ciclo.' };
  }

  const today = todayInBogota();
  const cycleStart = addDays(today, -29);
  const [cifra, insights, savings] = await Promise.all([
    loadCifra(user),
    loadMovimientosInsights(user),
    loadSavingsSummary(user.id),
  ]);

  const fixedMonthly = cifra.recurring
    .filter((r) => r.active)
    .reduce((s, r) => s + r.monthlyMinor, 0);

  const topCategories = insights.breakdown.rows.slice(0, 4).map((r) => ({
    category: r.label,
    amountMinor: r.currentMinor,
  }));

  await db
    .insert(cycleSnapshots)
    .values({
      userId: user.id,
      cycleStart,
      cycleEnd: today,
      incomeMinor: Math.max(0, cifra.balanceMinor + insights.breakdown.currentTotalMinor),
      fixedMinor: fixedMonthly,
      variableMinor: insights.breakdown.currentTotalMinor,
      savedMinor: savings.monthMinor,
      closingAvailableMinor: cifra.availableMinor,
      topCategories,
      committedAction,
    })
    .onConflictDoUpdate({
      target: [cycleSnapshots.userId, cycleSnapshots.cycleStart, cycleSnapshots.cycleEnd],
      set: {
        fixedMinor: fixedMonthly,
        variableMinor: insights.breakdown.currentTotalMinor,
        savedMinor: savings.monthMinor,
        closingAvailableMinor: cifra.availableMinor,
        topCategories,
        committedAction,
      },
    });

  await recordEvent('close_cycle', { savedMinor: savings.monthMinor }, user.id);
  revalidatePath('/app', 'layout');
  return { status: 'ok', message: 'Guardamos el cierre de tu ciclo y tu compromiso para el próximo pago.' };
}

export async function markNotificationRead(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(form.get('id') ?? '');
  if (!id) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
  revalidatePath('/app', 'layout');
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireUser();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
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
  if ((await getSessionContext())?.demoView) {
    return { status: 'error', message: 'En la demo no se borra la cuenta. Para dejarla como nueva, reiníciala desde /admin.' };
  }
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

// ---------------------------------------------------------------------------------------------
// Modo rápido: la cifra en un minuto con lo que la persona escribe. El extracto llega después,
// como mejora de precisión.

export type QuickState = { status: 'idle' } | { status: 'error'; step: number; message: string };

const Period = z.enum(['dia', 'semana', 'mes']);

function quickError(step: number, message: string): QuickState {
  return { status: 'error', step, message };
}

/** Lee el gasto del día a día escrito (monto y periodo). 0 vale. Devuelve centavos por día o null. */
function readDailySpend(form: FormData): number | null {
  const raw = String(form.get('daily') ?? '').trim();
  const period = Period.safeParse(form.get('period'));
  if (!raw || !period.success) return null;
  const amount = /^[$\s]*0+$/.test(raw) ? 0 : parsePesosInput(raw);
  if (amount === null) return null;
  return toDailyMinor(amount, period.data);
}

export async function saveQuickStart(_prev: QuickState, form: FormData): Promise<QuickState> {
  const user = await requireUser();

  const income = formIncome(form);
  if (!income.success) return quickError(0, 'Elige cada cuánto te pagan.');
  const days = incomeDaysFrom(income.data);
  if (income.data.frequency !== 'irregular' && !days) return quickError(0, 'Elige el día o los días en que te pagan.');

  const balance = parseBalanceInput(String(form.get('balance') ?? ''));
  if (balance === null) return quickError(1, 'Escribe cuánto tienes hoy, por ejemplo 1.250.000. Si no tienes nada, escribe 0.');
  const where = String(form.get('where') ?? '').trim().slice(0, 60);

  const names = form.getAll('fixedName').map((v) => String(v).trim().slice(0, 60));
  const amounts = form.getAll('fixedAmount').map((v) => String(v).trim());
  const dayValues = form.getAll('fixedDay').map((v) => String(v).trim());
  const fixed: Array<{ name: string; amountMinor: number; dayOfMonth: number }> = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i] ?? '';
    const amountRaw = amounts[i] ?? '';
    const dayRaw = dayValues[i] ?? '';
    if (!name && !amountRaw) continue;
    const amountMinor = parsePesosInput(amountRaw);
    const day = Number(dayRaw);
    if (!name || amountMinor === null || !Number.isInteger(day) || day < 1 || day > 31) {
      return quickError(2, `Revisa "${name || `el cobro ${i + 1}`}": necesita nombre, monto y día del mes.`);
    }
    fixed.push({ name, amountMinor, dayOfMonth: day });
  }
  if (fixed.length > 15) return quickError(2, 'Escribe hasta 15 cobros fijos. Los demás los agregas después en Ajustes.');

  const dailyMinor = readDailySpend(form);
  if (dailyMinor === null) return quickError(3, 'Escribe cuánto gastas en el día a día, por ejemplo 30.000 al día.');

  const zoneRaw = String(form.get('zoneSlug') ?? '').trim();
  const zone = zoneRaw && zoneRaw !== 'otra' ? getZoneBySlug(zoneRaw) : null;

  await db
    .update(users)
    .set({
      incomeFrequency: income.data.frequency,
      incomeDays: days,
      dailySpendMinor: dailyMinor,
      ...(zone ? { zoneSlug: zone.slug, lat: zone.lat, lng: zone.lng } : {}),
      onboardedAt: user.onboardedAt ?? new Date(),
    })
    .where(eq(users.id, user.id));

  // Un solo saldo escrito por el modo rápido: si ya existe (volvió a esta pantalla), se actualiza.
  const [manual] = await listManualAccounts(user.id);
  if (manual) {
    await setBalance(user.id, manual.id, balance);
    if (where) await db.update(dataSources).set({ entityName: where, lastSyncAt: new Date() }).where(eq(dataSources.id, manual.sourceId));
  } else {
    await createManualAccount(user.id, { entityName: where || 'Tus cuentas', name: 'Saldo escrito a mano', balanceMinor: balance });
  }

  const existing = await db.select().from(commitments).where(eq(commitments.userId, user.id));
  const seen = new Set(existing.map((c) => `${c.name.toLowerCase()}|${c.dayOfMonth}`));
  const fresh = fixed.filter((f) => !seen.has(`${f.name.toLowerCase()}|${f.dayOfMonth}`)).slice(0, Math.max(0, 20 - existing.length));
  if (fresh.length) await db.insert(commitments).values(fresh.map((f) => ({ userId: user.id, ...f })));

  await logAccess(user.id, 'tú', 'escribiste tu saldo, tus cobros fijos y tu gasto del día a día', { cobros_fijos: fixed.length });
  await recordEvent('quick_start', { path: '/app/bienvenida', fixed: fixed.length, period: String(form.get('period')) }, user.id);
  revalidatePath('/app', 'layout');
  redirect('/app?listo=rapido');
}

export async function saveDailySpend(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = String(form.get('daily') ?? '').trim();
  if (!raw) {
    await db.update(users).set({ dailySpendMinor: null }).where(eq(users.id, user.id));
    revalidatePath('/app', 'layout');
    return { status: 'ok', message: 'Listo. Lo calculamos solo con tus movimientos.' };
  }
  const dailyMinor = readDailySpend(form);
  if (dailyMinor === null) return { status: 'error', message: 'Escribe un monto en pesos, por ejemplo 30.000.' };
  await db.update(users).set({ dailySpendMinor: dailyMinor }).where(eq(users.id, user.id));
  revalidatePath('/app', 'layout');
  return { status: 'ok', message: 'Guardado.' };
}

/**
 * "¿Cuánto tienes hoy?" desde la pantalla de inicio: uno o varios saldos a la vez (campos bal:<id>).
 * Sin cuentas todavía, el campo bal:nueva crea un saldo escrito a mano. Los saldos que trae una entidad no se tocan.
 */
export async function updateBalances(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const entries = [...form.entries()].filter(([k, v]) => k.startsWith('bal:') && String(v).trim() !== '');
  if (!entries.length) return { status: 'error', message: 'Escribe al menos un saldo.' };
  const parsed: Array<{ key: string; minor: number }> = [];
  for (const [k, v] of entries) {
    const minor = parseBalanceInput(String(v));
    if (minor === null) return { status: 'error', message: 'Escribe el saldo en pesos, por ejemplo 1.250.000.' };
    parsed.push({ key: k.slice(4), minor });
  }
  const own = await db
    .select({ id: accounts.id, name: accounts.name, kind: dataSources.kind })
    .from(accounts)
    .innerJoin(dataSources, eq(dataSources.id, accounts.sourceId))
    .where(eq(accounts.userId, user.id));
  let updated = 0;
  for (const p of parsed) {
    if (p.key === 'nueva') {
      if (own.length) continue;
      await createManualAccount(user.id, { entityName: 'Tus cuentas', name: 'Saldo escrito a mano', balanceMinor: p.minor });
      updated++;
      continue;
    }
    const acct = own.find((a) => a.id === p.key);
    if (!acct || acct.kind === 'entidad_aliada') continue;
    await setBalance(user.id, acct.id, p.minor);
    updated++;
  }
  if (!updated) return { status: 'error', message: 'No encontramos esa cuenta.' };
  await logAccess(user.id, 'tú', 'actualizaste el saldo', { cuentas: updated });
  await recordEvent('update_balance', { path: '/app', accounts: updated }, user.id);
  revalidatePath('/app', 'layout');
  return { status: 'ok', message: 'Listo, tu cifra quedó con el saldo de hoy.' };
}

/** Un saldo escrito a mano desde "Tus datos" (efectivo, una billetera sin extracto). */
export async function addManualAccount(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const entityName = String(form.get('entity') ?? '').trim().slice(0, 60);
  const balance = parseBalanceInput(String(form.get('balance') ?? ''));
  if (entityName.length < 2) return { status: 'error', message: 'Escribe dónde está esa plata, por ejemplo Nequi o Efectivo.' };
  if (balance === null) return { status: 'error', message: 'Escribe el saldo en pesos, por ejemplo 250.000.' };
  const count = await db
    .select({ id: dataSources.id })
    .from(dataSources)
    .where(and(eq(dataSources.userId, user.id), eq(dataSources.kind, 'manual')));
  if (count.length >= 10) return { status: 'error', message: 'Puedes tener hasta 10 saldos escritos a mano.' };
  await createManualAccount(user.id, { entityName, name: 'Saldo escrito a mano', balanceMinor: balance });
  await logAccess(user.id, 'tú', 'escribiste un saldo a mano', { entidad: entityName });
  revalidatePath('/app', 'layout');
  return { status: 'ok', message: `Agregamos ${entityName}.` };
}
