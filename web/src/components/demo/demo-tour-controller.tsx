'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Lightbulb,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Store,
  UserRound,
  X,
} from 'lucide-react';
import { DEMO_TOUR_STEPS, TourStep } from '@/lib/demo-tour-data';

export function DemoTourController({
  isDemo = true,
  currentRole = 'persona',
}: {
  isDemo?: boolean;
  currentRole?: 'persona' | 'negocio';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Modo del tour: 'all' (completo), 'persona' (solo cliente), 'negocio' (solo tendero)
  const [filterMode, setFilterMode] = useState<'all' | 'persona' | 'negocio'>('all');
  const [active, setActive] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [progressSeconds, setProgressSeconds] = useState(0);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const [showStepList, setShowStepList] = useState(false);

  // Filtrar pasos según el modo seleccionado
  const steps = useMemo(() => {
    if (filterMode === 'persona') return DEMO_TOUR_STEPS.filter((s) => s.role === 'persona');
    if (filterMode === 'negocio') return DEMO_TOUR_STEPS.filter((s) => s.role === 'negocio');
    return DEMO_TOUR_STEPS;
  }, [filterMode]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep: TourStep = steps[currentStepIndex] ?? steps[0] ?? DEMO_TOUR_STEPS[0]!;

  // Escuchar si viene por URL ?tour=1 o localStorage
  useEffect(() => {
    const hasTourParam = searchParams.get('tour') === '1';
    const stepParam = searchParams.get('step');
    const modeParam = searchParams.get('mode') as 'all' | 'persona' | 'negocio' | null;

    if (modeParam && ['all', 'persona', 'negocio'].includes(modeParam)) {
      setFilterMode(modeParam);
    }

    if (hasTourParam) {
      setActive(true);
      if (stepParam !== null) {
        const idx = parseInt(stepParam, 10);
        if (!isNaN(idx) && idx >= 0 && idx < steps.length) {
          setCurrentStepIndex(idx);
        }
      }
    } else {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('cifra_demo_tour_active') : null;
      if (saved === '1') {
        setActive(true);
      }
    }
  }, [searchParams, steps.length]);

  // Sincronizar el paso con la ruta si el usuario navega a mano
  useEffect(() => {
    if (!active) return;
    const matchingIdx = steps.findIndex((s) => s.path === pathname && s.role === currentRole);
    if (matchingIdx >= 0 && matchingIdx !== currentStepIndex) {
      setCurrentStepIndex(matchingIdx);
      setProgressSeconds(0);
    }
  }, [pathname, currentRole, active, steps, currentStepIndex]);

  // Temporizador para auto-reproducción
  useEffect(() => {
    if (!active || !autoPlay || minimized || isSwitchingRole) return;

    const interval = setInterval(() => {
      setProgressSeconds((prev) => {
        const targetDuration = currentStep?.durationSeconds || 10;
        if (prev + 1 >= targetDuration) {
          handleNext();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [active, autoPlay, minimized, isSwitchingRole, currentStepIndex, currentStep]);

  // Transición al siguiente paso con cambio de rol automático si corresponde
  async function goToStep(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= steps.length) {
      // Fin del recorrido
      setActive(false);
      localStorage.removeItem('cifra_demo_tour_active');
      return;
    }

    const nextStep = steps[nextIndex];
    if (!nextStep) {
      setActive(false);
      localStorage.removeItem('cifra_demo_tour_active');
      return;
    }
    setCurrentStepIndex(nextIndex);
    setProgressSeconds(0);

    // Si el siguiente paso requiere cambiar de rol (ej. de Persona a Negocio o viceversa)
    if (nextStep.role !== currentRole) {
      setIsSwitchingRole(true);
      try {
        await fetch('/api/demo/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ role: nextStep.role }),
        });
      } catch (e) {
        console.error('Error switching demo session:', e);
      } finally {
        setIsSwitchingRole(false);
      }
    }

    localStorage.setItem('cifra_demo_tour_active', '1');
    router.push(`${nextStep.path}?tour=1&step=${nextIndex}&mode=${filterMode}`);
    router.refresh();
  }

  function handleNext() {
    if (currentStepIndex + 1 < steps.length) {
      goToStep(currentStepIndex + 1);
    } else {
      // Al terminar, volver al inicio o pausar
      setAutoPlay(false);
    }
  }

  function handlePrev() {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }

  function handleCloseTour() {
    setActive(false);
    localStorage.removeItem('cifra_demo_tour_active');
    // Limpiar query params de la URL
    const url = new URL(window.location.href);
    url.searchParams.delete('tour');
    url.searchParams.delete('step');
    url.searchParams.delete('mode');
    router.replace(url.pathname);
  }

  function startTour(mode: 'all' | 'persona' | 'negocio' = 'all') {
    setFilterMode(mode);
    setActive(true);
    setMinimized(false);
    setAutoPlay(true);
    setCurrentStepIndex(0);
    setProgressSeconds(0);
    localStorage.setItem('cifra_demo_tour_active', '1');

    const first = (mode === 'negocio' ? DEMO_TOUR_STEPS.find((s) => s.role === 'negocio') : DEMO_TOUR_STEPS[0]) ?? DEMO_TOUR_STEPS[0]!;
    const targetIdx = steps.findIndex((s) => s.id === first.id);
    goToStep(targetIdx >= 0 ? targetIdx : 0);
  }

  // Si no está en demo, no renderizar nada
  if (!isDemo) return null;

  // Botón flotante para abrir el tour si está inactivo
  if (!active) {
    return (
      <div className="no-print fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6">
        <button
          type="button"
          onClick={() => startTour('all')}
          className="group flex items-center gap-2 rounded-full border border-primary/40 bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-xl transition-all duration-200 hover:scale-105 hover:bg-black active:scale-95"
          title="Ver cómo funciona CIFRA y su propuesta de valor paso a paso"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
            <Play size={10} className="fill-white" />
          </span>
          <span>Recorrido Automático Demo</span>
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-bold text-primary-light">
            9 pasos
          </span>
        </button>
      </div>
    );
  }

  // Modo minimizado
  if (minimized) {
    return (
      <div className="no-print fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6">
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-white/95 p-2 shadow-2xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => setAutoPlay(!autoPlay)}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-paper text-ink transition hover:bg-line active:scale-95"
            title={autoPlay ? 'Pausar avance automático' : 'Reanudar avance automático'}
          >
            {autoPlay ? <Pause size={14} /> : <Play size={14} className="fill-current" />}
          </button>

          <button
            type="button"
            onClick={() => setMinimized(false)}
            className="flex items-center gap-2 px-2 text-left"
          >
            <span className="block text-[12px] font-bold text-ink truncate max-w-[160px]">
              {currentStepIndex + 1}/{steps.length}: {currentStep.title}
            </span>
            <Maximize2 size={13} className="text-ink-muted" />
          </button>

          <button
            type="button"
            onClick={handleCloseTour}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-paper hover:text-ink"
            title="Cerrar recorrido"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  const duration = currentStep.durationSeconds || 10;
  const progressPercent = Math.min(100, Math.round((progressSeconds / duration) * 100));

  return (
    <aside
      aria-label="Recorrido guiado de la demostración"
      className="no-print fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-2xl sm:bottom-5"
    >
      <div className="overflow-hidden rounded-3xl border border-line bg-white/95 shadow-2xl backdrop-blur-xl transition-all duration-300">
        {/* Barra superior del controlador */}
        <div className="flex items-center justify-between border-b border-line/70 bg-paper/60 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${
                currentStep.badgeColor === 'primary'
                  ? 'bg-primary-light text-primary-dark'
                  : 'bg-terra-light text-terra-dark'
              }`}
            >
              {currentStep.role === 'persona' ? <UserRound size={11} /> : <Store size={11} />}
              {currentStep.badge}
            </span>

            <span className="text-[12px] font-bold text-ink-muted">
              Paso {currentStepIndex + 1} de {steps.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Selector de modo */}
            <div className="hidden sm:flex items-center rounded-full border border-line bg-white p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => {
                  setFilterMode('all');
                  setCurrentStepIndex(0);
                  setProgressSeconds(0);
                }}
                className={`rounded-full px-2 py-0.5 transition ${
                  filterMode === 'all' ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'
                }`}
              >
                Todos (9)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode('persona');
                  setCurrentStepIndex(0);
                  setProgressSeconds(0);
                }}
                className={`rounded-full px-2 py-0.5 transition ${
                  filterMode === 'persona' ? 'bg-primary-dark text-white' : 'text-ink-muted hover:text-ink'
                }`}
              >
                Cliente (4)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode('negocio');
                  setCurrentStepIndex(0);
                  setProgressSeconds(0);
                }}
                className={`rounded-full px-2 py-0.5 transition ${
                  filterMode === 'negocio' ? 'bg-terra-dark text-white' : 'text-ink-muted hover:text-ink'
                }`}
              >
                Tendero (5)
              </button>
            </div>

            {/* Minimizar */}
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted hover:bg-paper hover:text-ink"
              title="Minimizar panel del recorrido"
            >
              <Minimize2 size={13} />
            </button>

            {/* Cerrar */}
            <button
              type="button"
              onClick={handleCloseTour}
              className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted hover:bg-paper hover:text-ink"
              title="Salir del recorrido"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Contenido principal del paso */}
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[18px] font-extrabold text-ink sm:text-[20px]">
              {currentStep.title}
            </h2>
            <span className="text-[12px] font-semibold text-ink-muted">
              {currentStep.actor}
            </span>
          </div>

          {/* Grilla: Dolor vs Solución de valor */}
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-2xl border border-neg/15 bg-neg/5 p-3 text-[12.5px] leading-snug text-ink-soft">
              <span className="mb-1 block font-bold text-neg">El dolor real:</span>
              {currentStep.problem}
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary-pale p-3 text-[12.5px] leading-snug text-ink-soft">
              <span className="mb-1 block font-bold text-primary-dark">La propuesta de CIFRA:</span>
              {currentStep.valueProp}
            </div>
          </div>

          {/* Métrica clave + Tip interactivo */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-paper px-3.5 py-2.5 text-[12.5px]">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-primary-dark shrink-0" />
              <strong className="text-ink font-bold">{currentStep.keyMetric}</strong>
            </div>
            <div className="flex items-center gap-1.5 text-ink-muted text-[11.5px]">
              <Lightbulb size={13} className="text-amber-600 shrink-0" />
              <span>{currentStep.interactiveTip}</span>
            </div>
          </div>

          {/* Estado de cambio de rol */}
          {isSwitchingRole && (
            <div className="mt-2 text-center text-[12px] font-bold text-terra-dark animate-pulse">
              🔄 Cambiando sesión al perfil de {currentStep.role === 'negocio' ? 'Rosa (Tendero)' : 'Mariana (Cliente)'}...
            </div>
          )}

          {/* Lista de pasos desplegable para saltar directo */}
          {showStepList && (
            <div className="mt-3 max-h-48 overflow-y-auto rounded-2xl border border-line bg-white p-2 text-[12px] space-y-1">
              {steps.map((st, i) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setShowStepList(false);
                    goToStep(i);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left transition ${
                    i === currentStepIndex
                      ? 'bg-ink font-bold text-white'
                      : 'hover:bg-paper text-ink-soft'
                  }`}
                >
                  <span className="truncate">
                    {i + 1}. {st.title}
                  </span>
                  <span className="text-[10.5px] uppercase opacity-80 shrink-0 ml-2">
                    {st.role === 'persona' ? 'Cliente' : 'Tendero'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Barra de progreso de auto-avance */}
        <div className="h-1 w-full bg-line/60">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              autoPlay ? (currentStep.role === 'persona' ? 'bg-primary' : 'bg-terra') : 'bg-ink-muted/40'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Barra de controles inferiores */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 bg-paper/50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              type="button"
              onClick={() => setAutoPlay(!autoPlay)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition active:scale-95 ${
                autoPlay
                  ? 'border border-primary/30 bg-primary-pale text-primary-dark'
                  : 'border border-line bg-white text-ink-muted hover:text-ink'
              }`}
              title={autoPlay ? 'Pausar avance automático' : 'Activar avance automático cada 10s'}
            >
              {autoPlay ? (
                <>
                  <Pause size={12} />
                  <span>Pausar ({duration - progressSeconds}s)</span>
                </>
              ) : (
                <>
                  <Play size={12} className="fill-current" />
                  <span>Auto-avance</span>
                </>
              )}
            </button>

            {/* Selector de pasos dropdown */}
            <button
              type="button"
              onClick={() => setShowStepList(!showStepList)}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-muted hover:text-ink"
            >
              <span>Ver todos</span>
              {showStepList ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {/* Botones Anterior / Siguiente */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-ink transition hover:border-ink disabled:opacity-40 disabled:pointer-events-none active:scale-95"
            >
              <ArrowLeft size={13} />
              <span>Anterior</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-bold text-white shadow-sm transition active:scale-95 ${
                currentStep.role === 'persona'
                  ? 'bg-primary-dark hover:bg-primary'
                  : 'bg-terra-dark hover:bg-terra'
              }`}
            >
              <span>{currentStepIndex + 1 === steps.length ? 'Finalizar' : 'Siguiente'}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
