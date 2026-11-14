'use client';

import { Lock, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { IncomeFields } from '@/components/app/income-fields';
import { MoneyInput } from '@/components/ui/money-input';
import type { IncomeFrequency } from '@/lib/engine/types';
import { cop, parsePesosInput, toDailyMinor, type SpendPeriod } from '@/lib/format';
import { parseQuickForm, type QuickFormValues } from '@/lib/quick-form';

/**
 * Las cuatro preguntas de la cifra: cada cuánto te pagan, cuánto tienes hoy, qué pagas fijo y
 * cuánto se te va en el día a día. Es el único formulario para esto, con dos usos:
 *
 * - `prueba`: la página pública, sin cuenta. Al terminar lee los datos en el navegador y se los
 *   pasa a `onDone`; no envía nada al servidor. Trae el campo opcional "¿cuánto crees que puedes
 *   gastar?".
 * - `cuenta`: el modo rápido de una cuenta nueva. Al terminar envía el formulario a la acción del
 *   servidor (`saveQuickStart`). Trae el campo opcional "¿Dónde está esa plata?".
 *
 * Los nombres de los campos son los que leen `parseQuickForm` y `saveQuickStart`.
 */

const STEPS = 4;
const SUGGESTED = ['Arriendo', 'Servicios', 'Celular', 'Internet', 'Suscripciones', 'Gimnasio', 'Cuota de crédito'];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const PERIODS: Array<[SpendPeriod, string]> = [
  ['dia', 'Al día'],
  ['semana', 'A la semana'],
  ['mes', 'Al mes'],
];

/** Identificadores de cada uso. Las pruebas de punta a punta los usan. */
const IDS = {
  prueba: { prefix: 'pc', next: 'btn-probar-seguir', finish: 'btn-probar-ver' },
  cuenta: { prefix: 'qs', next: 'btn-qs-next', finish: 'btn-qs-submit' },
} as const;

type Row = { id: number; name: string };

type CommonProps = {
  /** Si se conoce, la primera pregunta la llama por su nombre. */
  firstName?: string | null;
  /** Lo que ya se sabe de su ingreso, para no volver a preguntarlo en blanco. */
  frequency?: IncomeFrequency | null;
  days?: number[] | null;
  /** h1 cuando es lo principal de la página; h2 cuando va debajo de otro título. */
  headingLevel?: 1 | 2;
  /** Se llama cada vez que la persona toca o escribe algo. */
  onStart?: () => void;
  /** Lleva el foco a la primera pregunta apenas aparece (cuando llega de otra pantalla). */
  focusOnMount?: boolean;
};

type PruebaProps = CommonProps & {
  mode: 'prueba';
  /** Datos ya leídos y válidos. */
  onDone: (values: QuickFormValues) => void;
  /** Oculto mientras se muestra el resultado. Al volver a mostrarse arranca en la primera pregunta. */
  hidden?: boolean;
};

type CuentaProps = CommonProps & {
  mode: 'cuenta';
  action: (form: FormData) => void;
  pending: boolean;
  /** Error que devolvió el servidor, con el paso al que pertenece. */
  serverError: { step: number; message: string } | null;
  /** Si existe, la primera pregunta tiene "Atrás" y lo llama. */
  onBackFromFirst?: () => void;
  /** Campos ocultos que viajan con el formulario. */
  hiddenFields?: React.ReactNode;
};

export function CifraQuestions(props: PruebaProps | CuentaProps) {
  const { mode, firstName = null, frequency = null, days = null, headingLevel = 2, onStart, focusOnMount = false } = props;
  const ids = IDS[mode];
  const hidden = props.mode === 'prueba' ? Boolean(props.hidden) : false;
  const serverError = props.mode === 'cuenta' ? props.serverError : null;

  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [daily, setDaily] = useState('');
  const [period, setPeriod] = useState<SpendPeriod>('dia');
  const nextId = useRef(1);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(focusOnMount);
  const wasHidden = useRef(hidden);

  // Al cambiar de paso, el lector de pantalla y el teclado van a la pregunta nueva.
  useEffect(() => {
    if (mounted.current) headingRef.current?.focus();
    mounted.current = true;
  }, [step]);

  // Al volver a mostrarse (después del resultado), arranca en la primera pregunta con lo escrito.
  useEffect(() => {
    if (wasHidden.current && !hidden) {
      setStep(0);
      headingRef.current?.focus();
    }
    wasHidden.current = hidden;
  }, [hidden]);

  // Si el servidor rechaza algo, se vuelve al paso donde está el problema.
  useEffect(() => {
    if (serverError) setStep(serverError.step);
  }, [serverError]);

  const error = localError ?? (serverError && serverError.step === step ? serverError.message : null);

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
    setLocalError(problem);
    if (!problem) setStep((s) => Math.min(STEPS - 1, s + 1));
  }

  function back() {
    setLocalError(null);
    if (step === 0) {
      if (props.mode === 'cuenta') props.onBackFromFirst?.();
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  }

  /** Solo en la prueba: lee y valida en el navegador, sin enviar nada. */
  function finishInBrowser() {
    if (props.mode !== 'prueba' || !formRef.current) return;
    const problem = check(step);
    if (problem) {
      setLocalError(problem);
      return;
    }
    const parsed = parseQuickForm(new FormData(formRef.current));
    if (!parsed.ok) {
      setStep(parsed.step);
      setLocalError(parsed.message);
      return;
    }
    setLocalError(null);
    props.onDone(parsed.values);
  }

  function addRow(name: string) {
    onStart?.();
    setRows((r) => [...r, { id: nextId.current++, name }]);
  }

  const dailyAmount = /^[$\s]*0+$/.test(daily.trim()) ? 0 : parsePesosInput(daily);
  const perDay = dailyAmount !== null && period !== 'dia' ? toDailyMinor(dailyAmount, period) : null;
  const titles = [
    firstName ? `${firstName}, ¿cada cuánto te pagan?` : '¿Cada cuánto te pagan?',
    '¿Cuánto tienes hoy?',
    '¿Qué pagas fijo cada mes?',
    '¿Cuánto se te va en el día a día?',
  ];
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const showBack = step > 0 || (props.mode === 'cuenta' && Boolean(props.onBackFromFirst));
  const isLast = step === STEPS - 1;

  return (
    <form
      ref={formRef}
      action={props.mode === 'cuenta' ? props.action : undefined}
      hidden={hidden}
      noValidate
      className="surface-card p-5 sm:p-7"
      onChange={() => {
        onStart?.();
        if (localError) setLocalError(null);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return;
        if (!isLast) {
          e.preventDefault();
          next();
        } else if (props.mode === 'prueba') {
          e.preventDefault();
          finishInBrowser();
        }
        // En la cuenta, Enter en la última pregunta envía el formulario (y pasa por onSubmit).
      }}
      onSubmit={(e) => {
        if (!isLast) {
          e.preventDefault();
          next();
          return;
        }
        if (props.mode === 'prueba') {
          e.preventDefault();
          finishInBrowser();
          return;
        }
        const problem = check(step);
        if (problem) {
          e.preventDefault();
          setLocalError(problem);
        }
      }}
    >
      {props.mode === 'cuenta' && props.hiddenFields}

      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-line'}`} />
          ))}
        </div>
        <span className="tnum text-[13px] font-semibold text-ink-muted">
          Paso {step + 1} de {STEPS}
        </span>
      </div>

      <Heading
        ref={headingRef}
        tabIndex={-1}
        className="mt-5 font-display text-[26px] font-bold leading-tight tracking-[-0.02em] outline-none sm:text-[30px]"
      >
        {titles[step]}
      </Heading>

      <fieldset hidden={step !== 0} className="mt-2">
        <legend className="sr-only">Tu ingreso</legend>
        <p className="mb-5 text-[15px] leading-relaxed text-ink-muted">
          Tu cifra va desde hoy hasta tu próximo pago: salario, mesada u honorarios.
        </p>
        <IncomeFields frequency={frequency} days={days} />
      </fieldset>

      <fieldset hidden={step !== 1} className="mt-2">
        <legend className="sr-only">Tu saldo</legend>
        <p className="mb-5 text-[15px] leading-relaxed text-ink-muted">
          Suma lo que tienes en cuentas, billeteras y efectivo. No sumes el cupo de la tarjeta de crédito.
        </p>
        <label htmlFor={`${ids.prefix}-balance`} className="label">
          Tienes hoy
        </label>
        <MoneyInput
          id={`${ids.prefix}-balance`}
          name="balance"
          placeholder="1.250.000"
          presets={[100000, 500000, 1000000]}
          className="text-[20px] font-semibold"
        />
        {props.mode === 'cuenta' && (
          <>
            <label htmlFor="qs-where" className="label mt-5">
              ¿Dónde está esa plata? <span className="font-normal text-ink-faint">(opcional)</span>
            </label>
            <input id="qs-where" name="where" maxLength={60} autoComplete="off" className="field" placeholder="Ej. Bancolombia y Nequi" />
          </>
        )}
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
              onClick={() => addRow(s)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-2 text-[13.5px] font-semibold hover:border-line-strong hover:bg-white"
            >
              <Plus size={15} aria-hidden="true" /> {s}
            </button>
          ))}
          <button
            type="button"
            onClick={() => addRow('')}
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
                  <label htmlFor={`${ids.prefix}-fn-${r.id}`} className="sr-only">
                    Nombre del cobro {i + 1}
                  </label>
                  <input
                    id={`${ids.prefix}-fn-${r.id}`}
                    name="fixedName"
                    defaultValue={r.name}
                    maxLength={60}
                    placeholder="Nombre"
                    className="field py-2.5 font-semibold"
                    autoFocus={!r.name}
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
                    <label htmlFor={`${ids.prefix}-fa-${r.id}`} className="sr-only">
                      Monto de {r.name || `cobro ${i + 1}`}
                    </label>
                    <MoneyInput id={`${ids.prefix}-fa-${r.id}`} name="fixedAmount" placeholder="Monto" autoFocus={Boolean(r.name)} />
                  </div>
                  <div>
                    <label htmlFor={`${ids.prefix}-fd-${r.id}`} className="sr-only">
                      Día del mes de {r.name || `cobro ${i + 1}`}
                    </label>
                    <select id={`${ids.prefix}-fd-${r.id}`} name="fixedDay" defaultValue="" className="field py-2.5">
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
        <label htmlFor={`${ids.prefix}-daily`} className="label">
          Más o menos
        </label>
        <MoneyInput
          id={`${ids.prefix}-daily`}
          name="daily"
          value={daily}
          onChangeValue={(minor) => {
            onStart?.();
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

        {props.mode === 'prueba' && (
          <div className="mt-6 border-t border-line pt-5">
            <label htmlFor="pc-guess" className="label">
              Antes de verla: ¿cuánto crees que puedes gastar de aquí a tu próximo pago?{' '}
              <span className="font-normal text-ink-faint">(opcional)</span>
            </label>
            <MoneyInput id="pc-guess" name="guess" placeholder="Tu cálculo a ojo" />
          </div>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-neg-light px-4 py-3 text-[14px] text-neg">
          {error}
        </p>
      )}

      <div className="mt-7 flex gap-3">
        {showBack && (
          <button type="button" onClick={back} className="btn-ghost px-5">
            Atrás
          </button>
        )}
        {!isLast ? (
          <button id={ids.next} key="seguir" type="button" onClick={next} className="btn-primary flex-1">
            {step === 2 && rows.length === 0 ? 'No pago nada fijo, seguir' : 'Seguir'}
          </button>
        ) : props.mode === 'prueba' ? (
          <button id={ids.finish} key="ver" type="button" onClick={finishInBrowser} className="btn-primary flex-1">
            Ver mi cifra
          </button>
        ) : (
          <button id={ids.finish} key="ver" type="submit" disabled={props.pending} className="btn-primary flex-1">
            {props.pending ? 'Calculando tu cifra…' : 'Ver mi cifra'}
          </button>
        )}
      </div>

      {props.mode === 'prueba' ? (
        <p className="mt-5 flex items-start gap-2 text-[12.5px] leading-snug text-ink-faint">
          <Lock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>El cálculo se hace en tu celular. No guardamos ni enviamos estos números, y no te pedimos claves del banco.</span>
        </p>
      ) : (
        step === 0 && (
          <p className="mt-6 border-t border-line pt-4 text-[14px] leading-relaxed text-ink-muted">
            ¿Prefieres subir tu extracto bancario?{' '}
            <Link href="/app/datos/importar?primera=1" className="font-semibold text-primary-dark underline underline-offset-2">
              Súbelo aquí y detectamos todo solos
            </Link>
            .
          </p>
        )
      )}
    </form>
  );
}
