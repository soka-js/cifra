'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { useTransition } from 'react';
import { toggleCycleChargePaidAction } from '@/app/actions/v3';
import type { PendingCharge } from '@/lib/engine/cifra';
import { cop, shortDate } from '@/lib/format';

/**
 * Los cobros fijos que la cifra tiene apartados hasta el próximo pago. Si la persona ya pagó uno
 * y su saldo ya lo refleja, lo marca y deja de restarse (para no contarlo dos veces).
 */
export function PendingCharges({
  pending,
  paid,
  cycleEnd,
}: {
  pending: PendingCharge[];
  paid: Array<{ id: string; chargeKey: string; label: string; amountMinor: number }>;
  cycleEnd: string;
}) {
  const [busy, startTransition] = useTransition();

  function toggle(p: { chargeKey: string; label: string; amountMinor: number; markPaid: boolean }) {
    const fd = new FormData();
    fd.set('chargeKey', p.chargeKey);
    fd.set('label', p.label);
    fd.set('cycleEnd', cycleEnd);
    fd.set('amountMinor', String(p.amountMinor));
    fd.set('markPaid', p.markPaid ? 'true' : 'false');
    fd.set('deductBalance', 'false');
    startTransition(async () => {
      await toggleCycleChargePaidAction(fd);
    });
  }

  if (pending.length === 0 && paid.length === 0) return null;

  return (
    <details className="-mt-1">
      <summary className="cursor-pointer text-[13px] font-semibold text-primary-dark">Ver los cobros de este ciclo</summary>
      <p className="mt-2 text-[12.5px] text-ink-faint">Si ya pagaste uno y tu saldo ya lo refleja, tócalo para dejar de restarlo.</p>
      <ul className="tnum mt-1.5 divide-y divide-line text-[13.5px]">
        {pending.map((item) => (
          <li key={`${item.key}-${item.date}`} className="flex items-center justify-between gap-3 py-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => toggle({ chargeKey: item.key, label: item.name, amountMinor: item.amountMinor, markPaid: true })}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left hover:text-primary-dark"
            >
              <Circle size={17} className="shrink-0 text-ink-faint" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{item.name}</span>
                <span className="block text-[12px] text-ink-faint">
                  {shortDate(item.date)}
                  {item.estimated ? ' · monto aproximado' : ''}
                </span>
              </span>
            </button>
            <span className="shrink-0 font-semibold text-ink">{cop(item.amountMinor)}</span>
          </li>
        ))}
        {paid.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2 opacity-75">
            <button
              type="button"
              disabled={busy}
              onClick={() => toggle({ chargeKey: p.chargeKey, label: p.label, amountMinor: p.amountMinor, markPaid: false })}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <CheckCircle2 size={17} className="shrink-0 text-primary-dark" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink line-through">{p.label}</span>
                <span className="block text-[12px] text-primary-dark">Ya pagado. Toca para deshacer.</span>
              </span>
            </button>
            <span className="shrink-0 font-medium text-ink-faint">{cop(p.amountMinor)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
