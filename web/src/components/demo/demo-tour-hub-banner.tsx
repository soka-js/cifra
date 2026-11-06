'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Pause,
  Play,
  Sparkles,
  Store,
  UserRound,
} from 'lucide-react';
import { DEMO_TOUR_STEPS, TourStep } from '@/lib/demo-tour-data';

export function DemoTourHubBanner() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'persona' | 'negocio'>('all');
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [autoPlayPreview, setAutoPlayPreview] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  const filteredSteps =
    selectedCategory === 'persona'
      ? DEMO_TOUR_STEPS.filter((s) => s.role === 'persona')
      : selectedCategory === 'negocio'
      ? DEMO_TOUR_STEPS.filter((s) => s.role === 'negocio')
      : DEMO_TOUR_STEPS;

  const currentStep: TourStep = filteredSteps[activeStepIndex] ?? filteredSteps[0] ?? DEMO_TOUR_STEPS[0]!;

  // Auto-avance en la vista previa del Hub si está activo
  useEffect(() => {
    if (!autoPlayPreview) return;
    const t = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % filteredSteps.length);
    }, 4500);
    return () => clearInterval(t);
  }, [autoPlayPreview, filteredSteps.length]);

  async function launchLiveTour(role: 'persona' | 'negocio' | 'all') {
    setIsLaunching(true);
    const targetStep =
      (role === 'negocio' ? DEMO_TOUR_STEPS.find((s) => s.role === 'negocio') : DEMO_TOUR_STEPS[0]) ??
      DEMO_TOUR_STEPS[0]!;

    try {
      await fetch('/api/demo/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: targetStep.role }),
      });
      localStorage.setItem('cifra_demo_tour_active', '1');
      const stepIdx = DEMO_TOUR_STEPS.indexOf(targetStep);
      router.push(`${targetStep.path}?tour=1&step=${stepIdx}&mode=${role}`);
    } catch (e) {
      console.error('Error launching tour:', e);
      setIsLaunching(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary-pale/90 via-white to-terra-pale/60 p-6 sm:p-8 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wider text-white">
              <Sparkles size={12} className="text-primary-light" />
              Nuevo en el Demo
            </span>
            <span className="text-[12.5px] font-bold text-primary-dark">
              Recorrido Automático Guiado
            </span>
          </div>
          <h2 className="mt-2 font-display text-[24px] font-extrabold text-ink sm:text-[30px] leading-tight">
            Descubre la propuesta de valor en piloto automático
          </h2>
          <p className="mt-1.5 max-w-2xl text-[14.5px] text-ink-muted leading-relaxed">
            Te guiamos paso a paso por las 9 innovaciones de CIFRA para el <strong>Cliente</strong> (Mariana) y el <strong>Tendero</strong> (Rosa): cálculo sin deuda de golpe, captura en 3s, simulador con cuotas TC, mapa de barrio, cuadre del local, margen honesto y caja POS.
          </p>
        </div>

        {/* Botones de lanzamiento directo */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          <button
            type="button"
            disabled={isLaunching}
            onClick={() => launchLiveTour('all')}
            className="btn-primary py-3 px-5 text-[14px] shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <Play size={15} className="fill-white" />
            <span>{isLaunching ? 'Iniciando...' : 'Iniciar Recorrido Completo (9 pasos)'}</span>
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={isLaunching}
              onClick={() => launchLiveTour('persona')}
              className="flex-1 btn-sm border border-line bg-white text-ink font-bold hover:bg-paper flex items-center justify-center gap-1.5 py-2.5"
              title="Recorrer solo las 4 funciones del cliente"
            >
              <UserRound size={14} className="text-primary-dark" />
              <span>Solo Cliente</span>
            </button>
            <button
              type="button"
              disabled={isLaunching}
              onClick={() => launchLiveTour('negocio')}
              className="flex-1 btn-sm border border-terra/30 bg-white text-terra-dark font-bold hover:bg-terra-pale flex items-center justify-center gap-1.5 py-2.5"
              title="Recorrer solo las 5 funciones del tendero"
            >
              <Store size={14} className="text-terra-dark" />
              <span>Solo Tendero</span>
            </button>
          </div>
        </div>
      </div>

      {/* Previsualizador interactivo de los pasos del tour en el Hub */}
      <div className="mt-6 rounded-2xl border border-line/80 bg-white/90 p-5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">
              Previsualizar pasos del tour:
            </span>
            <div className="flex items-center rounded-full border border-line bg-paper p-0.5 text-[11.5px] font-bold">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setActiveStepIndex(0);
                }}
                className={`rounded-full px-2.5 py-0.5 transition ${
                  selectedCategory === 'all' ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'
                }`}
              >
                Todos ({DEMO_TOUR_STEPS.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('persona');
                  setActiveStepIndex(0);
                }}
                className={`rounded-full px-2.5 py-0.5 transition ${
                  selectedCategory === 'persona'
                    ? 'bg-primary-dark text-white'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Cliente (4)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('negocio');
                  setActiveStepIndex(0);
                }}
                className={`rounded-full px-2.5 py-0.5 transition ${
                  selectedCategory === 'negocio'
                    ? 'bg-terra-dark text-white'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Tendero (5)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoPlayPreview(!autoPlayPreview)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                autoPlayPreview
                  ? 'bg-primary-pale text-primary-dark border border-primary/30'
                  : 'bg-paper text-ink-muted border border-line hover:text-ink'
              }`}
            >
              {autoPlayPreview ? <Pause size={11} /> : <Play size={11} className="fill-current" />}
              <span>{autoPlayPreview ? 'Pausar preview' : 'Auto-play preview'}</span>
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setActiveStepIndex(
                    (prev) => (prev - 1 + filteredSteps.length) % filteredSteps.length
                  )
                }
                className="grid h-7 w-7 place-items-center rounded-lg border border-line text-ink-muted hover:bg-paper hover:text-ink"
                title="Paso anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[12px] font-semibold text-ink px-1 tnum">
                {activeStepIndex + 1} / {filteredSteps.length}
              </span>
              <button
                type="button"
                onClick={() => setActiveStepIndex((prev) => (prev + 1) % filteredSteps.length)}
                className="grid h-7 w-7 place-items-center rounded-lg border border-line text-ink-muted hover:bg-paper hover:text-ink"
                title="Paso siguiente"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Tarjeta del paso activo */}
        <div className="mt-4 grid gap-4 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                  currentStep.badgeColor === 'primary'
                    ? 'bg-primary-light text-primary-dark'
                    : 'bg-terra-light text-terra-dark'
                }`}
              >
                {currentStep.role === 'persona' ? <UserRound size={11} /> : <Store size={11} />}
                {currentStep.badge}
              </span>
              <span className="text-[12px] font-semibold text-ink-muted">{currentStep.actor}</span>
            </div>

            <h3 className="font-display text-[20px] font-bold text-ink">{currentStep.title}</h3>

            <div className="grid gap-2 sm:grid-cols-2 text-[13px]">
              <div className="rounded-xl border border-neg/15 bg-neg/5 p-3 leading-snug text-ink-soft">
                <strong className="block text-neg mb-1 font-semibold">El problema:</strong>
                {currentStep.problem}
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary-pale p-3 leading-snug text-ink-soft">
                <strong className="block text-primary-dark mb-1 font-semibold">
                  Solución CIFRA:
                </strong>
                {currentStep.valueProp}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[12px]">
              <span className="inline-flex items-center gap-1.5 font-bold text-ink">
                <Sparkles size={13} className="text-primary-dark" />
                {currentStep.keyMetric}
              </span>
              <span className="inline-flex items-center gap-1 text-ink-muted text-[11.5px]">
                <Lightbulb size={12} className="text-amber-600" />
                {currentStep.interactiveTip}
              </span>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col justify-center items-stretch border-t lg:border-t-0 lg:border-l border-line/70 pt-3 lg:pt-0 lg:pl-6 space-y-3">
            <p className="text-[12.5px] text-ink-muted">
              Pantalla: <strong className="font-mono text-ink font-semibold">{currentStep.path}</strong>
            </p>
            <button
              type="button"
              disabled={isLaunching}
              onClick={async () => {
                setIsLaunching(true);
                try {
                  await fetch('/api/demo/session', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ role: currentStep.role }),
                  });
                  localStorage.setItem('cifra_demo_tour_active', '1');
                  const stepIdx = DEMO_TOUR_STEPS.indexOf(currentStep);
                  router.push(
                    `${currentStep.path}?tour=1&step=${stepIdx}&mode=${selectedCategory}`
                  );
                } catch (e) {
                  console.error(e);
                  setIsLaunching(false);
                }
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm ${
                currentStep.role === 'persona'
                  ? 'bg-primary-dark hover:bg-primary'
                  : 'bg-terra-dark hover:bg-terra'
              }`}
            >
              <span>Abrir esta pantalla en vivo</span>
              <ArrowRight size={14} />
            </button>
            <p className="text-[11px] text-center text-ink-faint">
              Cambia la sesión demo automáticamente y activa el tour.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
