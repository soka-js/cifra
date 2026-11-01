import 'server-only';
import { cookies, headers } from 'next/headers';
import { db } from '../db';
import { events } from '../db/schema';
import { EVENT_NAMES, UTM_COOKIE, VARIANT_COOKIE, VISITOR_COOKIE, type EventName } from './shared';

export function deviceFrom(ua: string | null): string {
  if (!ua) return 'desconocido';
  if (/bot|crawler|spider|preview|headless/i.test(ua)) return 'bot';
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'movil';
  return 'computador';
}

export function readUtm(raw: string | undefined): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) if (typeof v === 'string' && k.startsWith('utm_')) out[k] = v.slice(0, 120);
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

type Props = Record<string, string | number | boolean | null>;

/** Registra un evento desde el servidor (registro, importación) con el contexto de cookies de la petición. */
export async function recordEvent(name: EventName, props: Props = {}, userId: string | null = null): Promise<void> {
  if (!EVENT_NAMES.includes(name)) return;
  const jar = await cookies();
  const h = await headers();
  const device = deviceFrom(h.get('user-agent'));
  if (device === 'bot') return;
  try {
    await db.insert(events).values({
      visitorId: jar.get(VISITOR_COOKIE)?.value ?? 'sin_cookie',
      userId,
      name,
      path: (props.path as string | undefined) ?? null,
      variant: jar.get(VARIANT_COOKIE)?.value ?? null,
      props,
      utm: readUtm(jar.get(UTM_COOKIE)?.value),
      referrer: null,
      device,
    });
  } catch (err) {
    // La analítica nunca debe tumbar el flujo principal.
    console.error('No se pudo registrar el evento', name, err);
  }
}
