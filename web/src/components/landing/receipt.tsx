'use client';

import { useMemo, useState } from 'react';
import { cop, parsePesosInput } from '@/lib/format';
import { track } from '@/lib/analytics/client';

// Ejemplo fijo y explícito: una persona a la que le pagan el 30 y hoy es 1 de noviembre.
const EXAMPLE = {
  balance: 2_800_000_00,
  fixed: 1_196_700_00,
  dailyNormal: 29_500_00,
  days: 29,
  payday: '30 nov',
};
const PROJECTED = EXAMPLE.dailyNormal * EXAMPLE.days;
const AVAILABLE = EXAMPLE.balance - EXAMPLE.fixed - PROJECTED;

const LINES: Array<{ label: string; hint: string; value: number }> = [
  { label: 'Tienes hoy en tu cuenta', hint: 'saldo', value: EXAMPLE.balance },
  { label: 'Cobros fijos antes del 30', hint: 'arriendo, gimnasio, Netflix, luz, celular', value: -EXAMPLE.fixed },
  { label: 'Tu día a día por 29 días', hint: '$29.500 diarios, según tus movimientos', value: -PROJECTED },
];

/** La resta de CIFRA en una tirilla, con un ejemplo que se puede probar. */
export function Receipt() {
  const [raw, setRaw] = useState('120.000');
  const [asked, setAsked] = useState(true);
  const amount = useMemo(() => parsePesosInput(raw), [raw]);

  const answer = useMemo(() => {
    if (amount === null) return null;
    const remaining = AVAILABLE - amount;
    if (remaining < 0) return { tone: 'no' as const, title: 'No te alcanza', body: `Te faltarían ${cop(-remaining)} antes del ${EXAMPLE.payday}.` };
    const perDay = Math.floor(remaining / EXAMPLE.days / 10000) * 10000;
    if (remaining < EXAMPLE.dailyNormal * 3)
      return { tone: 'justo' as const, title: 'Te alcanza, pero quedas justo', body: `Te quedarían ${cop(remaining)} para imprevistos hasta el ${EXAMPLE.payday}.` };
    return { tone: 'si' as const, title: 'Sí te alcanza', body: `Te quedarían ${cop(remaining)}: unos ${cop(perDay)} extra por día.` };
  }, [amount]);

  return (
    <figure className="relative mx-auto w-full max-w-[380px]" aria-label="Ejemplo de cómo CIFRA calcula la cifra">
      <div className="rounded-[20px] border border-line bg-white px-6 pb-6 pt-5 shadow-[0_1px_0_#DCE3DF,0_24px_48px_-24px_rgba(20,32,29,0.25)]">
        <div className="flex items-baseline justify-between text-[12px] text-ink-faint">
          <span>Ejemplo</span>
          <span className="tnum">1 nov</span>
        </div>
        <dl className="mt-4 space-y-3">
          {LINES.map((l, i) => (
            <div key={l.label} className="animate-print" style={{ animationDelay: `${250 + i * 420}ms` }}>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[15px] font-medium">{l.label}</dt>
                <dd className="tnum font-display text-[17px] font-semibold">
                  {l.value < 0 ? '- ' : ''}
                  {cop(Math.abs(l.value))}
                </dd>
              </div>
              <p className="text-[12.5px] leading-snug text-ink-faint">{l.hint}</p>
            </div>
          ))}
        </dl>
        <div
          className="animate-print mt-4 border-t-2 border-dashed border-ink/25 pt-4"
          style={{ animationDelay: `${250 + LINES.length * 420}ms` }}
        >
          <p className="text-[14px] font-medium text-ink-muted">Puedes gastar hasta el {EXAMPLE.payday}</p>
          <p className="tnum mt-1 font-display text-[52px] font-extrabold leading-none tracking-[-0.035em] text-primary-dark">
            {cop(AVAILABLE)}
          </p>
          <p className="mt-2 text-[12.5px] text-ink-faint">Esto no es tu saldo. Es lo que queda libre.</p>
        </div>

        <form
          className="mt-5 rounded-2xl bg-paper p-3"
          onSubmit={(e) => {
            e.preventDefault();
            setAsked(true);
            track('ask_spend', { where: 'landing', amount_bucket: amount ? Math.round(amount / 100 / 50000) * 50000 : 0 });
          }}
        >
          <label htmlFor="hero-amount" className="text-[13px] font-semibold">
            ¿Puedo gastar...?
          </label>
          <div className="mt-1.5 flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">$</span>
              <input
                id="hero-amount"
                inputMode="numeric"
                autoComplete="off"
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  setAsked(false);
                }}
                className="field tnum py-2.5 pl-7"
              />
            </div>
            <button type="submit" className="btn-primary min-h-11 px-4">
              Preguntar
            </button>
          </div>
          <div aria-live="polite" className="min-h-[44px]">
            {asked && answer && (
              <p
                className={`mt-2.5 text-[13.5px] leading-snug ${
                  answer.tone === 'no' ? 'text-neg' : answer.tone === 'justo' ? 'text-warn' : 'text-primary-dark'
                }`}
              >
                <strong className="font-semibold">{answer.title}.</strong> {answer.body}
              </p>
            )}
            {asked && amount === null && <p className="mt-2.5 text-[13.5px] text-neg">Escribe un monto en pesos, por ejemplo 120.000.</p>}
          </div>
        </form>
      </div>
    </figure>
  );
}
