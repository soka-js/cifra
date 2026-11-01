'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics/client';
import type { EventName } from '@/lib/analytics/shared';

export function TrackView({ name, props = {} }: { name: EventName; props?: Record<string, string | number | boolean | null> }) {
  useEffect(() => {
    track(name, props);
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
