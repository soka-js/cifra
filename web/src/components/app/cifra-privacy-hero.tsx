'use client';

import {
  Check,
  CircleHelp,
  Eye,
  EyeOff,
  PieChart,
  Plus,
  Share2,
  Tag,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { QuickCaptureModal } from '@/components/app/quick-capture-modal';
import { cop, shortDate } from '@/lib/format';

interface CifraPrivacyHeroProps {
  availableMinor: number;
  negative: boolean;
  perDayMinor: number;
  daysLeft: number;
  nextIncomeOn: string;
  statusBadge: { cls: string; text: string };
  numberColor: string;
  captureAccounts: Array<{ id: string; name: string; balanceMinor: number | null }>;
  todayIso: string;
  currentHour: number;
  children?: React.ReactNode;
}

export function CifraPrivacyHero({
  availableMinor,
  negative,
  perDayMinor,
  daysLeft,
  nextIncomeOn,
  statusBadge,
  numberColor,
  captureAccounts,
  todayIso,
  currentHour,
  children,
}: CifraPrivacyHeroProps) {
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Leer preferencia de privacidad guardada en localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cifra_privacy_mode');
      if (stored === 'hidden') {
        setIsPrivate(true);
      }
    } catch {
      // Ignorar errores en navegadores con storage restringido
    }
  }, []);

  function togglePrivacy() {
    setIsPrivate((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cifra_privacy_mode', next ? 'hidden' : 'visible');
      } catch {
        // Ignorar
      }
      return next;
    });
  }

  async function handleShareBudget() {
    const formattedAvailable = cop(Math.abs(availableMinor));
    const formattedPerDay = cop(perDayMinor);
    const dateStr = shortDate(nextIncomeOn);
    const msg = negative
      ? `En CIFRA calculé mi presupuesto hasta el ${dateStr}: tenemos un ajuste pendiente de ${formattedAvailable} para cubrir fijos y ritmo de gasto. Revisémoslo juntos: https://cifra.co`
      : `Mi cifra disponible segura hasta el ${dateStr} es ${formattedAvailable} (equivale a unos ${formattedPerDay}/día libres luego de apartar arriendo y cobros fijos). Calculado en CIFRA: https://cifra.co`;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(msg);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Si falla el clipboard, fallback simple
    }
  }

  const big = Math.abs(availableMinor);

  return (
    <>
      <section
        aria-labelledby="cifra-label"
        className="ticket-surface p-5 sm:p-7 transition-all"
        data-cifra-privacy={isPrivate ? 'hidden' : 'visible'}
      >
        {/* Barra superior de estado + fecha de pago + Botón Modo Ojo (Privacidad) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={statusBadge.cls}>{statusBadge.text}</span>
            <span className="tnum text-[12.5px] font-medium text-ink-faint">
              Próximo pago: {shortDate(nextIncomeOn)} ({daysLeft} {daysLeft === 1 ? 'día' : 'días'})
            </span>
          </div>

          {/* Botón de Privacidad (Seguridad en TransMilenio y transporte público) */}
          <button
            id="btn-cifra-privacy-toggle"
            type="button"
            onClick={togglePrivacy}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper/90 px-3 py-1 text-[12px] font-bold text-ink-muted transition hover:border-ink hover:bg-white hover:text-ink active:scale-95 shadow-2xs"
            aria-label={isPrivate ? 'Mostrar cifras' : 'Ocultar cifras (modo discreto)'}
            title={
              isPrivate
                ? 'Toca para mostrar tus números'
                : 'Modo discreto: oculta saldos mientras estás en transporte público'
            }
          >
            {isPrivate ? (
              <>
                <Eye size={14} className="text-primary-dark" aria-hidden="true" />
                <span>Mostrar saldo</span>
              </>
            ) : (
              <>
                <EyeOff size={14} aria-hidden="true" />
                <span>Modo discreto</span>
              </>
            )}
          </button>
        </div>

        {/* Título y Gran Cifra Hero */}
        <div className="mt-4">
          <p id="cifra-label" className="text-[14.5px] font-medium text-ink-muted">
            {negative
              ? `Para cubrir tus fijos y tu ritmo hasta el ${shortDate(nextIncomeOn)} te faltarían`
              : `Disponible seguro hasta el ${shortDate(nextIncomeOn)}`}
          </p>

          {isPrivate ? (
            <div className="tnum mt-1 flex items-baseline gap-2 py-1 select-none">
              <span className="font-mono text-[44px] font-extrabold tracking-[0.16em] text-ink/70 sm:text-[54px]">
                ••••••••
              </span>
              <span className="rounded-md bg-paper-deep px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Protegido
              </span>
            </div>
          ) : (
            <p
              className={`tnum mt-1 font-display text-[52px] font-extrabold leading-none tracking-[-0.04em] sm:text-[62px] ${numberColor}`}
            >
              {cop(big)}
            </p>
          )}

          {isPrivate ? (
            <p className="mt-2 text-[13.5px] leading-snug text-ink-faint">
              Modo discreto activado: tus números están protegidos de miradas en el transporte o la calle.
            </p>
          ) : (
            <p className="mt-3 text-[15px] leading-snug text-ink-muted">
              {negative
                ? 'Sin sustos: este número solo mira de aquí a tu próximo ingreso. Abajo puedes ver qué cobro o gasto diario ajustar.'
                : `Equivale a unos ${cop(perDayMinor)} libres por día durante ${daysLeft} ${
                    daysLeft === 1 ? 'día' : 'días'
                  }, además de tu día a día habitual.`}
            </p>
          )}
        </div>

        {/* Botón de Compartir con Pareja / Roommates / WhatsApp */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            id="btn-share-budget"
            type="button"
            onClick={handleShareBudget}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper/80 px-3 py-1.5 text-[12px] font-semibold text-ink-muted transition hover:border-primary/50 hover:bg-white hover:text-primary-dark active:scale-95 shadow-2xs"
            title="Copia un resumen claro de tu cifra para coordinar cuentas por WhatsApp"
          >
            {copied ? (
              <>
                <Check size={14} className="text-primary-dark" aria-hidden="true" />
                <span className="font-bold text-primary-dark">¡Copiado para WhatsApp o tu pareja!</span>
              </>
            ) : (
              <>
                <Share2 size={13} className="text-primary-dark" aria-hidden="true" />
                <span>Compartir disponible (WhatsApp / Pareja)</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Actions Hub: 4 tarjetas táctiles inmediatas */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {/* Acción 1: Anotar gasto con QuickCaptureModal */}
          <QuickCaptureModal
            accounts={captureAccounts}
            todayIso={todayIso}
            currentHour={currentHour}
            buttonId="cta-hoy-quick-capture"
            buttonClassName="group flex w-full flex-col items-start justify-between rounded-2xl border border-line bg-paper/90 p-3 text-left transition hover:border-primary/50 hover:bg-white hover:shadow-xs active:scale-[0.98]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-pale text-primary-dark transition group-hover:scale-105">
              <Plus size={17} aria-hidden="true" />
            </div>
            <div className="mt-2 min-w-0">
              <span className="block truncate font-display text-[14px] font-bold text-ink group-hover:text-primary-dark">
                Anotar gasto
              </span>
              <span className="block text-[11.5px] text-ink-faint">SMS, Bre-B o texto</span>
            </div>
          </QuickCaptureModal>

          {/* Acción 2: ¿Puedo gastar? */}
          <Link
            id="cta-hoy-ask"
            href="/app/gasto"
            className="group flex flex-col items-start justify-between rounded-2xl border border-line bg-paper/90 p-3 text-left transition hover:border-primary/50 hover:bg-white hover:shadow-xs active:scale-[0.98]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-paper-deep text-ink-soft transition group-hover:scale-105 group-hover:text-primary-dark">
              <CircleHelp size={17} aria-hidden="true" />
            </div>
            <div className="mt-2 min-w-0">
              <span className="block truncate font-display text-[14px] font-bold text-ink group-hover:text-primary-dark">
                ¿Puedo gastar?
              </span>
              <span className="block text-[11.5px] text-ink-faint">Simula antes de pagar</span>
            </div>
          </Link>

          {/* Acción 3: En qué se me va */}
          <Link
            id="cta-hoy-movimientos"
            href="/app/movimientos"
            className="group flex flex-col items-start justify-between rounded-2xl border border-line bg-paper/90 p-3 text-left transition hover:border-primary/50 hover:bg-white hover:shadow-xs active:scale-[0.98]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-paper-deep text-ink-soft transition group-hover:scale-105 group-hover:text-primary-dark">
              <PieChart size={17} aria-hidden="true" />
            </div>
            <div className="mt-2 min-w-0">
              <span className="block truncate font-display text-[14px] font-bold text-ink group-hover:text-primary-dark">
                En qué se va
              </span>
              <span className="block text-[11.5px] text-ink-faint">Fugas y ritmo</span>
            </div>
          </Link>

          {/* Acción 4: Beneficios / Ofertas del barrio */}
          <Link
            id="cta-hoy-ofertas"
            href="/app/ofertas"
            className="group flex flex-col items-start justify-between rounded-2xl border border-line bg-paper/90 p-3 text-left transition hover:border-terra/50 hover:bg-white hover:shadow-xs active:scale-[0.98]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-terra-pale text-terra-dark transition group-hover:scale-105">
              <Tag size={17} aria-hidden="true" />
            </div>
            <div className="mt-2 min-w-0">
              <span className="block truncate font-display text-[14px] font-bold text-ink group-hover:text-terra-dark">
                Ofertas barrio
              </span>
              <span className="block text-[11.5px] text-ink-faint">Locales vecinos</span>
            </div>
          </Link>
        </div>

        <div className="ticket-divider" />

        {/* Desglose de resta / cálculo con soporte de desenfoque de privacidad */}
        <div className={isPrivate ? 'select-none filter blur-sm transition-all duration-300' : 'transition-all duration-300'}>
          {children}
        </div>
      </section>

      {/* Floating Action Button en móviles para capturar gastos en 1 toque desde cualquier parte */}
      <div className="no-print fixed bottom-20 right-4 z-40 lg:hidden">
        <QuickCaptureModal
          accounts={captureAccounts}
          todayIso={todayIso}
          currentHour={currentHour}
          buttonId="fab-quick-capture"
          buttonClassName="flex items-center gap-2 rounded-full border border-primary/30 bg-ink px-4 py-3 text-[13.5px] font-bold text-white shadow-xl backdrop-blur transition hover:bg-black active:scale-95"
        >
          <Plus size={18} className="text-primary" aria-hidden="true" />
          <span>Anotar</span>
        </QuickCaptureModal>
      </div>
    </>
  );
}
