'use client';

import { useState } from 'react';
import { canISpend, type CifraResult } from '@/lib/engine/cifra';
import { shortDate } from '@/lib/engine/dates';
import { cop, parsePesosInput } from '@/lib/format';
import { track } from '@/lib/analytics/client';

type Slim = Pick<CifraResult, 'availableMinor' | 'dailyVariableMinor' | 'daysLeft' | 'nextIncomeOn'>;

export function Ask({ cifra }: { cifra: Slim }) {
  const [raw, setRaw] = useState('');
  const [what, setWhat] = useState('');
  const [answer, setAnswer] = useState<ReturnType<typeof canISpend> | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const amount = parsePesosInput(raw);
          if (amount === null) {
            setError('Escribe un monto en pesos, por ejemplo 85.000.');
            setAnswer(null);
            return;
          }
          setError(null);
          // canISpend solo usa estos campos de la cifra.
          const a = canISpend(cifra as CifraResult, amount);
          setAnswer(a);
          track('ask_spend', { where: 'app', verdict: a.verdict });
        }}
      >
        <div>
          <label htmlFor="amount" className="label">¿Cuánto quieres gastar?</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-[22px] text-ink-faint">$</span>
            <input
              id="amount"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="85.000"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="field tnum py-4 pl-9 font-display text-[26px] font-bold"
              aria-describedby={error ? 'amount-err' : undefined}
            />
          </div>
          {error && <p id="amount-err" className="mt-1.5 text-sm text-neg">{error}</p>}
        </div>
        <div>
          <label htmlFor="what" className="label">¿En qué? (opcional)</label>
          <input id="what" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Unos tenis, una salida, un regalo" className="field" maxLength={60} />
        </div>
        <button type="submit" className="btn-primary w-full">Preguntar</button>
      </form>

      {answer && (
        <section
          aria-live="polite"
          className={`mt-6 rounded-2xl px-5 py-5 ${answer.verdict === 'no' ? 'bg-neg-light' : answer.verdict === 'justo' ? 'bg-warn-light' : 'bg-primary-light'}`}
        >
          <h2 className={`font-display text-[28px] font-bold leading-tight ${answer.verdict === 'no' ? 'text-neg' : answer.verdict === 'justo' ? 'text-warn' : 'text-primary-dark'}`}>
            {answer.verdict === 'no' ? 'No te alcanza' : answer.verdict === 'justo' ? 'Te alcanza, pero quedas justo' : 'Sí te alcanza'}
          </h2>
          <p className="mt-2 text-[15.5px] leading-relaxed text-ink">
            {answer.verdict === 'no'
              ? `Si gastas ${cop(answer.amountMinor)}${what ? ` en ${what}` : ''}, te faltarían ${cop(answer.shortfallMinor)} antes del ${shortDate(answer.nextIncomeOn)}.`
              : `Si gastas ${cop(answer.amountMinor)}${what ? ` en ${what}` : ''}, te quedarían ${cop(answer.remainingMinor)} libres hasta el ${shortDate(answer.nextIncomeOn)}: unos ${cop(answer.perDayAfterMinor)} extra por día.`}
          </p>
          {answer.verdict !== 'si' && (
            <p className="mt-2 text-[14px] text-ink-muted">
              {answer.verdict === 'no'
                ? `Después de tu ingreso del ${shortDate(answer.nextIncomeOn)} vuelve a preguntar.`
                : 'Cualquier imprevisto te dejaría en rojo antes del pago.'}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
