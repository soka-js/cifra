'use client';

import { CircleHelp, Database, Home, Repeat } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/app', label: 'Hoy', icon: Home },
  { href: '/app/gasto', label: '¿Puedo?', icon: CircleHelp },
  { href: '/app/cobros', label: 'Cobros', icon: Repeat },
  { href: '/app/datos', label: 'Tus datos', icon: Database },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/app' ? pathname === '/app' : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[12px] font-semibold ${active ? 'text-primary-dark' : 'text-ink-faint hover:text-ink'}`}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
