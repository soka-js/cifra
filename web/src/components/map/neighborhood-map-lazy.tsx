'use client';

import dynamic from 'next/dynamic';
import type { NeighborhoodMapProps } from './neighborhood-map';

const InnerMap = dynamic(() => import('./neighborhood-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center rounded-2xl border border-line bg-paper-warm text-[13.5px] text-ink-muted">
      Cargando mapa del barrio...
    </div>
  ),
});

export function LazyNeighborhoodMap(props: NeighborhoodMapProps) {
  return <InnerMap {...props} />;
}
