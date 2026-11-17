import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as wompiPost } from '@/app/api/webhooks/wompi/route';
import { db } from '@/lib/db';
import { merchantInvoices, merchantPayments } from '@/lib/db/schema';
import { buildWorld, loginAs, truncateAll, type World } from './world';

/**
 * El aviso de Wompi es la única ruta que marca un corte de comisiones como pagado sin que nadie
 * lo revise. Se prueba que un aviso sin la firma no cambia nada, que un pago que no cubre el corte
 * no lo marca como pagado y que un aviso repetido se registra una sola vez.
 */

const SECRET = 'secreto-eventos-wompi-de-prueba';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

let w: World;
let previousSecret: string | undefined;

beforeEach(async () => {
  await truncateAll();
  w = await buildWorld();
  await loginAs(null);
  previousSecret = process.env.WOMPI_EVENTS_SECRET;
  process.env.WOMPI_EVENTS_SECRET = SECRET;
});

afterEach(() => {
  if (previousSecret === undefined) delete process.env.WOMPI_EVENTS_SECRET;
  else process.env.WOMPI_EVENTS_SECRET = previousSecret;
});

function aviso(tx: { id: string; status: string; reference: string; amount_in_cents: number; currency?: string }, secret = SECRET) {
  const timestamp = 1_763_000_000;
  const checksum = sha(`${tx.id}${tx.status}${tx.amount_in_cents}${timestamp}${secret}`);
  return {
    event: 'transaction.updated',
    data: { transaction: { currency: 'COP', ...tx } },
    timestamp,
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], checksum },
  };
}

const post = (body: unknown) =>
  wompiPost(
    new NextRequest('http://localhost:3000/api/webhooks/wompi', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  );

async function invoiceStatus() {
  const [inv] = await db.select().from(merchantInvoices).where(eq(merchantInvoices.id, w.victimInvoice.id));
  return inv!.status;
}
const wompiPayments = () => db.select().from(merchantPayments).where(eq(merchantPayments.method, 'wompi'));

describe('POST /api/webhooks/wompi', () => {
  const ref = () => `CIFRA-${w.victimInvoice.id}`;
  const due = () => w.victimInvoice.commissionTotalMinor;

  it('sin el secreto de eventos configurado: 503 y no toca nada', async () => {
    delete process.env.WOMPI_EVENTS_SECRET;
    const res = await post(aviso({ id: 'tx-1', status: 'APPROVED', reference: ref(), amount_in_cents: due() }));
    expect(res.status).toBe(503);
    expect(await invoiceStatus()).toBe('abierta');
    expect(await wompiPayments()).toEqual([]);
  });

  it('un aviso firmado con otro secreto: 401, el corte sigue abierto y no hay pago', async () => {
    const res = await post(aviso({ id: 'tx-1', status: 'APPROVED', reference: ref(), amount_in_cents: due() }, 'otro-secreto'));
    expect(res.status).toBe(401);
    expect(await invoiceStatus()).toBe('abierta');
    expect(await wompiPayments()).toEqual([]);
  });

  it('un pago aprobado que no cubre el corte no lo marca pagado: queda para revisar', async () => {
    const res = await post(aviso({ id: 'tx-poquito', status: 'APPROVED', reference: ref(), amount_in_cents: 100 }));
    expect(res.status).toBe(200);
    expect(await invoiceStatus()).toBe('en_verificacion');
    const [payment] = await wompiPayments();
    expect(payment).toMatchObject({ status: 'reportado', amountMinor: 100, wompiTransactionId: 'tx-poquito', invoiceId: w.victimInvoice.id });
    expect(payment!.note).toMatch(/Falta/);
  });

  it('el pago completo marca el corte como pagado, y el mismo aviso repetido no registra otro pago', async () => {
    const body = aviso({ id: 'tx-completo', status: 'APPROVED', reference: ref(), amount_in_cents: due() });
    expect((await post(body)).status).toBe(200);
    expect((await post(body)).status).toBe(200);
    expect(await invoiceStatus()).toBe('pagada');
    const payments = await wompiPayments();
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ status: 'aprobado', amountMinor: due(), merchantId: w.victimMerchant.id });
  });

  it('avisos que no son un pago aprobado de un corte no cambian nada', async () => {
    for (const tx of [
      { id: 'tx-a', status: 'DECLINED', reference: ref(), amount_in_cents: due() },
      { id: 'tx-b', status: 'APPROVED', reference: 'OTRA-REFERENCIA', amount_in_cents: due() },
      { id: 'tx-c', status: 'APPROVED', reference: 'CIFRA-no-es-un-id', amount_in_cents: due() },
      { id: 'tx-d', status: 'APPROVED', reference: 'CIFRA-00000000-0000-4000-8000-000000000000', amount_in_cents: due() },
    ]) {
      expect((await post(aviso(tx))).status).toBe(200);
    }
    expect(await invoiceStatus()).toBe('abierta');
    expect(await wompiPayments()).toEqual([]);
  });
});
