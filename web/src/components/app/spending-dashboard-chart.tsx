'use client';

import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Filter,
  Layers,
  PieChart,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
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
  description?: string;
  merchantName?: string;
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

const PALETTE: Record<string, { stroke: string; bg: string; badge: string; softBg: string }> = {
  comida: {
    stroke: '#0E6E63',
    bg: 'bg-[#0E6E63]',
    badge: 'bg-[#0E6E63]/12 text-[#0E6E63]',
    softBg: 'bg-[#E1F3F0]/60',
  },
  mercado: {
    stroke: '#C85A32',
    bg: 'bg-[#C85A32]',
    badge: 'bg-[#C85A32]/12 text-[#C85A32]',
    softBg: 'bg-[#FBECE5]/60',
  },
  vivienda: {
    stroke: '#101D1A',
    bg: 'bg-[#101D1A]',
    badge: 'bg-[#101D1A]/10 text-[#101D1A]',
    softBg: 'bg-[#EBE7DF]/60',
  },
  transferencias: {
    stroke: '#1E3A34',
    bg: 'bg-[#1E3A34]',
    badge: 'bg-[#1E3A34]/12 text-[#1E3A34]',
    softBg: 'bg-[#EBE7DF]/60',
  },
  transporte: {
    stroke: '#D97706',
    bg: 'bg-[#D97706]',
    badge: 'bg-[#D97706]/12 text-[#B45309]',
    softBg: 'bg-[#FEF3C7]/60',
  },
  suscripciones: {
    stroke: '#2E8B7D',
    bg: 'bg-[#2E8B7D]',
    badge: 'bg-[#2E8B7D]/12 text-[#2E8B7D]',
    softBg: 'bg-[#E1F3F0]/50',
  },
  salidas: {
    stroke: '#E11D48',
    bg: 'bg-[#E11D48]',
    badge: 'bg-[#E11D48]/12 text-[#BE123C]',
    softBg: 'bg-[#FFE4E6]/50',
  },
  compras: {
    stroke: '#4F6D66',
    bg: 'bg-[#4F6D66]',
    badge: 'bg-[#4F6D66]/12 text-[#4F6D66]',
    softBg: 'bg-[#F4F1EA]',
  },
  servicios: {
    stroke: '#0284C7',
    bg: 'bg-[#0284C7]',
    badge: 'bg-[#0284C7]/12 text-[#0369A1]',
    softBg: 'bg-[#E0F2FE]/60',
  },
  salud: {
    stroke: '#059669',
    bg: 'bg-[#059669]',
    badge: 'bg-[#059669]/12 text-[#059669]',
    softBg: 'bg-[#D1FAE5]/50',
  },
  educacion: {
    stroke: '#2563EB',
    bg: 'bg-[#2563EB]',
    badge: 'bg-[#2563EB]/12 text-[#2563EB]',
    softBg: 'bg-[#DBEAFE]/50',
  },
  otros: {
    stroke: '#64748B',
    bg: 'bg-[#64748B]',
    badge: 'bg-[#64748B]/15 text-[#475569]',
    softBg: 'bg-[#F1F5F9]',
  },
};

const FIXED_OR_STRUCTURAL_CATEGORIES = new Set<string>([
  'transferencias',
  'vivienda',
  'pagos_tarjeta',
]);

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
  // Si el usuario no filtró explícitamente por una categoría estructural (ej. transferencias),
  // iniciamos en 'variable' para que el arriendo/transferencia fija de $1.35M no aplaste el gráfico diario.
  const hasVariableRows = useMemo(
    () => rows.some((r) => !FIXED_OR_STRUCTURAL_CATEGORIES.has(r.category) && r.currentMinor > 0),
    [rows],
  );
  const [scopeMode, setScopeMode] = useState<'variable' | 'todo'>(() => {
    if (activeCat && FIXED_OR_STRUCTURAL_CATEGORIES.has(activeCat)) return 'todo';
    return hasVariableRows ? 'variable' : 'todo';
  });
  const [selectedCat, setSelectedCat] = useState<Category | null>(activeCat);

  // Separación contable: Gasto variable (día a día) vs. Fijos / Traslados estructurales
  const { variableTotalMinor, fixedTotalMinor, filteredRows, activeTotalMinor, activePrevMinor } =
    useMemo(() => {
      const varRows = rows.filter((r) => !FIXED_OR_STRUCTURAL_CATEGORIES.has(r.category));
      const fixRows = rows.filter((r) => FIXED_OR_STRUCTURAL_CATEGORIES.has(r.category));

      const varTotal = varRows.reduce((acc, r) => acc + Math.max(0, r.currentMinor), 0);
      const varPrev = varRows.reduce((acc, r) => acc + Math.max(0, r.previousMinor), 0);
      const fixTotal = fixRows.reduce((acc, r) => acc + Math.max(0, r.currentMinor), 0);

      const sourceRows = scopeMode === 'variable' && varRows.length > 0 ? varRows : rows;
      const sourceTotal =
        scopeMode === 'variable' && varRows.length > 0 ? varTotal : currentTotalMinor;
      const sourcePrev =
        scopeMode === 'variable' && varRows.length > 0 ? varPrev : previousTotalMinor;

      const recomputed = sourceRows.slice(0, 7).map((r) => ({
        ...r,
        sharePercent:
          sourceTotal > 0 ? Math.max(1, Math.round((r.currentMinor / sourceTotal) * 100)) : 0,
      }));

      return {
        variableTotalMinor: varTotal,
        fixedTotalMinor: fixTotal,
        filteredRows: recomputed,
        activeTotalMinor: sourceTotal,
        activePrevMinor: sourcePrev,
      };
    }, [rows, scopeMode, currentTotalMinor, previousTotalMinor]);

  const activeDeltaPct = useMemo(() => {
    if (scopeMode === 'todo') return deltaPct;
    if (activePrevMinor <= 0) return null;
    return Math.round(((activeTotalMinor - activePrevMinor) / activePrevMinor) * 100);
  }, [scopeMode, deltaPct, activeTotalMinor, activePrevMinor]);

  // Geometría del anillo SVG (r = 70, circunferencia = 2 * PI * 70 ≈ 439.82)
  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  const segments = useMemo(() => {
    const total = filteredRows.reduce((acc, r) => acc + Math.max(0, r.currentMinor), 0) || 1;
    let cumulativeFraction = 0;

    return filteredRows.map((row, idx) => {
      const fraction = Math.max(0.02, row.currentMinor / total);
      const length = fraction * circumference;
      const gap = filteredRows.length > 1 ? 3.5 : 0;
      const dashLength = Math.max(3, length - gap);
      const offset = -cumulativeFraction * circumference;
      cumulativeFraction += fraction;
      return {
        ...row,
        color: getColor(row.category, idx),
        dashArray: `${dashLength} ${circumference - dashLength}`,
        dashOffset: offset,
      };
    });
  }, [filteredRows, circumference]);

  const focusedRow = useMemo(() => {
    if (selectedCat) {
      const found = segments.find((r) => r.category === selectedCat);
      if (found) return found;
    }
    return null;
  }, [segments, selectedCat]);

  // Categoría destacada para la tarjeta de radiografía inferior izquierda (la seleccionada o la #1)
  const spotlightRow = focusedRow ?? segments[0] ?? null;

  // Cálculo de últimos 14 días y promedio por día de la semana (respetando el filtro Variable vs Todo)
  const rhythmData = useMemo(() => {
    const baseDate = new Date(`${todayIso}T12:00:00Z`);
    const days14: Array<{
      dateIso: string;
      label: string;
      shortDayNum: string;
      weekday: string;
      spentMinor: number;
      hadFixedSpike: boolean;
    }> = [];
    const byDate = new Map<string, number>();
    const fixedSpikeDates = new Set<string>();

    const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];

    for (const m of movements) {
      if (m.excluded || m.isInternal || m.amountMinor >= 0) continue;
      const isStructural = FIXED_OR_STRUCTURAL_CATEGORIES.has(m.category);
      if (scopeMode === 'variable' && isStructural) continue;

      const absMinor = Math.abs(m.amountMinor);
      if (isStructural && absMinor >= 500_000_00) {
        fixedSpikeDates.add(m.postedOn);
      }

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
      const shortFormatted = shortDate(iso);
      days14.push({
        dateIso: iso,
        label: shortFormatted,
        shortDayNum: shortFormatted.split(' ')[0] ?? '',
        weekday: wd,
        spentMinor: byDate.get(iso) ?? 0,
        hadFixedSpike: fixedSpikeDates.has(iso),
      });
    }

    // Escala inteligente: evitamos que un solo pago de arriendo en modo "Todo" aplane los otros 13 días
    const nonSpikeValues = days14
      .filter((d) => !d.hadFixedSpike)
      .map((d) => d.spentMinor);
    const highestNormalMinor = Math.max(...nonSpikeValues, dailyAllowanceMinor * 1.4, 80_000_00);
    const maxScaleMinor =
      scopeMode === 'variable'
        ? Math.max(dailyAllowanceMinor * 1.45, ...days14.map((d) => d.spentMinor), 80_000_00)
        : Math.max(highestNormalMinor * 1.35, dailyAllowanceMinor * 2.1);

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
    const activeDaysCount = days14.filter((d) => d.spentMinor > 0).length;
    const withinLimitDaysCount = days14.filter(
      (d) => d.spentMinor > 0 && (dailyAllowanceMinor <= 0 || d.spentMinor <= dailyAllowanceMinor),
    ).length;

    return {
      days14,
      maxScaleMinor,
      weekdaysSummary,
      peakWeekday,
      activeDaysCount,
      withinLimitDaysCount,
    };
  }, [movements, todayIso, dailyAllowanceMinor, scopeMode]);

  return (
    <section
      id="dashboard-grafico-gastos"
      className="surface-card scroll-mt-20 overflow-hidden border-line p-5 sm:p-6"
      aria-label="Dashboard gráfico de gastos"
    >
      {/* Cabecera con selector de vista y filtro inteligente de alcance */}
      <div className="flex flex-col gap-3.5 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-primary">
              <Sparkles size={12} aria-hidden="true" /> Radiografía visual · últimos 30 días
            </span>
            <span className="rounded-full bg-paper px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-muted">
              {scopeMode === 'variable'
                ? 'Enfoque: Gasto del día a día'
                : 'Enfoque: Total mes (incluye arriendo/fijos)'}
            </span>
          </div>
          <h2 className="mt-1.5 font-display text-[21px] font-bold tracking-[-0.02em] text-ink">
            Mapa visual de tu dinero
          </h2>
          <p className="text-[13.5px] text-ink-muted">
            Inspecciona en qué categorías se va tu plata cada semana y cómo se comporta tu ritmo diario frente a tu tope seguro.
          </p>
        </div>

        {/* Controles superiores: Vista (Categorías / Ritmo 14d) */}
        <div className="flex shrink-0 items-center gap-2 self-start">
          <div className="inline-flex shrink-0 rounded-xl border border-line bg-paper p-1 text-[12.5px] font-semibold">
            <button
              id="tab-chart-categorias"
              type="button"
              onClick={() => setViewMode('categorias')}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 transition ${
                viewMode === 'categorias'
                  ? 'bg-ink text-white shadow-2xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <PieChart size={14} className="shrink-0" aria-hidden="true" />
              <span>Por categorías</span>
            </button>
            <button
              id="tab-chart-ritmo"
              type="button"
              onClick={() => setViewMode('ritmo')}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 transition ${
                viewMode === 'ritmo'
                  ? 'bg-ink text-white shadow-2xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <BarChart3 size={14} className="shrink-0" aria-hidden="true" />
              <span>Ritmo diario (14d)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-barra de separación inteligente: Día a día vs. Todo el mes */}
      {fixedTotalMinor > 0 && hasVariableRows && (
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/80 bg-paper/75 px-3.5 py-2 text-[12.5px]">
          <div className="flex items-center gap-2 text-ink-soft">
            <Filter size={13.5} className="text-primary-dark" aria-hidden="true" />
            <span>
              Separamos tus <strong>pagos fijos/traslados ({cop(fixedTotalMinor)})</strong> para que veas con claridad tu gasto diario real:
            </span>
          </div>
          <div className="tnum inline-flex rounded-lg border border-line bg-white p-0.5 text-[11.5px] font-bold">
            <button
              id="btn-scope-variable"
              type="button"
              onClick={() => {
                setScopeMode('variable');
                if (selectedCat && FIXED_OR_STRUCTURAL_CATEGORIES.has(selectedCat)) {
                  setSelectedCat(null);
                }
              }}
              className={`rounded-md px-2.5 py-1 transition ${
                scopeMode === 'variable'
                  ? 'bg-primary text-white'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Día a día ({cop(variableTotalMinor)})
            </button>
            <button
              id="btn-scope-todo"
              type="button"
              onClick={() => setScopeMode('todo')}
              className={`rounded-md px-2.5 py-1 transition ${
                scopeMode === 'todo'
                  ? 'bg-ink text-white'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Todo ({cop(currentTotalMinor)})
            </button>
          </div>
        </div>
      )}

      {viewMode === 'categorias' ? (
        <div className="mt-5 grid items-start gap-5 lg:grid-cols-12">
          {/* Columna Izquierda: Panel de Dona + Spotlight de Categoría (alineado arriba sin espacio vacío) */}
          <div className="flex flex-col justify-between rounded-2xl border border-line bg-paper/55 p-4 lg:col-span-5">
            <div className="flex flex-col items-center">
              <div className="relative flex h-52 w-52 items-center justify-center">
                <svg
                  viewBox="0 0 180 180"
                  className="h-full w-full -rotate-90 transform"
                  role="img"
                  aria-label="Gráfico de anillo de distribución de gastos por categoría"
                >
                  <circle
                    cx="90"
                    cy="90"
                    r={radius}
                    fill="transparent"
                    stroke="#EBE7DF"
                    strokeWidth="22"
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
                        strokeWidth={isFocused ? 26 : 22}
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
                      <span className="max-w-[128px] truncate text-[10.5px] font-bold uppercase tracking-wider text-primary-dark">
                        {focusedRow.label}
                      </span>
                      <span className="tnum mt-0.5 font-display text-[21px] font-extrabold leading-tight text-ink">
                        {cop(focusedRow.currentMinor)}
                      </span>
                      <span className="tnum mt-0.5 text-[11px] font-semibold text-ink-muted">
                        {focusedRow.sharePercent}% · {focusedRow.txCount}{' '}
                        {focusedRow.txCount === 1 ? 'compra' : 'compras'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
                        {scopeMode === 'variable' ? 'Gasto día a día' : 'Total 30 días'}
                      </span>
                      <span className="tnum mt-0.5 font-display text-[21px] font-extrabold leading-tight text-ink">
                        {cop(activeTotalMinor)}
                      </span>
                      {activeDeltaPct !== null && (
                        <span
                          className={`tnum mt-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                            activeDeltaPct <= 0
                              ? 'bg-primary-light text-primary-dark'
                              : 'bg-warn-light text-warn'
                          }`}
                        >
                          {activeDeltaPct <= 0 ? (
                            <TrendingDown size={11} aria-hidden="true" />
                          ) : (
                            <TrendingUp size={11} aria-hidden="true" />
                          )}
                          {activeDeltaPct > 0 ? `+${activeDeltaPct}%` : `${activeDeltaPct}%`} vs mes ant.
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              <p className="mt-1 text-center text-[11.5px] text-ink-faint">
                {selectedCat
                  ? 'Tocaste una categoría · Toca de nuevo para ver el total'
                  : 'Toca un arco o una fila para inspeccionar su peso'}
              </p>
            </div>

            {/* Tarjeta Spotlight de la Categoría Principal o Seleccionada */}
            {spotlightRow && (
              <div className="mt-4 rounded-xl border border-line bg-white p-3.5 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
                    {focusedRow ? 'Categoría seleccionada' : 'Mayor peso en esta vista'}
                  </span>
                  <span
                    className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold ${spotlightRow.color.badge}`}
                  >
                    {spotlightRow.sharePercent}% del gasto
                  </span>
                </div>

                <p className="mt-1.5 font-display text-[15px] font-bold leading-snug text-ink">
                  {spotlightRow.label}
                </p>
                <p className="tnum mt-0.5 font-display text-[18px] font-extrabold text-primary-dark">
                  {cop(spotlightRow.currentMinor)}
                </p>

                <div className="tnum mt-2.5 grid grid-cols-2 gap-2 border-t border-line pt-2.5 text-[12px]">
                  <div>
                    <span className="block text-[10.5px] text-ink-faint">Promedio / compra</span>
                    <span className="font-bold text-ink">
                      {cop(
                        Math.round(
                          spotlightRow.currentMinor / Math.max(1, spotlightRow.txCount),
                        ),
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10.5px] text-ink-faint">Frecuencia (30d)</span>
                    <span className="font-bold text-ink">
                      {spotlightRow.txCount}{' '}
                      {spotlightRow.txCount === 1 ? 'compra' : 'compras'}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5">
                  <Link
                    href={`/app/movimientos?cat=${spotlightRow.category}`}
                    className="inline-flex items-center gap-1 text-[12px] font-bold text-primary-dark hover:underline"
                  >
                    <span>Ver movimientos de {spotlightRow.label.toLowerCase()}</span>
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </Link>
                  {selectedCat && (
                    <button
                      type="button"
                      onClick={() => setSelectedCat(null)}
                      className="text-[11.5px] font-semibold text-ink-faint underline hover:text-ink"
                    >
                      Restablecer
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Resumen contable pie de columna izquierda */}
            <div className="tnum mt-3 grid grid-cols-2 gap-2 rounded-xl border border-line/80 bg-white px-3 py-2 text-[11.5px]">
              <div>
                <span className="block text-ink-faint">Día a día (variable)</span>
                <span className="font-bold text-primary-dark">{cop(variableTotalMinor)}</span>
              </div>
              <div>
                <span className="block text-ink-faint">Fijos y traslados</span>
                <span className="font-bold text-ink">{cop(fixedTotalMinor)}</span>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Lista de Categorías sin truncamientos agresivos */}
          <div className="space-y-2.5 lg:col-span-7">
            {segments.map((seg) => {
              const isSelected = selectedCat === seg.category;
              const avgTicketMinor = Math.round(seg.currentMinor / Math.max(1, seg.txCount));
              return (
                <div
                  key={seg.category}
                  onClick={() =>
                    setSelectedCat((prev) => (prev === seg.category ? null : seg.category))
                  }
                  className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary-pale/55 shadow-2xs'
                      : 'border-line/90 bg-white hover:border-line-strong hover:bg-paper/40'
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full"
                        style={{ backgroundColor: seg.color.stroke }}
                        aria-hidden="true"
                      />
                      <span className="font-display text-[15px] font-bold text-ink">
                        {seg.label}
                      </span>
                      <span className="tnum shrink-0 rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-bold text-ink-muted">
                        {seg.sharePercent}%
                      </span>
                    </div>

                    <div className="tnum flex shrink-0 items-baseline gap-2">
                      {seg.deltaPercent !== null && seg.previousMinor > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            seg.deltaPercent > 10
                              ? 'bg-warn-light text-warn'
                              : seg.deltaPercent < -5
                                ? 'bg-primary-light text-primary-dark'
                                : 'bg-paper text-ink-faint'
                          }`}
                        >
                          {seg.deltaPercent > 0 ? `+${seg.deltaPercent}%` : `${seg.deltaPercent}%`}
                        </span>
                      )}
                      <span className="font-display text-[15.5px] font-extrabold text-ink">
                        {cop(seg.currentMinor)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-deep">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(5, seg.sharePercent)}%`,
                          backgroundColor: seg.color.stroke,
                        }}
                      />
                    </div>
                  </div>

                  <div className="tnum mt-2 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-ink-muted">
                    <span>
                      {seg.txCount} {seg.txCount === 1 ? 'movimiento' : 'movimientos'} · prom.{' '}
                      <strong className="font-semibold text-ink-soft">{cop(avgTicketMinor)}</strong>
                    </span>
                    <Link
                      href={isSelected ? '/app/movimientos' : `/app/movimientos?cat=${seg.category}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-bold text-primary-dark hover:underline"
                    >
                      {isSelected ? 'Quitar filtro' : 'Filtrar lista →'}
                    </Link>
                  </div>
                </div>
              );
            })}

            <div className="tnum flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[12.5px] text-ink-muted">
              <span>
                Mes anterior ({scopeMode === 'variable' ? 'día a día' : 'total'}):{' '}
                <strong className="text-ink">{cop(activePrevMinor)}</strong>
              </span>
              <span className="font-semibold text-ink">
                Variación: {cop(activeTotalMinor - activePrevMinor, { sign: true })}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Vista 2: Ritmo Diario de los últimos 14 días + Día pico de la semana */
        <div className="mt-5 space-y-5">
          {/* Cinta de KPIs de ritmo diario */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-paper/70 p-3.5">
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wider text-ink-faint">
                <CalendarDays size={13} className="text-primary-dark" aria-hidden="true" />
                Tope diario seguro
              </span>
              <p className="tnum mt-1 font-display text-[20px] font-extrabold text-primary-dark">
                {cop(dailyAllowanceMinor)}/día
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-muted">
                Para llegar holgado a tu próximo ingreso
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-paper/70 p-3.5">
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wider text-ink-faint">
                <Layers size={13} className="text-primary-dark" aria-hidden="true" />
                Días dentro de tu tope
              </span>
              <p className="tnum mt-1 font-display text-[20px] font-extrabold text-ink">
                {rhythmData.withinLimitDaysCount} de {Math.max(1, rhythmData.activeDaysCount)} días
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-muted">
                Días con compras que respetaron el tope
              </p>
            </div>

            <div className="rounded-2xl border border-terra/30 bg-terra-pale/45 p-3.5">
              <span className="text-[11.5px] font-bold uppercase tracking-wider text-terra-dark">
                Día de mayor salida
              </span>
              <p className="tnum mt-1 font-display text-[20px] font-extrabold text-terra-dark">
                {rhythmData.peakWeekday && rhythmData.peakWeekday.totalMinor > 0
                  ? `${rhythmData.peakWeekday.name} · ${cop(rhythmData.peakWeekday.totalMinor)}`
                  : 'Sin picos'}
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-soft">
                Acumulado en los últimos 30 días
              </p>
            </div>
          </div>

          {/* Gráfico de barras de los últimos 14 días */}
          <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className="font-bold text-ink">
                Evolución diaria (últimos 14 días · {scopeMode === 'variable' ? 'Gasto día a día' : 'Todo el mes'})
              </span>
              <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-primary" /> Dentro del tope
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-terra" /> Superó el tope
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 border-t-2 border-dashed border-primary" /> Tope {cop(dailyAllowanceMinor)}
                </span>
              </div>
            </div>

            <div className="pt-5">
              <div className="relative flex h-48 items-end gap-1.5 border-b border-line pb-2 sm:gap-2.5">
                {/* Línea punteada de tope diario seguro */}
                {dailyAllowanceMinor > 0 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-primary/70"
                    style={{
                      bottom: `${Math.min(88, Math.max(15, Math.round((dailyAllowanceMinor / rhythmData.maxScaleMinor) * 100)))}%`,
                    }}
                  >
                    <span className="tnum -top-5 right-0 absolute rounded-md border border-primary/25 bg-primary-pale px-2 py-0.5 text-[10.5px] font-bold text-primary-dark shadow-2xs">
                      Tope seguro: {cop(dailyAllowanceMinor)}
                    </span>
                  </div>
                )}

                {rhythmData.days14.map((day) => {
                  const rawRatio = day.spentMinor / rhythmData.maxScaleMinor;
                  const heightPct =
                    day.spentMinor > 0
                      ? Math.min(96, Math.max(10, Math.round(rawRatio * 100)))
                      : 4;
                  const overLimit =
                    dailyAllowanceMinor > 0 && day.spentMinor > dailyAllowanceMinor;
                  const compactAmount =
                    day.spentMinor >= 1_000_000_00
                      ? `$${(day.spentMinor / 1_000_000_00).toFixed(1)}M`
                      : day.spentMinor >= 10_000_00
                        ? `$${Math.round(day.spentMinor / 1_000_00)}k`
                        : '';

                  return (
                    <div
                      key={day.dateIso}
                      className="group relative flex h-full flex-1 flex-col items-center justify-end"
                    >
                      {/* Etiqueta compacta visible sobre barras activas */}
                      {day.spentMinor > 0 && (
                        <span
                          className={`tnum mb-1 text-[9.5px] font-bold ${
                            overLimit ? 'text-terra-dark' : 'text-primary-dark'
                          }`}
                        >
                          {compactAmount}
                        </span>
                      )}

                      {/* Tooltip completo al pasar el cursor */}
                      <div className="pointer-events-none absolute -top-9 z-20 hidden whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-[11px] font-bold text-white shadow-md group-hover:block tnum">
                        {day.label} ({day.weekday}): {cop(day.spentMinor)}
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
              <div className="mt-2 flex gap-1.5 text-center text-[10.5px] text-ink-faint sm:gap-2.5">
                {rhythmData.days14.map((day) => (
                  <div key={day.dateIso} className="flex-1 truncate">
                    <span className="block font-bold text-ink-muted">{day.weekday}</span>
                    <span className="tnum block text-[10px] text-ink-faint">{day.shortDayNum}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Distribución acumulada por día de la semana */}
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-ink-faint">
              Acumulado por día de la semana (últimos 30 días)
            </p>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {rhythmData.weekdaysSummary.map((w) => {
                const isPeak = rhythmData.peakWeekday?.name === w.name && w.totalMinor > 0;
                return (
                  <div
                    key={w.name}
                    className={`rounded-xl border p-2.5 transition ${
                      isPeak
                        ? 'border-terra/45 bg-terra-pale/60 shadow-2xs'
                        : 'border-line bg-paper/55'
                    }`}
                  >
                    <span className="block text-[11.5px] font-bold text-ink">{w.name}</span>
                    <span className="tnum mt-0.5 block text-[11.5px] font-extrabold text-ink-soft">
                      {w.totalMinor > 0 ? cop(w.totalMinor) : '$0'}
                    </span>
                    <span className="block text-[10px] text-ink-faint">
                      {w.txCount} {w.txCount === 1 ? 'compra' : 'compras'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
