'use client';

import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ASKED_EVENT, GUIDE_COOKIE, rememberCookie } from '@/lib/guide';

/**
 * La primera vez, guiada en tres pasos: qué es la cifra, preguntar antes de comprar y anotar lo
 * que se gasta. Cada paso se marca solo cuando la persona lo hace, y la guía se va cuando toca
 * "Entendido" o cuando ya hizo los tres.
 *
 * Lo que ya hizo se recuerda con dos cookies sin datos personales (`cf_guia`, `cf_pregunto`), para
 * que el servidor ya sepa si mostrarla y la pantalla no salte al cargar.
 */

export function FirstSteps({
  firstName,
  untilLabel,
  asked: askedInitially,
  hasExpenses,
}: {
  firstName: string | null;
  /** "15 nov": hasta cuándo va la cifra. */
  untilLabel: string;
  asked: boolean;
  hasExpenses: boolean;
}) {
  const [asked, setAsked] = useState(askedInitially);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const onAsked = () => setAsked(true);
    window.addEventListener(ASKED_EVENT, onAsked);
    return () => window.removeEventListener(ASKED_EVENT, onAsked);
  }, []);

  // Con los tres pasos hechos no hace falta volver a mostrarla.
  useEffect(() => {
    if (asked && hasExpenses) rememberCookie(GUIDE_COOKIE);
  }, [asked, hasExpenses]);

  if (closed) return null;

  function close() {
    rememberCookie(GUIDE_COOKIE);
    setClosed(true);
  }

  function goAsk() {
    const input = document.getElementById('ask-hoy');
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input?.focus({ preventScroll: true });
  }

  function goCapture() {
    document.getElementById('btn-anotar-gasto')?.click();
  }

  return (
    <section aria-labelledby="primeros-pasos" data-testid="primeros-pasos" className="rounded-2xl border border-primary/25 bg-primary-pale/70 px-4 pb-3 pt-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="primeros-pasos" className="font-display text-[17px] font-bold text-ink">
          {firstName ? `${firstName}, así se usa CIFRA` : 'Así se usa CIFRA'}
        </h2>
        <button
          id="btn-guia-entendido"
          type="button"
          onClick={close}
          aria-label="Entendido, cerrar la guía"
          className="-mr-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-white/70 hover:text-ink"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <ol className="mt-1">
        <Step n={1} done title="Esta es tu cifra" hint={`Lo que puedes gastar de hoy al ${untilLabel}, con lo fijo ya descontado.`} />
        <Step n={2} done={asked} title="Antes de comprar, pregunta" hint="Escribe el valor y te decimos si te alcanza." onClick={goAsk} />
        <Step n={3} done={hasExpenses} title="Cuando gastes, anótalo" hint="Tu cifra baja sola y queda al día." onClick={goCapture} />
      </ol>
    </section>
  );
}

function Step({ n, done, title, hint, onClick }: { n: number; done: boolean; title: string; hint: string; onClick?: () => void }) {
  const body = (
    <>
      <span
        className={`tnum grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${
          done ? 'bg-primary text-white' : 'border-2 border-primary/40 bg-white text-primary-dark'
        }`}
      >
        {done ? <Check size={15} strokeWidth={3} aria-label="Hecho" /> : n}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[14.5px] font-semibold text-ink">{title}</span>
        <span className="block text-[13px] leading-snug text-ink-muted">{hint}</span>
      </span>
    </>
  );
  return (
    <li>
      {onClick && !done ? (
        <button type="button" onClick={onClick} className="-mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-3 rounded-xl px-1.5 py-2 active:bg-white/70 hover:bg-white/60">
          {body}
        </button>
      ) : (
        <div className="flex items-center gap-3 py-2">{body}</div>
      )}
    </li>
  );
}
