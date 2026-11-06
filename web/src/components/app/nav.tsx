'use client';

import {
  Bell,
  CalendarCheck2,
  CircleHelp,
  Database,
  Home,
  PieChart,
  Repeat,
  Settings,
  Shield,
  Store,
  Tag,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from '@/components/logo';

const MOBILE_ITEMS = [
  { href: '/app', label: 'Hoy', icon: Home, exact: true },
  { href: '/app/gasto', label: '¿Puedo?', icon: CircleHelp },
  { href: '/app/movimientos', label: 'Gastos', icon: PieChart },
  { href: '/app/ofertas', label: 'Ofertas', icon: Tag },
  { href: '/app/cobros', label: 'Cobros', icon: Repeat },
];

const SIDEBAR_ITEMS = [
  { href: '/app', label: 'Hoy · Tu cifra', icon: Home, exact: true },
  { href: '/app/gasto', label: '¿Puedo hacer este gasto?', icon: CircleHelp },
  { href: '/app/movimientos', label: 'En qué se me va', icon: PieChart },
  { href: '/app/cobros', label: 'Cobros recurrentes', icon: Repeat },
  { href: '/app/ofertas', label: 'Ofertas cerca de ti', icon: Tag },
  { href: '/app/cierre', label: 'Cierre de ciclo', icon: CalendarCheck2 },
  { href: '/app/datos', label: 'Tus datos (Ley 1581)', icon: Database },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones principales"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {MOBILE_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11.5px] font-semibold transition-colors ${
                  active ? 'text-primary-dark' : 'text-ink-faint hover:text-ink'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DesktopSidebar({
  userName,
  zoneLabel,
  unreadCount,
  hasMerchant,
  isAdmin,
  isDemo,
}: {
  userName: string | null;
  zoneLabel: string | null;
  unreadCount: number;
  hasMerchant: boolean;
  isAdmin: boolean;
  isDemo: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Navegación lateral"
      className="no-print hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-line lg:bg-white"
    >
      <div className="flex items-center justify-between px-6 pb-4 pt-6">
        <Link href="/app" className="inline-flex items-center gap-2.5" aria-label="Inicio de CIFRA">
          <LogoMark size={28} />
          <span className="font-display text-[22px] font-bold tracking-[-0.025em] text-ink">cifra</span>
        </Link>
        {isDemo && (
          <Link href="/demo" className="badge-terra" title="Cambiar actor del demo">
            Demo
          </Link>
        )}
      </div>

      {(userName || zoneLabel) && (
        <div className="mx-4 mb-3 rounded-xl bg-paper px-3.5 py-2.5">
          {userName && <p className="truncate text-[14px] font-semibold text-ink">{userName}</p>}
          {zoneLabel && <p className="truncate text-[12px] text-ink-muted">{zoneLabel}</p>}
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {SIDEBAR_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-semibold transition-colors ${
                active ? 'bg-primary-light text-primary-dark' : 'text-ink-muted hover:bg-paper hover:text-ink'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.3 : 2} aria-hidden="true" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}

        <div className="my-3 border-t border-line pt-3">
          <Link
            href="/app/avisos"
            className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-[14px] font-semibold transition-colors ${
              pathname.startsWith('/app/avisos')
                ? 'bg-primary-light text-primary-dark'
                : 'text-ink-muted hover:bg-paper hover:text-ink'
            }`}
          >
            <span className="flex items-center gap-3">
              <Bell size={18} aria-hidden="true" />
              <span>Avisos</span>
            </span>
            {unreadCount > 0 && (
              <span className="tnum inline-flex min-w-5 items-center justify-center rounded-full bg-terra px-1.5 py-0.5 text-[11px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/app/ajustes"
            className={`mt-1 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-semibold transition-colors ${
              pathname.startsWith('/app/ajustes')
                ? 'bg-primary-light text-primary-dark'
                : 'text-ink-muted hover:bg-paper hover:text-ink'
            }`}
          >
            <Settings size={18} aria-hidden="true" />
            <span>Ajustes</span>
          </Link>
        </div>
      </nav>

      {(hasMerchant || isAdmin || isDemo) && (
        <div className="space-y-1.5 border-t border-line p-3">
          {hasMerchant && (
            <Link
              href="/negocio"
              className="flex items-center gap-2.5 rounded-xl bg-terra-pale px-3.5 py-2.5 text-[13.5px] font-semibold text-terra-dark hover:bg-terra-light"
            >
              <Store size={17} aria-hidden="true" />
              <span>Abrir mi negocio →</span>
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-2.5 rounded-xl bg-paper px-3.5 py-2 text-[13px] font-semibold text-ink-muted hover:bg-paper-deep hover:text-ink"
            >
              <Shield size={16} aria-hidden="true" />
              <span>Backoffice y métricas</span>
            </Link>
          )}
        </div>
      )}
    </aside>
  );
}
