'use client';

import { BookmarkPlus, CheckCircle2, Clock, CreditCard, PlusCircle, Sparkles, Tag, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { executeEvaluatedSpendAction } from '@/app/actions/v3';
import { ExpandableSmartMap } from '@/components/map/expandable-smart-map';
import { MoneyInput } from '@/components/ui/money-input';
import { track } from '@/lib/analytics/client';
import { canISpend, type CifraResult } from '@/lib/engine/cifra';
import { simulateCreditInstallments } from '@/lib/engine/daily-value';
import { shortDate } from '@/lib/engine/dates';
import { parseNaturalSpendQuery } from '@/lib/engine/insights';
import { cop, parsePesosInput } from '@/lib/format';
import type { SmartMapBundle } from '@/lib/v3-data';

type Slim = Pick<CifraResult, 'availableMinor' | 'perDayMinor' | 'dailyVariableMinor' | 'daysLeft' | 'nextIncomeOn'>;

interface NearbyOfferHint {
  id: string;
  merchantName: string;
  title: string;
  neighborhood: string;
  estimatedSavingsMinor: number;
}

const QUICK_EXAMPLES = [
  '¿Puedo pedir domicilio de 38 mil hoy?',
  '120 mil salida del viernes',
  '280 mil unos tenis a cuotas',
];

export function Ask({
  cifra,
  nearbyOffers = [],
  smartMapBundle,
}: {
  cifra: Slim;
  nearbyOffers?: NearbyOfferHint[];
  smartMapBundle?: SmartMapBundle;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [naturalText, setNaturalText] = useState('');
  const [raw, setRaw] = useState('');
  const [what, setWhat] = useState('');
  const [eaRate, setEaRate] = useState<number>(30.8);
  const [answer, setAnswer] = useState<ReturnType<typeof canISpend> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executedMessage, setExecutedMessage] = useState<string | null>(null);

  function evaluate(amountMinor: number, concept: string) {
    setError(null);
    setExecutedMessage(null);
    const a = canISpend(cifra as CifraResult, amountMinor);
    setWhat(concept);
    setRaw(String(Math.round(amountMinor / 100)));
    setAnswer(a);
    track('ask_spend', { where: 'app', verdict: a.verdict });
  }

  function handleExecuteSpend(mode: 'registrar_gasto' | 'apartar_ciclo') {
    if (!answer) return;
    startTransition(async () => {
      const res = await executeEvaluatedSpendAction({
        amountMinor: answer.amountMinor,
        concept: what || naturalText || 'Gasto evaluado en ¿Puedo?',
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

  const creditSim = useMemo(
    () => (answer ? simulateCreditInstallments(answer.amountMinor, eaRate, [1, 3, 6, 12]) : null),
    [answer, eaRate],
  );

  const isLocalConsumption = useMemo(() => {
    const combined = `${what} ${naturalText}`.toLowerCase();
    return /(almuerzo|cena|comida|domicilio|rappi|didi|cafe|pan|onces|mercado|fruver|postre|salida)/i.test(combined);
  }, [what, naturalText]);

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
            Evaluar gasto
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
            setError('Escribe un monto en pesos, por ejemplo 85,000.');
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
          <MoneyInput
            id="amount"
            name="amount"
            value={raw}
            onChangeValue={(minor) => {
              setRaw(String(Math.round(minor / 100)));
              if (error) setError(null);
            }}
            placeholder="85,000"
            presets={[20000, 50000, 100000, 200000]}
            className="py-3 pl-9 font-display text-[26px] font-bold"
          />
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
            placeholder="Unos tenis, domicilio cena, regalo..."
            className="field"
            maxLength={60}
          />
        </div>
        <button id="btn-ask-direct" type="submit" className="btn-primary w-full">
          Calcular impacto en mi cifra
        </button>
      </form>

      {/* Respuesta empática con impacto diario y alternativas accionables */}
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

          {/* Ejecución real en PostgreSQL: Registrar gasto o apartarlo en el ciclo */}
          <div className="mt-4 rounded-2xl border border-line bg-white/95 p-4">
            <p className="text-[12.5px] font-bold uppercase tracking-wider text-ink-muted">
              ¿Decidiste hacerlo? Ejecútalo en tu cifra real:
            </p>
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
                  <span>{isPending ? 'Guardando...' : `Registrar gasto (${cop(answer.amountMinor)})`}</span>
                </button>
                <button
                  id="btn-reserve-evaluated-spend"
                  type="button"
                  disabled={isPending}
                  onClick={() => handleExecuteSpend('apartar_ciclo')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-white px-4 py-2 text-[13px] font-bold text-ink transition hover:bg-paper"
                >
                  <BookmarkPlus size={15} aria-hidden="true" />
                  <span>Apartar como compromiso de este ciclo</span>
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Simulador colombiano de Tarjeta de Crédito: Contado / 1 cuota vs 3, 6 y 12 cuotas */}
      {creditSim && answer && answer.amountMinor >= 20_000_00 && (
        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CreditCard size={19} className="text-terra-dark" aria-hidden="true" />
              <h3 className="font-display text-[19px] font-bold text-ink">
                ¿Y si lo pasas con tarjeta a cuotas?
              </h3>
            </div>
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
              <span>Tasa E.A.:</span>
              <select
                value={eaRate}
                onChange={(e) => setEaRate(Number(e.target.value))}
                className="rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] font-semibold text-ink"
              >
                <option value={30.8}>30,8 % E.A. (promedio TC Colombia)</option>
                <option value={26.5}>26,5 % E.A. (tasa preferencial)</option>
                <option value={33.9}>33,9 % E.A. (cerca a usura)</option>
              </select>
            </label>
          </div>

          <p className="mt-1.5 text-[13.5px] text-ink-muted">
            Equivale a <strong className="tnum text-ink">{creditSim.monthlyRatePct} % mes vencido</strong>. Mira cuánto terminas pagando de verdad:
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
        </section>
      )}

      {/* Puente directo al barrio cuando consulta comida, domicilio, café o mercado */}
      {smartMapBundle && smartMapBundle.offers.length > 0 && (
        <ExpandableSmartMap
          bundle={smartMapBundle}
          defaultExpanded={Boolean(answer && isLocalConsumption)}
          initialCategoryFilter={isLocalConsumption ? 'comida' : null}
          compactTitle={
            isLocalConsumption
              ? 'En vez de pagar recargos de app: locales a minutos de ti con descuento activo'
              : '¿Prefieres resolverlo caminando en tu barrio y ahorrando?'
          }
          compactSubtitle="Compara cuánto te cuesta a pie en comercios independientes verificados frente a pedir por aplicación."
        />
      )}
    </div>
  );
}
