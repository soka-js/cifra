'use client';

import { ArrowRight, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AskInline } from '@/components/app/ask-inline';
import { CifraQuestions } from '@/components/app/cifra-questions';
import { track } from '@/lib/analytics/client';
import { shortDate, todayInBogota } from '@/lib/engine/dates';
import { compareGuess, computeQuickCifra, type CifraResult } from '@/lib/engine/quick';
import { cop } from '@/lib/format';
import type { QuickFormValues } from '@/lib/quick-form';

/**
 * La prueba sin cuenta: las cuatro preguntas (el mismo formulario del modo rápido con cuenta) y la
 * cifra, calculada en el navegador con el mismo motor que usa la app. Nada de lo que la persona
 * escribe se envía ni se guarda en el servidor; solo queda en este dispositivo (sessionStorage)
 * para que, si decide crear su cuenta, no lo repita.
 */

export const TRIAL_STORAGE_KEY = 'cifra:prueba';

type Done = { cifra: CifraResult; values: QuickFormValues };

export function TryCifra() {
  const [done, setDone] = useState<Done | null>(null);
  const startedAt = useRef<number | null>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (done) resultHeadingRef.current?.focus();
  }, [done]);

  function markStarted() {
    if (startedAt.current !== null) return;
    startedAt.current = Date.now();
    track('try_cifra_start');
  }

  function finish(values: QuickFormValues) {
    const cifra = computeQuickCifra({ today: todayInBogota(), ...values });
    setDone({ cifra, values });
    try {
      // Solo en este dispositivo: sirve para no volver a preguntar si la persona crea su cuenta.
      sessionStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({ v: 1, ...values }));
    } catch {
      // Sin almacenamiento disponible: la prueba funciona igual.
    }
    const guess = values.guessMinor === null ? 'sin' : compareGuess(values.guessMinor, cifra.availableMinor).direction;
    // A la analítica van solo conteos y el estado. Ningún monto.
    track('try_cifra_done', {
      seconds: startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : null,
      status: cifra.status,
      guess,
      fixed: values.fixed.length,
    });
  }

  return (
    <div>
      {done && <TrialResult done={done} headingRef={resultHeadingRef} onEdit={() => setDone(null)} />}

      {/* El formulario se queda montado (oculto) para que "Cambiar mis datos" conserve lo escrito. */}
      <CifraQuestions mode="prueba" hidden={done !== null} onStart={markStarted} onDone={finish} />
    </div>
  );
}

function TrialResult({
  done,
  headingRef,
  onEdit,
}: {
  done: Done;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onEdit: () => void;
}) {
  const { cifra: c, values } = done;
  const negative = c.availableMinor < 0;
  const badge = negative
    ? { cls: 'badge-neg', text: 'No alcanza: revisemos' }
    : c.status === 'justo'
      ? { cls: 'badge-warn', text: 'Vas justo hasta tu pago' }
      : { cls: 'badge-primary', text: 'Vas con buen margen' };
  const gap = values.guessMinor === null ? null : compareGuess(values.guessMinor, c.availableMinor);
  const dayWord = c.daysLeft === 1 ? 'día' : 'días';

  return (
    <section className="surface-card p-5 sm:p-7" aria-labelledby="pc-result">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={badge.cls}>{badge.text}</span>
        <span className="text-[13.5px] text-ink-muted">
          Próximo pago: {shortDate(c.nextIncomeOn)} ({c.daysLeft} {dayWord})
        </span>
      </div>

      <h2
        id="pc-result"
        ref={headingRef}
        tabIndex={-1}
        className="mt-4 text-[15px] font-medium text-ink-muted outline-none"
      >
        {negative ? `Te faltan para llegar al ${shortDate(c.nextIncomeOn)}` : `Puedes gastar hasta el ${shortDate(c.nextIncomeOn)}`}
      </h2>
      <p
        data-testid="cifra"
        className={`tnum font-display text-[52px] font-extrabold leading-none tracking-[-0.035em] sm:text-[60px] ${
          negative ? 'text-neg' : c.status === 'justo' ? 'text-warn' : 'text-ink'
        }`}
      >
        {cop(Math.abs(c.availableMinor))}
      </p>
      {!negative && (
        <p className="mt-2.5 text-[15px] leading-relaxed text-ink-muted">
          Son unos <span className="tnum font-semibold text-ink">{cop(c.perDayMinor)}</span> por día durante {c.daysLeft}{' '}
          {dayWord}, además de tu día a día.
        </p>
      )}

      {gap && (
        <p data-testid="brecha" className="mt-4 rounded-xl bg-paper-deep px-4 py-3 text-[14.5px] leading-snug text-ink">
          {gap.direction === 'igual' ? (
            <>
              Creías <span className="tnum font-semibold">{cop(gap.guessMinor)}</span>. Tu cálculo a ojo estuvo muy cerca.
            </>
          ) : (
            <>
              Creías <span className="tnum font-semibold">{cop(gap.guessMinor)}</span>. Son{' '}
              <span className="tnum font-semibold">{cop(Math.abs(gap.overMinor))}</span>{' '}
              {gap.direction === 'mas' ? 'menos de lo que pensabas' : 'más de lo que pensabas'}.
            </>
          )}
        </p>
      )}

      <div className="mt-5 border-t border-dashed border-line-strong pt-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">De dónde sale</h3>
        <dl className="tnum mt-3 space-y-2.5 text-[15px]">
          <ReceiptRow label="Tienes hoy" value={cop(c.balanceMinor)} />
          <ReceiptRow
            label="Cobros fijos que faltan"
            hint={
              c.pending.length === 0
                ? 'Ninguno antes de tu próximo pago'
                : c.pending.map((p) => `${p.name} (${shortDate(p.date)})`).join(', ')
            }
            value={`− ${cop(c.pendingMinor)}`}
          />
          <ReceiptRow
            label="Tu día a día"
            hint={`${cop(c.dailyVariableMinor)} por día × ${c.projectionDays} ${c.projectionDays === 1 ? 'día' : 'días'}`}
            value={`− ${cop(c.projectedVariableMinor)}`}
          />
          <div className={`flex items-baseline justify-between gap-3 border-t border-line pt-2.5 font-bold ${negative ? 'text-neg' : 'text-primary-dark'}`}>
            <dt>{negative ? '= Te faltan' : '= Puedes gastar'}</dt>
            <dd>{cop(Math.abs(c.availableMinor))}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6">
        <AskInline cifra={c} where="prueba" />
      </div>

      <div className="mt-6 space-y-3">
        <Link
          id="btn-probar-guardar"
          href="/registro?desde=prueba"
          onClick={() => track('try_cifra_save')}
          className="btn-primary w-full"
        >
          Guardar mi cifra <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <p className="text-center text-[13px] leading-snug text-ink-muted">
          Con una cuenta gratis la ves cada día, anotas tus gastos y la afinas con tu extracto.
        </p>
        <button type="button" onClick={onEdit} className="btn-ghost w-full">
          <RotateCcw size={16} aria-hidden="true" /> Cambiar mis datos
        </button>
      </div>
    </section>
  );
}

function ReceiptRow({ label, hint, value }: { label: string; hint?: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt>
        <span className="font-medium text-ink">{label}</span>
        {hint && <span className="block text-[12.5px] text-ink-faint">{hint}</span>}
      </dt>
      <dd className="shrink-0 font-semibold text-ink">{value}</dd>
    </div>
  );
}
