import 'server-only';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { loadCifra, loadSpendDeviation } from '../data';
import { db } from '../db';
import { notifications, offerCodes, offers, users } from '../db/schema';
import { addDays, todayInBogota } from '../engine/dates';
import { cop } from '../format';
import { renderCifraEmail, sendEmail } from './email';
import { sendUserPush } from './push';

export interface DailyJobSummary {
  today: string;
  expiredOffersMarked: number;
  expiredCodesMarked: number;
  usersEvaluated: number;
  notificationsCreated: number;
  pushesSent: number;
}

export async function runDailyRetentionAndOpsJob(): Promise<DailyJobSummary> {
  const now = new Date();
  const today = todayInBogota(now);
  const in3Days = addDays(today, 3);

  // 1. Vencer campañas cuya fecha límite ya pasó y códigos de mostrador expirados
  const [expiredOffers, expiredCodes] = await Promise.all([
    db
      .update(offers)
      .set({ status: 'vencida', updatedAt: now })
      .where(and(eq(offers.status, 'activa'), lt(offers.validUntil, today)))
      .returning({ id: offers.id }),
    db
      .update(offerCodes)
      .set({ status: 'vencido' })
      .where(and(eq(offerCodes.status, 'pendiente'), lt(offerCodes.expiresAt, now)))
      .returning({ id: offerCodes.id }),
  ]);

  // 2. Evaluar los 3 gatillos de retención accionables para personas con cifra activa
  const onboardedUsers = await db
    .select()
    .from(users)
    .where(and(isNotNull(users.onboardedAt), eq(users.isDemo, false)))
    .limit(500);

  let notificationsCreated = 0;
  let pushesSent = 0;

  for (const user of onboardedUsers) {
    const cifra = await loadCifra(user);
    if (!cifra.ready) continue;

    const candidates: Array<{
      kind: 'desviacion_patron' | 'cobro_recurrente' | 'cierre_ciclo';
      title: string;
      body: string;
      actionUrl: string;
      dedupeKey: string;
      emailAlso?: boolean;
    }> = [];

    // Gatillo A: Desvío real del ritmo semanal (>25 % y al menos $25.000)
    const dev = await loadSpendDeviation(user, cifra);
    if (dev.triggered) {
      const pctIncrease = Math.round((dev.ratio - 1) * 100);
      const weekBucket = `${today.slice(0, 7)}-s${Math.ceil(Number(today.slice(8, 10)) / 7)}`;
      candidates.push({
        kind: 'desviacion_patron',
        title: `Tu ritmo semanal subió ${pctIncrease} %`,
        body: `En los últimos 7 días llevas ${cop(dev.excessWeeklyMinor)} por encima de tu ritmo habitual${dev.topDriverName ? ` (principalmente en ${dev.topDriverName})` : ''}. Tu disponible por día queda en ${cop(cifra.perDayMinor)}.`,
        actionUrl: '/app/movimientos',
        dedupeKey: `dev:${weekBucket}`,
      });
    }

    // Gatillo B: Cobros fijos que se descuentan en los próximos 3 días
    for (const p of cifra.pending) {
      if (p.date >= today && p.date <= in3Days) {
        candidates.push({
          kind: 'cobro_recurrente',
          title: `Cobro próximo: ${p.name} (${cop(p.amountMinor)})`,
          body: `Se estima el ${p.date}. Ya está reservado dentro de tu cifra para que no te tome por sorpresa.`,
          actionUrl: '/app/cobros',
          dedupeKey: `rec:${p.key}:${p.date}`,
        });
      }
    }

    // Gatillo C: Cierre de ciclo la víspera del próximo ingreso
    if (cifra.daysLeft === 1) {
      candidates.push({
        kind: 'cierre_ciclo',
        title: 'Mañana cierra tu ciclo · Revisa cómo te fue',
        body: `Llegas al cierre con ${cop(cifra.availableMinor)} de margen. Guarda la foto de tu ciclo en 30 segundos.`,
        actionUrl: '/app/cierre',
        dedupeKey: `cierre:${cifra.nextIncomeOn}`,
        emailAlso: true,
      });
    }

    for (const item of candidates) {
      const inserted = await db
        .insert(notifications)
        .values({
          userId: user.id,
          kind: item.kind,
          title: item.title,
          body: item.body,
          actionUrl: item.actionUrl,
          dedupeKey: item.dedupeKey,
        })
        .onConflictDoNothing()
        .returning({ id: notifications.id });

      if (inserted.length > 0) {
        notificationsCreated += 1;
        const pushed = await sendUserPush(user.id, {
          title: item.title,
          body: item.body,
          url: item.actionUrl,
        });
        pushesSent += pushed;

        if (item.emailAlso && user.email) {
          const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
          const mail = renderCifraEmail({
            heading: item.title,
            bodyParagraphs: [item.body],
            ctaLabel: 'Ver mi cierre de ciclo',
            ctaUrl: `${site}${item.actionUrl}`,
          });
          await sendEmail({
            to: user.email,
            subject: item.title,
            html: mail.html,
            text: mail.text,
          });
        }
      }
    }
  }

  return {
    today,
    expiredOffersMarked: expiredOffers.length,
    expiredCodesMarked: expiredCodes.length,
    usersEvaluated: onboardedUsers.length,
    notificationsCreated,
    pushesSent,
  };
}
