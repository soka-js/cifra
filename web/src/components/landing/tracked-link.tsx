'use client';

import Link from 'next/link';
import { track } from '@/lib/analytics/client';

/** Enlace que registra el clic como `click_cta` con el lugar de la página donde está. */
export function TrackedLink({
  href,
  location,
  className,
  children,
}: {
  href: string;
  location: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => track('click_cta', { location, href })}>
      {children}
    </Link>
  );
}
