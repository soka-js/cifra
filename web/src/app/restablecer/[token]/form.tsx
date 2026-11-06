'use client';

import { useActionState } from 'react';
import { resetPassword, type AuthState } from '@/app/actions/auth';
import { FieldError } from '@/components/auth/shell';

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resetPassword, { status: 'idle' });
  const f = state.status === 'error' ? state.fields ?? {} : {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="new-password" className="label">
          Nueva contraseña
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          className="field"
          aria-invalid={!!f.password}
          aria-describedby="new-password-help new-password-err"
        />
        <p id="new-password-help" className="mt-1.5 text-[13px] text-ink-faint">
          Al menos 10 caracteres.
        </p>
        <FieldError id="new-password-err" message={f.password} />
      </div>
      {state.status === 'error' && state.message && (
        <p role="alert" className="text-sm text-neg">
          {state.message}
        </p>
      )}
      <button id="btn-reset-password" type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? 'Guardando...' : 'Guardar y entrar'}
      </button>
    </form>
  );
}
