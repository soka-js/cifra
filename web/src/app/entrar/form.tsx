'use client';

import { useActionState } from 'react';
import { login, type AuthState } from '@/app/actions/auth';
import { FieldError } from '@/components/auth/shell';

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, { status: 'idle' });
  const f = state.status === 'error' ? state.fields ?? {} : {};
  const v = state.status === 'error' ? state.values ?? {} : {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="label">Correo</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} className="field" aria-invalid={!!f.email} aria-describedby="email-err" />
        <FieldError id="email-err" message={f.email} />
      </div>
      <div>
        <label htmlFor="password" className="label">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="field" aria-invalid={!!f.password} aria-describedby="password-err" />
        <FieldError id="password-err" message={f.password} />
      </div>
      {state.status === 'error' && state.message && <p role="alert" className="text-sm text-neg">{state.message}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}
