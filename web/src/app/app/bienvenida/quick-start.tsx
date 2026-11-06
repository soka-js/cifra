'use client';

import Link from 'next/link';
import { EyeOff, FileSpreadsheet, Lock, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { IncomeFields } from '@/components/app/income-fields';
import { MoneyInput } from '@/components/ui/money-input';
import { cop, parsePesosInput, toDailyMinor, type SpendPeriod } from '@/lib/format';
import { BOGOTA_ZONES } from '@/lib/zones';
import { saveQuickStart, type QuickState } from '../actions';

const FORM_STEPS = 4;
const SUGGESTED = ['Arriendo', 'Servicios', 'Celular', 'Internet', 'Suscripciones', 'Gimnasio', 'Cuota de crédito'];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const PERIODS: Array<[SpendPeriod, string]> = [
  ['dia', 'Al día'],
  ['semana', 'A la semana'],
  ['mes', 'Al mes'],
];

type Row = { id: number; name: string };

/**
 * Aprendizaje de validación I.5 #1: antes de pedir cualquier dato financiero,
 * explicamos en lenguaje llano los permisos, el alcance de solo lectura y el control Ley 1581.
 */
export function QuickStart({
  firstName,
  frequency,
  days,
  initialZoneSlug,
  alreadyOnboarded,
}: {
  firstName: string | null;
  frequency: 'mensual' | 'quincenal' | 'semanal' | 'irregular' | null;
  days: number[] | null;
  initialZoneSlug: string;
  alreadyOnboarded: boolean;
}) {
  const [state, action, pending] = useActionState<QuickState, FormData>(saveQuickStart, { status: 'idle' });
  const [acceptedTrust, setAcceptedTrust] = useState(alreadyOnboarded);
  const [zoneSlug, setZoneSlug] = useState(initialZoneSlug);
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
    if (state.status === 'error') {
      setAcceptedTrust(true);
      setStep(state.step);
    }
  }, [state]);

  useEffect(() => {
    if (mounted.current) headingRef.current?.focus();
    mounted.current = true;
  }, [step, acceptedTrust]);

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
    if (!problem) setStep((s) => Math.min(FORM_STEPS - 1, s + 1));
  }

  function back() {
    setLocalError(null);
    if (step === 0 && !alreadyOnboarded) {
      setAcceptedTrust(false);
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  }

  function addRow(name: string) {
    setRows((r) => [...r, { id: nextId.current++, name }]);
  }

  const dailyAmount = /^[$\s]*0+$/.test(daily.trim()) ? 0 : parsePesosInput(daily);
  const perDay = dailyAmount !== null && period !== 'dia' ? toDailyMinor(dailyAmount, period) : null;

  if (!acceptedTrust) {
    return (
      <section className="space-y-6">
        <div>
          <span className="badge-primary">Antes de pedirte cualquier número</span>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-3 font-display text-[30px] font-bold leading-tight tracking-[-0.025em] outline-none sm:text-[34px]"
          >
            {firstName ? `${firstName}, así cuidamos ` : 'Así cuidamos '}tu información en CIFRA
          </h1>
          <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-muted">
            En menos de 3 minutos verás tu primera cifra. Antes, queremos dejarte claro qué toca CIFRA y qué nunca hace:
          </p>
        </div>

        <ul className="space-y-3">
          <li className="surface-card flex items-start gap-3.5 p-4">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-light text-primary-dark">
              <Lock size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">Cero claves bancarias, cero movimientos de dinero</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-muted">
                Nunca te pedimos usuario ni clave de tu banco. CIFRA solo lee movimientos o saldos para hacer la resta por ti.
              </p>
            </div>
          </li>
          <li className="surface-card flex items-start gap-3.5 p-4">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-light text-primary-dark">
              <EyeOff size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">Los comercios de barrio nunca ven tu extracto</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-muted">
                Si usas una oferta cerca de ti, el local solo ve un código de 6 letras. Tu saldo y tus gastos siguen siendo privados.
              </p>
            </div>
          </li>
          <li className="surface-card flex items-start gap-3.5 p-4">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-light text-primary-dark">
              <Trash2 size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">Tus datos son tuyos (Ley 1581 de 2012)</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-muted">
                Desde «Tus datos» puedes descargar una copia completa o borrar cualquier cuenta y todo tu historial en un clic.
              </p>
            </div>
          </li>
        </ul>

        <div className="surface-card p-4">
          <label htmlFor="trust-zone" className="label">
            ¿En qué barrio o zona te mueves más?
          </label>
          <select
            id="trust-zone"
            value={zoneSlug}
            onChange={(e) => setZoneSlug(e.target.value)}
            className="field"
          >
            {BOGOTA_ZONES.map((z) => (
              <option key={z.slug} value={z.slug}>
                {z.name}
              </option>
            ))}
            <option value="otra">Prefiero no indicar zona</option>
          </select>
          <p className="mt-1.5 text-[12.5px] text-ink-faint">
            Opcional. Lo usamos para mostrarte descuentos en panaderías, cafés y tiendas independientes cerca de ti.
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <button
            id="btn-start-quick"
            type="button"
            onClick={() => setAcceptedTrust(true)}
            className="btn-primary w-full"
          >
            <ShieldCheck size={18} aria-hidden="true" /> Calcular mi cifra en 1 minuto
          </button>
          <Link id="btn-start-import" href="/app/datos/importar?primera=1" className="btn-ghost w-full">
            <FileSpreadsheet size={18} aria-hidden="true" /> Tengo el extracto de mi banco (CSV, Excel o PDF)
          </Link>
        </div>
      </section>
    );
  }

  const titles = [
    `${firstName ? `${firstName}, ` : ''}¿cada cuánto te pagan?`,
    '¿Cuánto tienes hoy disponible?',
    '¿Qué pagas fijo cada mes?',
    '¿Cuánto se te va en el día a día?',
  ];

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="surface-card p-5 sm:p-7"
      onChange={() => {
        if (localError) setLocalError(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && step < FORM_STEPS - 1 && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          next();
        }
      }}
      onSubmit={(e) => {
        if (step < FORM_STEPS - 1) {
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
      <input type="hidden" name="zoneSlug" value={zoneSlug} />

      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {Array.from({ length: FORM_STEPS }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-line'}`} />
          ))}
        </div>
        <span className="tnum text-[13px] font-semibold text-ink-muted">
          Paso {step + 1} de {FORM_STEPS}
        </span>
      </div>

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-6 font-display text-[28px] font-bold leading-tight tracking-[-0.02em] outline-none sm:text-[32px]"
      >
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
          Suma lo que tienes líquido en tus cuentas y billeteras (como Bancolombia, Nequi o Daviplata). No sumes el cupo de tarjetas de crédito.
        </p>
        <label htmlFor="qs-balance" className="label">
          Saldo de hoy
        </label>
        <MoneyInput
          id="qs-balance"
          name="balance"
          placeholder="1,250,000"
          presets={[500000, 1000000, 2000000]}
          className="text-[20px] font-semibold"
        />
        <label htmlFor="qs-where" className="label mt-5">
          ¿Dónde está esa plata? <span className="font-normal text-ink-faint">(opcional)</span>
        </label>
        <input
          id="qs-where"
          name="where"
          maxLength={60}
          autoComplete="off"
          className="field"
          placeholder="Ej. Bancolombia y Nequi"
        />
      </fieldset>

      <fieldset hidden={step !== 2} className="mt-2">
        <legend className="sr-only">Tus cobros fijos</legend>
        <p className="mb-5 text-[15.5px] leading-relaxed text-ink-muted">
          Toca los que pagues fijo y pon qué día del mes salen. Nosotros calculamos cuáles faltan antes de tu próximo pago.
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
          <ul className="mt-5 space-y-3">
            {rows.map((r, i) => (
              <li key={r.id} className="rounded-2xl border border-line bg-paper p-3.5">
                <div className="flex items-center gap-2">
                  <label htmlFor={`qs-fn-${r.id}`} className="sr-only">
                    Nombre del cobro {i + 1}
                  </label>
                  <input
                    id={`qs-fn-${r.id}`}
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
                    <label htmlFor={`qs-fa-${r.id}`} className="sr-only">
                      Monto de {r.name || `cobro ${i + 1}`}
                    </label>
                    <MoneyInput
                      id={`qs-fa-${r.id}`}
                      name="fixedAmount"
                      placeholder="Monto"
                      presets={[100000, 300000, 600000]}
                      autoFocus={Boolean(r.name)}
                    />
                  </div>
                  <div>
                    <label htmlFor={`qs-fd-${r.id}`} className="sr-only">
                      Día del mes de {r.name || `cobro ${i + 1}`}
                    </label>
                    <select id={`qs-fd-${r.id}`} name="fixedDay" defaultValue="" className="field py-2.5">
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
        <p className="mb-6 text-[15.5px] leading-relaxed text-ink-muted">
          Comida, transporte, cafés, domicilios y salidas, sin contar lo fijo del paso anterior. Un aproximado sirve; al subir un extracto lo afinamos con tus compras reales.
        </p>
        <label htmlFor="qs-daily" className="label">
          Más o menos
        </label>
        <MoneyInput
          id="qs-daily"
          name="daily"
          value={daily}
          onChangeValue={(minor) => setDaily(String(Math.round(minor / 100)))}
          placeholder="35,000"
          presets={[20000, 35000, 50000, 80000]}
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
        {perDay !== null && <p className="tnum mt-2.5 text-[14px] text-ink-muted">Equivale a unos {cop(perDay)} por día.</p>}
      </fieldset>

      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-neg-light px-4 py-3 text-[14px] text-neg">
          {error}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        {(step > 0 || !alreadyOnboarded) && (
          <button type="button" onClick={back} className="btn-ghost px-5">
            Atrás
          </button>
        )}
        {step < FORM_STEPS - 1 ? (
          <button id="btn-qs-next" key="seguir" type="button" onClick={next} className="btn-primary flex-1">
            {step === 2 && rows.length === 0 ? 'No pago nada fijo, seguir' : 'Seguir'}
          </button>
        ) : (
          <button id="btn-qs-submit" key="enviar" type="submit" disabled={pending} className="btn-primary flex-1">
            {pending ? 'Calculando tu cifra...' : 'Ver mi cifra ahora'}
          </button>
        )}
      </div>

      {step === 0 && (
        <p className="mt-7 border-t border-line pt-4 text-[14px] leading-relaxed text-ink-muted">
          ¿Prefieres subir tu extracto bancario?{' '}
          <Link href="/app/datos/importar?primera=1" className="font-semibold text-primary-dark underline underline-offset-2">
            Súbelo aquí y detectamos todo solos
          </Link>
          .
        </p>
      )}
    </form>
  );
}
