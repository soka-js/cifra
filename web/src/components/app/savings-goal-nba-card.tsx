'use client';

import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Compass,
  Edit3,
  Flame,
  PiggyBank,
  PlusCircle,
  QrCode,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  activateAllNbaPlanAction,
  addGoalContributionAction,
  claimOfferCodeInlineAction,
  saveUserSavingsGoalAction,
  toggleNbaCommitmentAction,
  type ClaimCodeInlineResult,
} from '@/app/actions/v3';
import type { UserAppPreferences } from '@/lib/db/schema';
import { cop, parsePesosInput } from '@/lib/format';

export interface NextBestActionItem {
  id: string;
  badge: string;
  title: string;
  diagnosis: string;
  recommendation: string;
  monthlySavingsMinor: number;
  weeklyMissionText: string;
  ctaLabel: string;
  ctaHref: string;
  kind: 'merchant_offer' | 'subscription_cancel' | 'ant_leak';
  merchantName?: string;
  discountBadge?: string;
  offerId?: string;
  merchantKey?: string;
}

interface PresetGoal {
  id: string;
  title: string;
  categoryLabel: string;
  targetMinor: number;
  baseSavedMinor: number;
  defaultMonthlyPaceMinor: number;
}

const PRESET_GOALS: PresetGoal[] = [
  {
    id: 'moto_viaje',
    title: 'Viaje a Santa Marta + Tiquetes',
    categoryLabel: 'Viaje / Experiencia',
    targetMinor: 1_800_000_00,
    baseSavedMinor: 380_000_00,
    defaultMonthlyPaceMinor: 160_000_00,
  },
  {
    id: 'colchon_emergencia',
    title: 'Fondo de Tranquilidad (2 quincenas)',
    categoryLabel: 'Colchón de liquidez',
    targetMinor: 2_600_000_00,
    baseSavedMinor: 450_000_00,
    defaultMonthlyPaceMinor: 200_000_00,
  },
  {
    id: 'cuota_inicial',
    title: 'Cuota inicial Moto / Estudio',
    categoryLabel: 'Patrimonio / Educación',
    targetMinor: 4_500_000_00,
    baseSavedMinor: 650_000_00,
    defaultMonthlyPaceMinor: 280_000_00,
  },
];

interface SavingsGoalAndNbaCardProps {
  monthSavedMinor: number;
  allTimeSavedMinor: number;
  availableMinor: number;
  perDayMinor: number;
  daysLeft: number;
  topOffers: Array<{
    offer: {
      id: string;
      title: string;
      merchantName: string;
      neighborhood: string;
      discountKind: 'percent' | 'fixed';
      discountPercent: number | null;
      discountFixedMinor: number | null;
      targetCategory: string;
    };
    estimatedSavingsMinor: number;
    monthlySpendInCategoryMinor: number;
  }>;
  unusedRecurring: Array<{
    merchantKey: string;
    displayName: string;
    amountMinor: number;
  }>;
  deliverySpendMinor?: number;
  coffeeAndSnacksSpendMinor?: number;
  initialPreferences?: UserAppPreferences;
}

export function SavingsGoalAndNbaCard({
  monthSavedMinor,
  allTimeSavedMinor,
  availableMinor,
  topOffers,
  unusedRecurring,
  deliverySpendMinor = 185_000_00,
  coffeeAndSnacksSpendMinor = 96_000_00,
  initialPreferences,
}: SavingsGoalAndNbaCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initialPresetId = initialPreferences?.goalPresetId ?? 'moto_viaje';
  const [selectedGoalId, setSelectedGoalId] = useState<string>(initialPresetId);
  const [customTitle, setCustomTitle] = useState<string>(initialPreferences?.goalTitle ?? '');
  const [customCategory, setCustomCategory] = useState<string>(
    initialPreferences?.goalCategoryLabel ?? 'Meta personal',
  );
  const [customTargetMinor, setCustomTargetMinor] = useState<number>(
    initialPreferences?.goalTargetMinor ?? 1_800_000_00,
  );
  const [customSavedBaseMinor, setCustomSavedBaseMinor] = useState<number>(
    initialPreferences?.goalSavedBaseMinor ?? 380_000_00,
  );
  const [customPaceMinor, setCustomPaceMinor] = useState<number>(
    initialPreferences?.goalMonthlyPaceMinor ?? 160_000_00,
  );

  const [editingGoal, setEditingGoal] = useState(false);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [editTargetInput, setEditTargetInput] = useState('');
  const [editPaceInput, setEditPaceInput] = useState('');

  const [showContributeDrawer, setShowContributeDrawer] = useState(false);
  const [contribAmountInput, setContribAmountInput] = useState('50,000');
  const [contribLabelInput, setContribLabelInput] = useState('');
  const [contribDeductBalance, setContribDeductBalance] = useState(false);

  const [committedActionIds, setCommittedActionIds] = useState<string[]>(
    initialPreferences?.committedNbaIds ?? [],
  );
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [inlineClaimedCodes, setInlineClaimedCodes] = useState<Record<string, ClaimCodeInlineResult>>({});
  const [claimingOfferId, setClaimingOfferId] = useState<string | null>(null);

  const activeGoal = useMemo(() => {
    const preset = PRESET_GOALS.find((g) => g.id === selectedGoalId) ?? PRESET_GOALS[0]!;
    if (selectedGoalId === 'personalizada' || initialPreferences?.goalPresetId === selectedGoalId) {
      return {
        id: selectedGoalId,
        title: customTitle.trim() || preset.title,
        categoryLabel: customCategory.trim() || preset.categoryLabel,
        targetMinor: customTargetMinor > 0 ? customTargetMinor : preset.targetMinor,
        baseSavedMinor: customSavedBaseMinor >= 0 ? customSavedBaseMinor : preset.baseSavedMinor,
        defaultMonthlyPaceMinor: customPaceMinor > 0 ? customPaceMinor : preset.defaultMonthlyPaceMinor,
      };
    }
    return preset;
  }, [
    selectedGoalId,
    customTitle,
    customCategory,
    customTargetMinor,
    customSavedBaseMinor,
    customPaceMinor,
    initialPreferences?.goalPresetId,
  ]);

  const nbaItems = useMemo<NextBestActionItem[]>(() => {
    const list: NextBestActionItem[] = [];

    const firstOffer = topOffers[0];
    if (firstOffer) {
      const discLabel =
        firstOffer.offer.discountKind === 'percent' && firstOffer.offer.discountPercent
          ? `${firstOffer.offer.discountPercent} % DTO`
          : firstOffer.offer.discountFixedMinor
            ? `${cop(firstOffer.offer.discountFixedMinor)} DTO`
            : 'Beneficio vecinal';

      const monthlyPotMinor = Math.max(firstOffer.estimatedSavingsMinor, 24_000_00);
      const spendRefMinor = Math.max(firstOffer.monthlySpendInCategoryMinor, coffeeAndSnacksSpendMinor);

      list.push({
        id: `nba-offer-${firstOffer.offer.id}`,
        badge: 'Mejor Siguiente Acción · Barrio B2B2C',
        title: `Cambia 2 compras de la semana a ${firstOffer.offer.merchantName}`,
        diagnosis: `Este mes llevas ${cop(spendRefMinor)} en cafés, panadería y comidas fuera de casa.`,
        recommendation: `${firstOffer.offer.merchantName} (${firstOffer.offer.neighborhood}) tiene activo «${firstOffer.offer.title}» (${discLabel}). Te ahorras ${cop(monthlyPotMinor)}/mes sin dejar de darte gusto.`,
        monthlySavingsMinor: monthlyPotMinor,
        weeklyMissionText: `Misión de esta semana: redime 1 código QR en ${firstOffer.offer.merchantName} y suma +${cop(Math.round(monthlyPotMinor / 4))} a tu meta.`,
        ctaLabel: 'Ver en mapa',
        ctaHref: `/app/ofertas?destacada=${firstOffer.offer.id}`,
        kind: 'merchant_offer',
        merchantName: firstOffer.offer.merchantName,
        discountBadge: discLabel,
        offerId: firstOffer.offer.id,
      });
    }

    const unusedSub = unusedRecurring[0];
    if (unusedSub) {
      list.push({
        id: `nba-sub-${unusedSub.merchantKey}`,
        badge: 'Cobro Vampiro Detectado',
        title: `Cancela ${unusedSub.displayName} antes del próximo débito`,
        diagnosis: `Se debita automáticamente cada mes (${cop(unusedSub.amountMinor)}) y lo marcaste con bajo uso.`,
        recommendation: `Al cancelarlo liberas ${cop(unusedSub.amountMinor)} cada mes directo hacia tu meta «${activeGoal.title}».`,
        monthlySavingsMinor: unusedSub.amountMinor,
        weeklyMissionText: `Misión de hoy: confirma la cancelación en 1 clic y suma +${cop(unusedSub.amountMinor)} verificables a tu meta.`,
        ctaLabel: 'Ver cobros fijos',
        ctaHref: '/app/cobros',
        kind: 'subscription_cancel',
        merchantKey: unusedSub.merchantKey,
      });
    } else {
      const secondOffer = topOffers[1];
      const secondSavings = secondOffer ? Math.max(secondOffer.estimatedSavingsMinor, 28_000_00) : 34_000_00;
      list.push({
        id: 'nba-market-switch',
        badge: 'Optimización de Mercado',
        title: secondOffer
          ? `Haz tu compra fresca en ${secondOffer.offer.merchantName}`
          : 'Sustituye 1 pedido exprés por compra en fruver de tu cuadra',
        diagnosis: 'Los pedidos exprés con recargo de envío y tarifa dinámica encarecen tu canasta un 24 %.',
        recommendation: secondOffer
          ? `Con «${secondOffer.offer.title}» en ${secondOffer.offer.merchantName} ahorras ${cop(secondSavings)} al mes comprando a 4 minutos a pie.`
          : `Comprar fruta y panadería caminando en tu barrio libera ${cop(secondSavings)} al mes para tu meta.`,
        monthlySavingsMinor: secondSavings,
        weeklyMissionText: `Misión semanal: reemplaza 1 envío por compra local y libera +${cop(Math.round(secondSavings / 4))}.`,
        ctaLabel: 'Ver comercios aliados',
        ctaHref: '/app/ofertas',
        kind: 'merchant_offer',
        merchantName: secondOffer?.offer.merchantName ?? 'Fruver El Parque',
        discountBadge: 'Ahorro directo',
        offerId: secondOffer?.offer.id,
      });
    }

    const deliveryCutMinor = Math.max(42_000_00, Math.round(deliverySpendMinor * 0.25));
    list.push({
      id: 'nba-delivery-cap',
      badge: 'Control de Fuga Hormiga',
      title: 'Recorta 1 domicilio de fin de semana con recargo nocturno',
      diagnosis: `Detectamos ${cop(deliverySpendMinor)} en plataformas de domicilio y antojos nocturnos en los últimos 30 días.`,
      recommendation: `Bajar de 4 a 3 domicilios al mes te deja ${cop(deliveryCutMinor)} libres cada mes sin afectar tu calidad de vida.`,
      monthlySavingsMinor: deliveryCutMinor,
      weeklyMissionText: `Misión de este viernes: usa el evaluador «¿Puedo?» o pide directo al local sin recargo (+${cop(Math.round(deliveryCutMinor / 4))}).`,
      ctaLabel: 'Evaluar en ¿Puedo?',
      ctaHref: '/app/gasto',
      kind: 'ant_leak',
    });

    return list;
  }, [topOffers, unusedRecurring, deliverySpendMinor, coffeeAndSnacksSpendMinor, activeGoal.title]);

  const totalMonthlyNbaPotentialMinor = useMemo(
    () => nbaItems.reduce((acc, item) => acc + item.monthlySavingsMinor, 0),
    [nbaItems],
  );

  const committedMonthlyBoostMinor = useMemo(
    () =>
      nbaItems
        .filter((item) => committedActionIds.includes(item.id))
        .reduce((acc, item) => acc + item.monthlySavingsMinor, 0),
    [nbaItems, committedActionIds],
  );

  const verifiedSavedMinor = Math.min(
    activeGoal.targetMinor,
    activeGoal.baseSavedMinor + Math.max(monthSavedMinor, allTimeSavedMinor),
  );

  const basePaceMinor = Math.max(
    activeGoal.defaultMonthlyPaceMinor,
    availableMinor > 0 ? Math.min(350_000_00, Math.round(availableMinor * 0.25)) : activeGoal.defaultMonthlyPaceMinor,
  );
  const acceleratedPaceMinor = basePaceMinor + committedMonthlyBoostMinor;

  const remainingForGoalMinor = Math.max(0, activeGoal.targetMinor - verifiedSavedMinor);
  const monthsWithoutNba = Math.max(1, Math.ceil(remainingForGoalMinor / Math.max(1, basePaceMinor)));
  const monthsWithNba = Math.max(
    1,
    Math.ceil(remainingForGoalMinor / Math.max(1, basePaceMinor + totalMonthlyNbaPotentialMinor)),
  );
  const monthsActivePace = Math.max(1, Math.ceil(remainingForGoalMinor / Math.max(1, acceleratedPaceMinor)));
  const monthsSavedPotential = Math.max(1, monthsWithoutNba - monthsWithNba);

  const committedQuarterBoostMinor = committedMonthlyBoostMinor * 3;
  const projectedSavedWithCommitmentsMinor = Math.min(
    activeGoal.targetMinor,
    verifiedSavedMinor + committedQuarterBoostMinor,
  );

  const verifiedPct = Math.min(100, Math.max(5, Math.round((verifiedSavedMinor / activeGoal.targetMinor) * 100)));
  const projectedPct = Math.min(
    100,
    Math.max(verifiedPct, Math.round((projectedSavedWithCommitmentsMinor / activeGoal.targetMinor) * 100)),
  );

  function selectPresetGoal(id: string) {
    const preset = PRESET_GOALS.find((g) => g.id === id) ?? PRESET_GOALS[0]!;
    setSelectedGoalId(id);
    setCustomTitle(preset.title);
    setCustomCategory(preset.categoryLabel);
    setCustomTargetMinor(preset.targetMinor);
    setCustomSavedBaseMinor(preset.baseSavedMinor);
    setCustomPaceMinor(preset.defaultMonthlyPaceMinor);
    setEditingGoal(false);

    startTransition(async () => {
      const res = await saveUserSavingsGoalAction({
        goalPresetId: id,
        goalTitle: preset.title,
        goalCategoryLabel: preset.categoryLabel,
        goalTargetMinor: preset.targetMinor,
        goalSavedBaseMinor: preset.baseSavedMinor,
        goalMonthlyPaceMinor: preset.defaultMonthlyPaceMinor,
      });
      setFeedbackBanner(res.message);
      router.refresh();
    });
  }

  function openEditGoalDrawer() {
    setEditTitleInput(activeGoal.title);
    setEditTargetInput(Math.round(activeGoal.targetMinor / 100).toLocaleString('en-US'));
    setEditPaceInput(Math.round(activeGoal.defaultMonthlyPaceMinor / 100).toLocaleString('en-US'));
    setEditingGoal(true);
  }

  function handleSaveCustomGoal(e: React.FormEvent) {
    e.preventDefault();
    const parsedTarget = parsePesosInput(editTargetInput) ?? activeGoal.targetMinor;
    const parsedPace = parsePesosInput(editPaceInput) ?? activeGoal.defaultMonthlyPaceMinor;
    const cleanTitle = editTitleInput.trim() || activeGoal.title;

    setSelectedGoalId('personalizada');
    setCustomTitle(cleanTitle);
    setCustomCategory('Meta personalizada');
    setCustomTargetMinor(parsedTarget);
    setCustomPaceMinor(parsedPace);
    setEditingGoal(false);

    startTransition(async () => {
      const res = await saveUserSavingsGoalAction({
        goalPresetId: 'personalizada',
        goalTitle: cleanTitle,
        goalCategoryLabel: 'Meta personalizada',
        goalTargetMinor: parsedTarget,
        goalSavedBaseMinor: activeGoal.baseSavedMinor,
        goalMonthlyPaceMinor: parsedPace,
      });
      setFeedbackBanner(res.message);
      router.refresh();
    });
  }

  function handleAddContribution(e: React.FormEvent) {
    e.preventDefault();
    const parsedMinor = parsePesosInput(contribAmountInput);
    if (!parsedMinor || parsedMinor <= 0) {
      setFeedbackBanner('Escribe un monto válido en pesos para abonar a tu meta.');
      return;
    }

    startTransition(async () => {
      const res = await addGoalContributionAction({
        amountMinor: parsedMinor,
        label: contribLabelInput.trim() || `Abono a ${activeGoal.title}`,
        deductFromBalance: contribDeductBalance,
      });
      setFeedbackBanner(res.message);
      if (res.ok) {
        setShowContributeDrawer(false);
        setContribLabelInput('');
        router.refresh();
      }
    });
  }

  function handleToggleNbaCommitment(item: NextBestActionItem, recordImmediateWeekSaving = false) {
    startTransition(async () => {
      const res = await toggleNbaCommitmentAction({
        nbaId: item.id,
        nbaTitle: item.title,
        monthlySavingsMinor: item.monthlySavingsMinor,
        merchantKey: item.merchantKey,
        recordImmediateWeekSaving,
      });
      if (res.ok) {
        setCommittedActionIds(res.committedIds);
        setFeedbackBanner(res.message);
        router.refresh();
      }
    });
  }

  function handleActivateAllNba() {
    const allIds = nbaItems.map((i) => i.id);
    startTransition(async () => {
      const res = await activateAllNbaPlanAction(allIds);
      if (res.ok) {
        setCommittedActionIds(res.committedIds);
        setFeedbackBanner(res.message);
        router.refresh();
      }
    });
  }

  async function handleClaimOfferInline(offerId: string, itemId: string) {
    setClaimingOfferId(offerId);
    try {
      const res = await claimOfferCodeInlineAction(offerId);
      setInlineClaimedCodes((prev) => ({ ...prev, [itemId]: res }));
      if (res.ok && !committedActionIds.includes(itemId)) {
        const nbaItem = nbaItems.find((i) => i.id === itemId);
        if (nbaItem) {
          handleToggleNbaCommitment(nbaItem, false);
        }
      }
    } finally {
      setClaimingOfferId(null);
    }
  }

  return (
    <section
      aria-label="Meta de ahorro y Mejor Siguiente Acción"
      className="overflow-hidden rounded-3xl border border-primary/25 bg-white shadow-sm"
    >
      {/* Cabecera: Meta Financiera Activa + Selector rápido */}
      <div className="border-b border-line bg-gradient-to-br from-primary-pale/75 via-white to-paper px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
              <Target size={16} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary-dark">
                Meta de ahorro conectada a tus decisiones diarias
              </p>
              <h2 className="font-display text-[20px] font-bold leading-tight text-ink sm:text-[22px]">
                {activeGoal.title}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                disabled={isPending}
                onClick={() => selectPresetGoal(g.id)}
                className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition ${
                  selectedGoalId === g.id
                    ? 'bg-primary text-white shadow-xs'
                    : 'border border-line bg-white text-ink-muted hover:border-primary/40 hover:text-ink'
                }`}
              >
                {g.id === 'moto_viaje' ? 'Viaje / Moto' : g.id === 'colchon_emergencia' ? 'Emergencia' : 'Cuota Inicial'}
              </button>
            ))}
            <button
              type="button"
              onClick={() => (editingGoal ? setEditingGoal(false) : openEditGoalDrawer())}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[11.5px] font-semibold text-ink-muted transition hover:border-ink/40 hover:text-ink"
              title="Personalizar tu meta en pesos"
            >
              <Edit3 size={11} aria-hidden="true" />
              <span>Editar meta</span>
            </button>
            <button
              id="btn-open-goal-contribute"
              type="button"
              onClick={() => setShowContributeDrawer((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-primary-dark px-3 py-1 text-[11.5px] font-bold text-white shadow-xs transition hover:bg-primary"
            >
              <PlusCircle size={12} aria-hidden="true" />
              <span>+ Abonar a mi meta</span>
            </button>
          </div>
        </div>

        {feedbackBanner && (
          <div
            role="status"
            className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary-light/60 px-3.5 py-2 text-[12.5px] font-semibold text-primary-dark"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>{feedbackBanner}</span>
            </span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-[11px] underline hover:no-underline"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Cajón para editar meta en PostgreSQL */}
        {editingGoal && (
          <form
            onSubmit={handleSaveCustomGoal}
            className="mt-4 grid gap-3 rounded-2xl border border-primary/25 bg-white p-4 sm:grid-cols-[1.2fr_1fr_1fr_auto]"
          >
            <div>
              <label htmlFor="goal-title-input" className="text-[11.5px] font-semibold text-ink-muted">
                Nombre de tu meta
              </label>
              <input
                id="goal-title-input"
                type="text"
                value={editTitleInput}
                onChange={(e) => setEditTitleInput(e.target.value)}
                placeholder="Ej. Viaje a Medellín o computadores"
                className="field mt-1 py-2 text-[13.5px]"
              />
            </div>
            <div>
              <label htmlFor="goal-target-input" className="text-[11.5px] font-semibold text-ink-muted">
                Valor objetivo (COP)
              </label>
              <input
                id="goal-target-input"
                type="text"
                value={editTargetInput}
                onChange={(e) => setEditTargetInput(e.target.value)}
                placeholder="Ej. 1,800,000"
                className="field mt-1 py-2 text-[13.5px]"
              />
            </div>
            <div>
              <label htmlFor="goal-pace-input" className="text-[11.5px] font-semibold text-ink-muted">
                Aporte mensual base (COP)
              </label>
              <input
                id="goal-pace-input"
                type="text"
                value={editPaceInput}
                onChange={(e) => setEditPaceInput(e.target.value)}
                placeholder="Ej. 160,000"
                className="field mt-1 py-2 text-[13.5px]"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={isPending} className="btn-primary py-2.5 text-[13px]">
                {isPending ? 'Guardando...' : 'Guardar meta'}
              </button>
            </div>
          </form>
        )}

        {/* Cajón para registrar abono real en PostgreSQL */}
        {showContributeDrawer && (
          <form
            onSubmit={handleAddContribution}
            className="mt-4 rounded-2xl border border-primary/30 bg-white p-4 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-bold text-ink">
                Registrar abono real a «{activeGoal.title}»
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[20_000, 50_000, 100_000, 200_000].map((presetPesos) => (
                  <button
                    key={presetPesos}
                    type="button"
                    onClick={() => setContribAmountInput(presetPesos.toLocaleString('en-US'))}
                    className="rounded-lg border border-line bg-paper px-2.5 py-1 text-[11.5px] font-bold text-ink hover:border-primary/40 hover:bg-primary-pale"
                  >
                    +${presetPesos.toLocaleString('en-US')}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.3fr_auto]">
              <div>
                <label htmlFor="contrib-amount-input" className="text-[11.5px] font-semibold text-ink-muted">
                  Monto a abonar (COP)
                </label>
                <input
                  id="contrib-amount-input"
                  type="text"
                  value={contribAmountInput}
                  onChange={(e) => setContribAmountInput(e.target.value)}
                  placeholder="50,000"
                  className="field mt-1 py-2 font-mono text-[14px] font-bold"
                />
              </div>
              <div>
                <label htmlFor="contrib-label-input" className="text-[11.5px] font-semibold text-ink-muted">
                  Motivo o fuente del ahorro (opcional)
                </label>
                <input
                  id="contrib-label-input"
                  type="text"
                  value={contribLabelInput}
                  onChange={(e) => setContribLabelInput(e.target.value)}
                  placeholder="Ej. Ahorro de quincena / Evité domicilio"
                  className="field mt-1 py-2 text-[13.5px]"
                />
              </div>
              <div className="flex items-end">
                <button
                  id="btn-submit-goal-contribution"
                  type="submit"
                  disabled={isPending}
                  className="btn-primary w-full py-2.5 text-[13px] sm:w-auto"
                >
                  {isPending ? 'Abonando...' : 'Abonar ahora'}
                </button>
              </div>
            </div>

            <label className="mt-2.5 flex items-center gap-2 text-[12px] text-ink-muted">
              <input
                type="checkbox"
                checked={contribDeductBalance}
                onChange={(e) => setContribDeductBalance(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-line text-primary focus:ring-primary"
              />
              <span>Descontar también este abono del saldo líquido de mi billetera/cuenta</span>
            </label>
          </form>
        )}

        {/* Resumen numérico y barra de progreso */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="text-[11.5px] font-semibold text-ink-muted">Progreso acumulado verificado</span>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="tnum font-display text-[26px] font-extrabold text-ink">
                    {cop(verifiedSavedMinor)}
                  </span>
                  <span className="tnum text-[13.5px] font-medium text-ink-muted">
                    de {cop(activeGoal.targetMinor)} ({verifiedPct} %)
                  </span>
                </div>
              </div>

              {committedMonthlyBoostMinor > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-[11.5px] font-bold text-primary-dark">
                  <Sparkles size={12} aria-hidden="true" />
                  +{cop(committedQuarterBoostMinor)} trimestre con tu plan activo
                </span>
              )}
            </div>

            <div className="relative mt-3 h-3.5 w-full overflow-hidden rounded-full bg-paper-deep">
              {committedMonthlyBoostMinor > 0 && (
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary/35 transition-all duration-500"
                  style={{ width: `${projectedPct}%` }}
                />
              )}
              <div
                className="relative h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${verifiedPct}%` }}
              />
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <PiggyBank size={13} className="text-primary-dark" aria-hidden="true" />
                <span>
                  Ahorro verificado en CIFRA:{' '}
                  <strong className="tnum text-primary-dark">
                    +{cop(Math.max(monthSavedMinor, allTimeSavedMinor))}
                  </strong>
                </span>
              </span>
              <span className="tnum font-semibold text-ink">
                Faltan {cop(remainingForGoalMinor)}
              </span>
            </div>
          </div>

          {/* Comparador de velocidad: Sin jugadas vs Con Mejor Siguiente Acción */}
          <div className="flex flex-col justify-between rounded-2xl border border-primary/25 bg-primary-pale/55 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary-dark">
                  <CalendarClock size={13} aria-hidden="true" />
                  <span>Acelerador de Meta CIFRA</span>
                </p>
                <p className="mt-1 text-[13.5px] font-semibold text-ink">
                  Con las 3 jugadas recomendadas llegas{' '}
                  <span className="underline decoration-primary decoration-2 underline-offset-2">
                    {monthsSavedPotential} {monthsSavedPotential === 1 ? 'mes antes' : 'meses antes'}
                  </span>
                </p>
              </div>
              <span className="tnum shrink-0 rounded-xl bg-primary px-2.5 py-1 text-[12px] font-extrabold text-white">
                +{cop(totalMonthlyNbaPotentialMinor)}/mes
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-xl bg-white/85 px-3 py-2">
                <span className="block text-[11px] text-ink-faint">Ritmo normal</span>
                <strong className="tnum text-[14px] text-ink-muted">
                  {monthsWithoutNba} {monthsWithoutNba === 1 ? 'mes' : 'meses'}
                </strong>
                <span className="tnum block text-[11px] text-ink-faint">{cop(basePaceMinor)}/mes</span>
              </div>
              <div className="rounded-xl border border-primary/35 bg-white px-3 py-2">
                <span className="block text-[11px] font-semibold text-primary-dark">
                  {committedMonthlyBoostMinor > 0 ? 'Tu plan activo' : 'Con plan NBA'}
                </span>
                <strong className="tnum text-[14px] text-primary-dark">
                  {committedMonthlyBoostMinor > 0 ? monthsActivePace : monthsWithNba}{' '}
                  {(committedMonthlyBoostMinor > 0 ? monthsActivePace : monthsWithNba) === 1 ? 'mes' : 'meses'}
                </strong>
                <span className="tnum block text-[11px] font-semibold text-primary-dark">
                  {cop(committedMonthlyBoostMinor > 0 ? acceleratedPaceMinor : basePaceMinor + totalMonthlyNbaPotentialMinor)}/mes
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cuerpo: Motor de Mejor Siguiente Acción (Next Best Action) */}
      <div className="px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <Compass size={16} className="text-terra-dark" aria-hidden="true" />
              <h3 className="font-display text-[17px] font-bold text-ink">
                Tu Mejor Siguiente Acción (Next Best Action)
              </h3>
            </div>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              No solo te mostramos en qué se fue la plata: ejecuta cualquiera de estas 3 jugadas reales para acelerar tu meta.
            </p>
          </div>

          <button
            id="btn-activate-all-nba"
            type="button"
            disabled={isPending}
            onClick={handleActivateAllNba}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition ${
              committedActionIds.length === nbaItems.length
                ? 'bg-primary text-white shadow-xs'
                : 'border border-primary/35 bg-primary-pale text-primary-dark hover:bg-primary hover:text-white'
            }`}
          >
            <Zap size={14} aria-hidden="true" />
            <span>
              {committedActionIds.length === nbaItems.length
                ? 'Plan de 3 jugadas activo ✓'
                : `Activar plan de 3 jugadas (+${cop(totalMonthlyNbaPotentialMinor)}/mes)`}
            </span>
          </button>
        </div>

        <div className="mt-4 grid gap-3.5">
          {nbaItems.map((item, idx) => {
            const isCommitted = committedActionIds.includes(item.id);
            const claimedQr = inlineClaimedCodes[item.id];

            return (
              <article
                key={item.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 sm:p-5 transition ${
                  isCommitted
                    ? 'border-primary bg-primary-pale/35 shadow-xs'
                    : idx === 0
                      ? 'border-terra/35 bg-terra-pale/25'
                      : 'border-line bg-paper/45 hover:border-line-strong'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${
                        item.kind === 'merchant_offer'
                          ? 'bg-terra-pale text-terra-dark'
                          : item.kind === 'subscription_cancel'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-primary-light text-primary-dark'
                      }`}
                    >
                      {item.kind === 'merchant_offer' ? (
                        <Store size={11} aria-hidden="true" />
                      ) : item.kind === 'subscription_cancel' ? (
                        <Flame size={11} aria-hidden="true" />
                      ) : (
                        <TrendingUp size={11} aria-hidden="true" />
                      )}
                      <span>{item.badge}</span>
                    </span>

                    <span className="tnum rounded-lg bg-white px-2.5 py-0.5 text-[12.5px] font-extrabold text-primary-dark shadow-2xs">
                      +{cop(item.monthlySavingsMinor)}/mes
                    </span>
                  </div>

                  <h4 className="mt-2.5 font-display text-[15.5px] font-bold leading-snug text-ink">
                    {item.title}
                  </h4>

                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
                    {item.diagnosis}
                  </p>

                  <p className="mt-2 rounded-xl bg-white/90 px-3 py-2 text-[12.5px] leading-snug text-ink">
                    {item.recommendation}
                  </p>

                  {/* Si generó código QR en línea desde la NBA, mostrarlo listo para caja */}
                  {claimedQr?.ok && claimedQr.code && (
                    <div className="mt-2.5 rounded-xl border border-primary/40 bg-white p-3 text-center shadow-xs">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary-dark">
                        Código activo para caja ({claimedQr.merchantName})
                      </p>
                      <p className="mt-1 font-mono text-[20px] font-extrabold tracking-[0.18em] text-ink">
                        {claimedQr.code}
                      </p>
                      {claimedQr.qrDataUrl && (
                        <img
                          src={claimedQr.qrDataUrl}
                          alt={`QR ${claimedQr.code}`}
                          className="mx-auto mt-1.5 h-28 w-28 rounded-lg border border-line p-1"
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3.5 space-y-2 border-t border-line/70 pt-3">
                  <p className="text-[11.5px] font-medium text-ink-soft">
                    🎯 {item.weeklyMissionText}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggleNbaCommitment(item, false)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-bold transition ${
                        isCommitted
                          ? 'bg-primary text-white'
                          : 'border border-line-strong bg-white text-ink hover:border-primary hover:text-primary-dark'
                      }`}
                    >
                      <CheckCircle2 size={13} aria-hidden="true" />
                      <span>
                        {isCommitted
                          ? 'Comprometida en mi meta ✓'
                          : item.kind === 'subscription_cancel'
                            ? 'Cancelar cobro y sumar ahorro'
                            : 'Comprometer en mi meta'}
                      </span>
                    </button>

                    {item.offerId ? (
                      <button
                        type="button"
                        disabled={claimingOfferId === item.offerId}
                        onClick={() => handleClaimOfferInline(item.offerId!, item.id)}
                        className="inline-flex items-center gap-1 rounded-xl bg-terra px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-terra-dark"
                      >
                        <QrCode size={13} aria-hidden="true" />
                        <span>
                          {claimedQr?.ok
                            ? `Código: ${claimedQr.code}`
                            : claimingOfferId === item.offerId
                              ? 'Generando...'
                              : 'Activar QR ahora'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggleNbaCommitment(item, true)}
                        className="inline-flex items-center gap-1 text-[12px] font-bold text-primary-dark hover:underline"
                      >
                        <span>Abonar ahorro semanal</span>
                        <ArrowRight size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className="flex justify-end pt-0.5">
                    <Link
                      href={item.ctaHref}
                      className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink-muted hover:text-ink hover:underline"
                    >
                      <span>{item.ctaLabel}</span>
                      <ArrowRight size={11} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
