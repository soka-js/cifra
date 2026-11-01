import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { embedTokens } from '@/lib/db/schema';
import { apiError, authenticatePartner, findMember } from '@/lib/partner/auth';
import { randomToken, sha256 } from '@/lib/crypto';

type Ctx = { params: Promise<{ memberId: string }> };

const TTL_SECONDS = 120;

/**
 * Enlace de un solo uso para abrir CIFRA dentro de la app de la entidad (webview).
 * Se pide desde el servidor de la entidad justo cuando el asociado toca "Ver mi cifra".
 */
export async function POST(req: Request, ctx: Ctx) {
  const partner = await authenticatePartner(req);
  if (partner instanceof NextResponse) return partner;
  const { memberId } = await ctx.params;
  const user = await findMember(partner, memberId);
  if (!user) return apiError(404, 'no_existe', 'No hay un asociado con ese id.');
  const token = randomToken();
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
  await db.insert(embedTokens).values({ tokenHash: sha256(token), userId: user.id, partnerId: partner.id, expiresAt });
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  return NextResponse.json({ url: `${site}/e/${token}`, expires_at: expiresAt.toISOString() }, { status: 201 });
}
