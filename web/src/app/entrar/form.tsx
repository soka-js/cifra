'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login, type AuthState } from '@/app/actions/auth';
import { FieldError } from '@/components/auth/shell';

export function LoginForm({ nextPath, googleEnabled }: { nextPath?: string; googleEnabled: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, { status: 'idle' });
  const f = state.status === 'error' ? state.fields ?? {} : {};
  const v = state.status === 'error' ? state.values ?? {} : {};

  return (
    <div className="space-y-5">
      {googleEnabled && (
        <>
          <a
            id="btn-google-login"
            href={`/api/auth/google${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''}`}
            className="btn-ghost w-full"
          >
            Continuar con Google
          </a>
          <div className="flex items-center gap-3 text-[12.5px] font-medium uppercase tracking-wider text-ink-faint">
            <span className="h-px flex-1 bg-line" />
            <span>o con tu correo</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form action={action} className="space-y-5" noValidate>
        {nextPath && <input type="hidden" name="next" value={nextPath} />}
        <div>
          <label htmlFor="email" className="label">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={v.email}
            className="field"
            aria-invalid={!!f.email}
            aria-describedby="email-err"
          />
          <FieldError id="email-err" message={f.email} />
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="password" className="text-[13.5px] font-semibold text-ink">
              Contraseña
            </label>
            <Link href="/olvide-clave" className="text-[13px] font-semibold text-primary-dark underline-offset-2 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="field"
            aria-invalid={!!f.password}
            aria-describedby="password-err"
          />
          <FieldError id="password-err" message={f.password} />
        </div>
        {state.status === 'error' && state.message && (
          <p role="alert" className="rounded-xl bg-neg-light px-3.5 py-2.5 text-sm text-neg">
            {state.message}
          </p>
        )}
        <button id="btn-login-submit" type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
