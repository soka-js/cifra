import { desc, eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { logAccess } from '@/lib/data';
import { db } from '@/lib/db';
import {
  accessLog,
  accounts,
  commitments,
  cycleSnapshots,
  dataSources,
  recurringMarks,
  redemptions,
  savingsEvents,
  transactions,
  userCategoryRules,
} from '@/lib/db/schema';

function csvCell(val: unknown): string {
  const str = val == null ? '' : String(val);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/**
 * Portabilidad y transparencia completa según Ley 1581 de 2012 (Habeas Data):
 * permite descargar todos los datos asociados a la persona en JSON o CSV.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const format = req.nextUrl.searchParams.get('format') === 'csv' ? 'csv' : 'json';

  const [sources, accts, txs, rules, marks, comms, savings, snapshots, redeems, logs] = await Promise.all([
    db.select().from(dataSources).where(eq(dataSources.userId, user.id)),
    db.select().from(accounts).where(eq(accounts.userId, user.id)),
    db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.postedOn)),
    db.select().from(userCategoryRules).where(eq(userCategoryRules.userId, user.id)),
    db.select().from(recurringMarks).where(eq(recurringMarks.userId, user.id)),
    db.select().from(commitments).where(eq(commitments.userId, user.id)),
    db.select().from(savingsEvents).where(eq(savingsEvents.userId, user.id)),
    db.select().from(cycleSnapshots).where(eq(cycleSnapshots.userId, user.id)),
    db.select().from(redemptions).where(eq(redemptions.userId, user.id)),
    db.select().from(accessLog).where(eq(accessLog.userId, user.id)).orderBy(desc(accessLog.at)).limit(100),
  ]);

  await logAccess(user.id, 'tú', `descargaste una copia de tus datos (${format.toUpperCase()})`, {
    movimientos: txs.length,
  });

  const dateStamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    const acctNameById = new Map(accts.map((a) => [a.id, a.name]));
    const header = ['fecha', 'cuenta', 'comercio', 'categoria', 'valor_cop', 'descripcion_original', 'excluido'].join(',');
    const lines = txs.map((t) =>
      [
        csvCell(t.postedOn),
        csvCell(acctNameById.get(t.accountId) ?? ''),
        csvCell(t.merchantName ?? ''),
        csvCell(t.category ?? ''),
        csvCell((t.amountMinor / 100).toFixed(2)),
        csvCell(t.description),
        csvCell(t.excluded ? 'si' : 'no'),
      ].join(','),
    );
    const csv = `\uFEFF${[header, ...lines].join('\n')}`;
    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="cifra-movimientos-${dateStamp}.csv"`,
      },
    });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    legalBasis: 'Ley 1581 de 2012 - Derecho de acceso y portabilidad del titular',
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      incomeFrequency: user.incomeFrequency,
      incomeDays: user.incomeDays,
      bufferCop: user.bufferMinor / 100,
      dailySpendDeclaredCop: user.dailySpendMinor !== null ? user.dailySpendMinor / 100 : null,
      zoneSlug: user.zoneSlug,
      consentVersion: user.consentVersion,
      consentAt: user.consentAt,
      createdAt: user.createdAt,
    },
    dataSources: sources,
    accounts: accts,
    transactions: txs,
    categoryRules: rules,
    recurringMarks: marks,
    manualCommitments: comms,
    savingsEvents: savings,
    cycleSnapshots: snapshots,
    offerRedemptions: redeems,
    accessLog: logs,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="cifra-datos-${dateStamp}.json"`,
    },
  });
}
