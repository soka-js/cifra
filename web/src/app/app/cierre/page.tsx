import { CalendarCheck2, PiggyBank } from 'lucide-react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { loadCifra, loadCycleSnapshots, loadMovimientosInsights, loadSavingsSummary } from '@/lib/data';
import { shortDate } from '@/lib/engine/dates';
import { cop } from '@/lib/format';
import { CycleClosureForm } from './closure-form';

export const metadata = { title: 'Cierre de ciclo' };

export default async function CierrePage() {
  const user = await requireUser();
  const [cifra, insights, savings, snapshots] = await Promise.all([
    loadCifra(user),
    loadMovimientosInsights(user),
    loadSavingsSummary(user.id),
    loadCycleSnapshots(user.id),
  ]);

  const fixedMonthly = cifra.recurring.filter((r) => r.active).reduce((s, r) => s + r.monthlyMinor, 0);
  const deltaMinor = insights.breakdown.deltaTotalMinor;

  return (
    <div className="space-y-6">
      <div>
        <span className="badge-primary">Hábito de cierre</span>
        <h1 className="mt-2.5 font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">Cierre de ciclo</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          Antes de que entre tu próximo ingreso ({cifra.ready ? shortDate(cifra.nextIncomeOn) : 'tu fecha de pago'}), mira cómo cerró este periodo y elige un solo ajuste concreto.
        </p>
      </div>

      {!cifra.ready ? (
        <div className="surface-card p-6 text-[15px] text-ink-muted">
          <p>
            Calcula primero tu cifra para poder armar el resumen de cierre.{' '}
            <Link href="/app/bienvenida" className="font-semibold text-primary-dark underline">
              Empezar en 1 minuto →
            </Link>
          </p>
        </div>
      ) : (
        <>
          <section className="ticket-surface p-5 sm:p-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
              Resumen de los últimos 30 días
            </h2>

            <div className="tnum mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-[12.5px] text-ink-muted">Disponible hoy</p>
                <p className="mt-0.5 font-display text-[22px] font-extrabold text-ink">{cop(cifra.availableMinor)}</p>
              </div>
              <div>
                <p className="text-[12.5px] text-ink-muted">Gasto del mes</p>
                <p className="mt-0.5 font-display text-[22px] font-bold text-ink">
                  {cop(insights.breakdown.currentTotalMinor)}
                </p>
              </div>
              <div>
                <p className="text-[12.5px] text-ink-muted">Cobros fijos/mes</p>
                <p className="mt-0.5 font-display text-[22px] font-bold text-ink">{cop(fixedMonthly)}</p>
              </div>
              <div>
                <p className="text-[12.5px] text-ink-muted">Ahorrado con CIFRA</p>
                <p className="mt-0.5 font-display text-[22px] font-extrabold text-primary-dark">
                  {cop(savings.monthMinor)}
                </p>
              </div>
            </div>

            {insights.breakdown.previousTotalMinor > 0 && (
              <p className="mt-4 rounded-xl bg-paper px-3.5 py-2.5 text-[13.5px] text-ink-soft">
                {deltaMinor <= 0 ? (
                  <>
                    Este ciclo gastaste <strong className="tnum text-primary-dark">{cop(-deltaMinor)} menos</strong> que en los 30 días anteriores.
                  </>
                ) : (
                  <>
                    Este ciclo gastaste <strong className="tnum text-warn">{cop(deltaMinor)} más</strong> que en los 30 días anteriores.
                  </>
                )}
              </p>
            )}

            {insights.breakdown.rows.length > 0 && (
              <div className="mt-4 border-t border-dashed border-line-strong pt-4">
                <p className="text-[13px] font-semibold text-ink-muted">Categorías donde más se fue la plata</p>
                <ul className="tnum mt-2 space-y-1.5 text-[14px]">
                  {insights.breakdown.rows.slice(0, 3).map((r) => (
                    <li key={r.category} className="flex justify-between gap-3">
                      <span className="text-ink-soft">{r.label}</span>
                      <span className="font-semibold text-ink">{cop(r.currentMinor)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="surface-card p-5 sm:p-6">
            <h2 className="font-display text-[20px] font-bold text-ink">Tu compromiso para el próximo pago</h2>
            <p className="mt-1 text-[14px] text-ink-muted">
              Un cambio pequeño y medible funciona mejor que diez metas difíciles de sostener.
            </p>
            <div className="mt-4">
              <CycleClosureForm initialCommitment={snapshots[0]?.committedAction} />
            </div>
          </section>

          {snapshots.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="font-display text-[18px] font-bold text-ink">Cierres guardados</h2>
              <ul className="space-y-2.5">
                {snapshots.map((s) => (
                  <li key={s.id} className="surface-card p-4 text-[14px]">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-semibold text-ink">
                        <CalendarCheck2 size={15} className="text-primary" aria-hidden="true" />
                        <span>
                          {shortDate(s.cycleStart)} al {shortDate(s.cycleEnd)}
                        </span>
                      </span>
                      <span className="tnum inline-flex items-center gap-1 text-[13px] font-semibold text-primary-dark">
                        <PiggyBank size={14} aria-hidden="true" /> Ahorrado: {cop(s.savedMinor)} · Cierre: {cop(s.closingAvailableMinor)}
                      </span>
                    </div>
                    {s.committedAction && (
                      <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-[13.5px] text-ink-soft">
                        <strong>Compromiso:</strong> {s.committedAction}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
