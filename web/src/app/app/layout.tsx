import { Bell, Settings, Store } from 'lucide-react';
import Link from 'next/link';
import { BottomNav, DesktopSidebar } from '@/components/app/nav';
import { LogoMark } from '@/components/logo';
import { getMerchantAccess, isAdmin, requireUser } from '@/lib/auth/session';
import { loadUnreadNotificationsCount } from '@/lib/data';
import { getZoneBySlug } from '@/lib/zones';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tu cifra', robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [unreadCount, merchantAccess] = await Promise.all([
    loadUnreadNotificationsCount(user.id),
    getMerchantAccess(),
  ]);
  const zoneLabel = user.zoneSlug ? getZoneBySlug(user.zoneSlug).name : null;

  return (
    <div className="min-h-dvh bg-paper pb-24 lg:pb-12 lg:pl-64">
      <DesktopSidebar
        userName={user.name}
        zoneLabel={zoneLabel}
        unreadCount={unreadCount}
        hasMerchant={Boolean(merchantAccess)}
        isAdmin={isAdmin(user)}
        isDemo={user.isDemo}
      />

      {user.isDemo && (
        <div className="no-print border-b border-terra/20 bg-terra-light px-4 py-2 text-center text-[13px] text-terra-dark">
          Estás explorando una <strong>cuenta de demostración</strong> con datos simulados.{' '}
          <Link href="/demo" className="font-semibold underline underline-offset-2">
            Cambiar a vista Tendero o Data Room →
          </Link>
        </div>
      )}

      <header className="no-print mx-auto flex max-w-2xl items-center justify-between px-5 pt-5 lg:hidden">
        <Link href="/app" className="inline-flex items-center gap-2 rounded-lg" aria-label="Inicio de CIFRA">
          <LogoMark size={26} />
          <span className="font-display text-[20px] font-bold tracking-[-0.02em] text-ink">cifra</span>
        </Link>
        <div className="flex items-center gap-1">
          {merchantAccess && (
            <Link
              href="/negocio"
              className="mr-1 inline-flex items-center gap-1 rounded-full bg-terra-light px-2.5 py-1 text-[12px] font-semibold text-terra-dark"
            >
              <Store size={14} aria-hidden="true" />
              <span>Negocio</span>
            </Link>
          )}
          <Link
            href="/app/avisos"
            className="relative grid h-10 w-10 place-items-center rounded-full text-ink-muted hover:bg-white hover:text-ink"
            aria-label={unreadCount > 0 ? `Avisos (${unreadCount} sin leer)` : 'Avisos'}
          >
            <Bell size={20} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="tnum absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-terra px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/app/ajustes"
            className="grid h-10 w-10 place-items-center rounded-full text-ink-muted hover:bg-white hover:text-ink"
            aria-label="Ajustes"
          >
            <Settings size={20} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pt-6 lg:px-8 lg:pt-10">{children}</main>
      <BottomNav />
    </div>
  );
}
