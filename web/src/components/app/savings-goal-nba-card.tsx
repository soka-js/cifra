'use client';

import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Compass,
  Flame,
  MapPin,
  PencilLine,
  PiggyBank,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { crossReferenceOffers, type CrossReferencedOffer } from '@/lib/engine/crossref';
import { cop, formatThousands, parsePesosInput, shortDate } from '@/lib/format';
import type { SmartMapBundle } from '@/lib/v3-data';

interface SavingsEventItem {
  id: string;
  label: string;
  amountMinor: number;
  occurredOn: string;
}

interface SavingsGoalAndNbaCardProps {
  monthSavedMinor: number;
  allTimeSavedMinor: number;
  potentialSubscriptionSavingsMinor: number;
  unusedSubscriptionNames: string[];
  recentEvents: SavingsEventItem[];
  smartMap: SmartMapBundle;
}

interface GoalPreset {
  id: string;
  title: string;
  targetMinor: number;
  baseSavedMinor: number;
  monthlyPaceMinor: number;
  categoryHint: string;
}

const GOAL_PRESETS: GoalPreset[] = [
  {
    id: 'viaje',
    title: 'Viaje de descanso (Costa / Eje Cafetero)',
    targetMinor: 1_200_000_00,
    baseSavedMinor: 380_000_00,
    monthlyPaceMinor: 110_000_00,
    categoryHint: 'Vacaciones pagadas de contado sin endeudarte con tarjeta',
  },
  {
    id: 'vehiculo',
    title: 'Cuota inicial moto / carro',
    targetMinor: 4_500_000_00,
    baseSavedMinor: 1_150_000_00,
    monthlyPaceMinor: 280_000_00,
    categoryHint: 'Ahorro programado de cada quincena',
  },
  {
    id: 'colchon',
    title: 'Fondo de tranquilidad (3 meses de fijos)',
    targetMinor: 2_400_000_00,
    baseSavedMinor: 650_000_00,
    monthlyPaceMinor: 180_000_00,
    categoryHint: 'Respaldo líquido intocable ante cualquier imprevisto',
  },
];

/**
 * Calcula un impacto mensual realista y auditado para una oferta de barrio,
 * evitando comparar una compra individual contra un mercado mensual completo.
 */
function computeRealisticOfferImpact(offer: CrossReferencedOffer): {
  perVisitMinor: number;
  visitsPerMonth: number;
  monthlyImpactMinor: number;
} {
  const maxReasonablePerVisit = Math.max(
    offer.estimatedSavingsMinor,
    Math.round(offer.typicalTicketMinor * 0.35),
  );
  const rawPerVisit = Math.max(offer.estimatedSavingsMinor, offer.vsHabitualSavingsMinor);
  const perVisitMinor = Math.min(rawPerVisit, maxReasonablePerVisit);
  const visitsPerMonth = offer.targetCategory === 'mercado' ? 4 : 6;
  return {
    perVisitMinor,
    visitsPerMonth,
    monthlyImpactMinor: perVisitMinor * visitsPerMonth,
  };
}

export function SavingsGoalAndNbaCard({
  monthSavedMinor,
  allTimeSavedMinor,
  potentialSubscriptionSavingsMinor,
  unusedSubscriptionNames,
  recentEvents,
  smartMap,
}: SavingsGoalAndNbaCardProps) {
  const [selectedGoalId, setSelectedGoalId] = useState<string>('viaje');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customTargetText, setCustomTargetText] = useState<string>('');
  const [editingGoal, setEditingGoal] = useState<boolean>(false);
  const [committedNbaIds, setCommittedNbaIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const savedGoalId = localStorage.getItem('cifra_goal_id');
      const savedCustomTitle = localStorage.getItem('cifra_goal_custom_title');
      const savedCustomTarget = localStorage.getItem('cifra_goal_custom_target');
      if (savedGoalId) setSelectedGoalId(savedGoalId);
      if (savedCustomTitle) setCustomTitle(savedCustomTitle);
      if (savedCustomTarget) setCustomTargetText(savedCustomTarget);
    } catch {
      // Ignorar en entornos sin storage
    }
  }, []);

  const activePreset = useMemo(
    () => GOAL_PRESETS.find((g) => g.id === selectedGoalId) ?? GOAL_PRESETS[0]!,
    [selectedGoalId],
  );

  const parsedCustomMinor = useMemo(
    () => (customTargetText ? parsePesosInput(customTargetText) : null),
    [customTargetText],
  );

  const goalTitle = customTitle.trim() || activePreset.title;
  const goalTargetMinor =
    parsedCustomMinor && parsedCustomMinor >= 50_000_00
      ? parsedCustomMinor
      : activePreset.targetMinor;

  // Top recomendaciones contextualizadas ("Next Best Action" de Karol Benavides) diversificadas por comercio
  const topContextualOffers = useMemo(() => {
    const crossed = crossReferenceOffers({
      offers: smartMap.offers,
      profile: smartMap.profile,
      userLat: smartMap.defaultLat,
      userLng: smartMap.defaultLng,
      currentHour: smartMap.currentHour,
      dayOfWeek: smartMap.dayOfWeek,
      filter: 'todas',
    });
    const uniqueByMerchant: typeof crossed = [];
    const seenMerchants = new Set<string>();
    for (const item of crossed) {
      if (!seenMerchants.has(item.merchantId)) {
        seenMerchants.add(item.merchantId);
        uniqueByMerchant.push(item);
      }
      if (uniqueByMerchant.length >= 2) break;
    }
    const finalSelection = uniqueByMerchant.length >= 2 ? uniqueByMerchant : crossed.slice(0, 2);
    return finalSelection.map((offer) => ({
      offer,
      impact: computeRealisticOfferImpact(offer),
    }));
  }, [smartMap]);

  // Tercera jugada: Suscripción marcada sin uso o recorte de domicilios con sobrecosto de app
  const thirdAction = useMemo(() => {
    if (potentialSubscriptionSavingsMinor > 0) {
      return {
        id: 'sub-rescue',
        badge: 'Suscripción sin uso detectada',
        badgeTone: 'warn' as const,
        title: `Cancelar ${unusedSubscriptionNames.join(', ') || 'suscripción marcada'}`,
        description: `Marcaste este cobro como «no lo uso». Cancelarlo hoy traslada ${cop(potentialSubscriptionSavingsMinor)} cada mes directo a tu meta.`,
        monthlyMinor: potentialSubscriptionSavingsMinor,
        href: '/app/cobros',
        ctaLabel: 'Ir a cancelar →',
      };
    }
    return {
      id: 'delivery-habit',
      badge: 'Hábito recurrente · Fuga en apps',
      badgeTone: 'terra' as const,
      title: 'Sustituir 4 domicilios de app por compra directa',
      description:
        'Evitar el recargo de servicio + tarifa de envío + propina en 4 pedidos al mes libera $38,400 netos para tu meta.',
      monthlyMinor: 38_400_00,
      href: '/app/movimientos',
      ctaLabel: 'Ver radiografía →',
    };
  }, [potentialSubscriptionSavingsMinor, unusedSubscriptionNames]);

  const allAvailableNbaIds = useMemo(
    () => [...topContextualOffers.map((x) => x.offer.offerId), thirdAction.id],
    [topContextualOffers, thirdAction.id],
  );

  // Ahorro mensual adicional activado en la simulación
  const committedMonthlyBoostMinor = useMemo(() => {
    let sum = 0;
    for (const id of committedNbaIds) {
      if (id === thirdAction.id) {
        sum += thirdAction.monthlyMinor;
      } else {
        const found = topContextualOffers.find((x) => x.offer.offerId === id);
        if (found) {
          sum += found.impact.monthlyImpactMinor;
        }
      }
    }
    return sum;
  }, [committedNbaIds, thirdAction, topContextualOffers]);

  // Potencial mensual total si aplica las 3 jugadas sugeridas
  const totalMonthlyNbaPotentialMinor = useMemo(() => {
    const offersSum = topContextualOffers.reduce(
      (acc, x) => acc + x.impact.monthlyImpactMinor,
      0,
    );
    return offersSum + thirdAction.monthlyMinor;
  }, [topContextualOffers, thirdAction.monthlyMinor]);

  const verifiedSavedMinor =
    activePreset.baseSavedMinor + Math.max(allTimeSavedMinor, monthSavedMinor);
  // Al simular jugadas mostramos el impacto proyectado de un trimestre (3 meses) sobre la barra
  const simulatedQuarterBoostMinor = committedMonthlyBoostMinor * 3;
  const projectedSavedMinor = Math.min(
    goalTargetMinor,
    verifiedSavedMinor + simulatedQuarterBoostMinor,
  );

  const verifiedPct = Math.min(
    100,
    Math.max(5, Math.round((verifiedSavedMinor / goalTargetMinor) * 100)),
  );
  const projectedPct = Math.min(
    100,
    Math.max(verifiedPct, Math.round((projectedSavedMinor / goalTargetMinor) * 100)),
  );
  const remainingMinor = Math.max(0, goalTargetMinor - projectedSavedMinor);

  // Cálculo de meses para llegar a la meta (Ritmo actual vs Ritmo acelerado con NBA)
  const baseMonthlyPaceMinor = activePreset.monthlyPaceMinor + Math.max(monthSavedMinor, 15_000_00);
  const acceleratedMonthlyPaceMinor =
    baseMonthlyPaceMinor +
    (committedMonthlyBoostMinor > 0 ? committedMonthlyBoostMinor : totalMonthlyNbaPotentialMinor);

  const rawRemainingFromVerified = Math.max(0, goalTargetMinor - verifiedSavedMinor);
  const monthsAtCurrentPace = Math.max(
    1,
    Math.ceil(rawRemainingFromVerified / Math.max(10_000_00, baseMonthlyPaceMinor)),
  );
  const monthsWithNba = Math.max(
    1,
    Math.ceil(rawRemainingFromVerified / Math.max(10_000_00, acceleratedMonthlyPaceMinor)),
  );
  const monthsSaved = Math.max(0, monthsAtCurrentPace - monthsWithNba);

  function handleSelectPreset(id: string) {
    setSelectedGoalId(id);
    setCustomTitle('');
    setCustomTargetText('');
    try {
      localStorage.setItem('cifra_goal_id', id);
      localStorage.removeItem('cifra_goal_custom_title');
      localStorage.removeItem('cifra_goal_custom_target');
    } catch {
      // Ignorar
    }
  }

  function handleSaveCustomGoal(e: React.FormEvent) {
    e.preventDefault();
    setEditingGoal(false);
    try {
      if (customTitle.trim()) localStorage.setItem('cifra_goal_custom_title', customTitle.trim());
      if (customTargetText.trim())
        localStorage.setItem('cifra_goal_custom_target', customTargetText.trim());
    } catch {
      // Ignorar
    }
  }

  function toggleCommitNba(id: string) {
    setCommittedNbaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleCommitAll() {
    setCommittedNbaIds((prev) =>
      prev.length === allAvailableNbaIds.length ? [] : allAvailableNbaIds,
    );
  }

  const allSelected = committedNbaIds.length === allAvailableNbaIds.length;

  return (
    <section
      id="metas-y-next-best-action"
      className="surface-card scroll-mt-20 overflow-hidden border-primary/25 p-5 sm:p-6"
      aria-label="Metas financieras y Next Best Action contextual"
    >
      {/* Cabecera: Pesos ahorrados + Meta Conectada */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-light text-primary-dark">
            <Target size={22} aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge-primary">
                <Sparkles size={12} aria-hidden="true" /> Meta de ahorro · Next Best Action
              </span>
              <span className="tnum rounded-full bg-paper px-2.5 py-0.5 text-[11.5px] font-bold text-primary-dark">
                +{cop(monthSavedMinor)} ahorrados este mes con CIFRA
              </span>
            </div>
            <h2 className="mt-1.5 font-display text-[20px] font-bold text-ink">
              {goalTitle}
            </h2>
            <p className="text-[13px] text-ink-muted">
              {customTitle.trim() ? 'Tu meta personalizada en curso' : activePreset.categoryHint} · Cada beneficio local y cada fuga que recortas te acerca más rápido.
            </p>
          </div>
        </div>

        <button
          id="btn-edit-goal"
          type="button"
          onClick={() => setEditingGoal((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[12px] font-bold text-ink-muted transition hover:border-ink hover:bg-white hover:text-ink"
        >
          <PencilLine size={13} aria-hidden="true" />
          <span>{editingGoal ? 'Cerrar ajuste' : 'Cambiar meta'}</span>
        </button>
      </div>

      {/* Selector rápido de metas o personalización */}
      {editingGoal && (
        <div className="mt-4 rounded-2xl border border-line bg-paper p-4">
          <p className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">
            Elige una meta sugerida o personaliza la tuya
          </p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
            {GOAL_PRESETS.map((preset) => {
              const active = selectedGoalId === preset.id && !customTitle;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-primary bg-primary-pale text-primary-dark shadow-2xs'
                      : 'border-line bg-white text-ink hover:border-ink-muted'
                  }`}
                >
                  <span className="block text-[13px] font-bold">{preset.title}</span>
                  <span className="tnum mt-1 block text-[12px] font-semibold text-ink-muted">
                    Meta: {cop(preset.targetMinor)}
                  </span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSaveCustomGoal} className="mt-3 grid gap-2.5 sm:grid-cols-3">
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Ej.: Comprar portátil / Viaje a Medellín"
              className="field text-[13.5px] sm:col-span-2"
            />
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={customTargetText}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, '');
                  setCustomTargetText(digits ? formatThousands(digits) : '');
                }}
                placeholder="Meta $ (ej: 1,500,000)"
                className="field tnum text-[13.5px]"
              />
              <button type="submit" className="btn-ink shrink-0 px-3.5 text-[13px]">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Panel de progreso de la meta con línea de tiempo acelerada */}
      <div className="mt-4 rounded-2xl border border-line/80 bg-paper p-4">
        <div className="tnum flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="font-display text-[28px] font-extrabold leading-none text-primary-dark">
              {cop(projectedSavedMinor)}
            </span>
            <span className="ml-2 text-[13.5px] font-medium text-ink-muted">
              de {cop(goalTargetMinor)} ({projectedPct}%)
            </span>
            {committedMonthlyBoostMinor > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-bold text-primary-dark">
                +{cop(simulatedQuarterBoostMinor)} proyectados (90d)
              </span>
            )}
          </div>
          <span className="text-[12.5px] font-semibold text-ink-soft">
            Te faltan <strong className="text-ink">{cop(remainingMinor)}</strong>
          </span>
        </div>

        {/* Barra de progreso de doble capa: Ahorro real + Proyección simulada */}
        <div className="relative mt-2.5 h-3.5 w-full overflow-hidden rounded-full bg-paper-deep">
          {projectedPct > verifiedPct && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary/35 transition-all duration-500"
              style={{ width: `${projectedPct}%` }}
            />
          )}
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-primary to-primary-dark transition-all duration-500"
            style={{ width: `${verifiedPct}%` }}
          />
        </div>

        {/* Comparativo de velocidad hacia la meta */}
        <div className="tnum mt-3 grid gap-2 border-t border-line/80 pt-3 text-[12px] sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <PiggyBank size={15} className="shrink-0 text-primary-dark" aria-hidden="true" />
            <span className="text-ink-muted">
              Acumulado hoy: <strong className="text-ink">{cop(verifiedSavedMinor)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <CalendarClock size={15} className="shrink-0 text-ink-muted" aria-hidden="true" />
            <span className="text-ink-muted">
              Ritmo actual: <strong className="text-ink">{monthsAtCurrentPace} meses</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-semibold text-primary-dark sm:justify-end">
            <TrendingUp size={15} className="shrink-0" aria-hidden="true" />
            <span>
              Con jugadas NBA:{' '}
              <strong>
                {monthsWithNba} {monthsWithNba === 1 ? 'mes' : 'meses'}
              </strong>
              {monthsSaved > 0 ? ` (${monthsSaved} m antes)` : ` (+${cop(totalMonthlyNbaPotentialMinor)}/mes)`}
            </span>
          </div>
        </div>
      </div>

      {/* Motor Next Best Action (NBA) Contextualizado por Hábito + Geolocalización */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass size={17} className="shrink-0 text-primary-dark" aria-hidden="true" />
            <div>
              <h3 className="font-display text-[16px] font-bold text-ink">
                Tus mejores jugadas de hoy (Next Best Action)
              </h3>
              <p className="text-[12px] text-ink-muted">
                Cruzamos tus hábitos reales de consumo con comercios aliados cercanos y cobros evitables:
              </p>
            </div>
          </div>

          <button
            id="btn-simulate-all-nba"
            type="button"
            onClick={toggleCommitAll}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-bold transition ${
              allSelected
                ? 'border-primary bg-primary text-white'
                : 'border-line bg-paper text-primary-dark hover:border-primary'
            }`}
          >
            <Zap size={12} aria-hidden="true" />
            <span>
              {allSelected
                ? 'Simulación activa (3 jugadas)'
                : `Simular las 3 jugadas (+${cop(totalMonthlyNbaPotentialMinor)}/mes)`}
            </span>
          </button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {topContextualOffers.map(({ offer, impact }) => {
            const isCommitted = committedNbaIds.includes(offer.offerId);

            return (
              <div
                key={offer.offerId}
                className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                  isCommitted
                    ? 'border-primary bg-primary-pale/55 shadow-2xs'
                    : 'border-line bg-white hover:border-primary/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-terra-pale px-2.5 py-0.5 text-[11px] font-bold text-terra-dark">
                      <MapPin size={11} className="shrink-0" aria-hidden="true" />
                      <span>
                        {offer.merchantName}
                        {offer.walkMinutes ? ` · a ${offer.walkMinutes} min` : ''}
                      </span>
                    </span>
                    <span className="tnum shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-extrabold text-primary-dark border border-primary/25">
                      +{cop(impact.monthlyImpactMinor)}/mes
                    </span>
                  </div>

                  <p className="mt-2.5 font-display text-[15px] font-bold leading-snug text-ink">
                    {offer.title}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                    <strong className="text-ink-soft">Por qué te hace sentido:</strong>{' '}
                    {offer.whyThisMatches}. Ahorras{' '}
                    <strong className="tnum text-ink">{cop(impact.perVisitMinor)}</strong> por visita ({impact.visitsPerMonth} veces/mes ={' '}
                    <span className="tnum font-semibold text-primary-dark">
                      {cop(impact.monthlyImpactMinor)}/mes
                    </span>
                    ).
                  </p>
                </div>

                <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5">
                  <button
                    type="button"
                    onClick={() => toggleCommitNba(offer.offerId)}
                    className={`inline-flex items-center gap-1 text-[12px] font-bold transition ${
                      isCommitted ? 'text-primary-dark' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <CheckCircle2 size={14} aria-hidden="true" />
                    <span>{isCommitted ? 'Sumado a tu meta' : 'Simular en mi meta'}</span>
                  </button>
                  <Link
                    href="/app/ofertas"
                    className="inline-flex shrink-0 items-center gap-0.5 text-[12px] font-bold text-primary-dark hover:underline"
                  >
                    <span>Ver código QR</span>
                    <ArrowRight size={12} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })}

          {/* Tarjeta 3 (Ancho completo en grid de 2 columnas): Suscripción o Hábito de Domicilios */}
          <div
            className={`flex flex-col justify-between rounded-2xl border p-4 transition sm:col-span-2 ${
              committedNbaIds.includes(thirdAction.id)
                ? 'border-primary bg-primary-pale/55 shadow-2xs'
                : 'border-line bg-white hover:border-primary/40'
            }`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      thirdAction.badgeTone === 'warn'
                        ? 'bg-warn-light text-warn'
                        : 'bg-terra-pale text-terra-dark'
                    }`}
                  >
                    {thirdAction.badgeTone === 'warn' ? (
                      <Flame size={11} className="shrink-0" aria-hidden="true" />
                    ) : (
                      <ShoppingBag size={11} className="shrink-0" aria-hidden="true" />
                    )}
                    <span>{thirdAction.badge}</span>
                  </span>
                  <span className="tnum rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-extrabold text-primary-dark border border-primary/25">
                    +{cop(thirdAction.monthlyMinor)}/mes
                  </span>
                </div>
                <p className="font-display text-[15px] font-bold text-ink">
                  {thirdAction.title}
                </p>
                <p className="text-[12.5px] text-ink-muted">
                  {thirdAction.description}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3 pt-1 sm:flex-col sm:items-end sm:pt-0">
                <button
                  type="button"
                  onClick={() => toggleCommitNba(thirdAction.id)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition ${
                    committedNbaIds.includes(thirdAction.id)
                      ? 'border-primary bg-white text-primary-dark'
                      : 'border-line bg-paper text-ink hover:border-ink'
                  }`}
                >
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <span>
                    {committedNbaIds.includes(thirdAction.id)
                      ? 'Sumado a tu meta'
                      : 'Simular en mi meta'}
                  </span>
                </button>
                <Link
                  href={thirdAction.href}
                  className="text-[12px] font-bold text-primary-dark hover:underline"
                >
                  {thirdAction.ctaLabel}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Últimos eventos de ahorro verificados con encabezado claro */}
      {recentEvents.length > 0 && (
        <div className="mt-4 rounded-xl border border-line/80 bg-paper/60 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2 text-[11.5px] font-bold uppercase tracking-wider text-ink-faint">
            <span>Últimos ahorros verificados en caja</span>
            <Link href="/app/ofertas" className="text-primary-dark hover:underline">
              Ver todos los beneficios →
            </Link>
          </div>
          <ul className="tnum mt-1.5 divide-y divide-line/70 text-[12.5px]">
            {recentEvents.slice(0, 2).map((ev) => (
              <li key={ev.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="truncate text-ink-soft">
                  {ev.label} <span className="text-ink-faint">· {shortDate(ev.occurredOn)}</span>
                </span>
                <span className="shrink-0 font-bold text-primary-dark">+{cop(ev.amountMinor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
