'use client';

import { useState } from 'react';
import { computeRedemptionSplit } from '@/lib/engine/attribution';
import { cop, formatThousands } from '@/lib/format';

export function B2B2CSimulator() {
  const [members, setMembers] = useState(5000);
  const [redemptionsPerMemberMonth, setRedemptionsPerMemberMonth] = useState(1.5);
  const [avgTicketPesos, setAvgTicketPesos] = useState(22000);
  const [discountPct, setDiscountPct] = useState(10);

  const singleSplit = computeRedemptionSplit({
    grossAmountMinor: avgTicketPesos * 100,
    discountKind: 'percent',
    discountPercent: discountPct,
    commissionBps: 500,
    channel: 'aliado',
    partnerShareBps: 3000,
  });

  const monthlyTransactions = Math.round(members * redemptionsPerMemberMonth);
  const monthlyPartnerRevenueMinor = monthlyTransactions * singleSplit.partnerShareMinor;
  const monthlyMemberSavingsMinor = monthlyTransactions * singleSplit.discountMinor;

  return (
    <div className="my-6 rounded-2xl border border-line bg-paper p-5 sm:p-6 not-prose">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="badge-primary">Calculadora de reparto · 70 / 30</span>
          <h3 className="mt-1.5 font-display text-[20px] font-bold text-ink">
            Calcula el ahorro para tus asociados y tu ingreso por reparto (30 %)
          </h3>
          <p className="mt-1 text-[13px] text-ink-muted">
            Los valores con los que abre son un ejemplo, no datos de una entidad. Cámbialos por los tuyos.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Asociados con CIFRA activo</label>
          <input
            type="number"
            min={100}
            max={500000}
            step={100}
            value={members}
            onChange={(e) => setMembers(Math.max(0, Number(e.target.value)))}
            className="field py-2 text-[14.5px] tnum"
          />
        </div>
        <div>
          <label className="label">Ofertas redimidas / asociado / mes</label>
          <input
            type="number"
            min={0.2}
            max={20}
            step={0.1}
            value={redemptionsPerMemberMonth}
            onChange={(e) => setRedemptionsPerMemberMonth(Math.max(0, Number(e.target.value)))}
            className="field py-2 text-[14.5px] tnum"
          />
        </div>
        <div>
          <label className="label">Ticket promedio en comercio ($)</label>
          <input
            type="number"
            min={5000}
            max={200000}
            step={1000}
            value={avgTicketPesos}
            onChange={(e) => setAvgTicketPesos(Math.max(5000, Number(e.target.value)))}
            className="field py-2 text-[14.5px] tnum"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-[12px] text-ink-muted">Ahorro directo para tus asociados / mes</p>
          <p className="tnum mt-1 font-display text-[24px] font-bold text-primary-dark">
            {cop(monthlyMemberSavingsMinor)}
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-faint">
            ({discountPct} % de descuento asumido por comercios aliados)
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-[12px] text-ink-muted">Ingreso mensual para tu entidad (30 %)</p>
          <p className="tnum mt-1 font-display text-[24px] font-bold text-ink">
            {cop(monthlyPartnerRevenueMinor)}
          </p>
          <p className="tnum mt-0.5 text-[11.5px] text-ink-faint">
            {cop(singleSplit.partnerShareMinor)} por cada venta ({formatThousands(monthlyTransactions)} ventas/mes)
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-[12px] text-ink-muted">Costo fijo para tu entidad o el asociado</p>
          <p className="tnum mt-1 font-display text-[24px] font-bold text-primary-dark">$0</p>
          <p className="mt-0.5 text-[11.5px] text-ink-faint">
            Sin licencias por asiento ni cobros al usuario final
          </p>
        </div>
      </div>
    </div>
  );
}
