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
  isDemo = false,
  role = 'persona',
}: {
  userName?: string | null;
  merchantName?: string | null;
  merchantSlug?: string | null;
  unreadCount?: number;
  isDemo?: boolean;
  role?: 'persona' | 'negocio';
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
    if (pathname === '/app') return 'Tu Cifra de Hoy';
    if (pathname.startsWith('/app/bienvenida')) return 'Configuración inicial';
    if (pathname.startsWith('/app/gasto')) return '¿Puedo hacer este gasto?';
    if (pathname.startsWith('/app/movimientos')) return 'En qué se me va y fugas';
    if (pathname.startsWith('/app/ofertas')) return 'Beneficios de tu barrio';
    if (pathname.startsWith('/app/cobros')) return 'Cobros fijos y suscripciones';
    if (pathname.startsWith('/app/cierre')) return 'Cierre de ciclo';
    if (pathname.startsWith('/app/datos/importar')) return 'Subir extracto';
    if (pathname.startsWith('/app/datos')) return 'Tus datos (Ley 1581)';
    if (pathname.startsWith('/app/avisos')) return 'Avisos y alertas';
    if (pathname.startsWith('/app/ajustes')) return 'Ajustes';

    if (pathname === '/negocio') return 'Resumen del local';
    if (pathname.startsWith('/negocio/caja')) return 'Caja · Cobrar código';
    if (pathname.startsWith('/negocio/cuadre')) return 'Cuadre diario e insumos';
    if (pathname.startsWith('/negocio/ofertas')) return 'Mis ofertas y relámpago';
    if (pathname.startsWith('/negocio/vitrina')) return 'Mi vitrina y afiche QR';
    if (pathname.startsWith('/negocio/informe')) return 'Informe de 1 página';
    if (pathname.startsWith('/negocio/cuenta')) return 'Comisiones y facturación';
    if (pathname.startsWith('/negocio/perfil')) return 'Datos del negocio';

    return 'CIFRA';
  }

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line/80 bg-white/90 px-3.5 py-2.5 backdrop-blur-md">
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

        {/* Centro / Derecha: Switcher rápido Persona ⇄ Negocio */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-line bg-paper p-0.5 text-[12px] font-semibold">
            <Link
              href="/app"
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
                role === 'persona'
                  ? 'bg-ink font-bold text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <UserRound size={13} aria-hidden="true" />
              <span>Persona</span>
            </Link>
            <Link
              href="/negocio"
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
                role === 'negocio'
                  ? 'bg-terra font-bold text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Store size={13} aria-hidden="true" />
              <span>Negocio</span>
            </Link>
          </div>

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
