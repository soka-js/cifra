'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics/client';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]!) : null;
}

/**
 * Analítica de la landing y del embudo:
 * - Eventos propios (anónimos, sin datos personales) a /api/events: vista, profundidad de scroll y tiempo activo.
 * - GA4 solo si hay ID configurado y la persona acepta cookies de medición.
 */
export function Analytics() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<string | null>('pendiente');
  const sentDepths = useRef(new Set<number>());
  const activeMs = useRef(0);
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    setConsent(readCookie('cf_consent'));
  }, []);

  useEffect(() => {
    track('page_view', { path: pathname });
    sentDepths.current = new Set();
    if (pathname !== '/') return;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = (window.scrollY / max) * 100;
      for (const d of [25, 50, 75, 100]) {
        if (pct >= d - 1 && !sentDepths.current.has(d)) {
          sentDepths.current.add(d);
          track('scroll_depth', { percent: d });
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  // Tiempo con la pestaña visible, enviado al salir o al ocultarla.
  useEffect(() => {
    lastTick.current = document.visibilityState === 'visible' ? Date.now() : null;
    const flush = () => {
      if (lastTick.current) activeMs.current += Date.now() - lastTick.current;
      lastTick.current = null;
      const seconds = Math.round(activeMs.current / 1000);
      if (seconds >= 1) track('engaged_time', { seconds, path: pathname });
      activeMs.current = 0;
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
      else lastTick.current = Date.now();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, [pathname]);

  const decide = (value: 'si' | 'no') => {
    document.cookie = `cf_consent=${value}; max-age=${60 * 60 * 24 * 180}; path=/; samesite=lax`;
    setConsent(value);
  };

  return (
    <>
      {GA_ID && consent === 'si' && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
      {GA_ID && consent === null && !pathname.startsWith('/app') && (
        <div role="dialog" aria-label="Cookies de medición" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg rounded-2xl border border-line bg-white p-4 shadow-[0_8px_30px_rgba(20,32,29,0.12)] sm:inset-x-auto sm:right-4">
          <p className="text-sm text-ink-muted">
            Usamos Google Analytics para saber qué partes de esta página sirven. ¿Nos dejas medir tu visita?{' '}
            <a href="/privacidad#cookies" className="underline">Más información</a>
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary min-h-10 px-4 text-sm" onClick={() => decide('si')}>Sí, medir</button>
            <button type="button" className="btn-ghost min-h-10 px-4 text-sm" onClick={() => decide('no')}>No, gracias</button>
          </div>
        </div>
      )}
    </>
  );
}
