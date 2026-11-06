import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { merchantInvoices, merchantPayments } from '@/lib/db/schema';

function getNestedValue(obj: unknown, dottedPath: string): string {
  const parts = dottedPath.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return '';
    }
  }
  return cur == null ? '' : String(cur);
}

/**
 * Webhook oficial de Wompi Colombia para conciliar automáticamente pagos en línea
 * (PSE / Nequi / Botón Bancolombia) de estados de cuenta mensuales de comercios.
 */
export async function POST(request: NextRequest) {
  const eventsSecret = process.env.WOMPI_EVENTS_SECRET;
  if (!eventsSecret) {
    return NextResponse.json({ ok: false, error: 'Wompi no configurado' }, { status: 503 });
  }

  let body: {
    event?: string;
    data?: Record<string, unknown>;
    signature?: { properties?: string[]; checksum?: string };
    timestamp?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const props = body.signature?.properties ?? [];
  const providedChecksum = (body.signature?.checksum ?? '').toLowerCase();
  const timestamp = body.timestamp ?? '';

  const concatenated =
    props.map((prop) => getNestedValue(body.data, prop)).join('') + String(timestamp) + eventsSecret;
  const computed = createHash('sha256').update(concatenated).digest('hex').toLowerCase();

  if (!providedChecksum || computed !== providedChecksum) {
    return NextResponse.json({ ok: false, error: 'Firma inválida' }, { status: 401 });
  }

  if (body.event === 'transaction.updated') {
    const tx = (body.data?.transaction ?? {}) as {
      id?: string;
      status?: string;
      reference?: string;
      amount_in_cents?: number;
    };

    const ref = tx.reference ?? '';
    if (tx.status === 'APPROVED' && ref.startsWith('CIFRA-')) {
      const invoiceId = ref.slice('CIFRA-'.length);
      const [inv] = await db
        .select()
        .from(merchantInvoices)
        .where(eq(merchantInvoices.id, invoiceId))
        .limit(1);

      if (inv) {
        await db.insert(merchantPayments).values({
          invoiceId: inv.id,
          merchantId: inv.merchantId,
          method: 'wompi',
          amountMinor: tx.amount_in_cents ?? inv.commissionTotalMinor,
          reference: tx.id ?? ref,
          status: 'aprobado',
          reviewedAt: new Date(),
        });

        await db
          .update(merchantInvoices)
          .set({ status: 'pagada', paidAt: new Date() })
          .where(eq(merchantInvoices.id, inv.id));
      }
    }
  }

  return NextResponse.json({ ok: true });
}
