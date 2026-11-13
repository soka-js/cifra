import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { merchantInvoices, merchantPayments } from '@/lib/db/schema';
import {
  invoiceIdFromReference,
  readTransaction,
  settleInvoice,
  verifyEventSignature,
  type WompiEventBody,
} from '@/lib/payments/wompi';

/**
 * Aviso de Wompi cuando cambia una transacción. Si es el pago aprobado de un corte de comisiones,
 * lo registra una sola vez (Wompi repite los avisos) y marca el corte como pagado solo si el
 * monto en pesos lo cubre. Si no lo cubre, el pago queda reportado para que el equipo lo revise.
 */
export async function POST(request: NextRequest) {
  const eventsSecret = process.env.WOMPI_EVENTS_SECRET;
  if (!eventsSecret) {
    return NextResponse.json({ ok: false, error: 'Wompi no configurado' }, { status: 503 });
  }

  let body: WompiEventBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || !verifyEventSignature(body, eventsSecret)) {
    return NextResponse.json({ ok: false, error: 'Firma inválida' }, { status: 401 });
  }

  const tx = readTransaction(body);
  const invoiceId = tx && tx.status === 'APPROVED' ? invoiceIdFromReference(tx.reference) : null;
  if (!tx || !invoiceId) {
    // Otro evento, otro estado u otra referencia: no es un pago de corte. Se responde 200 para
    // que Wompi no lo repita.
    return NextResponse.json({ ok: true });
  }

  await db.transaction(async (q) => {
    // El bloqueo del corte ordena los avisos repetidos que llegan al mismo tiempo.
    const [inv] = await q.select().from(merchantInvoices).where(eq(merchantInvoices.id, invoiceId)).for('update');
    if (!inv) return;

    const [seen] = await q
      .select({ id: merchantPayments.id })
      .from(merchantPayments)
      .where(eq(merchantPayments.wompiTransactionId, tx.id))
      .limit(1);
    if (seen) return;

    const settlement = settleInvoice(tx, inv);
    const paid = settlement.action === 'pagar';
    await q.insert(merchantPayments).values({
      invoiceId: inv.id,
      merchantId: inv.merchantId,
      method: 'wompi',
      amountMinor: tx.amountInCents,
      reference: tx.id,
      wompiTransactionId: tx.id,
      note: paid ? null : settlement.note,
      status: paid ? 'aprobado' : 'reportado',
      reviewedAt: paid ? new Date() : null,
    });

    if (paid) {
      await q.update(merchantInvoices).set({ status: 'pagada', paidAt: new Date() }).where(eq(merchantInvoices.id, inv.id));
    } else if (inv.status === 'abierta' || inv.status === 'pendiente_pago') {
      await q.update(merchantInvoices).set({ status: 'en_verificacion' }).where(eq(merchantInvoices.id, inv.id));
    }
  });

  return NextResponse.json({ ok: true });
}
