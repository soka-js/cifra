'use client';

import { useActionState } from 'react';
import { IncomeFields } from '@/components/app/income-fields';
import { addCommitment, deleteAccount, saveBuffer, saveIncome, type FormState } from '../actions';

const idle: FormState = { status: 'idle' };

function Status({ state }: { state: FormState }) {
  if (state.status === 'idle') return null;
  return (
    <p role="status" className={`text-[13.5px] ${state.status === 'error' ? 'text-neg' : 'text-primary-dark'}`}>
      {state.message}
    </p>
  );
}

export function IncomeForm({ frequency, days }: { frequency: 'mensual' | 'quincenal' | 'semanal' | 'irregular' | null; days: number[] | null }) {
  const [state, action, pending] = useActionState(saveIncome, idle);
  return (
    <form action={action} className="space-y-4">
      <IncomeFields frequency={frequency} days={days} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">Guardar</button>
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
        <label htmlFor="buffer" className="label">Colchón para imprevistos</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">$</span>
          <input id="buffer" name="buffer" inputMode="numeric" defaultValue={current} className="field tnum pl-8" />
        </div>
        <p className="mt-1.5 text-[13px] text-ink-faint">Se resta de tu cifra para que no lo gastes. Escribe 0 si no quieres colchón.</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">Guardar</button>
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
          <label htmlFor="c-name" className="mb-1 block text-[13px] font-semibold">Nombre</label>
          <input id="c-name" name="name" placeholder="Arriendo en efectivo" className="field py-2.5" maxLength={60} />
        </div>
        <div>
          <label htmlFor="c-day" className="mb-1 block text-[13px] font-semibold">Día del mes</label>
          <input id="c-day" name="day" inputMode="numeric" placeholder="1" className="field tnum py-2.5" />
        </div>
      </div>
      <div>
        <label htmlFor="c-amount" className="mb-1 block text-[13px] font-semibold">Monto</label>
        <input id="c-amount" name="amount" inputMode="numeric" placeholder="650.000" className="field tnum py-2.5" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-ghost">Agregar compromiso</button>
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
        Se borran tu usuario, tus fuentes, cuentas, movimientos y ajustes. Escribe <strong className="text-ink">BORRAR</strong> para confirmar.
      </label>
      <input id="confirm" name="confirm" autoComplete="off" className="field" />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn bg-neg text-white hover:bg-neg/90">Borrar mi cuenta</button>
        <Status state={state} />
      </div>
    </form>
  );
}
