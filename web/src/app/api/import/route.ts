import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { accounts, dataSources } from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/auth/session';
import { ingestTransactions, setBalance } from '@/lib/ingest';
import { logAccess } from '@/lib/data';
import { recordEvent } from '@/lib/analytics/server';
import { allow } from '@/lib/rate-limit';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const Body = z.object({
  accountId: z.string().uuid().nullable().optional(),
  entityName: z.string().trim().min(2).max(80),
  accountKind: z.enum(['ahorros', 'corriente', 'billetera', 'tarjeta_credito', 'otra']),
  accountName: z.string().trim().min(1).max(60),
  mask: z.string().trim().regex(/^\d{4}$/).nullable(),
  balanceMinor: z.number().int().min(-1e13).max(1e13),
  transactions: z
    .array(
      z.object({
        postedOn: isoDate,
        description: z.string().trim().min(1).max(300),
        amountMinor: z.number().int().min(-1e13).max(1e13),
      }),
    )
    .min(1)
    .max(5000),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Tu sesión venció. Vuelve a entrar.' }, { status: 401 });
  if (!(await allow(`import:${user.id}`, 30, 3600))) {
    return NextResponse.json({ error: 'Subiste muchos extractos en poco tiempo. Intenta en una hora.' }, { status: 429 });
  }
  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'El extracto tiene datos que no pudimos leer.' }, { status: 400 });
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: 'No pudimos leer la información enviada.' }, { status: 400 });
  }

  // Si viene de "Subir extracto más reciente", se usa esa cuenta tal cual.
  if (body.accountId) {
    const [row] = await db
      .select({ account: accounts, source: dataSources })
      .from(accounts)
      .innerJoin(dataSources, eq(dataSources.id, accounts.sourceId))
      .where(and(eq(accounts.id, body.accountId), eq(accounts.userId, user.id), eq(dataSources.kind, 'extracto')))
      .limit(1);
    if (!row) return NextResponse.json({ error: 'No encontramos esa cuenta.' }, { status: 404 });
    return finish(user.id, row.account, row.source, body);
  }

  // Una fuente "extracto" por entidad; una cuenta por (entidad, últimos 4 dígitos o nombre).
  let [source] = await db
    .select()
    .from(dataSources)
    .where(and(eq(dataSources.userId, user.id), eq(dataSources.kind, 'extracto'), eq(dataSources.entityName, body.entityName)))
    .limit(1);
  if (!source) {
    [source] = await db
      .insert(dataSources)
      .values({ userId: user.id, kind: 'extracto', entityName: body.entityName, scopes: ['saldos', 'movimientos'], status: 'activa' })
      .returning();
  } else if (source.status !== 'activa') {
    await db.update(dataSources).set({ status: 'activa' }).where(eq(dataSources.id, source.id));
  }
  const existing = await db.select().from(accounts).where(and(eq(accounts.userId, user.id), eq(accounts.sourceId, source!.id)));
  let account = existing.find((a) => (body.mask ? a.mask === body.mask : !a.mask && a.name === body.accountName));
  if (!account) {
    [account] = await db
      .insert(accounts)
      .values({
        userId: user.id,
        sourceId: source!.id,
        kind: body.accountKind,
        name: body.accountName,
        mask: body.mask,
        includeInCifra: body.accountKind !== 'tarjeta_credito',
      })
      .returning();
  }
  return finish(user.id, account!, source!, body);
}

async function finish(
  userId: string,
  account: typeof accounts.$inferSelect,
  source: typeof dataSources.$inferSelect,
  body: z.infer<typeof Body>,
) {
  const result = await ingestTransactions(userId, account.id, source.id, body.transactions);
  await setBalance(userId, account.id, body.balanceMinor);
  await logAccess(userId, 'tú', 'subiste un extracto', {
    entidad: source.entityName,
    cuenta: account.name,
    movimientos_nuevos: result.inserted,
    repetidos: result.duplicates,
  });
  await recordEvent('import_statement', { path: '/app/datos/importar', rows: body.transactions.length, inserted: result.inserted }, userId);
  return NextResponse.json({ ok: true, ...result });
}
