'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestPasswordReset, type AuthState } from '@/app/actions/auth';
import { FieldError } from '@/components/auth/shell';

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, { status: 'idle' });
  const f = state.status === 'error' ? state.fields ?? {} : {};
  const v = state.status === 'error' ? state.values ?? {} : {};

  if (state.status === 'ok') {
    return (
      <div className="surface-card p-5">
        <p className="text-[15.5px] leading-relaxed text-ink">{state.message}</p>
        {state.devResetUrl && (
          <p className="mt-3 rounded-xl bg-primary-pale px-3.5 py-2.5 text-[13.5px] text-primary-dark">
            Modo local sin servidor SMTP configurado:{' '}
            <Link href={state.devResetUrl} className="font-semibold underline">
              Abrir enlace de restablecimiento →
            </Link>
          </p>
        )}
        <Link href="/entrar" className="btn-ghost mt-5 w-full">
          Volver a entrar
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <label htmlFor="reset-email" className="label">
          Correo de tu cuenta
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={v.email}
          placeholder="tu@correo.com"
          className="field"
          aria-invalid={!!f.email}
          aria-describedby="reset-email-err"
        />
        <FieldError id="reset-email-err" message={f.email} />
      </div>
      {state.status === 'error' && state.message && (
        <p role="alert" className="text-sm text-neg">
          {state.message}
        </p>
      )}
      <button id="btn-request-reset" type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
      </button>
    </form>
  );
}
