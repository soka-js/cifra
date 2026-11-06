import { CheckCircle2, ExternalLink, HelpCircle, PiggyBank, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { loadCifra, loadMarksDetailed } from '@/lib/data';
import { shortDate } from '@/lib/engine/dates';
import { CATEGORY_LABEL, getCancellationGuide } from '@/lib/engine/merchant';
import type { RecurringSeries } from '@/lib/engine/recurring';
import { cop } from '@/lib/format';
import { confirmRecurringCancelled, keepCommitment, markRecurring, removeCommitment } from '../actions';

export const metadata = { title: 'Cobros recurrentes' };

const CADENCE: Record<RecurringSeries['cadence'], string> = {
  semanal: 'cada semana',
  quincenal: 'cada quince días',
  mensual: 'cada mes',
  bimestral: 'cada dos meses',
  trimestral: 'cada tres meses',
  anual: 'cada año',
};

function MarkButton({ k, mark, current, children }: { k: string; mark: string; current?: string; children: React.ReactNode }) {
  const active = current === mark;
  return (
    <form action={markRecurring}>
      <input type="hidden" name="key" value={k} />
      <input type="hidden" name="mark" value={active ? 'quitar' : mark} />
      <button
        type="submit"
        aria-pressed={active}
        className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
          active
            ? mark === 'no_lo_uso'
              ? 'border-terra bg-terra text-white'
              : 'border-ink bg-ink text-white'
            : 'border-line bg-white text-ink-muted hover:border-line-strong hover:text-ink'
        }`}
      >
        {children}
      </button>
    </form>
  );
}

export default async function CobrosPage() {
  const user = await requireUser();
  const [c, marksDetail] = await Promise.all([loadCifra(user), loadMarksDetailed(user.id)]);
  const all = c.recurring;
  const active = all.filter((r) => r.active);
  const inactive = all.filter((r) => !r.active);
  const totalMonthly = active.reduce((s, r) => s + r.monthlyMinor, 0);
  const totalHistorical = active.reduce((s, r) => s + r.historicalTotalMinor, 0);
  const unused = active.filter(
    (r) => marksDetail[r.merchantKey]?.mark === 'no_lo_uso' && !marksDetail[r.merchantKey]?.cancelledAt,
  );
  const unusedMonthly = unused.reduce((s, r) => s + r.monthlyMinor, 0);
  const hidden = Object.entries(marksDetail).filter(([, m]) => m.mark === 'no_es_fijo');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">Cobros recurrentes</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          Suscripciones, débitos automáticos y servicios que encontramos en tus movimientos, con cuánto llevas pagado en total y cómo cortar los que ya no usas.
        </p>
      </div>

      {active.length === 0 ? (
        <div className="surface-card p-6 text-[15px] text-ink-muted">
          <p>
            {c.historyDays > 0
              ? 'Todavía no vemos cobros repetidos en tus movimientos. Con dos o tres meses de extracto aparecen solos.'
              : 'Cuando subas un extracto, aquí aparecen tus suscripciones, cuotas de manejo y débitos automáticos, incluidos los que no recordabas.'}{' '}
            {c.historyDays === 0 && (
              <Link href="/app/datos/importar" className="font-semibold text-primary-dark underline underline-offset-2">
                Subir extracto
              </Link>
            )}
          </p>
        </div>
      ) : (
        <>
          <section className="surface-card p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">Comprometido al mes</p>
                <p className="tnum mt-1 font-display text-[38px] font-extrabold leading-none tracking-[-0.03em] text-ink">
                  {cop(totalMonthly)}
                </p>
              </div>
              <div className="sm:border-l sm:border-line sm:pl-5">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
                  Acumulado en tus extractos
                </p>
                <p className="tnum mt-1 font-display text-[28px] font-bold leading-tight text-ink-soft">
                  {cop(totalHistorical)}
                </p>
                <p className="text-[12.5px] text-ink-faint">Lo que ya salió de tu cuenta en estos cobros</p>
              </div>
            </div>

            {unusedMonthly > 0 && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-terra-pale px-4 py-3 text-[14px] text-terra-dark">
                <PiggyBank size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Si cancelas hoy lo que marcaste como «No lo uso», liberas{' '}
                  <strong className="tnum">{cop(unusedMonthly)}/mes</strong> (<strong className="tnum">{cop(unusedMonthly * 12)}</strong> al año).
                </span>
              </div>
            )}
          </section>

          <ul className="space-y-3.5">
            {active.map((r) => {
              const detail = marksDetail[r.merchantKey];
              const currentMark = detail?.mark;
              const isCancelled = Boolean(detail?.cancelledAt);
              const guide = getCancellationGuide(r.merchantKey, r.name, r.category);

              return (
                <li key={r.merchantKey} className="surface-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[17px] font-bold text-ink">{r.name}</p>
                        {isCancelled && (
                          <span className="badge-primary">
                            <CheckCircle2 size={13} aria-hidden="true" /> Cancelado · Ahorras {cop(r.monthlyMinor)}/mes
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[13px] text-ink-muted">
                        {CATEGORY_LABEL[r.category]} · {CADENCE[r.cadence]} · Próximo esperado: {shortDate(r.nextDate)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum text-[17px] font-bold text-ink">
                        {r.variableAmount ? 'aprox. ' : ''}
                        {cop(r.typicalMinor)}
                      </p>
                      <p className="tnum text-[12px] text-ink-faint">{cop(r.monthlyMinor)}/mes</p>
                    </div>
                  </div>

                  {/* Acumulado histórico visible por suscripción (aprendizaje clave I.5 #4) */}
                  <div className="tnum mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3.5 py-2 text-[13px] text-ink-soft">
                    <span>
                      Llevas pagados <strong className="font-bold text-ink">{cop(r.historicalTotalMinor)}</strong> en{' '}
                      {r.occurrences} {r.occurrences === 1 ? 'cobro' : 'cobros'} desde el {shortDate(r.firstDate)}
                    </span>
                    <span className="text-ink-faint">Equivale a {cop(r.monthlyMinor * 12)}/año</span>
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <MarkButton k={r.merchantKey} mark="lo_uso" current={currentMark}>
                      Sí lo uso
                    </MarkButton>
                    <MarkButton k={r.merchantKey} mark="no_lo_uso" current={currentMark}>
                      No lo uso
                    </MarkButton>
                    <MarkButton k={r.merchantKey} mark="no_es_fijo" current={currentMark}>
                      No es cobro fijo
                    </MarkButton>
                  </div>

                  {/* Guía accionable paso a paso de cancelación en Colombia (I.5 #5) */}
                  <details
                    open={currentMark === 'no_lo_uso' && !isCancelled}
                    className="mt-3.5 rounded-2xl border border-line bg-paper/70 px-4 py-3"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-2 text-[13.5px] font-semibold text-primary-dark">
                      <span className="flex items-center gap-1.5">
                        <HelpCircle size={15} aria-hidden="true" />
                        <span>
                          {guide.title} (~{guide.estimatedMinutes} min)
                        </span>
                      </span>
                      <span className="text-[12px] text-ink-faint">Ver pasos</span>
                    </summary>

                    <div className="mt-3 space-y-3 text-[13.5px] leading-relaxed text-ink-soft">
                      {guide.legalNote && (
                        <p className="flex items-start gap-2 rounded-xl bg-primary-pale px-3 py-2 text-[12.5px] text-primary-dark">
                          <ShieldAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                          <span>{guide.legalNote}</span>
                        </p>
                      )}
                      <ol className="list-decimal space-y-1.5 pl-5">
                        {guide.steps.map((st, idx) => (
                          <li key={idx}>{st}</li>
                        ))}
                      </ol>

                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        {guide.url && (
                          <a
                            href={guide.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-sm border border-line bg-white text-ink hover:bg-paper-warm"
                          >
                            Ir a cancelar en {r.name} <ExternalLink size={14} aria-hidden="true" />
                          </a>
                        )}
                        {!isCancelled && (
                          <form action={confirmRecurringCancelled}>
                            <input type="hidden" name="key" value={r.merchantKey} />
                            <input type="hidden" name="name" value={r.name} />
                            <input type="hidden" name="monthlyMinor" value={r.monthlyMinor} />
                            <button type="submit" className="btn-sm bg-primary text-white hover:bg-primary-dark">
                              <CheckCircle2 size={14} aria-hidden="true" /> Ya lo cancelé · Sumar {cop(r.monthlyMinor)}/mes a mi ahorro
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {c.commitments.length > 0 && (
        <section id="escritos" className="scroll-mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[18px] font-bold">Compromisos que escribiste a mano</h2>
            <Link href="/app/ajustes#cobros-fijos" className="text-[13.5px] font-semibold text-primary-dark underline-offset-2 hover:underline">
              Agregar o editar
            </Link>
          </div>
          <ul className="mt-2.5 divide-y divide-line rounded-2xl border border-line bg-white text-[14.5px] shadow-card">
            {c.commitments.map((x) => {
              const sug = c.commitmentSuggestions.find((g) => g.commitmentId === x.id);
              return (
                <li key={x.id} className="px-5 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="font-semibold text-ink">{x.name}</span>{' '}
                      <span className="text-ink-muted">· día {x.dayOfMonth} de cada mes</span>
                      {c.matchedCommitments.includes(x.id) && (
                        <span className="block text-[12.5px] text-ink-faint">
                          Ya aparece en tus movimientos: lo contamos una sola vez.
                        </span>
                      )}
                    </span>
                    <span className="tnum shrink-0 font-semibold text-ink">{cop(x.amountMinor)}</span>
                  </div>
                  {sug && (
                    <div className="mt-2.5 rounded-xl bg-warn-light px-3.5 py-3 text-[14px] text-warn">
                      <p>
                        ¿Es el mismo cobro que <strong>{sug.seriesName}</strong> ({cop(sug.seriesAmountMinor)}, día {sug.seriesDay})? Mientras no nos digas, contamos los dos.
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <form action={removeCommitment}>
                          <input type="hidden" name="id" value={x.id} />
                          <button type="submit" className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-white">
                            Sí, quitar el escrito a mano
                          </button>
                        </form>
                        <form action={keepCommitment}>
                          <input type="hidden" name="id" value={x.id} />
                          <input type="hidden" name="key" value={sug.seriesKey} />
                          <button
                            type="submit"
                            className="rounded-full border border-warn/40 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-ink"
                          >
                            No, son pagos distintos
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {inactive.length > 0 && (
        <section>
          <h2 className="font-display text-[17px] font-bold">Cobros anteriores que ya no se repiten</h2>
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-white text-[14px] shadow-card">
            {inactive.map((r) => (
              <li key={r.merchantKey} className="flex justify-between gap-3 px-5 py-3 text-ink-muted">
                <span>{r.name}</span>
                <span>Último cobro: {shortDate(r.lastDate)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hidden.length > 0 && (
        <section>
          <h2 className="text-[14px] font-semibold text-ink-muted">Marcados como «no es cobro fijo»</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {hidden.map(([key]) => (
              <li key={key}>
                <MarkButton k={key} mark="no_es_fijo" current="no_es_fijo">
                  {key.replace(/_/g, ' ')} · deshacer
                </MarkButton>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
