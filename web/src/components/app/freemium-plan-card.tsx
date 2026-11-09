'use client';

import { Award, CheckCircle2, Crown, Gift, Layers, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { cop } from '@/lib/format';

export function FreemiumPlanCard() {
  const [selectedTier, setSelectedTier] = useState<'esencial' | 'plus'>('plus');

  return (
    <section
      id="plan-freemium-cifra"
      className="surface-card scroll-mt-20 overflow-hidden border-primary/25 p-5 sm:p-6"
      aria-label="Arquitectura Freemium CIFRA Esencial y CIFRA Plus"
    >
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-primary">
              <Crown size={12} aria-hidden="true" /> Tu plan en CIFRA
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11.5px] font-bold text-emerald-900">
              ● CIFRA Plus bonificado ($0 este mes)
            </span>
          </div>
          <h2 className="mt-1.5 font-display text-[20px] font-bold text-ink">
            Modelo Freemium: Base gratuita siempre + Evolución Plus
          </h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
            Tu cifra disponible y los descuentos en tiendas de barrio son siempre gratis. Las herramientas avanzadas de riesgo, inversión y geolocalización predictiva hacen parte de <strong>CIFRA Plus</strong> (gratis al redimir 2 ofertas al mes o por {cop(9_900_00)}/mes).
          </p>
        </div>

        <div className="inline-flex shrink-0 self-start rounded-xl border border-line bg-paper p-1 text-[12px] font-bold">
          <button
            type="button"
            onClick={() => setSelectedTier('esencial')}
            className={`rounded-lg px-3 py-1.5 transition ${
              selectedTier === 'esencial'
                ? 'bg-ink text-white shadow-2xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Esencial ($0)
          </button>
          <button
            type="button"
            onClick={() => setSelectedTier('plus')}
            className={`rounded-lg px-3 py-1.5 transition ${
              selectedTier === 'plus'
                ? 'bg-ink text-white shadow-2xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            CIFRA Plus ({cop(9_900_00)}/mes)
          </button>
        </div>
      </div>

      {/* Barra de bonificación por actividad en comercios aliados (conecta Freemium + B2B2C) */}
      <div className="mt-4 rounded-2xl border border-primary/30 bg-primary-pale/55 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
          <span className="inline-flex items-center gap-1.5 font-bold text-primary-dark">
            <Gift size={15} aria-hidden="true" />
            <span>Beneficio B2B2C: ¡Tu mes de CIFRA Plus te sale en $0!</span>
          </span>
          <span className="tnum rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-extrabold text-primary-dark shadow-2xs">
            2 / 2 canjes completados este mes
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-primary to-primary-dark" />
        </div>
        <p className="mt-1.5 text-[12px] text-ink-soft">
          Redimiste beneficios en <strong>Panadería La Espiga</strong> y <strong>Fruver El Parque</strong>. Como la red de comercios financia el ecosistema, desbloqueas todas las funciones Plus sin pagar suscripción.
        </p>
      </div>

      <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
        {/* Columna 1: CIFRA Esencial (Gratis siempre, financiado por B2B2C) */}
        <div
          onClick={() => setSelectedTier('esencial')}
          className={`cursor-pointer rounded-2xl border p-4 transition ${
            selectedTier === 'esencial'
              ? 'border-ink bg-paper/90 shadow-2xs'
              : 'border-line bg-paper/45 hover:bg-paper/70'
          }`}
        >
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-[16.5px] font-bold text-ink">
              CIFRA Esencial
            </h3>
            <span className="tnum font-display text-[18px] font-extrabold text-ink">
              $0 <span className="text-[11.5px] font-normal text-ink-muted">/ siempre</span>
            </span>
          </div>
          <p className="mt-1 text-[12px] text-ink-muted">
            Para ordenar tu quincena sin costo y aprovechar ofertas locales.
          </p>

          <ul className="mt-3 space-y-2 text-[12.5px] text-ink-soft">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <span>Disponible seguro hasta tu próximo pago y Tope de Hoy</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <span>Carga de extractos PDF/CSV y captura rápida SMS en 3 segundos</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <span>Códigos QR de descuento en comercios de tu cuadra</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <span>Control total de tus datos y portabilidad Ley 1581</span>
            </li>
          </ul>
        </div>

        {/* Columna 2: CIFRA Plus (Freemium / Incluido en convenios y wallets) */}
        <div
          onClick={() => setSelectedTier('plus')}
          className={`cursor-pointer rounded-2xl border p-4 transition ${
            selectedTier === 'plus'
              ? 'border-primary bg-primary-pale/55 shadow-2xs'
              : 'border-line bg-white hover:border-primary/40'
          }`}
        >
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles size={15} className="text-primary-dark" aria-hidden="true" />
              <h3 className="font-display text-[16.5px] font-bold text-ink">
                CIFRA Plus
              </h3>
            </div>
            <div className="text-right">
              <span className="tnum font-display text-[18px] font-extrabold text-primary-dark">
                {cop(9_900_00)} <span className="text-[11.5px] font-normal text-ink-muted">/ mes</span>
              </span>
              <span className="block text-[10.5px] font-bold text-emerald-800">
                o $0 con 2 canjes/mes
              </span>
            </div>
          </div>
          <p className="mt-1 text-[12px] text-ink-muted">
            Inteligencia predictiva, metas aceleradas y alertas de riesgo.
          </p>

          <ul className="mt-3 space-y-2 text-[12.5px] text-ink-soft">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <span>
                <strong>Motor Next Best Action (Geo + Hábitos):</strong> Cruce en vivo de tus compras recurrentes con alternativas más baratas a pasos de ti
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <span>
                <strong>Dashboard Gráfico + Insights de Riesgo:</strong> Alertas tempranas de desviación de gasto y radiografía de fugas invisibles
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <span>
                <strong>Simulador de Cuotas TC y Metas de Ahorro/Inversión:</strong> Cálculo de sobrecosto E.A. y planeador de metas (viaje, vehículo, vivienda)
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[12.5px]">
        <span className="flex items-center gap-2 text-ink-muted">
          <Layers size={15} className="shrink-0 text-primary-dark" aria-hidden="true" />
          <span>
            ¿Representas una billetera digital, marca retail o cooperativa? Licenciamos el motor de CIFRA en marca blanca.
          </span>
        </span>
        <Link
          href="/desarrolladores#marca-blanca"
          className="font-bold text-primary-dark underline underline-offset-2 hover:text-ink"
        >
          Ver SDK Marca Blanca →
        </Link>
      </div>
    </section>
  );
}
