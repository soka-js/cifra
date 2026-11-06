'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  Package,
  Plus,
  Settings2,
  Trash2,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useActionState, useState } from 'react';
import {
  addMerchantLedgerEntryAction,
  deleteMerchantLedgerEntryAction,
  launchQuickFlashOfferAction,
  updateMerchantBreakEvenTargetsAction,
  type V3ActionState,
} from '@/app/actions/v3';
import { cop, shortDate } from '@/lib/format';
import type { MerchantBreakEvenPageData } from '@/lib/v3-data';

const INITIAL: V3ActionState = { status: 'idle' };

const SUPPLY_CATEGORIES = [
  'Harina, mantequilla y panadería',
  'Café, leche y bebidas',
  'Frutas, verduras y proteínas',
  'Empaques y servilletas',
  'Gas, luz, agua o arriendo',
];

function defaultFlashTitle(cat: string): string {
  if (cat === 'panaderia') return '25 % OFF en horneados frescos de la tarde (cero merma)';
  if (cat === 'cafeteria') return '20 % OFF en café + pastelería de media tarde';
  if (cat === 'fruver') return '25 % OFF en canasta fresca del día antes del cierre';
  if (cat === 'restaurante') return '20 % OFF en almuerzo ejecutivo de 2:00 a 4:00 p. m.';
  return '20 % OFF en promoción relámpago de hoy en mostrador';
}

export function CuadreClient({
  merchantName,
  businessCategory,
  typicalTicketMinor,
  monthlyFixedCostMinor,
  currentHour,
  data,
}: {
  merchantName: string;
  businessCategory: string;
  typicalTicketMinor: number;
  monthlyFixedCostMinor: number;
  currentHour: number;
  data: MerchantBreakEvenPageData;
}) {
  const { summary, recentEntries, activeFlashCount } = data;
  const [entryKind, setEntryKind] = useState<'venta_mostrador' | 'insumos' | 'servicios_arriendo'>('venta_mostrador');
  const [categoryLabel, setCategoryLabel] = useState('Ventas de mostrador (efectivo / Nequi / datáfono)');
  const [showFlashBuilder, setShowFlashBuilder] = useState(false);
  const [showTargetEditor, setShowTargetEditor] = useState(false);

  const [ledgerState, ledgerAction, ledgerPending] = useActionState(addMerchantLedgerEntryAction, INITIAL);
  const [flashState, flashAction, flashPending] = useActionState(launchQuickFlashOfferAction, INITIAL);
  const [targetState, targetAction, targetPending] = useActionState(updateMerchantBreakEvenTargetsAction, INITIAL);

  const barPct = Math.min(100, Math.max(4, summary.progressPct));
  const defaultStart = Math.max(6, Math.min(20, currentHour));
  const defaultEnd = Math.min(22, defaultStart + 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="badge-terra">Utilidad diaria para tu local · Día 1</span>
          <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink">
            Cuadre del día y costo de insumos
          </h1>
          <p className="mt-1 text-[15px] text-ink-muted">
            Mira en segundos si hoy ya libraste el día en {merchantName}, controla alzas de proveedores y prende ofertas relámpago cuando falte movimiento.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowTargetEditor((v) => !v)}
          className="btn-sm border border-line bg-white text-ink-soft hover:text-ink"
        >
          <Settings2 size={14} aria-hidden="true" />
          Ajustar meta diaria
        </button>
      </div>

      {showTargetEditor && (
        <form action={targetAction} className="surface-card space-y-4 p-5">
          <h2 className="font-display text-[18px] font-bold text-ink">
            Configura el punto de equilibrio diario de tu local
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dailyBreakEven" className="label">
                Meta de ventas diaria para cubrir costos ($)
              </label>
              <input
                id="dailyBreakEven"
                name="dailyBreakEven"
                type="text"
                inputMode="numeric"
                defaultValue={Math.round(summary.dailyBreakEvenMinor / 100)}
                className="field tnum"
              />
            </div>
            <div>
              <label htmlFor="monthlyFixedCost" className="label">
                Gastos fijos mensuales (arriendo + servicios + ayuda) ($)
              </label>
              <input
                id="monthlyFixedCost"
                name="monthlyFixedCost"
                type="text"
                inputMode="numeric"
                defaultValue={Math.round(monthlyFixedCostMinor / 100)}
                className="field tnum"
              />
            </div>
          </div>
          {targetState.status !== 'idle' && (
            <p className={`text-[13.5px] font-medium ${targetState.status === 'error' ? 'text-neg' : 'text-primary-dark'}`}>
              {targetState.message}
            </p>
          )}
          <button type="submit" disabled={targetPending} className="btn-primary">
            {targetPending ? 'Guardando…' : 'Guardar meta'}
          </button>
        </form>
      )}

      {/* Termómetro del Punto de Equilibrio de HOY */}
      <section className="surface-card border-terra/30 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={summary.reachedBreakEven ? 'badge-primary' : 'badge-terra'}>
                <Flame size={12} aria-hidden="true" />
                {summary.reachedBreakEven
                  ? '¡Punto de equilibrio del día superado!'
                  : 'Termómetro de ventas de hoy'}
              </span>
              {activeFlashCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11.5px] font-bold text-amber-900">
                  ⚡ {activeFlashCount} relámpago encendida hoy
                </span>
              )}
            </div>

            <p className="mt-3 text-[13.5px] font-medium text-ink-muted">Ventas acumuladas hoy ({shortDate(data.today)})</p>
            <div className="tnum mt-0.5 flex flex-wrap items-baseline gap-2.5">
              <span className="font-display text-[40px] font-extrabold leading-none tracking-[-0.03em] text-ink">
                {cop(summary.todaySalesMinor)}
              </span>
              <span className="text-[14px] text-ink-faint">
                de {cop(summary.dailyBreakEvenMinor)} de meta diaria ({summary.progressPct} %)
              </span>
            </div>
          </div>

          {!summary.reachedBreakEven && (
            <button
              id="btn-open-flash-rescue"
              type="button"
              onClick={() => setShowFlashBuilder((v) => !v)}
              className="btn-terra shrink-0"
            >
              <Zap size={16} aria-hidden="true" />
              Me faltan {cop(summary.gapToBreakEvenMinor)} · Prender Relámpago
            </button>
          )}
        </div>

        <div className="mt-4">
          <div className="h-3 w-full overflow-hidden rounded-full bg-paper-deep">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                summary.reachedBreakEven ? 'bg-primary' : 'bg-terra'
              }`}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <div className="tnum mt-2.5 grid gap-2 text-[13px] text-ink-muted sm:grid-cols-3">
            <span>
              Mostrador directo: <strong className="text-ink">{cop(summary.todayCounterSalesMinor)}</strong>
            </span>
            <span>
              Con código CIFRA hoy: <strong className="text-primary-dark">{cop(summary.todayCifraSalesMinor)}</strong>
            </span>
            <span>
              Insumos pagados hoy: <strong className="text-ink">{cop(summary.todaySuppliesMinor)}</strong>
            </span>
          </div>
        </div>

        {/* Lanzador en 1 toque de Oferta Relámpago de Horas Muertas / Cero Merma */}
        {showFlashBuilder && (
          <form
            action={flashAction}
            className="mt-5 space-y-4 rounded-2xl border border-amber-300 bg-amber-50/75 p-4 sm:p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-950">
                  ⚡ Cero merma y horas tranquilas
                </span>
                <h3 className="mt-1.5 font-display text-[18px] font-bold text-ink">
                  Saca producto fresco antes del cierre y cierra la brecha de hoy
                </h3>
                <p className="text-[13px] text-ink-soft">
                  Aparecerá de inmediato con pin relámpago en el mapa de los vecinos que suelen comprar en tu categoría.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="flash-title" className="label">
                  ¿Qué vas a ofrecer hoy?
                </label>
                <input
                  id="flash-title"
                  name="title"
                  type="text"
                  required
                  defaultValue={defaultFlashTitle(businessCategory)}
                  className="field bg-white"
                />
              </div>

              <div>
                <label htmlFor="flash-pct" className="label">
                  Descuento relámpago (%)
                </label>
                <select id="flash-pct" name="discountPercent" defaultValue={25} className="field tnum bg-white">
                  {[15, 20, 25, 30, 35].map((p) => (
                    <option key={p} value={p}>
                      {p} % de descuento
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="flash-stock" className="label">
                  Cupos disponibles hoy
                </label>
                <input
                  id="flash-stock"
                  name="stockLimit"
                  type="number"
                  min={3}
                  max={60}
                  defaultValue={8}
                  className="field tnum bg-white"
                />
              </div>

              <div>
                <label htmlFor="flash-start" className="label">
                  Desde la hora (0–23)
                </label>
                <input
                  id="flash-start"
                  name="startHour"
                  type="number"
                  min={5}
                  max={22}
                  defaultValue={defaultStart}
                  className="field tnum bg-white"
                />
              </div>

              <div>
                <label htmlFor="flash-end" className="label">
                  Hasta la hora (0–23)
                </label>
                <input
                  id="flash-end"
                  name="endHour"
                  type="number"
                  min={6}
                  max={23}
                  defaultValue={defaultEnd}
                  className="field tnum bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="flash-cost" className="label">
                  Costo aproximado de insumos por venta de {cop(typicalTicketMinor)} ($) — protegemos tu margen
                </label>
                <input
                  id="flash-cost"
                  name="unitCost"
                  type="text"
                  inputMode="numeric"
                  defaultValue={Math.round((typicalTicketMinor * 0.36) / 100)}
                  className="field tnum bg-white"
                />
              </div>
            </div>

            {flashState.status !== 'idle' && (
              <p
                className={`rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold ${
                  flashState.status === 'error' ? 'bg-neg-light text-neg-dark' : 'bg-primary-light text-primary-dark'
                }`}
              >
                {flashState.message}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setShowFlashBuilder(false)} className="btn-ghost bg-white">
                Cerrar
              </button>
              <button id="btn-submit-flash-rescue" type="submit" disabled={flashPending} className="btn-terra">
                <Zap size={15} aria-hidden="true" />
                {flashPending ? 'Encendiendo…' : 'Encender oferta relámpago ahora'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Alertas de Encarecimiento de Insumos (últimos 30d vs 30d previos) */}
      {summary.supplyInflationAlerts.length > 0 && (
        <section className="surface-card border-warn/35 bg-warn-light/60 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[18px] font-bold text-ink">
                Alerta de encarecimiento de insumos en tu negocio
              </h2>
              <p className="mt-0.5 text-[13.5px] text-ink-soft">
                Detectamos rubros donde estás pagando más que el mes pasado para que ajustes porciones, precios o proveedor a tiempo:
              </p>
              <ul className="tnum mt-3 space-y-2 text-[13.5px]">
                {summary.supplyInflationAlerts.map((al) => (
                  <li
                    key={al.categoryLabel}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn/25 bg-white px-3.5 py-2.5"
                  >
                    <div>
                      <strong className="font-semibold text-ink">{al.categoryLabel}</strong>
                      <span className="ml-2 text-[12px] text-ink-muted">
                        Mes anterior: {cop(al.prev30dMinor)} → Últimos 30 días: {cop(al.recent30dMinor)}
                      </span>
                    </div>
                    <span className="badge-warn font-bold">+{al.deltaPct} %</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Formulario rápido de 5 segundos: anotar venta del día o compra a proveedor */}
      <div className="grid gap-5 lg:grid-cols-5">
        <form action={ledgerAction} className="surface-card space-y-4 p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[19px] font-bold text-ink">
              Anotar en 5 segundos
            </h2>
            <span className="text-[12px] text-ink-faint">Las ventas con código CIFRA entran solas</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-line bg-paper p-1">
            <button
              type="button"
              onClick={() => {
                setEntryKind('venta_mostrador');
                setCategoryLabel('Ventas de mostrador (efectivo / Nequi / datáfono)');
              }}
              className={`rounded-xl py-2 text-[12.5px] font-semibold transition-colors ${
                entryKind === 'venta_mostrador' ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'
              }`}
            >
              + Venta mostrador
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryKind('insumos');
                setCategoryLabel(SUPPLY_CATEGORIES[0]!);
              }}
              className={`rounded-xl py-2 text-[12.5px] font-semibold transition-colors ${
                entryKind === 'insumos' ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'
              }`}
            >
              - Compra insumos
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryKind('servicios_arriendo');
                setCategoryLabel('Gas, luz, agua o arriendo');
              }}
              className={`rounded-xl py-2 text-[12.5px] font-semibold transition-colors ${
                entryKind === 'servicios_arriendo' ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'
              }`}
            >
              - Gasto fijo local
            </button>
          </div>

          <input type="hidden" name="kind" value={entryKind} />

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="ledger-amount" className="label">
                Valor en pesos ($)
              </label>
              <input
                id="ledger-amount"
                name="amount"
                type="text"
                inputMode="numeric"
                required
                placeholder={entryKind === 'venta_mostrador' ? '185.000' : '92.000'}
                className="field tnum font-display text-[20px] font-bold"
              />
            </div>

            <div>
              <label htmlFor="ledger-cat" className="label">
                Concepto / rubro
              </label>
              {entryKind === 'insumos' ? (
                <select
                  id="ledger-cat"
                  name="categoryLabel"
                  value={categoryLabel}
                  onChange={(e) => setCategoryLabel(e.target.value)}
                  className="field"
                >
                  {SUPPLY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="ledger-cat"
                  name="categoryLabel"
                  type="text"
                  value={categoryLabel}
                  onChange={(e) => setCategoryLabel(e.target.value)}
                  className="field"
                />
              )}
            </div>

            {entryKind !== 'venta_mostrador' && (
              <div>
                <label htmlFor="ledger-supplier" className="label">
                  Proveedor (opcional)
                </label>
                <input
                  id="ledger-supplier"
                  name="supplierName"
                  type="text"
                  placeholder="Ej. Molinos del Sol, Central..."
                  className="field"
                />
              </div>
            )}

            <div className={entryKind === 'venta_mostrador' ? 'sm:col-span-2' : ''}>
              <label htmlFor="ledger-note" className="label">
                Nota corta (opcional)
              </label>
              <input
                id="ledger-note"
                name="note"
                type="text"
                placeholder={
                  entryKind === 'venta_mostrador'
                    ? 'Ej. Corte de mediodía'
                    : 'Ej. Bulto harina 50kg subió $8.000'
                }
                className="field"
              />
            </div>
          </div>

          {ledgerState.status !== 'idle' && (
            <p
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium ${
                ledgerState.status === 'error'
                  ? 'bg-neg-light text-neg-dark'
                  : 'bg-primary-light text-primary-dark'
              }`}
            >
              {ledgerState.status === 'ok' && <CheckCircle2 size={15} aria-hidden="true" />}
              {ledgerState.message}
            </p>
          )}

          <button id="btn-add-ledger" type="submit" disabled={ledgerPending} className="btn-primary w-full">
            <Plus size={17} aria-hidden="true" />
            {ledgerPending ? 'Guardando…' : 'Registrar en el cuadre de hoy'}
          </button>
        </form>

        {/* Resumen mensual operativo + Horizonte Compras Colectivas */}
        <div className="space-y-4 lg:col-span-2">
          <section className="surface-card p-5">
            <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
              <TrendingUp size={15} className="text-primary-dark" aria-hidden="true" />
              <span>Últimos 30 días de operación</span>
            </div>
            <dl className="tnum mt-3 space-y-2.5 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Ventas registradas (30d)</dt>
                <dd className="font-semibold text-ink">{cop(summary.monthSalesMinor)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Insumos y gastos (30d)</dt>
                <dd className="font-semibold text-neg">-{cop(summary.monthSuppliesMinor)}</dd>
              </div>
              <div className="flex justify-between border-t border-dashed border-line-strong pt-2.5 text-[15.5px] font-bold">
                <dt className="text-ink">Margen operativo bruto</dt>
                <dd className={summary.monthOperatingMarginMinor >= 0 ? 'text-primary-dark' : 'text-neg'}>
                  {cop(summary.monthOperatingMarginMinor)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-primary/20 bg-primary-pale/55 p-4 text-[13px] text-ink-soft">
            <p className="flex items-center gap-1.5 font-display text-[15px] font-bold text-ink">
              <Users size={16} className="text-primary-dark" aria-hidden="true" />
              Compras colectivas de cuadra · Horizonte 3
            </p>
            <p className="mt-1 leading-relaxed">
              Al llevar tus costos de insumos aquí con nombre de proveedor, CIFRA detecta alzas de inmediato. Cuando varios locales de tu zona registren el mismo insumo (harina, empaques, café, lácteos), habilitaremos compras conjuntas por volumen para negociar precio mayorista sin intermediarios.
            </p>
          </section>
        </div>
      </div>

      {/* Bitácora reciente del cuadre */}
      {recentEntries.length > 0 && (
        <section className="surface-card p-5">
          <div className="flex items-center gap-2">
            <Package size={17} className="text-terra-dark" aria-hidden="true" />
            <h2 className="font-display text-[18px] font-bold text-ink">
              Últimos registros de ventas e insumos
            </h2>
          </div>

          <ul className="tnum mt-3 divide-y divide-line text-[14px]">
            {recentEntries.map((e) => {
              const isSale = e.kind === 'venta_mostrador' || e.kind === 'venta_cifra';
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">
                      {e.categoryLabel}
                      {e.supplierName ? (
                        <span className="font-normal text-ink-muted"> · {e.supplierName}</span>
                      ) : null}
                    </p>
                    <p className="truncate text-[12px] text-ink-faint">
                      {shortDate(e.entryOn)} ·{' '}
                      {e.kind === 'venta_cifra'
                        ? 'Automático desde Caja CIFRA'
                        : e.kind === 'venta_mostrador'
                          ? 'Venta de mostrador'
                          : 'Costo / insumo'}
                      {e.note ? ` · ${e.note}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className={`font-bold ${isSale ? 'text-primary-dark' : 'text-ink'}`}>
                      {isSale ? `+${cop(e.amountMinor)}` : `-${cop(e.amountMinor)}`}
                    </span>
                    {e.kind !== 'venta_cifra' && (
                      <form action={deleteMerchantLedgerEntryAction}>
                        <input type="hidden" name="entryId" value={e.id} />
                        <button
                          type="submit"
                          className="rounded-lg p-1 text-ink-faint hover:bg-paper hover:text-neg"
                          aria-label="Eliminar registro"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
