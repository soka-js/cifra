'use client';

import { useActionState, useEffect, useState } from 'react';
import { updateBalances, type FormState } from '@/app/app/actions';
import { MoneyInput } from '@/components/ui/money-input';
import { cop, formatThousands } from '@/lib/format';

export interface EditableAccount {
  id: string;
  name: string;
  balanceMinor: number | null;
}

/** Formulario de saldos: uno por cuenta que la persona puede escribir, o uno nuevo si todavía no hay cuentas. */
function BalanceForm({ accounts, autoFocus, onDone, onCancel }: { accounts: EditableAccount[]; autoFocus: boolean; onDone?: () => void; onCancel?: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateBalances, { status: 'idle' });
  useEffect(() => {
    if (state.status === 'ok') onDone?.();
  }, [state, onDone]);
  const list = accounts.length ? accounts : [{ id: 'nueva', name: 'Saldo de hoy', balanceMinor: null }];
  return (
    <form action={action}>
      <div className="space-y-2.5">
        {list.map((a, i) => (
          <div key={a.id}>
            <label htmlFor={`hoy-bal-${a.id}`} className={list.length === 1 ? 'sr-only' : 'mb-1 block text-[13px] font-semibold text-ink-muted'}>
              {a.name}
            </label>
            <MoneyInput
              id={`hoy-bal-${a.id}`}
              name={`bal:${a.id}`}
              defaultValue={a.balanceMinor !== null ? Math.round(a.balanceMinor / 100) : ''}
              placeholder={a.balanceMinor !== null ? formatThousands(Math.round(a.balanceMinor / 100)) : '1.250.000'}
              presets={[50000, 100000, 200000, 500000]}
              autoFocus={autoFocus && i === 0}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary min-h-11 flex-1 px-4">
          {pending ? 'Guardando...' : 'Actualizar mi cifra'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost min-h-11 px-4">
            Cancelar
          </button>
        )}
      </div>
      {state.status === 'error' && (
        <p role="alert" className="mt-2 text-[13.5px] text-neg">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** Aviso abierto en la pantalla de inicio cuando el saldo no es de hoy (o no hay saldo). */
export function BalancePrompt({ accounts, note }: { accounts: EditableAccount[]; note: string }) {
  return (
    <section aria-labelledby="hoy-saldo" className="rounded-2xl border-2 border-primary/25 bg-primary-light/60 px-5 py-4">
      <h2 id="hoy-saldo" className="text-[16px] font-bold">¿Cuánto tienes hoy?</h2>
      <p className="mb-3 mt-0.5 text-[14px] text-ink-muted">{note}</p>
      <BalanceForm accounts={accounts} autoFocus={false} />
    </section>
  );
}

/** Fila "Tienes hoy" del desglose, con "Cambiar" para escribir el saldo sin salir de la pantalla. */
export function BalanceRow({ accounts, hint, value }: { accounts: EditableAccount[]; hint: string; value: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span>
          Tienes hoy
          <span className="block text-[12.5px] text-ink-faint">
            {hint}
            {accounts.length > 0 && !open && (
              <>
                {'. '}
                <button type="button" onClick={() => setOpen(true)} className="underline underline-offset-2 hover:text-ink">
                  Cambiar
                </button>
              </>
            )}
          </span>
        </span>
        <span className="shrink-0 font-semibold">{value}</span>
      </div>
      {open && (
        <div className="mt-3">
          <BalanceForm accounts={accounts} autoFocus onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
