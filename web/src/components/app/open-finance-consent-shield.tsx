'use client';

import {
  CheckCircle2,
  Clock,
  FileCheck2,
  KeyRound,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateConsentMandateAction } from '@/app/actions/v3';
import type { UserConsentMandateConfig } from '@/lib/db/schema';
import { addDays, shortDate } from '@/lib/engine/dates';
import { CONSENT_VERSION } from '@/lib/format';

interface OpenFinanceConsentShieldProps {
  userName?: string | null;
  userEmail?: string | null;
  consentGrantedAtIso: string;
  initialMandate?: UserConsentMandateConfig;
}

export function OpenFinanceConsentShield({
  userName,
  userEmail,
  consentGrantedAtIso,
  initialMandate,
}: OpenFinanceConsentShieldProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [durationDays, setDurationDays] = useState<90 | 180 | 365>(
    initialMandate?.durationDays ?? 180,
  );
  const [scopeRecurring, setScopeRecurring] = useState<boolean>(
    initialMandate?.scopeRecurring ?? true,
  );
  const [scopeGeoNba, setScopeGeoNba] = useState<boolean>(
    initialMandate?.scopeGeoNba ?? true,
  );
  const [scopeFutureOpenFinanceApi, setScopeFutureOpenFinanceApi] = useState<boolean>(
    initialMandate?.scopeFutureOpenFinanceApi ?? false,
  );
  const [mandateHash, setMandateHash] = useState<string>(
    initialMandate?.mandateHash ?? '9f4c8b21a7d0e6f35a912b4c8e7d1039c5a2b8f1e4d903a7',
  );
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  function persistMandate(
    nextDays: 90 | 180 | 365,
    nextRec: boolean,
    nextGeo: boolean,
    nextOpenApi: boolean,
  ) {
    setDurationDays(nextDays);
    setScopeRecurring(nextRec);
    setScopeGeoNba(nextGeo);
    setScopeFutureOpenFinanceApi(nextOpenApi);

    startTransition(async () => {
      const res = await updateConsentMandateAction({
        durationDays: nextDays,
        scopeRecurring: nextRec,
        scopeGeoNba: nextGeo,
        scopeFutureOpenFinanceApi: nextOpenApi,
      });
      if (res.ok) {
        setMandateHash(res.mandate.mandateHash);
        setSavedNotice(res.message);
        router.refresh();
      }
    });
  }

  const expiresOnIso = addDays(consentGrantedAtIso, durationDays);

  return (
    <section
      aria-label="Certificado de Consentimiento Explícito y Estándar de Finanzas Abiertas"
      className="overflow-hidden rounded-3xl border border-primary/30 bg-white shadow-sm"
    >
      {/* Cabecera: Sello de Mandato Explícito */}
      <div className="border-b border-line bg-gradient-to-r from-primary-pale/80 via-white to-paper px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-xs">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
                  Mandato Activo · {CONSENT_VERSION}
                </span>
                <span className="rounded-full bg-paper px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">
                  Ley 1581 de 2012 · Decreto 1297 de 2022 (Finanzas Abiertas)
                </span>
              </div>
              <h2 className="mt-1.5 font-display text-[20px] font-bold leading-tight text-ink sm:text-[22px]">
                Certificado de Consentimiento Explícito y Finalidad Única
              </h2>
              <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-muted">
                Siguiendo el principio fundamental de Finanzas Abiertas en Colombia: tus datos financieros son 100 % tuyos, se leen únicamente bajo tu mandato temporal expreso y <strong>jamás se comparten ni venden a terceros</strong>.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/25 bg-white px-3.5 py-2.5 text-right shadow-2xs">
            <span className="block text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
              Vigencia del mandato
            </span>
            <span className="tnum font-display text-[15px] font-extrabold text-primary-dark">
              Hasta el {shortDate(expiresOnIso)}
            </span>
            <span className="block text-[11px] text-ink-muted">
              Renovación expresa cada {durationDays} días
            </span>
          </div>
        </div>

        {savedNotice && (
          <div
            role="status"
            className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary-light/60 px-3.5 py-2 text-[12.5px] font-semibold text-primary-dark"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>{savedNotice}</span>
            </span>
            <button
              type="button"
              onClick={() => setSavedNotice(null)}
              className="text-[11px] underline hover:no-underline"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* Cuerpo: 4 Condiciones regulatorias + Interruptores granulares */}
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-ink-muted">
            <FileCheck2 size={15} className="text-primary-dark" aria-hidden="true" />
            <span>Condiciones garantizadas a {userName || userEmail || 'Titular'}</span>
          </h3>

          <ul className="space-y-2.5 text-[13px]">
            <li className="flex items-start gap-2.5 rounded-2xl border border-line bg-paper/45 p-3">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <div>
                <p className="font-bold text-ink">1. Finalidad exclusiva para tu beneficio</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
                  Tus extractos y saldos se procesan únicamente para calcular tu cifra disponible, detectar cobros recurrentes y mostrarte ahorros en tu barrio. Prohibido su uso para cobranza o venta de perfiles crediticios.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-2.5 rounded-2xl border border-line bg-paper/45 p-3">
              <Lock size={16} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <div>
                <p className="font-bold text-ink">2. Anonimato total frente a comercios aliados</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
                  Cuando redimes un beneficio B2B2C en una panadería, café o fruver, el comercio solo recibe un código alfanumérico de 6 caracteres. Nunca conoce tu nombre, banco ni historial.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-2.5 rounded-2xl border border-line bg-paper/45 p-3">
              <KeyRound size={16} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <div>
                <p className="font-bold text-ink">3. Ingesta híbrida segura sin credenciales bancarias</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
                  Mientras las APIs bancarias de Open Finance en Colombia se habilitan para terceros, CIFRA opera mediante lectura local de extractos en tu dispositivo y canal B2B2C con cooperativas y billeteras aliadas.
                </p>
              </div>
            </li>
          </ul>
        </div>

        {/* Panel derecho: Permisos granulares persistidos en PostgreSQL */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-paper/60 p-4">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-ink">
                <SlidersHorizontal size={14} className="text-primary-dark" aria-hidden="true" />
                <span>Permisos granulares del titular</span>
              </h3>
            </div>

            <div className="rounded-xl bg-white p-3 shadow-2xs">
              <label className="block text-[11.5px] font-bold text-ink">
                Vigencia temporal de tu autorización:
              </label>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {([90, 180, 365] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      persistMandate(days, scopeRecurring, scopeGeoNba, scopeFutureOpenFinanceApi)
                    }
                    className={`rounded-lg py-1.5 text-[12px] font-bold transition ${
                      durationDays === days
                        ? 'bg-primary text-white shadow-2xs'
                        : 'border border-line bg-paper text-ink-muted hover:text-ink'
                    }`}
                  >
                    {days} días
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl bg-white p-3 shadow-2xs">
                <div>
                  <span className="block text-[12.5px] font-bold text-ink">
                    Detección automática de cobros recurrentes
                  </span>
                  <span className="block text-[11.5px] text-ink-muted">
                    Identificar suscripciones y servicios fijos en tus movimientos.
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={isPending}
                  checked={scopeRecurring}
                  onChange={(e) =>
                    persistMandate(durationDays, e.target.checked, scopeGeoNba, scopeFutureOpenFinanceApi)
                  }
                  className="mt-1 h-4 w-4 rounded border-line-strong text-primary focus:ring-primary"
                />
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl bg-white p-3 shadow-2xs">
                <div>
                  <span className="block text-[12.5px] font-bold text-ink">
                    Cruce anónimo con ofertas de mi zona (NBA)
                  </span>
                  <span className="block text-[11.5px] text-ink-muted">
                    Calcular ahorro potencial en comercios cercanos sin compartir mi identidad.
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={isPending}
                  checked={scopeGeoNba}
                  onChange={(e) =>
                    persistMandate(durationDays, scopeRecurring, e.target.checked, scopeFutureOpenFinanceApi)
                  }
                  className="mt-1 h-4 w-4 rounded border-line-strong text-primary focus:ring-primary"
                />
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl bg-white p-3 shadow-2xs">
                <div>
                  <span className="block text-[12.5px] font-bold text-ink">
                    Conector directo API Open Finance (SFC)
                  </span>
                  <span className="block text-[11.5px] text-ink-muted">
                    Dejar pre-autorizada la conexión OAuth2 cuando tu banco habilite APIs abiertas.
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={isPending}
                  checked={scopeFutureOpenFinanceApi}
                  onChange={(e) =>
                    persistMandate(durationDays, scopeRecurring, scopeGeoNba, e.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-line-strong text-primary focus:ring-primary"
                />
              </label>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[11px] text-ink-faint">
            <span className="inline-flex items-center gap-1">
              <Clock size={12} aria-hidden="true" />
              <span>Otorgado el {shortDate(consentGrantedAtIso)}</span>
            </span>
            <span className="font-mono">
              SHA-256: {mandateHash.slice(0, 8)}…{mandateHash.slice(-4)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
