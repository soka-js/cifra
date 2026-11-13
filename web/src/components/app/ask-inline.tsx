'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MoneyInput } from '@/components/ui/money-input';
import { track } from '@/lib/analytics/client';
import { canISpend, type CifraResult, type SpendAnswer } from '@/lib/engine/cifra';
import { shortDate } from '@/lib/engine/dates';
import { cop, parsePesosInput } from '@/lib/format';

/** Lo mínimo de la cifra que hace falta para contestar "¿puedo gastar?". */
export type AskCifra = Pick<CifraResult, 'availableMinor' | 'dailyVariableMinor' | 'daysLeft' | 'nextIncomeOn'>;

/**
 * "¿Puedo gastar?" contestado ahí mismo, contra la cifra que la persona tiene a la vista.
 * Se usa en la prueba sin cuenta y en el Hoy: la misma pregunta, la misma respuesta.
 * A la analítica va solo el veredicto; el monto no se envía.
 */
export function AskInline({ cifra, where, moreHref }: { cifra: AskCifra; where: 'prueba' | 'hoy'; moreHref?: string }) {
  const [raw, setRaw] = useState('');
  const [answer, setAnswer] = useState<SpendAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  function ask() {
    const amount = parsePesosInput(raw);
    if (amount === null) {
      setAnswer(null);
      setError('Escribe un monto en pesos, por ejemplo 85.000.');
      return;
    }
    setError(null);
    const a = canISpend(cifra as CifraResult, amount);
    setAnswer(a);
    track('ask_spend', { verdict: a.verdict, where });
  }

  const tone =
    answer?.verdict === 'si'
      ? 'bg-primary-light text-primary-dark'
      : answer?.verdict === 'justo'
        ? 'bg-warn-light text-warn'
        : 'bg-neg-light text-neg';

  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <label htmlFor={`ask-${where}`} className="font-display text-[18px] font-bold text-ink">
        ¿Puedo gastar…?
      </label>
      <p className="mt-0.5 text-[13.5px] text-ink-muted">Escribe un gasto que tengas en mente y te decimos si te alcanza.</p>
      <div className="mt-3 flex gap-2">
        <div className="flex-1">
          <MoneyInput
            id={`ask-${where}`}
            name="ask"
            placeholder="85.000"
            value={raw}
            onChangeValue={(minor) => {
              setRaw(minor ? String(Math.round(minor / 100)) : '');
              setAnswer(null);
            }}
          />
        </div>
        <button id={`btn-ask-${where}`} type="button" onClick={ask} className="btn-ink shrink-0 self-start px-5">
          Preguntar
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2.5 text-[13.5px] text-neg">
          {error}
        </p>
      )}
      {answer && (
        <p data-testid="respuesta-puedo" role="status" className={`tnum mt-3 rounded-xl px-4 py-3 text-[14.5px] font-medium leading-snug ${tone}`}>
          {answer.verdict === 'si' && (
            <>
              Sí. Te quedarían {cop(answer.remainingMinor)} hasta el {shortDate(answer.nextIncomeOn)}.
            </>
          )}
          {answer.verdict === 'justo' && (
            <>
              Te alcanza, pero quedas justo: te quedarían {cop(answer.remainingMinor)} hasta el {shortDate(answer.nextIncomeOn)}.
            </>
          )}
          {answer.verdict === 'no' && <>No te alcanza: te faltarían {cop(answer.shortfallMinor)}.</>}
        </p>
      )}
      {answer && moreHref && (
        <Link href={moreHref} className="mt-2.5 inline-block text-[13px] font-semibold text-primary-dark underline underline-offset-2">
          Verlo con más detalle
        </Link>
      )}
    </div>
  );
}
