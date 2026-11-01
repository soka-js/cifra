import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { MEMBER_ID, apiError, authenticatePartner, findMember, partnerSource } from '@/lib/partner/auth';
import { logAccess } from '@/lib/data';

const Body = z.object({
  name: z.string().trim().max(80).optional(),
  income: z
    .object({
      frequency: z.enum(['mensual', 'quincenal', 'semanal', 'irregular']),
      days: z.array(z.number().int().min(1).max(31)).max(2).default([]),
    })
    .optional(),
  /** La entidad confirma que el asociado activó CIFRA y aceptó el tratamiento de sus datos en su app. */
  consent_at: z.iso.datetime({ offset: true }),
});

type Ctx = { params: Promise<{ memberId: string }> };

/** Crea o actualiza un asociado. Idempotente. */
export async function PUT(req: Request, ctx: Ctx) {
  const partner = await authenticatePartner(req);
  if (partner instanceof NextResponse) return partner;
  const { memberId } = await ctx.params;
  if (!MEMBER_ID.test(memberId)) return apiError(400, 'id_invalido', 'El id del asociado admite letras, números y . _ : - (máximo 80).');
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, 'cuerpo_invalido', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const b = parsed.data;
  const values = {
    name: b.name ?? null,
    incomeFrequency: b.income?.frequency ?? null,
    incomeDays: b.income ? b.income.days : null,
    consentVersion: `entidad:${partner.slug}`,
    consentAt: new Date(b.consent_at),
    // Si la entidad ya sabe cuándo le pagan, no hace falta preguntarlo al entrar.
    ...(b.income ? { onboardedAt: new Date() } : {}),
  };
  const existing = await findMember(partner, memberId);
  const created = !existing;
  const [user] = existing
    ? await db.update(users).set({ ...values, name: b.name ?? existing.name }).where(eq(users.id, existing.id)).returning()
    : await db.insert(users).values({ ...values, partnerId: partner.id, partnerMemberId: memberId }).returning();
  await partnerSource(partner, user!.id);
  if (created) await logAccess(user!.id, partner.name, 'activó CIFRA para ti');
  return NextResponse.json({ member_id: memberId, created }, { status: created ? 201 : 200 });
}

/** Borra al asociado y todos sus datos en CIFRA (por ejemplo, si revoca la autorización). */
export async function DELETE(req: Request, ctx: Ctx) {
  const partner = await authenticatePartner(req);
  if (partner instanceof NextResponse) return partner;
  const { memberId } = await ctx.params;
  const user = await findMember(partner, memberId);
  if (!user) return apiError(404, 'no_existe', 'No hay un asociado con ese id.');
  await db.delete(users).where(eq(users.id, user.id));
  return new NextResponse(null, { status: 204 });
}
