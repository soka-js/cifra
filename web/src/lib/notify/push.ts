import 'server-only';
import { eq } from 'drizzle-orm';
import webpush from 'web-push';
import { db } from '../db';
import { pushSubscriptions } from '../db/schema';

let configured = false;

function ensureVapidConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:hola@cifra.co';
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
    return true;
  } catch {
    return false;
  }
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendUserPush(
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<number> {
  if (!ensureVapidConfigured()) return 0;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return 0;

  let sent = 0;
  const bodyStr = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/app/avisos',
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        bodyStr,
      );
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }
  return sent;
}
