'use client';

import type { EventName, GaKeyEvent } from './shared';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

type Props = Record<string, string | number | boolean | null>;

/**
 * Solo a GA4, para eventos que la analítica propia ya registra en el servidor (registro, contacto, extracto, modo rápido)
 * y que en GA4 se marcan como eventos clave.
 */
export function gaEvent(name: GaKeyEvent, props: Props = {}): void {
  try {
    window.gtag?.('event', name, props);
  } catch {
    // Silencioso a propósito.
  }
}

/** Envía un evento a la analítica propia y, si la persona aceptó cookies y hay GA4, también a GA4. */
export function track(name: EventName, props: Props = {}): void {
  try {
    const body = JSON.stringify({ name, props, path: window.location.pathname, referrer: document.referrer || null });
    const sent = navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }));
    if (!sent) void fetch('/api/events', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } });
    window.gtag?.('event', name, props);
  } catch {
    // Silencioso a propósito.
  }
}
