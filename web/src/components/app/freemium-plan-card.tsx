'use client';

import {
  CheckCircle2,
  Crown,
  Sparkles,
  Store,
  Ticket,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateUserPlanTierAction } from '@/app/actions/v3';
import { cop } from '@/lib/format';

interface FreemiumPlanCardProps {
  initialPlanTier?: 'esencial' | 'plus';
  monthlyRedemptionsUsed?: number;
  recentMerchantNames?: string[];
}

export function FreemiumPlanCard({
  initialPlanTier = 'esencial',
  monthlyRedemptionsUsed = 2,
  recentMerchantNames = ['Panadería La Espiga', 'Fruver El Parque'],
}: FreemiumPlanCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTier, setActiveTier] = useState<'esencial' | 'plus'>(initialPlanTier);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const freeQuotaLimit = 2;
  const usedInFree = Math.min(freeQuotaLimit, monthlyRedemptionsUsed);
  const usedPct = activeTier === 'plus' ? 100 : Math.min(100, Math.round((usedInFree / freeQuotaLimit) * 100));

  function handleSelectTier(nextTier: 'esencial' | 'plus') {
    setActiveTier(nextTier);
    startTransition(async () => {
      const res = await updateUserPlanTierAction(nextTier);
      if (res.ok) {
        setActiveTier(res.planTier);
        setFeedbackMessage(res.message);
        router.refresh();
      }
    });
  }

  return (
    <section
      aria-label="Planes CIFRA Esencial y CIFRA Plus"
      className="overflow-hidden rounded-3xl border border-primary/25 bg-white shadow-sm"
    >
      <div className="border-b border-line bg-gradient-to-r from-primary-pale/75 via-white to-terra-pale/45 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
                <Crown size={11} aria-hidden="true" />
                <span>Modelo Freemium Sostenible</span>
              </span>
              <span className="rounded-full bg-terra-pale px-2.5 py-0.5 text-[11px] font-bold text-terra-dark">
                Plan activo: {activeTier === 'plus' ? 'CIFRA Plus ($9,900/mes)' : 'CIFRA Esencial ($0/mes)'}
              </span>
            </div>
            <h2 className="mt-1.5 font-display text-[21px] font-bold leading-tight text-ink">
              Tu Plan en CIFRA: Claridad 100 % Gratis + Beneficios Ilimitados en CIFRA Plus
            </h2>
            <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-muted">
              Ordenar tus cuentas, calcular tu disponible diario y detectar cobros vampiro es y será siempre <strong>$0</strong>. Incluye 2 cupones B2B2C gratis cada mes; si redimes más, <strong>CIFRA Plus ($9,900/mes)</strong> se paga solo desde tu segundo canje.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white px-4 py-2.5 text-right shadow-2xs">
            <span className="block text-[11px] font-semibold text-ink-muted">
              Cupo mensual de ofertas B2B2C
            </span>
            <span className="tnum font-display text-[19px] font-extrabold text-primary-dark">
              {activeTier === 'plus'
                ? `Ilimitado (${monthlyRedemptionsUsed} redimidos)`
                : `${usedInFree} / ${freeQuotaLimit} redimidos`}
            </span>
          </div>
        </div>

        {feedbackMessage && (
          <div
            role="status"
            className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary-light/60 px-3.5 py-2 text-[12.5px] font-semibold text-primary-dark"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>{feedbackMessage}</span>
            </span>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="text-[11px] underline hover:no-underline"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        {/* Plan Esencial Gratis */}
        <div
          className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
            activeTier === 'esencial'
              ? 'border-primary bg-primary-pale/30 shadow-xs'
              : 'border-line bg-paper/45'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-ink shadow-2xs">
                CIFRA Esencial
              </span>
              <span className="font-display text-[22px] font-extrabold text-ink">$0 / mes</span>
            </div>
            <p className="mt-1.5 text-[12.5px] text-ink-muted">
              Para organizar tu quincena sin fricción y empezar a ahorrar en tu cuadra.
            </p>

            <ul className="mt-3.5 space-y-2 text-[12.5px] text-ink">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary-dark" />
                <span>Cálculo diario de tu cifra libre y resta explicada paso a paso</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary-dark" />
                <span>Detector de cobros vampiro y alertas tempranas de desviación</span>
              </li>
              <li className="flex items-start gap-2">
                <Ticket size={14} className="mt-0.5 shrink-0 text-terra-dark" />
                <span>
                  <strong>Hasta 2 redenciones QR al mes</strong> en comercios de barrio (ahorro promedio de {cop(8_500_00)})
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary-dark" />
                <span>Lectura local de 1 extracto bancario al mes + captura rápida 3s</span>
              </li>
            </ul>
          </div>

          <div className="mt-4 border-t border-line/70 pt-3">
            <div className="mb-2 flex items-center justify-between text-[11.5px]">
              <span className="font-semibold text-ink-muted">Uso de cupones gratuitos este mes</span>
              <span className="tnum font-bold text-terra-dark">
                {usedInFree} de {freeQuotaLimit} usados
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-paper-deep">
              <div className="h-full rounded-full bg-terra transition-all" style={{ width: `${usedPct}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-ink-faint">
              {recentMerchantNames.length > 0
                ? `Canjes verificados: ${recentMerchantNames.slice(0, 2).join(' y ')}.`
                : 'Aún no has redimido tus 2 cupones gratuitos de este mes.'}
            </p>
            <button
              id="btn-plan-esencial"
              type="button"
              disabled={isPending}
              onClick={() => handleSelectTier('esencial')}
              className={`mt-3 w-full rounded-xl py-2 text-[12.5px] font-bold transition ${
                activeTier === 'esencial'
                  ? 'bg-ink text-white'
                  : 'border border-line-strong bg-white text-ink hover:bg-paper'
              }`}
            >
              {activeTier === 'esencial' ? 'Plan Esencial Activo ✓' : 'Cambiar a Plan Esencial ($0)'}
            </button>
          </div>
        </div>

        {/* Plan CIFRA Plus */}
        <div
          className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
            activeTier === 'plus'
              ? 'border-terra bg-terra-pale/30 shadow-xs'
              : 'border-terra/35 bg-gradient-to-b from-terra-pale/20 to-white'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-terra px-2.5 py-0.5 text-[11px] font-bold text-white">
                <Sparkles size={11} aria-hidden="true" />
                <span>CIFRA Plus</span>
              </span>
              <div className="text-right">
                <span className="tnum font-display text-[22px] font-extrabold text-terra-dark">
                  {cop(9_900_00)}
                </span>
                <span className="text-[11.5px] font-medium text-ink-muted"> / mes</span>
              </div>
            </div>
            <p className="mt-1.5 text-[12.5px] text-ink-muted">
              Para quienes usan múltiples bancos/billeteras y ahorran todas las semanas en el barrio.
            </p>

            <ul className="mt-3.5 space-y-2 text-[12.5px] text-ink">
              <li className="flex items-start gap-2">
                <Zap size={14} className="mt-0.5 shrink-0 text-terra-dark" />
                <span>
                  <strong>Redenciones QR ilimitadas</strong> en toda la red de comercios y Ofertas Relámpago (ahorro típico de {cop(46_000_00)}/mes)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <TrendingUp size={14} className="mt-0.5 shrink-0 text-primary-dark" />
                <span>
                  <strong>Multi-banco ilimitado:</strong> consolida Bancolombia + Nequi + Nu + Davivienda + Lulo sin límite de extractos
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Store size={14} className="mt-0.5 shrink-0 text-primary-dark" />
                <span>
                  <strong>Motor Next Best Action Pro:</strong> metas múltiples simultáneas y simulador de cuotas TC con alerta de tasa de usura
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary-dark" />
                <span>Acceso anticipado 15 min antes a cupos relámpago de cero merma</span>
              </li>
            </ul>
          </div>

          <div className="mt-4 border-t border-line/70 pt-3">
            <div className="rounded-xl bg-white/90 px-3 py-2 text-[11.5px] text-ink-soft">
              💡 <strong>Retorno inmediato:</strong> Con 3 cafés o almuerzos con descuento al mes ahorras{' '}
              <strong className="tnum text-primary-dark">{cop(24_000_00)}</strong> — más del doble de los {cop(9_900_00)} del plan.
            </div>
            <button
              id="btn-plan-plus"
              type="button"
              disabled={isPending}
              onClick={() => handleSelectTier('plus')}
              className={`mt-3 w-full rounded-xl py-2 text-[12.5px] font-bold transition ${
                activeTier === 'plus'
                  ? 'bg-terra text-white shadow-xs'
                  : 'bg-primary text-white hover:bg-primary-dark'
              }`}
            >
              {activeTier === 'plus'
                ? 'CIFRA Plus Activo ($9,900/mes) ✓'
                : 'Activar CIFRA Plus ($9,900/mes)'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
