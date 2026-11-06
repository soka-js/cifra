import { eq } from 'drizzle-orm';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { BackButton } from '@/components/ui/back-button';
import { requireUser } from '@/lib/auth/session';
import { bogotaDate, loadNotifications } from '@/lib/data';
import { db } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema';
import { shortDate } from '@/lib/engine/dates';
import { markAllNotificationsRead, markNotificationRead } from '../actions';
import { PushToggleCard } from './push-toggle';

export const metadata = { title: 'Avisos' };

export default async function AvisosPage() {
  const user = await requireUser();
  const [list, subs] = await Promise.all([
    loadNotifications(user.id),
    db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, user.id))
      .limit(1),
  ]);
  const unread = list.filter((n) => !n.readAt).length;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined;

  return (
    <div className="space-y-6">
      <BackButton href="/app" label="Volver a Hoy" className="mb-2" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">Avisos</h1>
          <p className="mt-1.5 text-[15px] text-ink-muted">
            Alertas de ritmo semanal, cobros próximos, cierres de ciclo y descuentos confirmados.
          </p>
        </div>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="btn-sm border border-line bg-white text-ink hover:bg-paper-warm">
              <CheckCheck size={15} aria-hidden="true" /> Marcar todo leído
            </button>
          </form>
        )}
      </div>

      <PushToggleCard vapidPublicKey={vapidPublicKey} initialSubscribed={subs.length > 0} />

      {list.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-2 p-8 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-paper text-ink-faint">
            <Bell size={20} aria-hidden="true" />
          </span>
          <p className="text-[15px] font-semibold text-ink">Todo tranquilo por ahora</p>
          <p className="max-w-sm text-[13.5px] text-ink-muted">
            Solo te avisaremos cuando tu gasto semanal se desvíe de tu patrón, venga un cobro fijo grande o se confirme un beneficio en tienda.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((n) => (
            <li
              key={n.id}
              className={`surface-card p-4 sm:p-5 ${!n.readAt ? 'border-primary/35 bg-primary-pale/35' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!n.readAt && <span className="h-2 w-2 rounded-full bg-terra" aria-hidden="true" />}
                    <p className="text-[15.5px] font-bold text-ink">{n.title}</p>
                  </div>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{n.body}</p>
                </div>
                <span className="shrink-0 text-[12px] text-ink-faint">{shortDate(bogotaDate(n.createdAt))}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {n.actionUrl && (
                  <Link href={n.actionUrl} className="text-[13.5px] font-semibold text-primary-dark underline underline-offset-2">
                    Abrir →
                  </Link>
                )}
                {!n.readAt && (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className="text-[13px] font-medium text-ink-muted hover:text-ink">
                      Marcar como leído
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
