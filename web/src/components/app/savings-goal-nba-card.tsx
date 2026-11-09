'use client';

import {
  CheckCircle2,
  Compass,
  Flame,
  MapPin,
  PencilLine,
  PiggyBank,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { crossReferenceOffers } from '@/lib/engine/crossref';
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
  categoryHint: string;
}

const GOAL_PRESETS: GoalPreset[] = [
  {
    id: 'viaje',
    title: 'Viaje de descanso (Costa / Eje Cafetero)',
    targetMinor: 1_200_000_00,
    baseSavedMinor: 380_000_00,
    categoryHint: 'Vacaciones sin endeudarte con tarjeta',
  },
  {
    id: 'vehiculo',
    title: 'Cuota inicial moto / carro',
    targetMinor: 4_500_000_00,
    baseSavedMinor: 1_150_000_00,
    categoryHint: 'Ahorro programado de cada quincena',
  },
  {
    id: 'colchon',
    title: 'Fondo de tranquilidad (3 meses de fijos)',
    targetMinor: 2_400_000_00,
    baseSavedMinor: 650_000_00,
    categoryHint: 'Respaldo líquido intocable',
  },
];

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

  // Top recomendaciones contextualizadas ("Next Best Action" de Karol Benavides)
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
    return crossed.slice(0, 2);
  }, [smartMap]);

  const committedBoostMinor = useMemo(() => {
    let sum = 0;
    for (const id of committedNbaIds) {
      if (id === 'sub-rescue') {
        sum += potentialSubscriptionSavingsMinor;
      } else {
        const found = topContextualOffers.find((o) => o.offerId === id);
        if (found) {
          sum += Math.max(found.estimatedSavingsMinor, found.vsHabitualSavingsMinor) * 6;
        }
      }
    }
    return sum;
  }, [committedNbaIds, potentialSubscriptionSavingsMinor, topContextualOffers]);

  const currentSavedMinor =
    activePreset.baseSavedMinor + Math.max(allTimeSavedMinor, monthSavedMinor) + committedBoostMinor;
  const progressPct = Math.min(100, Math.max(6, Math.round((currentSavedMinor / goalTargetMinor) * 100)));
  const remainingMinor = Math.max(0, goalTargetMinor - currentSavedMinor);

  const monthlyGeoPotentialMinor = useMemo(() => {
    return topContextualOffers.reduce(
      (acc, o) => acc + Math.max(o.estimatedSavingsMinor, o.vsHabitualSavingsMinor) * 6,
      0,
    );
  }, [topContextualOffers]);

  const totalMonthlyAccelerationMinor =
    Math.max(monthSavedMinor, 25_000_00) +
    potentialSubscriptionSavingsMinor +
    monthlyGeoPotentialMinor;

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
      if (customTargetText.trim()) localStorage.setItem('cifra_goal_custom_target', customTargetText.trim());
    } catch {
      // Ignorar
    }
  }

  function toggleCommitNba(id: string) {
    setCommittedNbaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <section
      id="metas-y-next-best-action"
      className="surface-card overflow-hidden border-primary/25 p-5 sm:p-6"
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
                <Sparkles size={12} aria-hidden="true" /> Meta + Next Best Action
              </span>
              <span className="tnum text-[12px] font-semibold text-primary-dark">
                +{cop(monthSavedMinor)} ahorrados este mes con CIFRA
              </span>
            </div>
            <h2 className="mt-1 font-display text-[20px] font-bold text-ink">
              {goalTitle}
            </h2>
            <p className="text-[13px] text-ink-muted">
              Cada descuento en tu barrio y cada suscripción que recortas acelera tu meta real.
            </p>
          </div>
        </div>

        <button
          id="btn-edit-goal"
          type="button"
          onClick={() => setEditingGoal((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[12px] font-bold text-ink-muted transition hover:border-ink hover:bg-white hover:text-ink"
        >
          <PencilLine size={13} aria-hidden="true" />
          <span>{editingGoal ? 'Cerrar ajuste' : 'Cambiar meta'}</span>
        </button>
      </div>

      {/* Selector rápido de metas o personalización */}
      {editingGoal && (
        <div className="mt-4 rounded-2xl border border-line bg-paper p-4">
          <p className="text-[12.5px] font-bold uppercase tracking-wider text-ink-faint">
            Elige una meta o escribe la tuya
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

      {/* Barra de progreso de la meta */}
      <div className="mt-4 rounded-2xl bg-paper p-4">
        <div className="tnum flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="font-display text-[28px] font-extrabold leading-none text-primary-dark">
              {cop(currentSavedMinor)}
            </span>
            <span className="ml-2 text-[13.5px] font-medium text-ink-muted">
              de {cop(goalTargetMinor)} ({progressPct}%)
            </span>
          </div>
          <span className="text-[12.5px] font-semibold text-ink-soft">
            Te faltan <strong className="text-ink">{cop(remainingMinor)}</strong>
          </span>
        </div>

        <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-paper-deep">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dark transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="tnum mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <PiggyBank size={14} className="text-primary-dark" aria-hidden="true" />
            Ahorro verificado este mes: <strong className="text-ink">{cop(monthSavedMinor)}</strong>
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-primary-dark">
            <TrendingUp size={14} aria-hidden="true" />
            Potencial con Next Best Actions: +{cop(totalMonthlyAccelerationMinor)}/mes
          </span>
        </div>
      </div>

      {/* Motor Next Best Action (NBA) Contextualizado por Hábito + Geolocalización */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass size={17} className="text-primary-dark" aria-hidden="true" />
            <h3 className="font-display text-[16px] font-bold text-ink">
              Tu Next Best Action de hoy (basada en tus hábitos reales)
            </h3>
          </div>
          <span className="text-[11.5px] font-medium text-ink-faint">
            Cruce de consumo × cercanía GPS
          </span>
        </div>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {topContextualOffers.map((offer) => {
            const monthlyImpactMinor =
              Math.max(offer.estimatedSavingsMinor, offer.vsHabitualSavingsMinor) * 6;
            const isCommitted = committedNbaIds.includes(offer.offerId);

            return (
              <div
                key={offer.offerId}
                className={`flex flex-col justify-between rounded-2xl border p-3.5 transition ${
                  isCommitted
                    ? 'border-primary bg-primary-pale/60'
                    : 'border-line bg-white hover:border-primary/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-terra-pale px-2.5 py-0.5 text-[11px] font-bold text-terra-dark">
                      <MapPin size={11} aria-hidden="true" />
                      {offer.merchantName}
                      {offer.walkMinutes ? ` · a ${offer.walkMinutes} min` : ''}
                    </span>
                    <span className="tnum text-[12px] font-extrabold text-primary-dark">
                      +{cop(monthlyImpactMinor)}/mes
                    </span>
                  </div>

                  <p className="mt-2 font-display text-[14.5px] font-bold leading-snug text-ink">
                    {offer.title}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                    <strong className="text-ink-soft">Por qué te hace sentido:</strong>{' '}
                    {offer.whyThisMatches}. Si sustituyes 6 compras al mes aquí, sumas{' '}
                    <span className="tnum font-semibold text-primary-dark">
                      {cop(monthlyImpactMinor)}
                    </span>{' '}
                    directos a tu meta.
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5">
                  <button
                    type="button"
                    onClick={() => toggleCommitNba(offer.offerId)}
                    className={`inline-flex items-center gap-1 text-[12px] font-bold transition ${
                      isCommitted ? 'text-primary-dark' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <CheckCircle2 size={14} aria-hidden="true" />
                    <span>{isCommitted ? 'Sumado a tu simulación' : 'Simular en mi meta'}</span>
                  </button>
                  <Link
                    href="/app/ofertas"
                    className="text-[12px] font-bold text-primary-dark underline-offset-2 hover:underline"
                  >
                    Ver código QR →
                  </Link>
                </div>
              </div>
            );
          })}

          {potentialSubscriptionSavingsMinor > 0 && (
            <div
              className={`flex flex-col justify-between rounded-2xl border p-3.5 transition ${
                committedNbaIds.includes('sub-rescue')
                  ? 'border-primary bg-primary-pale/60'
                  : 'border-line bg-white hover:border-primary/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-warn-light px-2.5 py-0.5 text-[11px] font-bold text-warn">
                    <Flame size={11} aria-hidden="true" />
                    Suscripción sin uso detectada
                  </span>
                  <span className="tnum text-[12px] font-extrabold text-primary-dark">
                    +{cop(potentialSubscriptionSavingsMinor)}/mes
                  </span>
                </div>
                <p className="mt-2 font-display text-[14.5px] font-bold leading-snug text-ink">
                  Cancelar {unusedSubscriptionNames.join(', ') || 'suscripción marcada'}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                  Marcaste este cobro como «no lo uso». Cancelarlo hoy traslada{' '}
                  <span className="tnum font-semibold text-primary-dark">
                    {cop(potentialSubscriptionSavingsMinor)} cada mes
                  </span>{' '}
                  a tu meta de {goalTitle.toLowerCase()}.
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5">
                <button
                  type="button"
                  onClick={() => toggleCommitNba('sub-rescue')}
                  className="inline-flex items-center gap-1 text-[12px] font-bold text-ink-muted hover:text-ink"
                >
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <span>
                    {committedNbaIds.includes('sub-rescue')
                      ? 'Sumado a tu simulación'
                      : 'Simular en mi meta'}
                  </span>
                </button>
                <Link
                  href="/app/cobros"
                  className="text-[12px] font-bold text-primary-dark underline-offset-2 hover:underline"
                >
                  Ir a cancelar →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Últimos eventos de ahorro verificados */}
      {recentEvents.length > 0 && (
        <ul className="tnum mt-4 divide-y divide-line border-t border-line pt-2.5 text-[12.5px]">
          {recentEvents.slice(0, 2).map((ev) => (
            <li key={ev.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="truncate text-ink-muted">
                {ev.label} <span className="text-ink-faint">· {shortDate(ev.occurredOn)}</span>
              </span>
              <span className="shrink-0 font-semibold text-primary-dark">+{cop(ev.amountMinor)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
