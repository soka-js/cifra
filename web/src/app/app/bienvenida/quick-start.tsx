'use client';

import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { IncomeFields } from '@/components/app/income-fields';
import { cop, parsePesosInput, toDailyMinor, type SpendPeriod } from '@/lib/format';
import { saveQuickStart, type QuickState } from '../actions';

const STEPS = 4;
const SUGGESTED = ['Arriendo', 'Servicios', 'Celular', 'Internet', 'Suscripciones', 'Gimnasio', 'Cuota de crédito'];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const PERIODS: Array<[SpendPeriod, string]> = [
  ['dia', 'Al día'],
  ['semana', 'A la semana'],
  ['mes', 'Al mes'],
];

type Row = { id: number; name: string };

/**
 * La cifra en un minuto: cuatro preguntas en un solo formulario. Cada paso muestra una pregunta;
 * todo se envía junto al final y el servidor valida otra vez.
 */
export function QuickStart({
  firstName,
  frequency,
  days,
}: {
  firstName: string | null;
  frequency: 'mensual' | 'quincenal' | 'semanal' | 'irregular' | null;
  days: number[] | null;
}) {
  const [state, action, pending] = useActionState<QuickState, FormData>(saveQuickStart, { status: 'idle' });
  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [daily, setDaily] = useState('');
  const [period, setPeriod] = useState<SpendPeriod>('dia');
  const nextId = useRef(1);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (state.status === 'error') setStep(state.step);
  }, [state]);

  useEffect(() => {
    // Al cambiar de paso, el foco va a la pregunta (no al cargar la página por primera vez).
    if (mounted.current) headingRef.current?.focus();
    mounted.current = true;
  }, [step]);

  const serverError = state.status === 'error' && state.step === step ? state.message : null;
  const error = localError ?? serverError;

  function value(name: string): string {
    const el = formRef.current?.elements.namedItem(name);
    if (!el) return '';
    if (el instanceof RadioNodeList) return el.value;
    return (el as HTMLInputElement).value ?? '';
  }

  function check(current: number): string | null {
    if (current === 0 && !value('frequency')) return 'Elige cada cuánto te pagan.';
    if (current === 1 && !value('balance').trim()) return 'Escribe cuánto tienes hoy. Si no tienes nada, escribe 0.';
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
    setStep((s) => Math.max(0, s - 1));
  }

  function addRow(name: string) {
    setRows((r) => [...r, { id: nextId.current++, name }]);
  }

  const dailyAmount = /^[$\s]*0+$/.test(daily.trim()) ? 0 : parsePesosInput(daily);
  const perDay = dailyAmount !== null && period !== 'dia' ? toDailyMinor(dailyAmount, period) : null;

  const titles = [
    `${firstName ? `${firstName}, ` : ''}¿cada cuánto te pagan?`,
    '¿Cuánto tienes hoy?',
    '¿Qué pagas fijo cada mes?',
    '¿Cuánto gastas en el día a día?',
  ];

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      onChange={() => {
        if (localError) setLocalError(null);
      }}
      onKeyDown={(e) => {
        // Enter en un campo avanza al siguiente paso (sin botón de envío visible no lo haría solo).
        if (e.key === 'Enter' && step < STEPS - 1 && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          next();
        }
      }}
      onSubmit={(e) => {
        if (step < STEPS - 1) {
          e.preventDefault();
          next();
          return;
        }
        const problem = check(step);
        if (problem) {
          e.preventDefault();
          setLocalError(problem);
        }
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-line'}`} />
          ))}
        </div>
        <span className="text-[13px] font-semibold text-ink-muted">
          Paso {step + 1} de {STEPS}
        </span>
      </div>

      <h1 ref={headingRef} tabIndex={-1} className="mt-6 font-display text-[30px] font-bold leading-tight tracking-[-0.02em] outline-none">
        {titles[step]}
      </h1>

      <fieldset hidden={step !== 0} className="mt-2">
        <legend className="sr-only">Tu ingreso</legend>
        <p className="mb-6 text-[15.5px] leading-relaxed text-ink-muted">
          Tu cifra va desde hoy hasta tu próximo ingreso: salario, mesada u honorarios.
        </p>
        <IncomeFields frequency={frequency} days={days} />
      </fieldset>

      <fieldset hidden={step !== 1} className="mt-2">
        <legend className="sr-only">Tu saldo</legend>
        <p className="mb-6 text-[15.5px] leading-relaxed text-ink-muted">
          Suma lo que tienes en tus cuentas y billeteras, como Nequi o Daviplata. Sin tarjetas de crédito.
        </p>
        <label htmlFor="qs-balance" className="label">Saldo de hoy</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">$</span>
          <input id="qs-balance" name="balance" inputMode="numeric" autoComplete="off" className="field tnum pl-8 text-[20px] font-semibold placeholder:font-normal" placeholder="1.250.000" />
        </div>
        <label htmlFor="qs-where" className="label mt-5">¿Dónde está? (opcional)</label>
        <input id="qs-where" name="where" maxLength={60} autoComplete="off" className="field" placeholder="Bancolombia y Nequi" />
      </fieldset>

      <fieldset hidden={step !== 2} className="mt-2">
        <legend className="sr-only">Tus cobros fijos</legend>
        <p className="mb-5 text-[15.5px] leading-relaxed text-ink-muted">
          Con el día del mes en que lo pagas. Nosotros vemos cuáles faltan antes de tu próximo pago. Si no pagas nada fijo, sigue.
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED.map((s) => (
            <button key={s} type="button" onClick={() => addRow(s)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-[14px] font-semibold hover:border-ink-faint">
              <Plus size={15} aria-hidden="true" /> {s}
            </button>
          ))}
          <button type="button" onClick={() => addRow('')} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink-faint px-3.5 py-2 text-[14px] font-semibold text-ink-muted hover:text-ink">
            <Plus size={15} aria-hidden="true" /> Otro
          </button>
        </div>
        {rows.length > 0 && (
          <ul className="mt-5 space-y-3">
            {rows.map((r, i) => (
              <li key={r.id} className="rounded-2xl border border-line bg-white p-3.5">
                <div className="flex items-center gap-2">
                  <label htmlFor={`qs-fn-${r.id}`} className="sr-only">Nombre del cobro {i + 1}</label>
                  <input id={`qs-fn-${r.id}`} name="fixedName" defaultValue={r.name} maxLength={60} placeholder="Nombre" className="field py-2.5 font-semibold" autoFocus={!r.name} />
                  <button type="button" onClick={() => setRows((all) => all.filter((x) => x.id !== r.id))} aria-label={`Quitar ${r.name || `cobro ${i + 1}`}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-paper hover:text-ink">
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_7.5rem] gap-2">
                  <div className="relative">
                    <label htmlFor={`qs-fa-${r.id}`} className="sr-only">Monto de {r.name || `cobro ${i + 1}`}</label>
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">$</span>
                    <input id={`qs-fa-${r.id}`} name="fixedAmount" inputMode="numeric" placeholder="Monto" className="field tnum py-2.5 pl-8" autoFocus={Boolean(r.name)} />
                  </div>
                  <div>
                    <label htmlFor={`qs-fd-${r.id}`} className="sr-only">Día del mes de {r.name || `cobro ${i + 1}`}</label>
                    <select id={`qs-fd-${r.id}`} name="fixedDay" defaultValue="" className="field py-2.5">
                      <option value="" disabled>Día</option>
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
        <p className="mb-6 text-[15.5px] leading-relaxed text-ink-muted">
          Comida, transporte, domicilios y salidas, sin lo fijo del paso anterior. Un aproximado sirve: cuando subas un extracto lo calculamos con tus movimientos.
        </p>
        <label htmlFor="qs-daily" className="label">Más o menos</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">$</span>
          <input
            id="qs-daily"
            name="daily"
            inputMode="numeric"
            autoComplete="off"
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
            className="field tnum pl-8 text-[20px] font-semibold placeholder:font-normal"
            placeholder="30.000"
          />
        </div>
        <div role="radiogroup" aria-label="Cada cuánto" className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-paper-deep p-1">
          {PERIODS.map(([v, l]) => (
            <label key={v} className={`cursor-pointer rounded-lg px-2 py-2.5 text-center text-[14.5px] font-semibold ${period === v ? 'bg-white text-ink shadow-[0_1px_2px_rgba(20,32,29,0.12)]' : 'text-ink-muted'}`}>
              <input type="radio" name="period" value={v} checked={period === v} onChange={() => setPeriod(v)} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
        {perDay !== null && <p className="tnum mt-2.5 text-[14px] text-ink-muted">Son unos {cop(perDay)} al día.</p>}
      </fieldset>

      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-neg-light px-4 py-3 text-[14px] text-neg">
          {error}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <button type="button" onClick={back} className="btn-ghost px-5">
            Atrás
          </button>
        )}
        {/* Llaves distintas: si React reutilizara el mismo botón, el clic en "Seguir" terminaría enviando el formulario. */}
        {step < STEPS - 1 ? (
          <button key="seguir" type="button" onClick={next} className="btn-primary flex-1">
            {step === 2 && rows.length === 0 ? 'No pago nada fijo, seguir' : 'Seguir'}
          </button>
        ) : (
          <button key="enviar" type="submit" disabled={pending} className="btn-primary flex-1">
            {pending ? 'Calculando...' : 'Ver mi cifra'}
          </button>
        )}
      </div>

      {step === 0 && (
        <p className="mt-8 border-t border-line pt-5 text-[14.5px] leading-relaxed text-ink-muted">
          ¿Tienes el extracto de tu banco a mano?{' '}
          <Link href="/app/datos/importar?primera=1" className="font-semibold text-primary-dark underline underline-offset-2">
            Súbelo y lo calculamos con tus movimientos
          </Link>
          .
        </p>
      )}
    </form>
  );
}
