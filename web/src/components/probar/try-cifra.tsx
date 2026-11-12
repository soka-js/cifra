'use client';

import { ArrowRight, Lock, Plus, RotateCcw, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { IncomeFields } from '@/components/app/income-fields';
import { MoneyInput } from '@/components/ui/money-input';
import { track } from '@/lib/analytics/client';
import { shortDate, todayInBogota } from '@/lib/engine/dates';
import { canISpend, compareGuess, computeQuickCifra, type CifraResult, type SpendAnswer } from '@/lib/engine/quick';
import { cop, parsePesosInput, toDailyMinor, type SpendPeriod } from '@/lib/format';
import { parseQuickForm, type QuickFormValues } from '@/lib/quick-form';

/**
 * La prueba sin cuenta: cuatro datos y la cifra, calculada en el navegador con el mismo motor
 * que usa la app. Nada de lo que la persona escribe se envía ni se guarda en el servidor; solo
 * queda en este dispositivo (sessionStorage) para que, si decide crear su cuenta, no lo repita.
 */

export const TRIAL_STORAGE_KEY = 'cifra:prueba';

const STEPS = 4;
const SUGGESTED = ['Arriendo', 'Servicios', 'Celular', 'Internet', 'Suscripciones', 'Gimnasio', 'Cuota de crédito'];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const PERIODS: Array<[SpendPeriod, string]> = [
  ['dia', 'Al día'],
  ['semana', 'A la semana'],
  ['mes', 'Al mes'],
];
const TITLES = [
  '¿Cada cuánto te pagan?',
  '¿Cuánto tienes hoy?',
  '¿Qué pagas fijo cada mes?',
  '¿Cuánto se te va en el día a día?',
];

type Row = { id: number; name: string };
type Done = { cifra: CifraResult; values: QuickFormValues };

export function TryCifra() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [daily, setDaily] = useState('');
  const [period, setPeriod] = useState<SpendPeriod>('dia');
  const [done, setDone] = useState<Done | null>(null);
  const nextId = useRef(1);
  const startedAt = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) headingRef.current?.focus();
    mounted.current = true;
  }, [step, done]);

  function markStarted() {
    if (startedAt.current !== null) return;
    startedAt.current = Date.now();
    track('try_cifra_start');
  }

  function fieldValue(name: string): string {
    const el = formRef.current?.elements.namedItem(name);
    if (!el) return '';
    if (el instanceof RadioNodeList) return el.value;
    return (el as HTMLInputElement).value ?? '';
  }

  function check(current: number): string | null {
    if (current === 0 && !fieldValue('frequency')) return 'Elige cada cuánto te pagan.';
    if (current === 1 && !fieldValue('balance').trim()) return 'Escribe cuánto tienes hoy. Si no tienes nada, escribe 0.';
    if (current === 3 && !daily.trim()) return 'Escribe cuánto gastas en el día a día.';
    return null;
  }

  function next() {
    const problem = check(step);
    setError(problem);
    if (!problem) setStep((s) => Math.min(STEPS - 1, s + 1));
  }

  function finish() {
    if (!formRef.current) return;
    const parsed = parseQuickForm(new FormData(formRef.current));
    if (!parsed.ok) {
      setStep(parsed.step);
      setError(parsed.message);
      return;
    }
    const cifra = computeQuickCifra({ today: todayInBogota(), ...parsed.values });
    setError(null);
    setDone({ cifra, values: parsed.values });
    try {
      // Solo en este dispositivo: sirve para no volver a preguntar si la persona crea su cuenta.
      sessionStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({ v: 1, ...parsed.values }));
    } catch {
      // Sin almacenamiento disponible: la prueba funciona igual.
    }
    const guess =
      parsed.values.guessMinor === null ? 'sin' : compareGuess(parsed.values.guessMinor, cifra.availableMinor).direction;
    // A la analítica van solo conteos y el estado. Ningún monto.
    track('try_cifra_done', {
      seconds: startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : null,
      status: cifra.status,
      guess,
      fixed: parsed.values.fixed.length,
    });
  }

  const dailyAmount = /^[$\s]*0+$/.test(daily.trim()) ? 0 : parsePesosInput(daily);
  const perDay = dailyAmount !== null && period !== 'dia' ? toDailyMinor(dailyAmount, period) : null;

  return (
    <div>
      {done && (
        <TrialResult
          done={done}
          headingRef={headingRef}
          onEdit={() => {
            setDone(null);
            setStep(0);
          }}
        />
      )}

      {/* El formulario se queda montado (oculto) para que "Cambiar mis datos" conserve lo escrito. */}
      <form
        ref={formRef}
        hidden={done !== null}
        noValidate
        className="surface-card p-5 sm:p-7"
        onChange={() => {
          markStarted();
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            if (step < STEPS - 1) next();
            else finish();
          }
        }}
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS - 1) next();
          else finish();
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1.5" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-line'}`} />
            ))}
          </div>
          <span className="tnum text-[13px] font-semibold text-ink-muted">
            {step + 1} de {STEPS}
          </span>
        </div>

        <h2
          ref={done ? undefined : headingRef}
          tabIndex={-1}
          className="mt-5 font-display text-[26px] font-bold leading-tight tracking-[-0.02em] outline-none sm:text-[30px]"
        >
          {TITLES[step]}
        </h2>

        <fieldset hidden={step !== 0} className="mt-2">
          <legend className="sr-only">Tu ingreso</legend>
          <p className="mb-5 text-[15px] leading-relaxed text-ink-muted">
            Tu cifra va desde hoy hasta tu próximo pago: salario, mesada u honorarios.
          </p>
          <IncomeFields frequency={null} days={null} />
        </fieldset>

        <fieldset hidden={step !== 1} className="mt-2">
          <legend className="sr-only">Tu saldo</legend>
          <p className="mb-5 text-[15px] leading-relaxed text-ink-muted">
            Suma lo que tienes en cuentas, billeteras y efectivo. No sumes el cupo de la tarjeta de crédito.
          </p>
          <label htmlFor="pc-balance" className="label">
            Tienes hoy
          </label>
          <MoneyInput
            id="pc-balance"
            name="balance"
            placeholder="1.250.000"
            presets={[100000, 500000, 1000000]}
            className="text-[20px] font-semibold"
          />
        </fieldset>

        <fieldset hidden={step !== 2} className="mt-2">
          <legend className="sr-only">Tus cobros fijos</legend>
          <p className="mb-4 text-[15px] leading-relaxed text-ink-muted">
            Toca los que pagues y pon qué día del mes salen. Solo restamos los que caen antes de tu próximo pago.
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  markStarted();
                  setRows((r) => [...r, { id: nextId.current++, name: s }]);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-2 text-[13.5px] font-semibold hover:border-line-strong hover:bg-white"
              >
                <Plus size={15} aria-hidden="true" /> {s}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRows((r) => [...r, { id: nextId.current++, name: '' }])}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink-faint px-3.5 py-2 text-[13.5px] font-semibold text-ink-muted hover:text-ink"
            >
              <Plus size={15} aria-hidden="true" /> Otro
            </button>
          </div>
          {rows.length > 0 && (
            <ul className="mt-4 space-y-3">
              {rows.map((r, i) => (
                <li key={r.id} className="rounded-2xl border border-line bg-paper p-3.5">
                  <div className="flex items-center gap-2">
                    <label htmlFor={`pc-fn-${r.id}`} className="sr-only">
                      Nombre del cobro {i + 1}
                    </label>
                    <input
                      id={`pc-fn-${r.id}`}
                      name="fixedName"
                      defaultValue={r.name}
                      maxLength={60}
                      placeholder="Nombre"
                      className="field py-2.5 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setRows((all) => all.filter((x) => x.id !== r.id))}
                      aria-label={`Quitar ${r.name || `cobro ${i + 1}`}`}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-white hover:text-ink"
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_7.5rem] gap-2">
                    <div>
                      <label htmlFor={`pc-fa-${r.id}`} className="sr-only">
                        Monto de {r.name || `cobro ${i + 1}`}
                      </label>
                      <MoneyInput id={`pc-fa-${r.id}`} name="fixedAmount" placeholder="Monto" />
                    </div>
                    <div>
                      <label htmlFor={`pc-fd-${r.id}`} className="sr-only">
                        Día del mes de {r.name || `cobro ${i + 1}`}
                      </label>
                      <select id={`pc-fd-${r.id}`} name="fixedDay" defaultValue="" className="field py-2.5">
                        <option value="" disabled>
                          Día
                        </option>
                        {DAYS.map((d) => (
                          <option key={d} value={d}>
                            Día {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <fieldset hidden={step !== 3} className="mt-2">
          <legend className="sr-only">Tu gasto del día a día</legend>
          <p className="mb-5 text-[15px] leading-relaxed text-ink-muted">
            Comida, transporte, cafés y salidas, sin contar lo fijo. Un aproximado sirve.
          </p>
          <label htmlFor="pc-daily" className="label">
            Más o menos
          </label>
          <MoneyInput
            id="pc-daily"
            name="daily"
            value={daily}
            onChangeValue={(minor) => {
              markStarted();
              setDaily(String(Math.round(minor / 100)));
            }}
            placeholder="35.000"
            presets={[20000, 35000, 50000]}
            className="text-[20px] font-semibold"
          />
          <div role="radiogroup" aria-label="Cada cuánto" className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-paper-deep p-1">
            {PERIODS.map(([v, l]) => (
              <label
                key={v}
                className={`cursor-pointer rounded-lg px-2 py-2.5 text-center text-[14.5px] font-semibold ${
                  period === v ? 'bg-white text-ink shadow-[0_1px_2px_rgba(20,32,29,0.12)]' : 'text-ink-muted'
                }`}
              >
                <input type="radio" name="period" value={v} checked={period === v} onChange={() => setPeriod(v)} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
          {perDay !== null && <p className="tnum mt-2.5 text-[14px] text-ink-muted">Son unos {cop(perDay)} por día.</p>}

          <div className="mt-6 border-t border-line pt-5">
            <label htmlFor="pc-guess" className="label">
              Antes de verla: ¿cuánto crees que puedes gastar de aquí a tu próximo pago?{' '}
              <span className="font-normal text-ink-faint">(opcional)</span>
            </label>
            <MoneyInput id="pc-guess" name="guess" placeholder="Tu cálculo a ojo" />
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-neg-light px-4 py-3 text-[14px] text-neg">
            {error}
          </p>
        )}

        <div className="mt-7 flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep((s) => Math.max(0, s - 1));
              }}
              className="btn-ghost px-5"
            >
              Atrás
            </button>
          )}
          {step < STEPS - 1 ? (
            <button id="btn-probar-seguir" key="seguir" type="button" onClick={next} className="btn-primary flex-1">
              {step === 2 && rows.length === 0 ? 'No pago nada fijo, seguir' : 'Seguir'}
            </button>
          ) : (
            <button id="btn-probar-ver" key="ver" type="button" onClick={finish} className="btn-primary flex-1">
              Ver mi cifra
            </button>
          )}
        </div>

        <p className="mt-5 flex items-start gap-2 text-[12.5px] leading-snug text-ink-faint">
          <Lock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>El cálculo se hace en tu celular. No guardamos ni enviamos estos números, y no te pedimos claves del banco.</span>
        </p>
      </form>
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

      <AskInline cifra={c} />

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

/** "¿Puedo gastar?" contestado ahí mismo, contra la cifra que la persona acaba de ver. */
function AskInline({ cifra }: { cifra: CifraResult }) {
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
    const a = canISpend(cifra, amount);
    setAnswer(a);
    // Solo el veredicto. El monto no se envía.
    track('ask_spend', { verdict: a.verdict, where: 'prueba' });
  }

  const tone =
    answer?.verdict === 'si'
      ? 'bg-primary-light text-primary-dark'
      : answer?.verdict === 'justo'
        ? 'bg-warn-light text-warn'
        : 'bg-neg-light text-neg';

  return (
    <div className="mt-6 rounded-2xl border border-line bg-paper p-4">
      <label htmlFor="pc-ask" className="font-display text-[18px] font-bold text-ink">
        ¿Puedo gastar…?
      </label>
      <p className="mt-0.5 text-[13.5px] text-ink-muted">Escribe un gasto que tengas en mente y te decimos si te alcanza.</p>
      <div className="mt-3 flex gap-2">
        <div className="flex-1">
          <MoneyInput
            id="pc-ask"
            name="ask"
            placeholder="85.000"
            value={raw}
            onChangeValue={(minor) => {
              setRaw(minor ? String(Math.round(minor / 100)) : '');
              setAnswer(null);
            }}
          />
        </div>
        <button id="btn-probar-preguntar" type="button" onClick={ask} className="btn-ink shrink-0 self-start px-5">
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
    </div>
  );
}
