'use client';

import { useEffect } from 'react';
import { gaEvent } from '@/lib/analytics/client';

/** Dispara un evento de GA4 una sola vez al montar (por ejemplo, sign_up al llegar a la bienvenida). */
export function GaOnce({ name }: { name: 'sign_up' | 'generate_lead' | 'import_statement' }) {
  useEffect(() => {
    const key = `ga-once-${name}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Sin sessionStorage, se envía igual.
    }
    gaEvent(name);
  }, [name]);
  return null;
}
