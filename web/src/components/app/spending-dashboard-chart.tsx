'use client';

import { BarChart3, CalendarDays, PieChart, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Category } from '@/lib/engine/merchant';
import { cop, shortDate } from '@/lib/format';

interface CategoryRow {
  category: Category;
  label: string;
  currentMinor: number;
  previousMinor: number;
  deltaPercent: number | null;
  sharePercent: number;
  txCount: number;
}

interface MovementSummaryItem {
  postedOn: string;
  amountMinor: number;
  category: Category;
  isInternal?: boolean;
  excluded?: boolean;
}

interface SpendingDashboardChartProps {
  currentTotalMinor: number;
  previousTotalMinor: number;
  deltaPct: number | null;
  rows: CategoryRow[];
  movements: MovementSummaryItem[];
  dailyAllowanceMinor: number;
  activeCat: Category | null;
  todayIso: string;
}

const PALETTE: Record<string, { stroke: string; bg: string; badge: string }> = {
  comida: { stroke: '#0E6E63', bg: 'bg-[#0E6E63]', badge: 'bg-[#0E6E63]/12 text-[#0E6E63]' },
  vivienda: { stroke: '#101D1A', bg: 'bg-[#101D1A]', badge: 'bg-[#101D1A]/10 text-[#101D1A]' },
  transporte: { stroke: '#C85A32', bg: 'bg-[#C85A32]', badge: 'bg-[#C85A32]/12 text-[#C85A32]' },
  suscripciones: { stroke: '#2E8B7D', bg: 'bg-[#2E8B7D]', badge: 'bg-[#2E8B7D]/12 text-[#2E8B7D]' },
  salidas: { stroke: '#D97706', bg: 'bg-[#D97706]', badge: 'bg-[#D97706]/12 text-[#B45309]' },
  compras: { stroke: '#4F6D66', bg: 'bg-[#4F6D66]', badge: 'bg-[#4F6D66]/12 text-[#4F6D66]' },
  servicios: { stroke: '#6FB8AE', bg: 'bg-[#6FB8AE]', badge: 'bg-[#6FB8AE]/20 text-[#0E6E63]' },
  salud: { stroke: '#059669', bg: 'bg-[#059669]', badge: 'bg-[#059669]/12 text-[#059669]' },
  educacion: { stroke: '#2563EB', bg: 'bg-[#2563EB]', badge: 'bg-[#2563EB]/12 text-[#2563EB]' },
  otros: { stroke: '#8C9B96', bg: 'bg-[#8C9B96]', badge: 'bg-[#8C9B96]/15 text-[#4F6D66]' },
};

function getColor(cat: string, idx: number) {
  if (PALETTE[cat]) return PALETTE[cat];
  const fallback = Object.values(PALETTE);
  return fallback[idx % fallback.length]!;
}

const WEEKDAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function SpendingDashboardChart({
  currentTotalMinor,
  previousTotalMinor,
  deltaPct,
  rows,
  movements,
  dailyAllowanceMinor,
  activeCat,
  todayIso,
}: SpendingDashboardChartProps) {
  const [viewMode, setViewMode] = useState<'categorias' | 'ritmo'>('categorias');
  const [selectedCat, setSelectedCat] = useState<Category | null>(activeCat);

  const topRows = useMemo(() => rows.slice(0, 7), [rows]);

  // Geometría del anillo SVG (r = 72, circunferencia = 2 * PI * 72 ≈ 452.39)
  const radius = 72;
  const circumference = 2 * Math.PI * radius;

  const segments = useMemo(() => {
    const total = topRows.reduce((acc, r) => acc + Math.max(0, r.currentMinor), 0) || 1;
    let cumulativeFraction = 0;

    return topRows.map((row, idx) => {
      const fraction = Math.max(0.015, row.currentMinor / total);
      const length = fraction * circumference;
      const gap = topRows.length > 1 ? 3 : 0;
      const dashLength = Math.max(2, length - gap);
      const offset = -cumulativeFraction * circumference;
      cumulativeFraction += fraction;
      return {
        ...row,
        color: getColor(row.category, idx),
        dashArray: `${dashLength} ${circumference - dashLength}`,
        dashOffset: offset,
      };
    });
  }, [topRows, circumference]);

  const focusedRow = useMemo(
    () => topRows.find((r) => r.category === selectedCat) ?? null,
    [topRows, selectedCat],
  );

  // Cálculo de últimos 14 días y promedio por día de la semana
  const rhythmData = useMemo(() => {
    const baseDate = new Date(`${todayIso}T12:00:00Z`);
    const days14: Array<{ dateIso: string; label: string; weekday: string; spentMinor: number }> = [];
    const byDate = new Map<string, number>();

    const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];

    for (const m of movements) {
      if (m.excluded || m.isInternal || m.amountMinor >= 0) continue;
      const absMinor = Math.abs(m.amountMinor);
      byDate.set(m.postedOn, (byDate.get(m.postedOn) ?? 0) + absMinor);

      const d = new Date(`${m.postedOn}T12:00:00Z`);
      if (!isNaN(d.getTime())) {
        const wd = d.getUTCDay();
        weekdayTotals[wd] = (weekdayTotals[wd] ?? 0) + absMinor;
        weekdayCounts[wd] = (weekdayCounts[wd] ?? 0) + 1;
      }
    }

    for (let i = 13; i >= 0; i--) {
      const d = new Date(baseDate.getTime() - i * 86_400_000);
      const iso = d.toISOString().slice(0, 10);
      const wd = WEEKDAY_NAMES[d.getUTCDay()] ?? '';
      days14.push({
        dateIso: iso,
        label: shortDate(iso),
        weekday: wd,
        spentMinor: byDate.get(iso) ?? 0,
      });
    }

    const maxDayMinor = Math.max(
      dailyAllowanceMinor * 1.35,
      ...days14.map((d) => d.spentMinor),
      10_000_00,
    );

    const weekdaysSummary = WEEKDAY_NAMES.map((name, idx) => {
      const total = weekdayTotals[idx] ?? 0;
      const count = weekdayCounts[idx] ?? 0;
      return {
        name,
        totalMinor: total,
        txCount: count,
        avgPerTxMinor: count > 0 ? Math.round(total / count) : 0,
      };
    });

    const peakWeekday = [...weekdaysSummary].sort((a, b) => b.totalMinor - a.totalMinor)[0] ?? null;

    return { days14, maxDayMinor, weekdaysSummary, peakWeekday };
  }, [movements, todayIso, dailyAllowanceMinor]);

  return (
    <section
      id="dashboard-grafico-gastos"
      className="surface-card overflow-hidden border-line p-5 sm:p-6"
      aria-label="Dashboard gráfico de gastos"
    >
      {/* Cabecera con selector de vista gráfica */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <span className="badge-primary">
            <Sparkles size={12} aria-hidden="true" /> Radiografía visual · últimos 30 días
          </span>
          <h2 className="mt-1.5 font-display text-[21px] font-bold tracking-[-0.02em] text-ink">
            Mapa visual de tu dinero
          </h2>
          <p className="text-[13.5px] text-ink-muted">
            Toca cualquier categoría del anillo o revisa tu curva diaria frente a tu tope seguro.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-line bg-paper p-1 text-[12.5px] font-semibold">
          <button
            id="tab-chart-categorias"
            type="button"
            onClick={() => setViewMode('categorias')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              viewMode === 'categorias'
                ? 'bg-ink text-white shadow-2xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <PieChart size={14} aria-hidden="true" />
            <span>Por categorías</span>
          </button>
          <button
            id="tab-chart-ritmo"
            type="button"
            onClick={() => setViewMode('ritmo')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              viewMode === 'ritmo'
                ? 'bg-ink text-white shadow-2xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <BarChart3 size={14} aria-hidden="true" />
            <span>Ritmo diario (14d)</span>
          </button>
        </div>
      </div>

      {viewMode === 'categorias' ? (
        <div className="mt-5 grid items-center gap-6 lg:grid-cols-12">
          {/* Columna Izquierda: Dona Interactiva SVG */}
          <div className="flex flex-col items-center justify-center lg:col-span-5">
            <div className="relative flex h-56 w-56 items-center justify-center">
              <svg
                viewBox="0 0 180 180"
                className="h-full w-full -rotate-90 transform overflow-visible"
                role="img"
                aria-label="Gráfico de anillo de distribución de gastos por categoría"
              >
                <circle
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="transparent"
                  stroke="#EBE7DF"
                  strokeWidth="20"
                />
                {segments.map((seg) => {
                  const isFocused = selectedCat === seg.category;
                  const isDimmed = selectedCat !== null && !isFocused;
                  return (
                    <circle
                      key={seg.category}
                      cx="90"
                      cy="90"
                      r={radius}
                      fill="transparent"
                      stroke={seg.color.stroke}
                      strokeWidth={isFocused ? 25 : 20}
                      strokeDasharray={seg.dashArray}
                      strokeDashoffset={seg.dashOffset}
                      strokeLinecap="butt"
                      onClick={() =>
                        setSelectedCat((prev) => (prev === seg.category ? null : seg.category))
                      }
                      className={`cursor-pointer transition-all duration-300 ${
                        isDimmed ? 'opacity-35' : 'opacity-100 hover:opacity-90'
                      }`}
                    >
                      <title>{`${seg.label}: ${cop(seg.currentMinor)} (${seg.sharePercent}%)`}</title>
                    </circle>
                  );
                })}
              </svg>

              {/* Centro interactivo de la dona */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
                {focusedRow ? (
                  <>
                    <span className="truncate max-w-[130px] text-[11.5px] font-bold uppercase tracking-wider text-primary-dark">
                      {focusedRow.label}
                    </span>
                    <span className="tnum mt-0.5 font-display text-[22px] font-extrabold leading-tight text-ink">
                      {cop(focusedRow.currentMinor)}
                    </span>
                    <span className="tnum mt-0.5 text-[11.5px] font-semibold text-ink-muted">
                      {focusedRow.sharePercent}% del total · {focusedRow.txCount} compras
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                      Total 30 días
                    </span>
                    <span className="tnum mt-0.5 font-display text-[22px] font-extrabold leading-tight text-ink">
                      {cop(currentTotalMinor)}
                    </span>
                    {deltaPct !== null && (
                      <span
                        className={`tnum mt-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          deltaPct <= 0
                            ? 'bg-primary-light text-primary-dark'
                            : 'bg-warn-light text-warn'
                        }`}
                      >
                        {deltaPct <= 0 ? (
                          <TrendingDown size={11} aria-hidden="true" />
                        ) : (
                          <TrendingUp size={11} aria-hidden="true" />
                        )}
                        {deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`} vs mes ant.
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {selectedCat && (
              <div className="mt-2 flex items-center gap-2">
                <Link
                  href={`/app/movimientos?cat=${selectedCat}`}
                  className="rounded-full bg-primary-pale px-3 py-1 text-[12px] font-bold text-primary-dark hover:bg-primary-light"
                >
                  Filtrar lista por {focusedRow?.label} →
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedCat(null)}
                  className="text-[12px] font-semibold text-ink-faint underline hover:text-ink"
                >
                  Ver todas
                </button>
              </div>
            )}
          </div>

          {/* Columna Derecha: Desglose interactivo con barras y comparativo mes anterior */}
          <div className="space-y-2.5 lg:col-span-7">
            {segments.map((seg) => {
              const isSelected = selectedCat === seg.category;
              return (
                <div
                  key={seg.category}
                  onClick={() =>
                    setSelectedCat((prev) => (prev === seg.category ? null : seg.category))
                  }
                  className={`cursor-pointer rounded-2xl border p-3 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary-pale/50 shadow-2xs'
                      : 'border-line/80 bg-paper/45 hover:border-line-strong hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full"
                        style={{ backgroundColor: seg.color.stroke }}
                        aria-hidden="true"
                      />
                      <span className="truncate font-display text-[14.5px] font-bold text-ink">
                        {seg.label}
                      </span>
                      <span className="tnum rounded-full bg-white px-2 py-0.5 text-[11.5px] font-bold text-ink-muted border border-line">
                        {seg.sharePercent}%
                      </span>
                    </div>

                    <div className="tnum flex shrink-0 items-baseline gap-2">
                      {seg.deltaPercent !== null && seg.previousMinor > 0 && (
                        <span
                          className={`text-[11.5px] font-bold ${
                            seg.deltaPercent > 10
                              ? 'text-warn'
                              : seg.deltaPercent < -5
                                ? 'text-primary-dark'
                                : 'text-ink-faint'
                          }`}
                        >
                          {seg.deltaPercent > 0 ? `+${seg.deltaPercent}%` : `${seg.deltaPercent}%`}
                        </span>
                      )}
                      <span className="font-display text-[15px] font-extrabold text-ink">
                        {cop(seg.currentMinor)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-deep">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(4, seg.sharePercent)}%`,
                          backgroundColor: seg.color.stroke,
                        }}
                      />
                    </div>
                    <Link
                      href={isSelected ? '/app/movimientos' : `/app/movimientos?cat=${seg.category}`}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 text-[11.5px] font-semibold text-primary-dark hover:underline"
                    >
                      {seg.txCount} {seg.txCount === 1 ? 'compra' : 'compras'} →
                    </Link>
                  </div>
                </div>
              );
            })}

            <div className="tnum flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3.5 py-2.5 text-[12.5px] text-ink-muted">
              <span>Mes anterior (30 días previos): {cop(previousTotalMinor)}</span>
              <span className="font-semibold text-ink">
                Diferencia neta: {cop(currentTotalMinor - previousTotalMinor, { sign: true })}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Vista 2: Ritmo Diario de los últimos 14 días + Día pico de la semana */
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-paper p-3.5 text-[13px]">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-primary-dark" aria-hidden="true" />
              <span className="text-ink-soft">
                Tu tope diario sugerido es{' '}
                <strong className="tnum font-bold text-primary-dark">
                  {cop(dailyAllowanceMinor)}/día
                </strong>
              </span>
            </div>
            {rhythmData.peakWeekday && rhythmData.peakWeekday.totalMinor > 0 && (
              <span className="tnum rounded-full bg-terra-pale px-3 py-1 text-[12px] font-bold text-terra-dark">
                Día de mayor gasto: {rhythmData.peakWeekday.name} ({cop(rhythmData.peakWeekday.totalMinor)} acumulados)
              </span>
            )}
          </div>

          {/* Gráfico de barras de los últimos 14 días */}
          <div className="pt-2">
            <div className="relative flex h-44 items-end gap-1.5 sm:gap-2.5 border-b border-line pb-2">
              {/* Línea punteada de tope diario seguro */}
              {dailyAllowanceMinor > 0 && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-primary/60"
                  style={{
                    bottom: `${Math.min(92, Math.max(12, Math.round((dailyAllowanceMinor / rhythmData.maxDayMinor) * 100)))}%`,
                  }}
                >
                  <span className="tnum -top-5 right-0 absolute rounded bg-primary-pale px-1.5 py-0.5 text-[10.5px] font-bold text-primary-dark">
                    Tope {cop(dailyAllowanceMinor)}
                  </span>
                </div>
              )}

              {rhythmData.days14.map((day) => {
                const heightPct =
                  day.spentMinor > 0
                    ? Math.max(8, Math.round((day.spentMinor / rhythmData.maxDayMinor) * 100))
                    : 3;
                const overLimit = dailyAllowanceMinor > 0 && day.spentMinor > dailyAllowanceMinor;
                return (
                  <div
                    key={day.dateIso}
                    className="group relative flex h-full flex-1 flex-col items-center justify-end"
                  >
                    <div className="pointer-events-none mb-1 hidden group-hover:block absolute -top-8 z-20 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] font-bold text-white shadow-md tnum">
                      {day.label}: {cop(day.spentMinor)}
                    </div>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-300 ${
                        day.spentMinor === 0
                          ? 'bg-paper-deep'
                          : overLimit
                            ? 'bg-terra hover:bg-terra-dark'
                            : 'bg-primary hover:bg-primary-dark'
                      }`}
                      style={{ height: `${heightPct}%` }}
                      title={`${day.label} (${day.weekday}): ${cop(day.spentMinor)}`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Etiquetas eje X */}
            <div className="mt-2 flex gap-1.5 sm:gap-2.5 text-center text-[10.5px] text-ink-faint">
              {rhythmData.days14.map((day, idx) => (
                <div key={day.dateIso} className="flex-1 truncate">
                  <span className="block font-semibold text-ink-muted">{day.weekday}</span>
                  <span className="hidden sm:block">{idx % 2 === 0 ? day.label.split(' ')[0] : ''}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Distribución por día de la semana */}
          <div className="grid grid-cols-7 gap-1.5 pt-1 text-center">
            {rhythmData.weekdaysSummary.map((w) => {
              const isPeak = rhythmData.peakWeekday?.name === w.name && w.totalMinor > 0;
              return (
                <div
                  key={w.name}
                  className={`rounded-xl border p-2 ${
                    isPeak
                      ? 'border-terra/40 bg-terra-pale/50'
                      : 'border-line bg-paper/50'
                  }`}
                >
                  <span className="block text-[11px] font-bold text-ink">{w.name}</span>
                  <span className="tnum mt-0.5 block text-[11.5px] font-extrabold text-ink-soft">
                    {w.totalMinor > 0 ? cop(w.totalMinor) : '$0'}
                  </span>
                  <span className="block text-[10px] text-ink-faint">
                    {w.txCount} {w.txCount === 1 ? 'vez' : 'veces'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
