'use client';

import { useActionState, useState } from 'react';
import { IncomeFields } from '@/components/app/income-fields';
import { BOGOTA_ZONES } from '@/lib/zones';
import {
  addCommitment,
  deleteAccount,
  saveBuffer,
  saveDailySpend,
  saveIncome,
  saveZonePreference,
  type FormState,
} from '../actions';

const idle: FormState = { status: 'idle' };

function Status({ state }: { state: FormState }) {
  if (state.status === 'idle') return null;
  return (
    <p role="status" className={`text-[13.5px] font-medium ${state.status === 'error' ? 'text-neg' : 'text-primary-dark'}`}>
      {state.message}
    </p>
  );
}

export function IncomeForm({
  frequency,
  days,
}: {
  frequency: 'mensual' | 'quincenal' | 'semanal' | 'irregular' | null;
  days: number[] | null;
}) {
  const [state, action, pending] = useActionState(saveIncome, idle);
  return (
    <form action={action} className="space-y-4">
      <IncomeFields frequency={frequency} days={days} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          Guardar
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function ZoneForm({ currentZone }: { currentZone: string | null }) {
  const [state, action, pending] = useActionState(saveZonePreference, idle);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="zoneSlugSelect" className="label">
          Zona o barrio principal
        </label>
        <select id="zoneSlugSelect" name="zoneSlug" defaultValue={currentZone ?? 'ninguna'} className="field">
          <option value="ninguna">Sin ubicación · no cruzar por cercanía</option>
          {BOGOTA_ZONES.map((z) => (
            <option key={z.slug} value={z.slug}>
              {z.name} ({z.localidad})
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[13px] text-ink-faint">
          Solo guardamos esta referencia general de zona para ordenar ofertas cercanas; nunca rastreamos tu GPS en segundo plano.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          Guardar zona
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function BufferForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(saveBuffer, idle);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="buffer" className="label">
          Colchón para imprevistos
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">$</span>
          <input id="buffer" name="buffer" inputMode="numeric" defaultValue={current} className="field tnum pl-8" />
        </div>
        <p className="mt-1.5 text-[13px] text-ink-faint">
          Se resta de tu cifra para que no lo gastes. Escribe 0 si no quieres colchón.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          Guardar
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function DailySpendForm({ current, fromMovements }: { current: string; fromMovements: boolean }) {
  const [state, action, pending] = useActionState(saveDailySpend, idle);
  const [period, setPeriod] = useState<'dia' | 'semana' | 'mes'>('dia');
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="daily" className="label">
          Más o menos cuánto gastas
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">$</span>
          <input id="daily" name="daily" inputMode="numeric" defaultValue={current} placeholder="30.000" className="field tnum pl-8" />
        </div>
        <div role="radiogroup" aria-label="Cada cuánto" className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-paper-deep p-1">
          {(
            [
              ['dia', 'Al día'],
              ['semana', 'A la semana'],
              ['mes', 'Al mes'],
            ] as const
          ).map(([v, l]) => (
            <label
              key={v}
              className={`cursor-pointer rounded-lg px-2 py-2 text-center text-[14px] font-semibold ${
                period === v ? 'bg-white text-ink shadow-[0_1px_2px_rgba(20,32,29,0.12)]' : 'text-ink-muted'
              }`}
            >
              <input type="radio" name="period" value={v} checked={period === v} onChange={() => setPeriod(v)} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-[13px] text-ink-faint">
          {fromMovements
            ? 'Ya tienes tres semanas o más de movimientos, así que tu cifra usa tu promedio real. Este valor queda como respaldo.'
            : 'Comida, transporte, domicilios y salidas, sin cobros fijos. Lo usamos hasta que haya tres semanas de movimientos.'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          Guardar
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function CommitmentForm() {
  const [state, action, pending] = useActionState(addCommitment, idle);
  return (
    <form action={action} className="space-y-3" key={state.status === 'ok' ? state.message : 'f'}>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <div>
          <label htmlFor="c-name" className="mb-1 block text-[13px] font-semibold">
            Nombre
          </label>
          <input id="c-name" name="name" placeholder="Arriendo" className="field py-2.5" maxLength={60} />
        </div>
        <div>
          <label htmlFor="c-day" className="mb-1 block text-[13px] font-semibold">
            Día del mes
          </label>
          <input id="c-day" name="day" inputMode="numeric" placeholder="1" className="field tnum py-2.5" />
        </div>
      </div>
      <div>
        <label htmlFor="c-amount" className="mb-1 block text-[13px] font-semibold">
          Monto
        </label>
        <input id="c-amount" name="amount" inputMode="numeric" placeholder="650.000" className="field tnum py-2.5" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-ghost">
          Agregar cobro fijo
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, idle);
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="confirm" className="block text-[14px] text-ink-muted">
        Se borran tu usuario, tus fuentes, cuentas, movimientos, reglas y registro de actividad de inmediato. Escribe{' '}
        <strong className="text-ink">BORRAR</strong> para confirmar.
      </label>
      <input id="confirm" name="confirm" autoComplete="off" className="field" />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn bg-neg text-white hover:bg-neg-dark">
          Borrar mi cuenta y mis datos
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}
