'use client';

import { ArrowLeft, Bell, ChevronRight, Play, Settings, Sparkles, Store, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogoMark } from '@/components/logo';

export function AppTopBar({
  userName,
  merchantName,
  merchantSlug,
  unreadCount = 0,
  role = 'persona',
  hasMerchant = false,
}: {
  userName?: string | null;
  merchantName?: string | null;
  merchantSlug?: string | null;
  unreadCount?: number;
  role?: 'persona' | 'negocio';
  /** La persona tiene un negocio registrado: se le muestra el acceso a él. */
  hasMerchant?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isPersonaRoot = pathname === '/app';
  const isNegocioRoot = pathname === '/negocio';
  const isRoot = role === 'persona' ? isPersonaRoot : isNegocioRoot;

  function handleBack(e: React.MouseEvent) {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  }

  // Título según la ruta actual para que el usuario siempre sepa dónde está
  function getSectionTitle(): string {
    if (pathname === '/app') return 'Tu cifra';
    if (pathname.startsWith('/app/bienvenida')) return 'Configuración inicial';
    if (pathname.startsWith('/app/gasto')) return '¿Puedo hacer este gasto?';
    if (pathname.startsWith('/app/movimientos')) return 'En qué se me va';
    if (pathname.startsWith('/app/ofertas')) return 'Ofertas cerca de ti';
    if (pathname.startsWith('/app/cobros')) return 'Cobros fijos y suscripciones';
    if (pathname.startsWith('/app/cierre')) return 'Cierre de ciclo';
    if (pathname.startsWith('/app/datos/importar')) return 'Subir extracto';
    if (pathname.startsWith('/app/datos')) return 'Tus datos';
    if (pathname.startsWith('/app/avisos')) return 'Avisos y alertas';
    if (pathname.startsWith('/app/ajustes')) return 'Ajustes';

    if (pathname === '/negocio') return 'Inicio';
    if (pathname.startsWith('/negocio/caja')) return 'Caja';
    if (pathname.startsWith('/negocio/cuadre')) return 'Cuadre diario e insumos';
    if (pathname.startsWith('/negocio/ofertas')) return 'Mis ofertas';
    if (pathname.startsWith('/negocio/vitrina')) return 'Vitrina y afiche';
    if (pathname.startsWith('/negocio/informe')) return 'Informe del mes';
    if (pathname.startsWith('/negocio/cuenta')) return 'Tu cuenta';
    if (pathname.startsWith('/negocio/perfil')) return 'Datos del negocio';

    return 'CIFRA';
  }

  return (
    <header data-testid="app-top-bar" className="no-print border-b border-line/80 bg-white/90 px-3.5 py-2.5 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        {/* Izquierda: Miga de pan contextual limpia (sin duplicar el BackButton de página) */}
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={role === 'persona' ? '/app' : '/negocio'}
            className="flex shrink-0 items-center gap-1.5 lg:hidden"
          >
            <LogoMark size={22} />
          </Link>

          <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
            <Link
              href={role === 'persona' ? '/app' : '/negocio'}
              onClick={!isRoot ? handleBack : undefined}
              className="shrink-0 font-semibold text-ink-muted transition hover:text-ink"
            >
              {role === 'persona' ? 'Hoy' : 'Negocio'}
            </Link>
            <ChevronRight size={14} className="shrink-0 text-ink-faint" aria-hidden="true" />
            <span className="truncate font-bold text-ink">{getSectionTitle()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Paso entre la cifra personal y el negocio, solo para quien tiene las dos cosas. */}
          {role === 'persona' && hasMerchant && (
            <Link
              href="/negocio"
              className="inline-flex items-center gap-1.5 rounded-full border border-terra/30 bg-terra-pale px-3 py-1.5 text-[12.5px] font-semibold text-terra-dark hover:bg-terra-light"
            >
              <Store size={14} aria-hidden="true" />
              <span>Mi negocio</span>
            </Link>
          )}
          {role === 'negocio' && (
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted hover:text-ink"
            >
              <UserRound size={14} aria-hidden="true" />
              <span>Mi cifra</span>
            </Link>
          )}

          {/* Avisos */}
          {role === 'persona' && (
            <Link
              href="/app/avisos"
              className="relative grid h-8 w-8 place-items-center rounded-full text-ink-muted transition hover:bg-paper hover:text-ink"
              aria-label="Avisos"
            >
              <Bell size={17} aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute right-0.5 top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-terra px-1 text-[9.5px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* Ajustes */}
          <Link
            href={role === 'persona' ? '/app/ajustes' : '/negocio/perfil'}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition hover:bg-paper hover:text-ink"
            aria-label="Configuración"
          >
            <Settings size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
