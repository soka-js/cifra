import { AlertOctagon, Coffee, Search, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { QuickCaptureModal } from '@/components/app/quick-capture-modal';
import { SpendingDashboardChart } from '@/components/app/spending-dashboard-chart';
import { ExpandableSmartMap } from '@/components/map/expandable-smart-map';
import { BackButton } from '@/components/ui/back-button';
import { requireUser } from '@/lib/auth/session';
import { loadCifra, loadMovimientosInsights } from '@/lib/data';
import { shortDate, todayInBogota } from '@/lib/engine/dates';
import { CATEGORY_LABEL, EDITABLE_CATEGORIES, type Category } from '@/lib/engine/merchant';
import { cop } from '@/lib/format';
import {
  currentBogotaHour,
  loadPersonaDailyValueBundle,
  loadSmartMapBundle,
} from '@/lib/v3-data';
import { toggleExcluded } from '../actions';
import { ReclassifyChip } from './reclassify-chip';

export const metadata = { title: 'En qué se me va' };

export default async function MovimientosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 60);
  const catParam = sp.cat as Category | undefined;
  const activeCat = catParam && EDITABLE_CATEGORIES.includes(catParam) ? catParam : null;

  const [{ breakdown, antExpenses, movements }, cifra, smartMap] = await Promise.all([
    loadMovimientosInsights(user, q, activeCat),
    loadCifra(user),
    loadSmartMapBundle(user),
  ]);
  const dailyBundle = await loadPersonaDailyValueBundle(user, cifra);

  const deltaPct =
    breakdown.previousTotalMinor > 0
      ? Math.round(((breakdown.currentTotalMinor - breakdown.previousTotalMinor) / breakdown.previousTotalMinor) * 100)
      : null;

  const totalRecoverableLeaksMinor = dailyBundle.leaks.reduce((s, l) => s + l.recoverableMonthlyMinor, 0);

  const groups = new Map<string, typeof movements>();
  for (const r of movements) {
    const list = groups.get(r.postedOn) ?? [];
    list.push(r);
    groups.set(r.postedOn, list);
  }

  return (
    <div className="space-y-6">
      <BackButton href="/app" label="Volver a Hoy" className="mb-1" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">En qué se me va</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">
            Tus gastos clasificados automáticamente y tus fugas con nombre propio. Anota en 3 segundos o reclasifica en un toque.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QuickCaptureModal
            accounts={dailyBundle.captureAccounts}
            todayIso={todayInBogota()}
            currentHour={currentBogotaHour()}
            buttonLabel="Anotar / pegar SMS"
            buttonClassName="btn-sm bg-ink text-white hover:bg-ink/90"
          />
          <Link href="/app/datos/importar" className="btn-sm border border-line bg-white text-ink hover:bg-paper-warm">
            <Upload size={15} aria-hidden="true" /> Subir extracto
          </Link>
        </div>
      </div>

      {/* Dashboard Gráfico Interactivo (Anillo de categorías + Ritmo diario 14d) */}
      {!q && breakdown.rows.length > 0 && (
        <SpendingDashboardChart
          currentTotalMinor={breakdown.currentTotalMinor}
          previousTotalMinor={breakdown.previousTotalMinor}
          deltaPct={deltaPct}
          rows={breakdown.rows}
          movements={movements}
          dailyAllowanceMinor={dailyBundle.pulse.dailyAllowanceMinor}
          activeCat={activeCat}
          todayIso={todayInBogota()}
        />
      )}

      {/* Radiografía de Fugas con Nombre Propio (Fase 6) */}
      {!q && !activeCat && dailyBundle.leaks.length > 0 && (
        <section className="surface-card border-neg/20 bg-gradient-to-br from-neg-light/45 via-white to-terra-pale/40 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neg-light text-neg">
                <AlertOctagon size={20} aria-hidden="true" />
              </span>
              <div>
                <span className="badge-neg">Radiografía de fugas reales · últimos 30 días</span>
                <h2 className="mt-1.5 font-display text-[20px] font-bold text-ink">
                  Podrías recuperar hasta <span className="tnum text-primary-dark">{cop(totalRecoverableLeaksMinor)}/mes</span>
                </h2>
                <p className="mt-0.5 text-[13.5px] text-ink-muted">
                  Plata que se va en sobrecostos invisibles, comisiones bancarias o picos evitables:
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {dailyBundle.leaks.map((leak) => (
              <div key={leak.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-[16px] font-bold text-ink">{leak.title}</h3>
                  <span className="tnum shrink-0 text-[13.5px] font-extrabold text-neg">
                    -{cop(leak.monthlyLossMinor)}/mes
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-ink-muted">{leak.evidence}</p>
                <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-[12.5px] leading-snug text-ink-soft">
                  <strong className="font-semibold text-primary-dark">
                    Recupera ~{cop(leak.recoverableMonthlyMinor)}/mes:
                  </strong>{' '}
                  {leak.concreteAction}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mapa inteligente desplegable para sustituir fugas por comercio local */}
      {!q && smartMap.offers.length > 0 && (
        <ExpandableSmartMap
          bundle={smartMap}
          initialCategoryFilter={activeCat ?? 'comida'}
          compactTitle="Reemplaza sobrecostos de apps con tiendas a minutos de ti"
          compactSubtitle="Cruzamos tus gastos del mes con comercios independientes de tu barrio que tienen descuento activo hoy."
        />
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
