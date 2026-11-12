import { and, eq, gt, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { embedTokens, users } from '@/lib/db/schema';
import { createSession } from '@/lib/auth/session';
import { sha256 } from '@/lib/crypto';

type Ctx = { params: Promise<{ token: string }> };

/** Canjea el enlace de un solo uso por una sesión y abre la cifra. */
export async function GET(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const origin = new URL(req.url).origin;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return NextResponse.redirect(`${origin}/entrar?enlace=invalido`);
  // Marcar como usado en la misma sentencia evita que dos peticiones canjeen el mismo enlace.
  const [row] = await db
    .update(embedTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(embedTokens.tokenHash, sha256(token)), isNull(embedTokens.usedAt), gt(embedTokens.expiresAt, new Date())))
    .returning({ userId: embedTokens.userId });
  if (!row) return NextResponse.redirect(`${origin}/entrar?enlace=vencido`);
  const [user] = await db
    .select({ onboardedAt: users.onboardedAt, isDemo: users.isDemo })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);
  // Un usuario de demostración no tiene entrada propia: a la demo se llega solo desde /admin.
  if (!user || user.isDemo) return NextResponse.redirect(`${origin}/entrar?enlace=invalido`);
  await createSession(row.userId);
  return NextResponse.redirect(`${origin}${user?.onboardedAt ? '/app' : '/app/bienvenida'}`);
}
