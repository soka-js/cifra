import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { apiError, authenticatePartner, findMember, partnerSource } from '@/lib/partner/auth';

const Body = z.object({
  kind: z.enum(['ahorros', 'corriente', 'billetera', 'tarjeta_credito', 'otra']),
  name: z.string().trim().min(1).max(60),
  mask: z.string().regex(/^\d{4}$/).nullable().optional(),
  balance: z.object({ amount_minor: z.number().int().min(-1e13).max(1e13), at: z.iso.datetime({ offset: true }) }).optional(),
});

type Ctx = { params: Promise<{ memberId: string; accountId: string }> };

/** Crea o actualiza una cuenta del asociado y, si viene, su saldo. */
export async function PUT(req: Request, ctx: Ctx) {
  const partner = await authenticatePartner(req);
  if (partner instanceof NextResponse) return partner;
  const { memberId, accountId } = await ctx.params;
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(accountId)) return apiError(400, 'id_invalido', 'El id de la cuenta admite letras, números y . _ : - (máximo 80).');
  const user = await findMember(partner, memberId);
  if (!user) return apiError(404, 'no_existe', 'Primero crea el asociado con PUT /api/v1/members/{member_id}.');
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, 'cuerpo_invalido', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const b = parsed.data;
  const source = await partnerSource(partner, user.id);
  const values = {
    kind: b.kind,
    name: b.name,
    mask: b.mask ?? null,
    includeInCifra: b.kind !== 'tarjeta_credito',
    ...(b.balance ? { balanceMinor: b.balance.amount_minor, balanceAt: new Date(b.balance.at) } : {}),
  };
  const [existing] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.sourceId, source.id), eq(accounts.externalId, accountId)))
    .limit(1);
  if (existing) {
    await db.update(accounts).set(values).where(eq(accounts.id, existing.id));
    return NextResponse.json({ account_id: accountId, created: false });
  }
  await db.insert(accounts).values({ ...values, userId: user.id, sourceId: source.id, externalId: accountId });
  return NextResponse.json({ account_id: accountId, created: true }, { status: 201 });
}
