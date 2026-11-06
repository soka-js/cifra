'use client';

import { CheckCircle2, Circle, Flame, ShieldCheck, TrendingUp } from 'lucide-react';
import { useTransition } from 'react';
import { toggleCycleChargePaidAction } from '@/app/actions/v3';
import { QuickCaptureModal } from '@/components/app/quick-capture-modal';
import type { PaidCycleCharge } from '@/lib/db/schema';
import type { PendingCharge } from '@/lib/engine/cifra';
import type { DailyPulse } from '@/lib/engine/daily-value';
import { cop, shortDate } from '@/lib/format';

interface DailyPulseCardProps {
  pulse: DailyPulse;
  pendingCharges: PendingCharge[];
  paidCharges: PaidCycleCharge[];
  cycleEnd: string;
  captureAccounts: Array<{ id: string; name: string; balanceMinor: number | null }>;
  todayIso: string;
  currentHour: number;
}

export function DailyPulseCard({
  pulse,
  pendingCharges,
  paidCharges,
  cycleEnd,
  captureAccounts,
  todayIso,
  currentHour,
}: DailyPulseCardProps) {
  const [isPending, startTransition] = useTransition();

  const barPct = Math.min(100, Math.max(4, pulse.usedPct));
  const barColor =
    pulse.status === 'pasado'
      ? 'bg-neg'
      : pulse.status === 'al_limite'
        ? 'bg-warn'
        : 'bg-primary';

  const hasChecklist = pendingCharges.length > 0 || paidCharges.length > 0;

  function handleToggleCharge(params: {
    chargeKey: string;
    label: string;
    amountMinor: number;
    markPaid: boolean;
  }) {
    const fd = new FormData();
    fd.set('chargeKey', params.chargeKey);
    fd.set('label', params.label);
    fd.set('cycleEnd', cycleEnd);
    fd.set('amountMinor', String(params.amountMinor));
    fd.set('markPaid', params.markPaid ? 'true' : 'false');
    fd.set('deductBalance', 'false');
    startTransition(async () => {
      await toggleCycleChargePaidAction(fd);
    });
  }

  return (
    <div className="space-y-4">
      {/* Tarjeta 1: Tu Tope de Hoy Vivo */}
      <section className="surface-card border-primary/25 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={
                  pulse.status === 'pasado'
                    ? 'badge-neg'
                    : pulse.status === 'al_limite'
                      ? 'badge-warn'
                      : 'badge-primary'
                }
              >
                <Flame size={12} aria-hidden="true" />
                {pulse.status === 'pasado'
                  ? 'Hoy te pasaste del tope sugerido'
                  : pulse.status === 'al_limite'
                    ? 'Cerca de tu tope de hoy'
                    : 'Tu tope de hoy vivo'}
              </span>
              <span className="text-[12px] text-ink-faint">
                {pulse.todayTxCount === 0
                  ? '0 gastos anotados hoy'
                  : `${pulse.todayTxCount} ${pulse.todayTxCount === 1 ? 'gasto hoy' : 'gastos hoy'}`}
              </span>
            </div>

            <p className="mt-2.5 text-[13.5px] font-medium text-ink-muted">
              {pulse.remainingTodayMinor >= 0
                ? 'Te quedan libres hoy sin tocar tus fijos'
                : 'Exceso de hoy (se compensa suave en los próximos días)'}
            </p>
            <div className="tnum mt-0.5 flex items-baseline gap-2.5">
              <span
                className={`font-display text-[36px] font-extrabold leading-none tracking-[-0.03em] ${
                  pulse.remainingTodayMinor < 0 ? 'text-neg' : 'text-ink'
                }`}
              >
                {cop(Math.abs(pulse.remainingTodayMinor))}
              </span>
              <span className="text-[13.5px] text-ink-faint">
                de {cop(pulse.dailyAllowanceMinor)} hoy
              </span>
            </div>
          </div>

          <QuickCaptureModal
            accounts={captureAccounts}
            todayIso={todayIso}
            currentHour={currentHour}
            buttonLabel="Anotar gasto / SMS"
            buttonClassName="btn-ink shrink-0 text-[13.5px]"
          />
        </div>

        {/* Barra de progreso del día */}
        <div className="mt-4">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper-deep">
            <div
              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <div className="tnum mt-2 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-muted">
            <span>Gastado hoy: {cop(pulse.todaySpentMinor)}</span>
            <span className="inline-flex items-center gap-1 font-semibold text-primary-dark">
              <TrendingUp size={13} aria-hidden="true" />
              Si cierras así hoy, mañana tu tope será {cop(pulse.tomorrowAllowanceMinor)}
              {pulse.tomorrowDeltaMinor > 0 ? ` (+${cop(pulse.tomorrowDeltaMinor)})` : ''}
            </span>
          </div>
        </div>
      </section>

      {/* Tarjeta 2: Checklist de Intocables de la Quincena */}
      {hasChecklist && (
        <section className="surface-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary-dark" aria-hidden="true" />
              <h2 className="font-display text-[17px] font-bold text-ink">
                Intocables reservados hasta el {shortDate(cycleEnd)}
              </h2>
            </div>
            <span className="text-[12px] text-ink-faint">
              Toca cuando ya esté pagado y tu saldo ya lo refleje
            </span>
          </div>

          <ul className="tnum mt-3 divide-y divide-line text-[14px]">
            {pendingCharges.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 py-2.5">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    handleToggleCharge({
                      chargeKey: item.key,
                      label: item.name,
                      amountMinor: item.amountMinor,
                      markPaid: true,
                    })
                  }
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left hover:text-primary-dark"
                >
                  <Circle size={18} className="shrink-0 text-ink-faint" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{item.name}</span>
                    <span className="block text-[12px] text-ink-faint">
                      Previsto {shortDate(item.date)} {item.estimated ? '· estimado' : '· compromiso fijo'}
                    </span>
                  </span>
                </button>
                <span className="shrink-0 font-semibold text-ink">{cop(item.amountMinor)}</span>
              </li>
            ))}

            {paidCharges.map((paid) => (
              <li key={paid.id} className="flex items-center justify-between gap-3 py-2.5 opacity-75">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    handleToggleCharge({
                      chargeKey: paid.chargeKey,
                      label: paid.label,
                      amountMinor: paid.amountMinor,
                      markPaid: false,
                    })
                  }
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <CheckCircle2 size={18} className="shrink-0 text-primary-dark" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink line-through">{paid.label}</span>
                    <span className="block text-[12px] text-primary-dark">
                      Ya cubierto en este ciclo (toca para deshacer)
                    </span>
                  </span>
                </button>
                <span className="shrink-0 text-[13px] font-medium text-ink-faint">
                  {cop(paid.amountMinor)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
