'use client';

import Link from 'next/link';
import { EyeOff, FileSpreadsheet, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { CifraQuestions } from '@/components/app/cifra-questions';
import { BOGOTA_ZONES } from '@/lib/zones';
import { saveQuickStart, type QuickState } from '../actions';

/**
 * El modo rápido de una cuenta nueva. Aprendizaje de validación I.5 #1: antes de pedir cualquier
 * dato financiero, explicamos en lenguaje llano qué toca CIFRA y qué nunca hace. Después vienen las
 * cuatro preguntas, con el mismo formulario de la prueba sin cuenta (`CifraQuestions`).
 */
export function QuickStart({
  firstName,
  frequency,
  days,
  initialZoneSlug,
  alreadyOnboarded,
}: {
  firstName: string | null;
  frequency: 'mensual' | 'quincenal' | 'semanal' | 'irregular' | null;
  days: number[] | null;
  initialZoneSlug: string;
  alreadyOnboarded: boolean;
}) {
  const [state, action, pending] = useActionState<QuickState, FormData>(saveQuickStart, { status: 'idle' });
  const [acceptedTrust, setAcceptedTrust] = useState(alreadyOnboarded);
  const [zoneSlug, setZoneSlug] = useState(initialZoneSlug);
  const trustHeadingRef = useRef<HTMLHeadingElement>(null);
  // Cambió de pantalla dentro de esta misma página: el foco va al título de la pantalla nueva.
  const [switched, setSwitched] = useState(false);

  useEffect(() => {
    if (state.status === 'error') setAcceptedTrust(true);
  }, [state]);

  useEffect(() => {
    if (!acceptedTrust && switched) trustHeadingRef.current?.focus();
  }, [acceptedTrust, switched]);

  function showQuestions(show: boolean) {
    setSwitched(true);
    setAcceptedTrust(show);
  }

  if (!acceptedTrust) {
    return (
      <section className="space-y-6">
        <div>
          <span className="badge-primary">Antes de pedirte cualquier número</span>
          <h1
            ref={trustHeadingRef}
            tabIndex={-1}
            className="mt-3 font-display text-[30px] font-bold leading-tight tracking-[-0.025em] outline-none sm:text-[34px]"
          >
            {firstName ? `${firstName}, así cuidamos ` : 'Así cuidamos '}tu información en CIFRA
          </h1>
          <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-muted">
            En menos de 3 minutos verás tu primera cifra. Antes, queremos dejarte claro qué toca CIFRA y qué nunca hace:
          </p>
        </div>

        <ul className="space-y-3">
          <li className="surface-card flex items-start gap-3.5 p-4">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-light text-primary-dark">
              <Lock size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">Cero claves bancarias, cero movimientos de dinero</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-muted">
                Nunca te pedimos usuario ni clave de tu banco. CIFRA solo lee movimientos o saldos para hacer la resta por ti.
              </p>
            </div>
          </li>
          <li className="surface-card flex items-start gap-3.5 p-4">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-light text-primary-dark">
              <EyeOff size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">Los comercios de barrio nunca ven tu extracto</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-muted">
                Si usas una oferta cerca de ti, el local solo ve un código de 6 letras. Tu saldo y tus gastos siguen siendo privados.
              </p>
            </div>
          </li>
          <li className="surface-card flex items-start gap-3.5 p-4">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-light text-primary-dark">
              <Trash2 size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">Tus datos son tuyos (Ley 1581 de 2012)</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-muted">
                Desde «Tus datos» puedes descargar una copia completa o borrar cualquier cuenta y todo tu historial en un clic.
              </p>
            </div>
          </li>
        </ul>

        <div className="surface-card p-4">
          <label htmlFor="trust-zone" className="label">
            ¿En qué barrio o zona te mueves más?
          </label>
          <select
            id="trust-zone"
            value={zoneSlug}
            onChange={(e) => setZoneSlug(e.target.value)}
            className="field"
          >
            {BOGOTA_ZONES.map((z) => (
              <option key={z.slug} value={z.slug}>
                {z.name}
              </option>
            ))}
            <option value="otra">Prefiero no indicar zona</option>
          </select>
          <p className="mt-1.5 text-[12.5px] text-ink-faint">
            Opcional. Lo usamos para mostrarte descuentos en panaderías, cafés y tiendas independientes cerca de ti.
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <button
            id="btn-start-quick"
            type="button"
            onClick={() => showQuestions(true)}
            className="btn-primary w-full"
          >
            <ShieldCheck size={18} aria-hidden="true" /> Calcular mi cifra en 1 minuto
          </button>
          <Link id="btn-start-import" href="/app/datos/importar?primera=1" className="btn-ghost w-full">
            <FileSpreadsheet size={18} aria-hidden="true" /> Tengo el extracto de mi banco (CSV, Excel o PDF)
          </Link>
        </div>
      </section>
    );
  }

  return (
    <CifraQuestions
      mode="cuenta"
      headingLevel={1}
      firstName={firstName}
      frequency={frequency}
      days={days}
      action={action}
      pending={pending}
      serverError={state.status === 'error' ? state : null}
      focusOnMount={switched}
      onBackFromFirst={alreadyOnboarded ? undefined : () => showQuestions(false)}
      hiddenFields={<input type="hidden" name="zoneSlug" value={zoneSlug} />}
    />
  );
}
