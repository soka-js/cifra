'use client';

import { useActionState, useEffect } from 'react';
import { signup, type AuthState } from '@/app/actions/auth';
import { FieldError } from '@/components/auth/shell';
import { track } from '@/lib/analytics/client';

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, { status: 'idle' });
  useEffect(() => track('begin_signup'), []);
  const f = state.status === 'error' ? state.fields ?? {} : {};
  const v = state.status === 'error' ? state.values ?? {} : {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <label htmlFor="name" className="label">¿Cómo te llamas?</label>
        <input id="name" name="name" autoComplete="given-name" defaultValue={v.name} className="field" aria-invalid={!!f.name} aria-describedby="name-err" />
        <FieldError id="name-err" message={f.name} />
      </div>
      <div>
        <label htmlFor="email" className="label">Correo</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} className="field" aria-invalid={!!f.email} aria-describedby="email-err" />
        <FieldError id="email-err" message={f.email} />
      </div>
      <div>
        <label htmlFor="password" className="label">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} className="field" aria-invalid={!!f.password} aria-describedby="password-help password-err" />
        <p id="password-help" className="mt-1.5 text-[13px] text-ink-faint">Al menos 10 caracteres.</p>
        <FieldError id="password-err" message={f.password} />
      </div>
      <label className="flex items-start gap-3 text-[14.5px] leading-snug text-ink-muted">
        <input type="checkbox" name="consent" className="mt-0.5 h-5 w-5 shrink-0 accent-[#0E6E63]" aria-describedby="consent-err" />
        <span>
          Autorizo a CIFRA a tratar los movimientos que yo comparta solo para calcular mi cifra, según la{' '}
          <a href="/privacidad" target="_blank" className="font-semibold text-ink underline">política de tratamiento de datos</a>{' '}
          (Ley 1581 de 2012). Puedo borrar todo cuando quiera.
        </span>
      </label>
      <FieldError id="consent-err" message={f.consent} />
      {state.status === 'error' && state.message && <p role="alert" className="text-sm text-neg">{state.message}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? 'Creando tu cuenta...' : 'Crear cuenta'}
      </button>
    </form>
  );
}
