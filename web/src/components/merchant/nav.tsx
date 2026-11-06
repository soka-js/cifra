'use client';

import {
  Calculator,
  FileText,
  Home,
  QrCode,
  Receipt,
  Settings,
  Share2,
  Shield,
  Store,
  Tag,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/actions/auth';
import { switchActiveMerchant } from '@/app/actions/merchant';
import { LogoMark } from '@/components/logo';

const MOBILE_ITEMS = [
  { href: '/negocio', label: 'Resumen', icon: Home, exact: true },
  { href: '/negocio/caja', label: 'Caja', icon: QrCode },
  { href: '/negocio/cuadre', label: 'Cuadre', icon: Calculator },
  { href: '/negocio/ofertas', label: 'Ofertas', icon: Tag },
  { href: '/negocio/vitrina', label: 'Vitrina', icon: Share2 },
];

const SIDEBAR_ITEMS = [
  { href: '/negocio', label: 'Resumen del mes', icon: Home, exact: true },
  { href: '/negocio/caja', label: 'Caja · Cobrar código', icon: QrCode },
  { href: '/negocio/cuadre', label: 'Cuadre diario e insumos', icon: Calculator },
  { href: '/negocio/ofertas', label: 'Mis ofertas y relámpago', icon: Tag },
  { href: '/negocio/vitrina', label: 'Mi vitrina y afiche QR', icon: Share2 },
  { href: '/negocio/informe', label: 'Informe de 1 página', icon: FileText },
  { href: '/negocio/cuenta', label: 'Comisiones y pagos', icon: Receipt },
  { href: '/negocio/perfil', label: 'Datos del negocio', icon: Settings },
];

export function MerchantBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones de tu negocio"
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
                  active ? 'text-terra-dark' : 'text-ink-faint hover:text-ink'
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

export function MerchantSidebar({
  merchantId,
  merchantName,
  neighborhood,
  allMerchants,
  isAdmin,
  isDemo,
}: {
  merchantId: string;
  merchantName: string;
  neighborhood: string;
  allMerchants: Array<{ id: string; name: string; neighborhood: string }>;
  isAdmin: boolean;
  isDemo: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Navegación de tu negocio"
      className="no-print hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-line lg:bg-white"
    >
      <div className="flex items-center justify-between px-6 pb-4 pt-6">
        <Link href="/negocio" className="inline-flex items-center gap-2.5" aria-label="Portal de negocio CIFRA">
          <LogoMark size={28} />
          <div className="leading-none">
            <span className="font-display text-[21px] font-bold tracking-[-0.025em] text-ink">cifra</span>
            <span className="ml-1.5 rounded-md bg-terra-light px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-terra-dark">
              Negocio
            </span>
          </div>
        </Link>
        {isDemo && (
          <Link href="/demo" className="badge-terra" title="Cambiar actor del demo">
            Demo
          </Link>
        )}
      </div>

      <div className="mx-4 mb-3 rounded-xl border border-terra/20 bg-terra-pale/70 px-3.5 py-2.5">
        <p className="flex items-center gap-1.5 truncate text-[14px] font-bold text-ink">
          <Store size={15} className="shrink-0 text-terra-dark" aria-hidden="true" />
          <span className="truncate">{merchantName}</span>
        </p>
        <p className="mt-0.5 truncate text-[12px] text-ink-muted">{neighborhood}</p>

        {allMerchants.length > 1 && (
          <form action={switchActiveMerchant} className="mt-2">
            <label htmlFor="merchant-switch" className="sr-only">
              Cambiar negocio
            </label>
            <select
              id="merchant-switch"
              name="merchantId"
              defaultValue={merchantId}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="w-full rounded-lg border border-line bg-white px-2 py-1 text-[12px] font-medium text-ink"
            >
              {allMerchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.neighborhood})
                </option>
              ))}
            </select>
          </form>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {SIDEBAR_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-semibold transition-colors ${
                active ? 'bg-terra-light text-terra-dark' : 'text-ink-muted hover:bg-paper hover:text-ink'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.3 : 2} aria-hidden="true" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1.5 border-t border-line p-3">
        <Link
          href="/app"
          className="flex items-center gap-2.5 rounded-xl bg-primary-pale px-3.5 py-2 text-[13px] font-semibold text-primary-dark hover:bg-primary-light"
        >
          <UserRound size={16} aria-hidden="true" />
          <span>Ir a mi vista personal →</span>
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-2.5 rounded-xl bg-paper px-3.5 py-2 text-[13px] font-semibold text-ink-muted hover:bg-paper-deep hover:text-ink"
          >
            <Shield size={16} aria-hidden="true" />
            <span>Backoffice y Data Room</span>
          </Link>
        )}
        <form action={logout}>
          <button
            type="submit"
            className="w-full rounded-xl px-3.5 py-1.5 text-left text-[12.5px] font-medium text-ink-faint hover:bg-paper hover:text-ink"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
