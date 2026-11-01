import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { apiError, authenticatePartner, findMember, partnerSource } from '@/lib/partner/auth';
import { ingestTransactions } from '@/lib/ingest';
import { logAccess } from '@/lib/data';

const Body = z.object({
  transactions: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        posted_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        description: z.string().trim().min(1).max(300),
        amount_minor: z.number().int().min(-1e13).max(1e13).refine((n) => n !== 0, 'no puede ser 0'),
      }),
    )
    .min(1)
    .max(1000),
});

type Ctx = { params: Promise<{ memberId: string; accountId: string }> };

/** Agrega movimientos. Idempotente por `id`: reenviar el mismo movimiento no lo duplica. */
export async function POST(req: Request, ctx: Ctx) {
  const partner = await authenticatePartner(req);
  if (partner instanceof NextResponse) return partner;
  const { memberId, accountId } = await ctx.params;
  const user = await findMember(partner, memberId);
  if (!user) return apiError(404, 'no_existe', 'No hay un asociado con ese id.');
  const source = await partnerSource(partner, user.id);
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.sourceId, source.id), eq(accounts.externalId, accountId)))
    .limit(1);
  if (!account) return apiError(404, 'no_existe', 'Primero crea la cuenta con PUT .../accounts/{account_id}.');
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, 'cuerpo_invalido', parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const result = await ingestTransactions(
    user.id,
    account.id,
    source.id,
    parsed.data.transactions.map((t) => ({ externalId: `${accountId}:${t.id}`, postedOn: t.posted_on, description: t.description, amountMinor: t.amount_minor })),
  );
  if (result.inserted > 0) await logAccess(user.id, partner.name, 'envió movimientos', { cuenta: account.name, nuevos: result.inserted });
  return NextResponse.json({ received: parsed.data.transactions.length, inserted: result.inserted, duplicates: result.duplicates });
}
