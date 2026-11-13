import { createHash, timingSafeEqual } from 'node:crypto';
import { cop } from '@/lib/format';

/**
 * Wompi, la pasarela con la que un negocio paga su corte de comisiones en línea (PSE, Nequi).
 * Funciones puras, sin base de datos. Hay dos firmas y las dos importan:
 *
 * - La de integridad va en el enlace de pago y amarra el monto a la referencia. Sin ella,
 *   cualquiera cambia `amount-in-cents` en la dirección y paga menos con la referencia del corte.
 * - La de eventos llega con cada aviso de Wompi y prueba que el aviso lo mandó Wompi.
 *
 * Aun con las dos, el aviso se revisa contra el corte: si el monto no alcanza, el corte no se
 * marca como pagado y el pago queda para que el equipo lo revise.
 */

export const WOMPI_REFERENCE_PREFIX = 'CIFRA-';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que Wompi tiene que firmar en el aviso para que creamos el id, el estado y el monto. */
export const REQUIRED_SIGNED_PROPERTIES = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] as const;

const sha256Hex = (text: string) => createHash('sha256').update(text).digest('hex');

export function invoiceReference(invoiceId: string): string {
  return `${WOMPI_REFERENCE_PREFIX}${invoiceId}`;
}

/** El id del corte dentro de la referencia, o null si la referencia no es de un corte de CIFRA. */
export function invoiceIdFromReference(reference: string): string | null {
  if (!reference.startsWith(WOMPI_REFERENCE_PREFIX)) return null;
  const id = reference.slice(WOMPI_REFERENCE_PREFIX.length);
  return UUID.test(id) ? id.toLowerCase() : null;
}

/** Firma de integridad de Wompi: SHA-256 de referencia + monto en centavos + moneda + secreto. */
export function integritySignature(reference: string, amountInCents: number, integritySecret: string): string {
  return sha256Hex(`${reference}${amountInCents}COP${integritySecret}`);
}

/** Enlace al pago en línea de un corte, con el monto firmado. */
export function checkoutUrl(opts: {
  publicKey: string;
  integritySecret: string;
  invoiceId: string;
  amountInCents: number;
  redirectUrl: string;
}): string {
  const reference = invoiceReference(opts.invoiceId);
  const params = new URLSearchParams({
    'public-key': opts.publicKey,
    currency: 'COP',
    'amount-in-cents': String(opts.amountInCents),
    reference,
    'signature:integrity': integritySignature(reference, opts.amountInCents, opts.integritySecret),
    'redirect-url': opts.redirectUrl,
  });
  return `https://checkout.wompi.co/p/?${params.toString()}`;
}

export interface WompiEventBody {
  event?: unknown;
  data?: unknown;
  signature?: { properties?: unknown; checksum?: unknown } | null;
  timestamp?: unknown;
}

function nestedValue(obj: unknown, dottedPath: string): string {
  let cur: unknown = obj;
  for (const part of dottedPath.split('.')) {
    if (cur && typeof cur === 'object' && Object.hasOwn(cur, part)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return '';
    }
  }
  return cur == null ? '' : String(cur);
}

/**
 * Comprueba la firma de un aviso de Wompi: SHA-256 de los valores de `signature.properties`
 * (en ese orden) + `timestamp` + secreto de eventos. Compara en tiempo constante y exige que la
 * firma cubra el id, el estado y el monto de la transacción.
 */
export function verifyEventSignature(body: WompiEventBody, eventsSecret: string): boolean {
  if (!eventsSecret) return false;
  const rawProps = body.signature?.properties;
  const props = Array.isArray(rawProps) ? rawProps.filter((p): p is string => typeof p === 'string') : [];
  if (!REQUIRED_SIGNED_PROPERTIES.every((p) => props.includes(p))) return false;

  const provided = typeof body.signature?.checksum === 'string' ? body.signature.checksum.toLowerCase() : '';
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;

  const ts = body.timestamp;
  if (!(typeof ts === 'number' && Number.isFinite(ts)) && !(typeof ts === 'string' && /^\d+$/.test(ts))) return false;

  const computed = sha256Hex(props.map((p) => nestedValue(body.data, p)).join('') + String(ts) + eventsSecret);
  return timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(provided, 'hex'));
}

export interface WompiTransaction {
  id: string;
  status: string;
  reference: string;
  amountInCents: number;
  currency: string;
}

/** La transacción de un aviso `transaction.updated`, o null si le falta algo. */
export function readTransaction(body: WompiEventBody): WompiTransaction | null {
  if (body.event !== 'transaction.updated') return null;
  const tx = body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>).transaction : null;
  if (!tx || typeof tx !== 'object') return null;
  const t = tx as Record<string, unknown>;
  const amount = t.amount_in_cents;
  if (typeof t.id !== 'string' || !t.id) return null;
  if (typeof t.status !== 'string' || typeof t.reference !== 'string') return null;
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0) return null;
  return {
    id: t.id,
    status: t.status,
    reference: t.reference,
    amountInCents: amount,
    currency: typeof t.currency === 'string' ? t.currency : '',
  };
}

export type InvoiceSettlement = { action: 'pagar' } | { action: 'revisar'; note: string };

/**
 * Qué hacer con un pago aprobado por Wompi frente al corte que dice pagar. Solo se marca pagado
 * si es en pesos y cubre el corte completo; lo demás queda reportado para que el equipo lo revise.
 * Nunca se pierde: el pago siempre se registra.
 */
export function settleInvoice(
  tx: Pick<WompiTransaction, 'amountInCents' | 'currency'>,
  invoice: { commissionTotalMinor: number; status: string },
): InvoiceSettlement {
  if (invoice.status === 'pagada' || invoice.status === 'anulada') {
    return { action: 'revisar', note: `Wompi aprobó un pago sobre un corte que ya estaba ${invoice.status}. Revisar si es un pago doble.` };
  }
  if (tx.currency !== 'COP') {
    return { action: 'revisar', note: `Wompi reporta el pago en "${tx.currency || 'sin moneda'}", no en pesos.` };
  }
  if (tx.amountInCents < invoice.commissionTotalMinor) {
    return {
      action: 'revisar',
      note: `Wompi aprobó ${cop(tx.amountInCents)} y el corte es de ${cop(invoice.commissionTotalMinor)}. Falta ${cop(invoice.commissionTotalMinor - tx.amountInCents)}.`,
    };
  }
  return { action: 'pagar' };
}
