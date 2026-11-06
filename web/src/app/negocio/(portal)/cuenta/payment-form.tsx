'use client';

import { CheckCircle2, CreditCard, Send } from 'lucide-react';
import { useActionState } from 'react';
import { reportMerchantPayment, type MerchantActionState } from '@/app/actions/merchant';
import { cop } from '@/lib/format';

const INITIAL: MerchantActionState = { status: 'idle' };

export function PaymentReportForm({
  invoiceId,
  periodLabel,
  amountMinor,
  wompiPublicKey,
  siteUrl,
}: {
  invoiceId: string;
  periodLabel: string;
  amountMinor: number;
  wompiPublicKey?: string;
  siteUrl: string;
}) {
  const [state, action, pending] = useActionState(reportMerchantPayment, INITIAL);

  const wompiUrl = wompiPublicKey
    ? `https://checkout.wompi.co/p/?public-key=${encodeURIComponent(wompiPublicKey)}&currency=COP&amount-in-cents=${amountMinor}&reference=${encodeURIComponent(`CIFRA-${invoiceId}`)}&redirect-url=${encodeURIComponent(`${siteUrl}/negocio/cuenta`)}`
    : null;

  return (
    <div className="space-y-4">
      {wompiUrl && (
        <a
          href={wompiUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-primary w-full text-[15px]"
        >
          <CreditCard size={17} aria-hidden="true" />
          Pagar {cop(amountMinor)} en línea con PSE / Nequi (Wompi)
        </a>
      )}

      <form action={action} className="space-y-3.5 rounded-2xl border border-line bg-paper p-4">
        <input type="hidden" name="invoiceId" value={invoiceId} />

        <p className="text-[14px] font-bold text-ink">
          Reportar pago realizado por Bre-B, Nequi o transferencia ({periodLabel})
        </p>

        {state.status === 'ok' && (
          <div className="flex items-center gap-2 rounded-xl bg-primary-pale px-3.5 py-2.5 text-[13.5px] font-medium text-primary-dark">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{state.message}</span>
          </div>
        )}

        {state.status === 'error' && (
          <div role="alert" className="rounded-xl bg-neg-light px-3.5 py-2.5 text-[13.5px] text-neg">
            {state.message}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`method-${invoiceId}`} className="label">
              Medio usado
            </label>
            <select id={`method-${invoiceId}`} name="method" defaultValue="breb" className="field py-2.5 text-[14.5px]">
              <option value="breb">Llave Bre-B</option>
              <option value="nequi">Nequi</option>
              <option value="transferencia">Transferencia bancaria</option>
            </select>
          </div>

          <div>
            <label htmlFor={`ref-${invoiceId}`} className="label">
              Número de comprobante / referencia
            </label>
            <input
              id={`ref-${invoiceId}`}
              name="reference"
              type="text"
              required
              minLength={4}
              placeholder="Ej. M9482014"
              className="field py-2.5 text-[14.5px]"
            />
          </div>
        </div>

        <div>
          <label htmlFor={`note-${invoiceId}`} className="label">
            Nota opcional
          </label>
          <input
            id={`note-${invoiceId}`}
            name="note"
            type="text"
            placeholder="Ej. Enviado desde el Nequi de Rosa"
            className="field py-2 text-[14px]"
          />
        </div>

        <button type="submit" disabled={pending} className="btn-terra w-full sm:w-auto">
          <Send size={15} aria-hidden="true" />
          {pending ? 'Enviando comprobante...' : `Confirmar envío de ${cop(amountMinor)}`}
        </button>
      </form>
    </div>
  );
}
