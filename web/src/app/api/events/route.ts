import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { deviceFrom, readUtm } from '@/lib/analytics/server';
import { EVENT_NAMES, UTM_COOKIE, VARIANT_COOKIE, VISITOR_COOKIE } from '@/lib/analytics/shared';
import { getCurrentUser } from '@/lib/auth/session';

const Body = z.object({
  name: z.enum(EVENT_NAMES),
  path: z.string().max(200).nullable().optional(),
  referrer: z.string().max(300).nullable().optional(),
  props: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).optional(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    const raw = await req.text();
    if (raw.length > 4000) return new NextResponse(null, { status: 413 });
    parsed = Body.safeParse(JSON.parse(raw));
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const jar = await cookies();
  const h = await headers();
  const visitorId = jar.get(VISITOR_COOKIE)?.value;
  const device = deviceFrom(h.get('user-agent'));
  if (!visitorId || device === 'bot') return new NextResponse(null, { status: 204 });
  const props = Object.fromEntries(Object.entries(parsed.data.props ?? {}).slice(0, 12));
  let referrerHost: string | null = null;
  try {
    referrerHost = parsed.data.referrer ? new URL(parsed.data.referrer).host : null;
  } catch {
    referrerHost = null;
  }
  const user = await getCurrentUser();
  await db.insert(events).values({
    visitorId: visitorId.slice(0, 64),
    userId: user?.id ?? null,
    name: parsed.data.name,
    path: parsed.data.path ?? null,
    variant: jar.get(VARIANT_COOKIE)?.value ?? null,
    props,
    utm: readUtm(jar.get(UTM_COOKIE)?.value),
    referrer: referrerHost,
    device,
  });
  return new NextResponse(null, { status: 204 });
}
