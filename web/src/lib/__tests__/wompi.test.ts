import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  checkoutUrl,
  integritySignature,
  invoiceIdFromReference,
  readTransaction,
  settleInvoice,
  verifyEventSignature,
  type WompiEventBody,
} from '../payments/wompi';

const SECRET = 'secreto-de-eventos-de-prueba';
const INVOICE = '3f2b8c1e-6a4d-4e8f-9b1a-2c3d4e5f6a7b';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** Un aviso como los que manda Wompi, firmado con el secreto que se le pase. */
function signedEvent(tx: Record<string, unknown>, secret = SECRET, props = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']): WompiEventBody {
  const timestamp = 1_763_000_000;
  const data = { transaction: { ...tx } };
  const values = props.map((p) => String((tx as Record<string, unknown>)[p.replace('transaction.', '')] ?? '')).join('');
  return { event: 'transaction.updated', data, timestamp, signature: { properties: props, checksum: sha(values + timestamp + secret) } };
}

const TX = { id: '1234-1610641025-49201', status: 'APPROVED', reference: `CIFRA-${INVOICE}`, amount_in_cents: 90_000, currency: 'COP' };

describe('Wompi: enlace de pago', () => {
  it('la firma de integridad amarra referencia, monto y moneda', () => {
    expect(integritySignature(`CIFRA-${INVOICE}`, 90_000, 'llave')).toBe(sha(`CIFRA-${INVOICE}90000COPllave`));
    expect(integritySignature(`CIFRA-${INVOICE}`, 100, 'llave')).not.toBe(integritySignature(`CIFRA-${INVOICE}`, 90_000, 'llave'));
  });

  it('el enlace lleva el monto y su firma; el secreto nunca va en la dirección', () => {
    const url = new URL(
      checkoutUrl({ publicKey: 'pub_test_x', integritySecret: 'llave-secreta', invoiceId: INVOICE, amountInCents: 90_000, redirectUrl: 'https://micifra.vercel.app/negocio/cuenta' }),
    );
    expect(url.origin).toBe('https://checkout.wompi.co');
    expect(url.searchParams.get('amount-in-cents')).toBe('90000');
    expect(url.searchParams.get('currency')).toBe('COP');
    expect(url.searchParams.get('reference')).toBe(`CIFRA-${INVOICE}`);
    expect(url.searchParams.get('signature:integrity')).toBe(integritySignature(`CIFRA-${INVOICE}`, 90_000, 'llave-secreta'));
    expect(url.toString()).not.toContain('llave-secreta');
  });

  it('solo acepta referencias de un corte de CIFRA con un id bien formado', () => {
    expect(invoiceIdFromReference(`CIFRA-${INVOICE}`)).toBe(INVOICE);
    expect(invoiceIdFromReference(`CIFRA-${INVOICE.toUpperCase()}`)).toBe(INVOICE);
    expect(invoiceIdFromReference(INVOICE)).toBeNull();
    expect(invoiceIdFromReference('CIFRA-1; drop table')).toBeNull();
    expect(invoiceIdFromReference('OTRO-' + INVOICE)).toBeNull();
  });
});

describe('Wompi: firma de los avisos', () => {
  it('acepta un aviso firmado con el secreto', () => {
    expect(verifyEventSignature(signedEvent(TX), SECRET)).toBe(true);
  });

  it('rechaza un aviso firmado con otro secreto, o con el monto cambiado después de firmar', () => {
    expect(verifyEventSignature(signedEvent(TX, 'otro-secreto'), SECRET)).toBe(false);
    const tampered = signedEvent(TX);
    (tampered.data as { transaction: Record<string, unknown> }).transaction.amount_in_cents = 100;
    expect(verifyEventSignature(tampered, SECRET)).toBe(false);
  });

  it('rechaza una firma que no cubre el id, el estado y el monto', () => {
    expect(verifyEventSignature(signedEvent(TX, SECRET, ['transaction.id', 'transaction.status']), SECRET)).toBe(false);
    expect(verifyEventSignature(signedEvent(TX, SECRET, []), SECRET)).toBe(false);
  });

  it('rechaza avisos sin firma, con firma mal formada, sin hora o sin secreto configurado', () => {
    const good = signedEvent(TX);
    expect(verifyEventSignature({ ...good, signature: null }, SECRET)).toBe(false);
    expect(verifyEventSignature({ ...good, signature: { ...good.signature, checksum: 'abc' } }, SECRET)).toBe(false);
    expect(verifyEventSignature({ ...good, timestamp: undefined }, SECRET)).toBe(false);
    expect(verifyEventSignature(good, '')).toBe(false);
  });
});

describe('Wompi: qué se hace con un pago aprobado', () => {
  it('lee la transacción solo de un aviso transaction.updated completo', () => {
    expect(readTransaction(signedEvent(TX))).toEqual({ id: TX.id, status: 'APPROVED', reference: TX.reference, amountInCents: 90_000, currency: 'COP' });
    expect(readTransaction({ ...signedEvent(TX), event: 'nequi_token.updated' })).toBeNull();
    expect(readTransaction(signedEvent({ ...TX, amount_in_cents: '90000' }))).toBeNull();
    expect(readTransaction(signedEvent({ ...TX, id: undefined }))).toBeNull();
  });

  it('marca el corte como pagado solo si es en pesos y lo cubre completo', () => {
    const open = { commissionTotalMinor: 90_000, status: 'abierta' };
    expect(settleInvoice({ amountInCents: 90_000, currency: 'COP' }, open)).toEqual({ action: 'pagar' });
    expect(settleInvoice({ amountInCents: 95_000, currency: 'COP' }, open)).toEqual({ action: 'pagar' });
  });

  it('un pago que no alcanza queda para revisar y dice cuánto falta', () => {
    const r = settleInvoice({ amountInCents: 100, currency: 'COP' }, { commissionTotalMinor: 90_000, status: 'abierta' });
    expect(r).toEqual({ action: 'revisar', note: 'Wompi aprobó $1 y el corte es de $900. Falta $899.' });
  });

  it('otra moneda, o un corte ya pagado o anulado, también quedan para revisar', () => {
    expect(settleInvoice({ amountInCents: 90_000, currency: 'USD' }, { commissionTotalMinor: 90_000, status: 'abierta' }).action).toBe('revisar');
    expect(settleInvoice({ amountInCents: 90_000, currency: 'COP' }, { commissionTotalMinor: 90_000, status: 'pagada' }).action).toBe('revisar');
    expect(settleInvoice({ amountInCents: 90_000, currency: 'COP' }, { commissionTotalMinor: 90_000, status: 'anulada' }).action).toBe('revisar');
  });
});
