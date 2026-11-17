'use client';

import { BookmarkPlus, CheckCircle2, Clock, CreditCard, PlusCircle, Tag, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { executeEvaluatedSpendAction } from '@/app/actions/v3';
import { MoneyInput } from '@/components/ui/money-input';
import { track } from '@/lib/analytics/client';
import { canISpend, comfortableSpendMinor, spendReserveMinor, type CifraResult } from '@/lib/engine/cifra';
import { simulateCreditInstallments } from '@/lib/engine/daily-value';
import { shortDate } from '@/lib/engine/dates';
import { cop, parsePesosInput } from '@/lib/format';
import { ASKED_COOKIE, rememberCookie } from '@/lib/guide';

type Slim = Pick<CifraResult, 'availableMinor' | 'perDayMinor' | 'dailyVariableMinor' | 'daysLeft' | 'nextIncomeOn'>;

interface NearbyOfferHint {
  id: string;
  merchantName: string;
  title: string;
  neighborhood: string;
  estimatedSavingsMinor: number;
}

/** Tasas de ejemplo para el simulador de cuotas. Se rotulan como ejemplo en pantalla; no son la tasa de nadie. */
const EXAMPLE_EA_RATES = [26.5, 30.8, 33.9];

/**
 * "¿Puedo gastar?" con detalle: un solo campo, el monto, y la respuesta. Es la misma pregunta del
 * Hoy; aquí además se ve cómo queda el margen por día y se puede anotar el gasto.
 */
export function Ask({
  cifra,
  nearbyOffers = [],
  initialAmountMinor = null,
}: {
  cifra: Slim;
  nearbyOffers?: NearbyOfferHint[];
  /** Si llega desde el Hoy con un monto ya escrito, se contesta sin volver a pedirlo. */
  initialAmountMinor?: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [raw, setRaw] = useState(initialAmountMinor ? String(Math.round(initialAmountMinor / 100)) : '');
  const [eaRate, setEaRate] = useState<number>(EXAMPLE_EA_RATES[1]!);
  const [answer, setAnswer] = useState<ReturnType<typeof canISpend> | null>(() =>
    initialAmountMinor ? canISpend(cifra as CifraResult, initialAmountMinor) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [executedMessage, setExecutedMessage] = useState<string | null>(null);

  function evaluate(amountMinor: number) {
    setError(null);
    setExecutedMessage(null);
    const a = canISpend(cifra as CifraResult, amountMinor);
    setRaw(String(Math.round(amountMinor / 100)));
    setAnswer(a);
    track('ask_spend', { where: 'app', verdict: a.verdict });
    rememberCookie(ASKED_COOKIE);
  }

  function handleExecuteSpend(mode: 'registrar_gasto' | 'apartar_ciclo') {
    if (!answer) return;
    startTransition(async () => {
      const res = await executeEvaluatedSpendAction({
        amountMinor: answer.amountMinor,
        concept: 'Gasto que consultaste en ¿Puedo gastar?',
        mode,
      });
      if (res.ok) {
        setExecutedMessage(res.message);
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  // El gasto más grande que todavía recibe un "sí": la cifra menos tres días de tu día a día.
  const comfortableMinor = comfortableSpendMinor(cifra);
  const reserveMinor = spendReserveMinor(cifra);
  const reserveDays = Math.min(3, cifra.daysLeft);

  const usedSharePct =
    answer && cifra.availableMinor > 0
      ? Math.min(100, Math.max(4, Math.round((answer.amountMinor / cifra.availableMinor) * 100)))
      : 100;

  const creditSim = useMemo(
    () => (answer ? simulateCreditInstallments(answer.amountMinor, eaRate, [1, 3, 6, 12]) : null),
    [answer, eaRate],
  );

  return (
    <div className="space-y-5">
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
          evaluate(amount);
        }}
      >
        <div>
          <label htmlFor="amount" className="label">
            ¿Cuánto cuesta?
          </label>
          <MoneyInput
            id="amount"
            name="amount"
            value={raw}
            onChangeValue={(minor) => {
              setRaw(minor ? String(Math.round(minor / 100)) : '');
              if (error) setError(null);
            }}
            placeholder="85.000"
            presets={[20000, 50000, 100000, 200000]}
            className="py-3 pl-9 font-display text-[26px] font-bold"
          />
          {error && (
            <p id="amount-err" role="alert" className="mt-1.5 text-sm text-neg">
              {error}
            </p>
          )}
        </div>
        <button id="btn-ask-direct" type="submit" className="btn-primary w-full">
          Preguntar
        </button>
      </form>

      {/* La respuesta, con cómo queda el margen por día y qué opciones hay. */}
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
                  ? 'No te alcanza'
                  : answer.verdict === 'justo'
                    ? 'Te alcanza, pero quedas justo'
                    : 'Sí, te alcanza'}
              </h2>
              <p className="mt-2 text-[15.5px] leading-relaxed text-ink">
                {answer.verdict === 'no'
                  ? `${cop(answer.amountMinor)} es más de lo que puedes gastar: te faltarían ${cop(
                      answer.shortfallMinor,
                    )} para llegar al ${shortDate(answer.nextIncomeOn)}.`
                  : `Después de gastar ${cop(answer.amountMinor)} te quedarían ${cop(
                      answer.remainingMinor,
                    )} hasta el ${shortDate(answer.nextIncomeOn)}.`}
              </p>
            </div>
          </div>

          {/* Comparativo antes / después en margen diario */}
          <div className="mt-4 rounded-2xl bg-white/90 p-4">
            <div className="flex items-baseline justify-between text-[13px] font-semibold text-ink-muted">
              <span>Lo que te queda por día</span>
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
                ? 'Se lleva toda tu cifra y toca la plata de tus cobros fijos o de tu día a día.'
                : `Este gasto se lleva el ${usedSharePct} % de tu cifra.`}
            </p>
          </div>

          {/* Alternativas concretas y sin regaño cuando No o Justo */}
          {answer.verdict !== 'si' && (
            <div className="mt-4 space-y-2.5 rounded-2xl bg-white/90 p-4 text-[14px]">
              <p className="font-semibold text-ink">Lo que puedes hacer:</p>
              <ul className="space-y-2 text-ink-soft">
                {comfortableMinor > 0 && comfortableMinor < answer.amountMinor && (
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>
                      <strong>Gastar hasta</strong>{' '}
                      <button
                        id="btn-ask-comfortable"
                        type="button"
                        onClick={() => evaluate(comfortableMinor)}
                        className="tnum font-semibold text-primary-dark underline underline-offset-2"
                      >
                        {cop(comfortableMinor)}
                      </button>
                      : te quedan <span className="tnum">{cop(reserveMinor)}</span> de margen, lo que gastas en {reserveDays}{' '}
                      {reserveDays === 1 ? 'día' : 'días'} de tu día a día.
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <Clock size={15} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
                  <span>
                    <strong>Esperar {cifra.daysLeft} {cifra.daysLeft === 1 ? 'día' : 'días'}:</strong> tu próximo pago llega el{' '}
                    <strong>{shortDate(answer.nextIncomeOn)}</strong>.
                  </span>
                </li>
                {nearbyOffers[0] && (
                  <li className="flex items-start gap-2">
                    <Tag size={15} className="mt-0.5 shrink-0 text-terra" aria-hidden="true" />
                    <span>
                      <strong>Una oferta cerca:</strong> {nearbyOffers[0].merchantName} ({nearbyOffers[0].neighborhood}) tiene{' '}
                      <em>{nearbyOffers[0].title}</em>.{' '}
                      <Link href={`/app/ofertas?destacada=${nearbyOffers[0].id}`} className="font-semibold text-terra-dark underline">
                        Ver oferta
                      </Link>
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Si decide hacerlo: anotar el gasto o apartar la plata. */}
          <div className="mt-4 rounded-2xl border border-line bg-white/95 p-4">
            <p className="text-[14px] font-semibold text-ink">¿Lo vas a hacer?</p>
            {executedMessage ? (
              <p role="status" className="mt-2 flex items-center gap-2 rounded-xl bg-primary-pale px-3.5 py-2.5 text-[13.5px] font-semibold text-primary-dark">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>{executedMessage}</span>
              </p>
            ) : (
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                <button
                  id="btn-record-evaluated-spend"
                  type="button"
                  disabled={isPending}
                  onClick={() => handleExecuteSpend('registrar_gasto')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-bold text-white shadow-xs transition hover:bg-primary-dark"
                >
                  <PlusCircle size={15} aria-hidden="true" />
                  <span>{isPending ? 'Guardando…' : `Anotar este gasto (${cop(answer.amountMinor)})`}</span>
                </button>
                <button
                  id="btn-reserve-evaluated-spend"
                  type="button"
                  disabled={isPending}
                  onClick={() => handleExecuteSpend('apartar_ciclo')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-white px-4 py-2 text-[13px] font-bold text-ink transition hover:bg-paper"
                >
                  <BookmarkPlus size={15} aria-hidden="true" />
                  <span>Apartar esa plata hasta mi pago</span>
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Cuotas con tarjeta, con una tasa de ejemplo rotulada como ejemplo. Plegado: no es la pregunta principal. */}
      {creditSim && answer && answer.amountMinor >= 20_000_00 && (
        <details className="surface-card group p-5 sm:p-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <CreditCard size={19} className="text-terra-dark" aria-hidden="true" />
              <span className="font-display text-[18px] font-bold text-ink">¿Y si lo pagas a cuotas?</span>
            </span>
            <span className="text-[13px] font-medium text-ink-muted group-open:hidden">Ver</span>
            <span className="hidden text-[13px] font-medium text-ink-muted group-open:inline">Cerrar</span>
          </summary>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
              <span>Tasa de ejemplo:</span>
              <select
                id="ask-ea-rate"
                value={eaRate}
                onChange={(e) => setEaRate(Number(e.target.value))}
                className="rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] font-semibold text-ink"
              >
                {EXAMPLE_EA_RATES.map((r) => (
                  <option key={r} value={r}>
                    {String(r).replace('.', ',')} % E.A.
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-1.5 text-[13.5px] text-ink-muted">
            Es un ejemplo: la tasa de tu tarjeta sale en su extracto. Con esta tasa, que equivale a{' '}
            <strong className="tnum text-ink">{creditSim.monthlyRatePct} % mes vencido</strong>, terminarías pagando:
          </p>

          <div className="tnum mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {creditSim.options.map((opt) => (
              <div
                key={opt.installments}
                className={`rounded-2xl border p-3.5 ${
                  opt.installments === 1
                    ? 'border-primary/35 bg-primary-pale/55'
                    : 'border-line bg-paper/70'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[12.5px] font-bold text-ink">{opt.label}</span>
                </div>
                <p className="mt-1.5 font-display text-[20px] font-extrabold text-ink">
                  {cop(opt.monthlyPaymentMinor)}
                  {opt.installments > 1 ? <span className="text-[12px] font-normal text-ink-faint">/mes</span> : null}
                </p>
                <p className="mt-1 text-[12px] text-ink-muted">Total: {cop(opt.totalPaidMinor)}</p>
                <p
                  className={`mt-0.5 text-[12px] font-semibold ${
                    opt.interestLostMinor === 0 ? 'text-primary-dark' : 'text-neg'
                  }`}
                >
                  {opt.interestLostMinor === 0
                    ? '$0 en intereses'
                    : `+${cop(opt.interestLostMinor)} en intereses`}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 rounded-xl bg-paper px-3.5 py-2.5 text-[13px] text-ink-soft">
            {creditSim.plainAdvice}
          </p>
        </details>
      )}
    </div>
  );
}
