'use client';

import { ArrowLeft, Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LogoMark } from '@/components/logo';

/**
 * La barra de arriba, como la de cualquier aplicación del celular: en las pantallas del menú de
 * abajo dice en cuál estás; en las demás, una flecha para volver y el nombre de la pantalla.
 * Es el único "volver" de la app: las páginas no traen el suyo.
 */

type Screen = {
  title: string;
  /** A dónde vuelve la flecha si la persona abrió esta pantalla directamente. Sin `parent`, es una pestaña. */
  parent?: string;
};

const PERSONA: Array<[prefix: string, screen: Screen]> = [
  ['/app/gasto', { title: '¿Puedo gastar?', parent: '/app' }],
  ['/app/movimientos', { title: 'Gastos' }],
  ['/app/ofertas', { title: 'Ofertas' }],
  ['/app/mas', { title: 'Más' }],
  ['/app/cobros', { title: 'Cobros fijos', parent: '/app/mas' }],
  ['/app/ajustes', { title: 'Ajustes', parent: '/app/mas' }],
  ['/app/datos/importar', { title: 'Subir extracto', parent: '/app/mas' }],
  ['/app/datos', { title: 'Tus datos', parent: '/app/mas' }],
  ['/app/avisos', { title: 'Avisos', parent: '/app/mas' }],
  ['/app/cierre', { title: 'Cierre del ciclo', parent: '/app/mas' }],
  ['/app/bienvenida', { title: 'Tu primera cifra' }],
];

const NEGOCIO: Array<[prefix: string, screen: Screen]> = [
  ['/negocio/caja', { title: 'Caja' }],
  ['/negocio/ofertas', { title: 'Ofertas' }],
  ['/negocio/vitrina', { title: 'Afiche y vitrina', parent: '/negocio' }],
  ['/negocio/cuenta', { title: 'Cuenta y pagos', parent: '/negocio' }],
  ['/negocio/cuadre', { title: 'Cuadre del día', parent: '/negocio' }],
  ['/negocio/informe', { title: 'Informe del mes', parent: '/negocio' }],
  ['/negocio/perfil', { title: 'Datos del negocio', parent: '/negocio' }],
];

function screenFor(pathname: string, role: 'persona' | 'negocio'): Screen {
  const table = role === 'persona' ? PERSONA : NEGOCIO;
  const hit = table.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (hit) return hit[1];
  return { title: role === 'persona' ? 'Hoy' : 'Mi negocio' };
}

export function AppTopBar({
  merchantName,
  unreadCount = 0,
  role = 'persona',
}: {
  /** En el portal del negocio: el nombre del local, al lado del título. */
  merchantName?: string | null;
  unreadCount?: number;
  role?: 'persona' | 'negocio';
}) {
  const pathname = usePathname();
  const router = useRouter();
  const screen = screenFor(pathname, role);

  // Cuántas pantallas ha abierto la persona dentro de la app desde que la cargó. Si ya navegó,
  // la flecha vuelve a la pantalla anterior; si abrió esta directamente, va a su sección.
  const moves = useRef(0);
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      moves.current += 1;
      lastPath.current = pathname;
    }
  }, [pathname]);

  function back(e: React.MouseEvent) {
    if (moves.current > 0) {
      e.preventDefault();
      moves.current = Math.max(0, moves.current - 2); // volver también cuenta como un cambio de pantalla
      router.back();
    }
  }

  const home = role === 'persona' ? '/app' : '/negocio';

  return (
    <header data-testid="app-top-bar" className="no-print border-b border-line/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-[52px] max-w-4xl items-center justify-between gap-3 px-2.5">
        <div className="flex min-w-0 items-center gap-1">
          {screen.parent ? (
            <Link
              href={screen.parent}
              onClick={back}
              aria-label="Volver"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink transition active:bg-paper-deep hover:bg-paper"
            >
              <ArrowLeft size={21} aria-hidden="true" />
            </Link>
          ) : (
            <Link href={home} aria-label="CIFRA, inicio" className="grid h-11 w-10 shrink-0 place-items-center rounded-full lg:hidden">
              <LogoMark size={24} />
            </Link>
          )}
          <p className="min-w-0 truncate font-display text-[19px] font-bold tracking-[-0.02em] text-ink lg:pl-2">
            {screen.title}
            {role === 'negocio' && !screen.parent && merchantName && pathname !== '/negocio' && (
              <span className="ml-2 font-sans text-[13px] font-medium tracking-normal text-ink-faint">{merchantName}</span>
            )}
          </p>
        </div>

        {role === 'persona' && (
          <Link
            href="/app/avisos"
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-muted transition active:bg-paper-deep hover:bg-paper hover:text-ink"
            aria-label={unreadCount > 0 ? `Avisos, ${unreadCount} sin leer` : 'Avisos'}
          >
            <Bell size={20} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="tnum absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-terra px-1 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </Link>
        )}
      </div>
    </header>
  );
}
