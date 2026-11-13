'use client';

import { useActionState, useState } from 'react';
import { MoneyInput } from '@/components/ui/money-input';
import { addManualAccount, deleteSource, updateBalance, type FormState } from '../actions';

export function BalanceForm({ accountId, current }: { accountId: string; current: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateBalance, { status: 'idle' });
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[13.5px] font-semibold text-primary-dark underline-offset-2 hover:underline">
        Actualizar saldo
      </button>
    );
  }
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="flex-1">
        <label htmlFor={`bal-${accountId}`} className="mb-1 block text-[13px] font-semibold">¿Cuánto tienes hoy?</label>
        <MoneyInput id={`bal-${accountId}`} name="balance" defaultValue={current} autoFocus placeholder="0" presets={[50000, 100000, 200000]} />
      </div>
      <button type="submit" disabled={pending} className="btn-primary min-h-11 px-4">{pending ? 'Guardando' : 'Guardar'}</button>
      {state.status !== 'idle' && (
        <p role="status" className={`w-full text-[13px] ${state.status === 'error' ? 'text-neg' : 'text-primary-dark'}`}>{state.message}</p>
      )}
    </form>
  );
}

export function DeleteSource({ sourceId, entity }: { sourceId: string; entity: string }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="text-[13.5px] font-semibold text-neg underline-offset-2 hover:underline">
        Borrar esta fuente
      </button>
    );
  }
  return (
    <form action={deleteSource} className="mt-2 rounded-xl bg-neg-light p-3">
      <input type="hidden" name="sourceId" value={sourceId} />
      <p className="text-[13.5px] text-neg">Se borran las cuentas y todos los movimientos de {entity}. No se puede deshacer.</p>
      <div className="mt-2 flex gap-2">
        <button type="submit" className="btn min-h-10 bg-neg px-4 text-sm text-white">Sí, borrar</button>
        <button type="button" onClick={() => setConfirm(false)} className="btn-ghost min-h-10 px-4 text-sm">Cancelar</button>
      </div>
    </form>
  );
}

export function ManualAccountForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addManualAccount, { status: 'idle' });
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost w-full">
        Escribir un saldo a mano
      </button>
    );
  }
  return (
    <form action={action} key={state.status === 'ok' ? state.message : 'f'} className="rounded-2xl border border-line bg-white p-5">
      <p className="text-[15px] font-semibold">Un saldo escrito a mano</p>
      <p className="mt-0.5 text-[13.5px] text-ink-muted">Para plata que no tiene extracto: efectivo, una billetera, un bolsillo.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="m-entity" className="mb-1 block text-[13px] font-semibold">Dónde está</label>
          <input id="m-entity" name="entity" maxLength={60} placeholder="Efectivo" className="field py-2.5" autoFocus />
        </div>
        <div>
          <label htmlFor="m-balance" className="mb-1 block text-[13px] font-semibold">Cuánto tienes hoy</label>
          <MoneyInput id="m-balance" name="balance" placeholder="150.000" presets={[50000, 150000, 300000]} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary min-h-11 px-4">{pending ? 'Guardando' : 'Agregar'}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost min-h-11 px-4">Cerrar</button>
        {state.status !== 'idle' && (
          <p role="status" className={`text-[13px] ${state.status === 'error' ? 'text-neg' : 'text-primary-dark'}`}>{state.message}</p>
        )}
      </div>
    </form>
  );
}
