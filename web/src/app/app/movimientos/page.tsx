import { Coffee, Search, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { loadMovimientosInsights } from '@/lib/data';
import { shortDate } from '@/lib/engine/dates';
import { CATEGORY_LABEL, EDITABLE_CATEGORIES, type Category } from '@/lib/engine/merchant';
import { cop } from '@/lib/format';
import { toggleExcluded } from '../actions';
import { ReclassifyChip } from './reclassify-chip';

export const metadata = { title: 'En qué se me va' };

export default async function MovimientosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 60);
  const catParam = sp.cat as Category | undefined;
  const activeCat = catParam && EDITABLE_CATEGORIES.includes(catParam) ? catParam : null;

  const { breakdown, antExpenses, movements } = await loadMovimientosInsights(user, q, activeCat);

  const deltaPct =
    breakdown.previousTotalMinor > 0
      ? Math.round(((breakdown.currentTotalMinor - breakdown.previousTotalMinor) / breakdown.previousTotalMinor) * 100)
      : null;

  const groups = new Map<string, typeof movements>();
  for (const r of movements) {
    const list = groups.get(r.postedOn) ?? [];
    list.push(r);
    groups.set(r.postedOn, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">En qué se me va</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">
            Tus gastos clasificados automáticamente. Toca cualquier etiqueta para reclasificar un comercio hacia atrás y hacia adelante en un toque.
          </p>
        </div>
        <Link href="/app/datos/importar" className="btn-sm border border-line bg-white text-ink hover:bg-paper-warm">
          <Upload size={15} aria-hidden="true" /> Subir extracto
        </Link>
      </div>

      {/* Comparativo de ciclo actual (30d) vs ciclo anterior (30d previos) */}
      {!q && breakdown.rows.length > 0 && (
        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
                Últimos 30 días (sin traslados propios)
              </h2>
              <p className="tnum mt-1 font-display text-[34px] font-extrabold leading-none tracking-[-0.03em] text-ink">
                {cop(breakdown.currentTotalMinor)}
              </p>
            </div>
            {deltaPct !== null && (
              <span className={deltaPct <= 0 ? 'badge-primary tnum' : 'badge-warn tnum'}>
                {deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`} vs. 30 días previos ({cop(breakdown.previousTotalMinor)})
              </span>
            )}
          </div>

          <ul className="tnum mt-5 space-y-3 text-[14.5px]">
            {breakdown.rows.slice(0, 8).map((row) => {
              const isSelected = activeCat === row.category;
              return (
                <li key={row.category}>
                  <Link
                    href={isSelected ? '/app/movimientos' : `/app/movimientos?cat=${row.category}`}
                    className={`block rounded-xl px-2.5 py-2 transition-colors ${
                      isSelected ? 'bg-primary-pale ring-1 ring-primary/30' : 'hover:bg-paper'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-ink">
                        {row.label}{' '}
                        <span className="text-[12px] font-normal text-ink-faint">
                          ({row.txCount} {row.txCount === 1 ? 'compra' : 'compras'})
                        </span>
                      </span>
                      <span className="flex items-baseline gap-2">
                        {row.deltaPercent !== null && row.previousMinor > 0 && (
                          <span
                            className={`text-[12px] font-semibold ${
                              row.deltaPercent > 10 ? 'text-warn' : row.deltaPercent < -5 ? 'text-primary-dark' : 'text-ink-faint'
                            }`}
                          >
                            {row.deltaPercent > 0 ? `+${row.deltaPercent}%` : `${row.deltaPercent}%`}
                          </span>
                        )}
                        <span className="font-semibold text-ink">{cop(row.currentMinor)}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-paper-deep" aria-hidden="true">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${Math.max(3, row.sharePercent)}%` }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Detector de gastos hormiga (Etapa 1 del mapa C.5) */}
      {!q && !activeCat && antExpenses.length > 0 && (
        <section className="surface-card border-terra/25 bg-terra-pale/60 p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-terra-light text-terra-dark">
              <Coffee size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[17px] font-bold text-ink">Gastos hormiga del último mes</h2>
              <p className="mt-0.5 text-[13.5px] text-ink-muted">
                Compras pequeñas repetidas que pasan desapercibidas solas, pero sumadas mueven tu cifra:
              </p>
              <ul className="tnum mt-3 divide-y divide-line/80 text-[14px]">
                {antExpenses.map((ant) => (
                  <li key={ant.merchantKey} className="flex items-baseline justify-between gap-3 py-2">
                    <span>
                      <strong className="font-semibold text-ink">{ant.name}</strong>{' '}
                      <span className="text-[12.5px] text-ink-muted">
                        · {ant.count} veces (prom. {cop(ant.averageMinor)})
                      </span>
                    </span>
                    <span className="shrink-0 font-bold text-terra-dark">{cop(ant.totalMinor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Buscador y filtro activo */}
      <div className="space-y-2.5">
        <form className="relative" role="search">
          {activeCat && <input type="hidden" name="cat" value={activeCat} />}
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <label htmlFor="q" className="sr-only">
            Buscar movimientos
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Buscar comercio o descripción: Rappi, D1, Spotify..."
            className="field pl-11"
          />
        </form>
        {(activeCat || q) && (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-ink-muted">Filtro activo:</span>
            {activeCat && (
              <Link href={q ? `/app/movimientos?q=${encodeURIComponent(q)}` : '/app/movimientos'} className="badge-primary">
                {CATEGORY_LABEL[activeCat]} <X size={12} aria-hidden="true" />
              </Link>
            )}
            {q && (
              <Link href={activeCat ? `/app/movimientos?cat=${activeCat}` : '/app/movimientos'} className="badge-neutral">
                «{q}» <X size={12} aria-hidden="true" />
              </Link>
            )}
          </div>
        )}
      </div>

      {movements.length === 0 ? (
        <div className="surface-card p-6 text-[15px] text-ink-muted">
          {q || activeCat ? (
            <p>
              No encontramos movimientos con ese filtro en los últimos 90 días.{' '}
              <Link href="/app/movimientos" className="font-semibold text-primary-dark underline">
                Ver todos
              </Link>
            </p>
          ) : (
            <p>
              Todavía no hay movimientos importados.{' '}
              <Link href="/app/datos/importar" className="font-semibold text-primary-dark underline">
                Sube tu primer extracto
              </Link>{' '}
              para ver en qué se te va la plata automáticamente.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([date, list]) => (
            <section key={date}>
              <h2 className="mb-1.5 px-1 text-[12.5px] font-semibold uppercase tracking-wider text-ink-faint">
                {shortDate(date)}
              </h2>
              <ul className="divide-y divide-line rounded-2xl border border-line bg-white shadow-card">
                {list.map((r) => (
                  <li key={r.id} className={`px-4 py-3.5 sm:px-5 ${r.excluded ? 'opacity-55' : ''}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-ink">{r.merchantName}</p>
                        <p className="truncate text-[12.5px] text-ink-faint">
                          {r.isInternal ? 'Traslado entre tus propias cuentas · ' : ''}
                          {r.entity} · <span className="font-mono text-[11.5px]">{r.description.slice(0, 44)}</span>
                        </p>
                      </div>
                      <p
                        className={`tnum shrink-0 text-[15px] font-semibold ${
                          r.amountMinor > 0 ? 'text-primary-dark' : 'text-ink'
                        } ${r.excluded ? 'line-through' : ''}`}
                      >
                        {cop(r.amountMinor, { sign: true })}
                      </p>
                    </div>

                    {!r.isInternal && (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        {r.amountMinor < 0 ? (
                          <ReclassifyChip
                            merchantKey={r.merchantKey}
                            merchantName={r.merchantName}
                            currentCategory={r.category}
                            isUserRule={r.categorySource === 'user_rule'}
                          />
                        ) : (
                          <span className="badge-primary">Ingreso / abono</span>
                        )}
                        <form action={toggleExcluded}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="exclude" value={r.excluded ? 'no' : 'si'} />
                          <button type="submit" className="text-[12.5px] font-semibold text-ink-muted underline-offset-2 hover:underline">
                            {r.excluded ? 'Volver a contarlo' : 'Gasto único · no proyectar'}
                          </button>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
