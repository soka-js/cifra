'use client';

import { useState } from 'react';
import { computeRedemptionSplit } from '@/lib/engine/attribution';
import { cop } from '@/lib/format';

export function MerchantCalculator() {
  const [ticketPesos, setTicketPesos] = useState(20000);
  const [discountPct, setDiscountPct] = useState(10);

  const split = computeRedemptionSplit({
    grossAmountMinor: ticketPesos * 100,
    discountKind: 'percent',
    discountPercent: discountPct,
    commissionBps: 500,
  });

  return (
    <div className="ticket-surface p-6 sm:p-7">
      <div className="flex items-baseline justify-between border-b border-line pb-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wider text-terra-dark">
            Calculadora transparente para tu mostrador
          </p>
          <h3 className="mt-1 font-display text-[22px] font-bold text-ink">
            Paga solo cuando ya vendiste
          </h3>
        </div>
        <span className="tnum text-[13px] font-bold text-primary-dark">$0 fijo / mes</span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="calc-ticket" className="label">
            Pedido en tu local ($)
          </label>
          <select
            id="calc-ticket"
            value={ticketPesos}
            onChange={(e) => setTicketPesos(Number(e.target.value))}
            className="field py-2.5 text-[15px] tnum"
          >
            <option value={12000}>$12,000 (café + panadería)</option>
            <option value={20000}>$20,000 (pedido típico barrio)</option>
            <option value={35000}>$35,000 (almuerzo o fruver)</option>
            <option value={50000}>$50,000 (compra familiar)</option>
          </select>
        </div>

        <div>
          <label htmlFor="calc-disc" className="label">
            Descuento que ofreces al cliente nuevo
          </label>
          <select
            id="calc-disc"
            value={discountPct}
            onChange={(e) => setDiscountPct(Number(e.target.value))}
            className="field py-2.5 text-[15px] tnum"
          >
            <option value={8}>8 % de bienvenida</option>
            <option value={10}>10 % de bienvenida</option>
            <option value={15}>15 % horas tranquilas</option>
            <option value={20}>20 % primera visita</option>
          </select>
        </div>
      </div>

      <dl className="mt-5 space-y-2.5 text-[14.5px]">
        <div className="flex justify-between">
          <dt className="text-ink-soft">Valor normal del pedido</dt>
          <dd className="tnum font-semibold text-ink">{cop(split.grossAmountMinor)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Descuento para atraer al vecino nuevo ({discountPct} %)</dt>
          <dd className="tnum text-ink-muted">−{cop(split.discountMinor)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2">
          <dt className="font-semibold text-ink">Cobras en tu caja al instante</dt>
          <dd className="tnum font-bold text-ink">{cop(split.netPaidByUserMinor)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Comisión CIFRA (5 % sobre lo cobrado, a fin de mes)</dt>
          <dd className="tnum font-semibold text-terra-dark">−{cop(split.cifraCommissionMinor)}</dd>
        </div>
      </dl>

      <div className="mt-4 rounded-2xl bg-primary-pale p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[14px] font-bold text-primary-dark">Te quedan libres en tu caja</span>
          <span className="tnum font-display text-[30px] font-extrabold leading-none text-primary-dark">
            {cop(split.merchantNetKeepMinor)}
          </span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-snug text-ink-soft">
          Y cuando ese vecino vuelva la próxima semana sin descuento, te queda el <strong>100 %</strong> de la venta ($0 comisión).
        </p>
      </div>
    </div>
  );
}
