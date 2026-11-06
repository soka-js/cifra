'use client';

import Link from 'next/link';
import { CheckCircle2, Clock, Sparkles, Tag, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { canISpend, type CifraResult } from '@/lib/engine/cifra';
import { shortDate } from '@/lib/engine/dates';
import { parseNaturalSpendQuery } from '@/lib/engine/insights';
import { cop, parsePesosInput } from '@/lib/format';
import { track } from '@/lib/analytics/client';

type Slim = Pick<CifraResult, 'availableMinor' | 'perDayMinor' | 'dailyVariableMinor' | 'daysLeft' | 'nextIncomeOn'>;

interface NearbyOfferHint {
  id: string;
  merchantName: string;
  title: string;
  neighborhood: string;
  estimatedSavingsMinor: number;
}

const QUICK_EXAMPLES = [
  '¿Puedo gastar 45 mil en almuerzo con amigos?',
  '120 mil salida del viernes',
  '280 mil unos tenis',
];

export function Ask({ cifra, nearbyOffers = [] }: { cifra: Slim; nearbyOffers?: NearbyOfferHint[] }) {
  const [naturalText, setNaturalText] = useState('');
  const [raw, setRaw] = useState('');
  const [what, setWhat] = useState('');
  const [answer, setAnswer] = useState<ReturnType<typeof canISpend> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function evaluate(amountMinor: number, concept: string) {
    setError(null);
    const a = canISpend(cifra as CifraResult, amountMinor);
    setWhat(concept);
    setRaw(String(Math.round(amountMinor / 100)));
    setAnswer(a);
    track('ask_spend', { where: 'app', verdict: a.verdict });
  }

  function handleNaturalSubmit(text: string) {
    const parsed = parseNaturalSpendQuery(text);
    if (parsed.amountMinor === null) {
      setError('Incluye el monto en tu pregunta, por ejemplo: «¿puedo gastar 90 mil en cena el viernes?»');
      setAnswer(null);
      return;
    }
    evaluate(parsed.amountMinor, parsed.concept);
  }

  const safeAlternativeMinor =
    cifra.availableMinor > 10_000_00 ? Math.floor((cifra.availableMinor * 0.65) / 5_000_00) * 5_000_00 : 0;

  const usedSharePct =
    answer && cifra.availableMinor > 0
      ? Math.min(100, Math.max(4, Math.round((answer.amountMinor / cifra.availableMinor) * 100)))
      : 100;

  return (
    <div className="space-y-5">
      {/* Modo lenguaje natural (H.1.2) */}
      <section className="surface-card p-5">
        <label htmlFor="natural-ask" className="label flex items-center gap-1.5">
          <Sparkles size={15} className="text-primary" aria-hidden="true" />
          <span>Pregúntalo en tus palabras</span>
        </label>
        <form
          className="mt-1 flex flex-col gap-2.5 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            handleNaturalSubmit(naturalText);
          }}
        >
          <input
            id="natural-ask"
            value={naturalText}
            onChange={(e) => setNaturalText(e.target.value)}
            placeholder="Ej. ¿puedo gastar 180 mil el viernes con amigos?"
            className="field flex-1"
          />
          <button id="btn-ask-natural" type="submit" className="btn-ink shrink-0">
            Simular
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {QUICK_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setNaturalText(ex);
                handleNaturalSubmit(ex);
              }}
              className="rounded-full border border-line bg-paper px-3 py-1 text-[12.5px] font-medium text-ink-muted hover:border-line-strong hover:bg-white hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      </section>

      {/* Modo directo por monto */}
      <form
        className="surface-card space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const amount = parsePesosInput(raw);
          if (amount === null) {
            setError('Escribe un monto en pesos, por ejemplo 85.000.');
            setAnswer(null);
            return;
          }
          evaluate(amount, what);
        }}
      >
        <div>
          <label htmlFor="amount" className="label">
            O escribe el valor directo
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-[22px] text-ink-faint">
              $
            </span>
            <input
              id="amount"
              inputMode="numeric"
              autoComplete="off"
              placeholder="85.000"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="field tnum py-3.5 pl-9 font-display text-[26px] font-bold"
              aria-describedby={error ? 'amount-err' : undefined}
            />
          </div>
          {error && (
            <p id="amount-err" className="mt-1.5 text-sm text-neg">
              {error}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="what" className="label">
            ¿En qué sería? <span className="font-normal text-ink-faint">(opcional)</span>
          </label>
          <input
            id="what"
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            placeholder="Unos tenis, cena, regalo..."
            className="field"
            maxLength={60}
          />
        </div>
        <button id="btn-ask-direct" type="submit" className="btn-primary w-full">
          Calcular impacto en mi cifra
        </button>
      </form>

      {/* Respuesta empática con impacto diario y alternativas accionables (I.5 #3) */}
      {answer && (
        <section
          aria-live="polite"
          className={`rounded-3xl border p-5 sm:p-6 ${
            answer.verdict === 'no'
              ? 'border-neg/25 bg-neg-light/75'
              : answer.verdict === 'justo'
                ? 'border-warn/30 bg-warn-light/85'
                : 'border-primary/25 bg-primary-light/80'
          }`}
        >
          <div className="flex items-start gap-3">
            {answer.verdict === 'si' ? (
              <CheckCircle2 size={26} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
            ) : (
              <TriangleAlert
                size={26}
                className={`mt-0.5 shrink-0 ${answer.verdict === 'no' ? 'text-neg' : 'text-warn'}`}
                aria-hidden="true"
              />
            )}
            <div className="min-w-0 flex-1">
              <h2
                className={`font-display text-[26px] font-bold leading-tight ${
                  answer.verdict === 'no'
                    ? 'text-neg-dark'
                    : answer.verdict === 'justo'
                      ? 'text-warn'
                      : 'text-primary-dark'
                }`}
              >
                {answer.verdict === 'no'
                  ? 'Hoy te descuadraría antes de tu pago'
                  : answer.verdict === 'justo'
                    ? 'Te alcanza, pero quedas con poco margen'
                    : 'Sí puedes hacerlo con tranquilidad'}
              </h2>
              <p className="mt-2 text-[15.5px] leading-relaxed text-ink">
                {answer.verdict === 'no'
                  ? `Gastar ${cop(answer.amountMinor)}${what ? ` en ${what}` : ''} supera tu disponible seguro y te dejaría corto por ${cop(
                      answer.shortfallMinor,
                    )} antes del ${shortDate(answer.nextIncomeOn)}.`
                  : `Después de gastar ${cop(answer.amountMinor)}${what ? ` en ${what}` : ''}, aún te quedan ${cop(
                      answer.remainingMinor,
                    )} libres hasta el ${shortDate(answer.nextIncomeOn)}.`}
              </p>
            </div>
          </div>

          {/* Comparativo antes / después en margen diario */}
          <div className="mt-4 rounded-2xl bg-white/90 p-4">
            <div className="flex items-baseline justify-between text-[13px] font-semibold text-ink-muted">
              <span>Tu margen libre diario</span>
              <span className="tnum">
                {cop(cifra.perDayMinor)}/día →{' '}
                <strong className={answer.verdict === 'no' ? 'text-neg' : 'text-primary-dark'}>
                  {answer.verdict === 'no' ? '$0/día' : `${cop(answer.perDayAfterMinor)}/día`}
                </strong>
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-deep" aria-hidden="true">
              <div
                className={`h-full rounded-full transition-all ${
                  answer.verdict === 'no' ? 'bg-neg' : answer.verdict === 'justo' ? 'bg-warn' : 'bg-primary'
                }`}
                style={{ width: `${usedSharePct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[12.5px] text-ink-faint">
              {answer.verdict === 'no'
                ? 'Ocupa el 100 % de tu disponible libre y toca plata reservada para cobros fijos o comida.'
                : `Este gasto toma el ${usedSharePct} % de lo que tenías libre para los próximos ${cifra.daysLeft} días.`}
            </p>
          </div>

          {/* Alternativas concretas y sin regaño cuando No o Justo */}
          {answer.verdict !== 'si' && (
            <div className="mt-4 space-y-2.5 rounded-2xl bg-white/90 p-4 text-[14px]">
              <p className="font-semibold text-ink">Opciones concretas para decidir tranquilo:</p>
              <ul className="space-y-2 text-ink-soft">
                {safeAlternativeMinor > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>
                      <strong>Tope cómodo hoy:</strong> hasta{' '}
                      <button
                        type="button"
                        onClick={() => evaluate(safeAlternativeMinor, what)}
                        className="tnum font-semibold text-primary-dark underline underline-offset-2"
                      >
                        {cop(safeAlternativeMinor)}
                      </button>{' '}
                      sin apretar el resto de tus días.
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <Clock size={15} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
                  <span>
                    <strong>Esperar {cifra.daysLeft} {cifra.daysLeft === 1 ? 'día' : 'días'}:</strong> tu próximo ingreso entra el{' '}
                    <strong>{shortDate(answer.nextIncomeOn)}</strong>.
                  </span>
                </li>
                {nearbyOffers[0] && (
                  <li className="flex items-start gap-2">
                    <Tag size={15} className="mt-0.5 shrink-0 text-terra" aria-hidden="true" />
                    <span>
                      <strong>Alternativa con beneficio cerca:</strong> {nearbyOffers[0].merchantName} ({nearbyOffers[0].neighborhood}) tiene{' '}
                      <em>{nearbyOffers[0].title}</em>.{' '}
                      <Link href={`/app/ofertas?destacada=${nearbyOffers[0].id}`} className="font-semibold text-terra-dark underline">
                        Ver oferta →
                      </Link>
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
