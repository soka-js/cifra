'use client';

import { useActionState, useEffect } from 'react';
import { signup, type AuthState } from '@/app/actions/auth';
import { FieldError } from '@/components/auth/shell';
import { track } from '@/lib/analytics/client';
import { BOGOTA_ZONES } from '@/lib/zones';

export function SignupForm({ nextPath, googleEnabled }: { nextPath?: string; googleEnabled: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, { status: 'idle' });
  useEffect(() => track('begin_signup'), []);
  const f = state.status === 'error' ? state.fields ?? {} : {};
  const v = state.status === 'error' ? state.values ?? {} : {};

  return (
    <div className="space-y-5">
      {googleEnabled && (
        <>
          <a
            id="btn-google-signup"
            href={`/api/auth/google${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''}`}
            className="btn-ghost w-full"
          >
            Crear cuenta con Google
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
          <label htmlFor="name" className="label">
            ¿Cómo te llamas?
          </label>
          <input
            id="name"
            name="name"
            autoComplete="given-name"
            defaultValue={v.name}
            placeholder="Tu nombre"
            className="field"
            aria-invalid={!!f.name}
            aria-describedby="name-err"
          />
          <FieldError id="name-err" message={f.name} />
        </div>
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
            placeholder="tu@correo.com"
            className="field"
            aria-invalid={!!f.email}
            aria-describedby="email-err"
          />
          <FieldError id="email-err" message={f.email} />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            className="field"
            aria-invalid={!!f.password}
            aria-describedby="password-help password-err"
          />
          <p id="password-help" className="mt-1.5 text-[13px] text-ink-faint">
            Al menos 10 caracteres.
          </p>
          <FieldError id="password-err" message={f.password} />
        </div>
        <div>
          <label htmlFor="zoneSlug" className="label">
            ¿En qué zona te mueves más? <span className="font-normal text-ink-faint">(opcional)</span>
          </label>
          <select id="zoneSlug" name="zoneSlug" defaultValue={v.zoneSlug ?? 'chapinero'} className="field">
            {BOGOTA_ZONES.map((z) => (
              <option key={z.slug} value={z.slug}>
                {z.name}
              </option>
            ))}
            <option value="otra">Otra zona de Bogotá o fuera de Bogotá</option>
          </select>
          <p className="mt-1 text-[12.5px] text-ink-faint">
            Sirve para mostrarte beneficios reales en comercios independientes cerca de ti.
          </p>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-3.5 text-[14px] leading-snug text-ink-muted">
          <input
            id="consent"
            type="checkbox"
            name="consent"
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#0B6B58]"
            aria-describedby="consent-err"
          />
          <span>
            Soy mayor de edad y autorizo a CIFRA a tratar los datos que yo comparta solo para calcular mi disponible y mostrarme beneficios relevantes, según la{' '}
            <a href="/privacidad" target="_blank" className="font-semibold text-ink underline">
              política de tratamiento de datos
            </a>{' '}
            (Ley 1581 de 2012), y acepto los{' '}
            <a href="/terminos" target="_blank" className="font-semibold text-ink underline">
              términos de uso
            </a>
            . Puedo exportar o borrar todo cuando quiera.
          </span>
        </label>
        <FieldError id="consent-err" message={f.consent} />
        {state.status === 'error' && state.message && (
          <p role="alert" className="rounded-xl bg-neg-light px-3.5 py-2.5 text-sm text-neg">
            {state.message}
          </p>
        )}
        <button id="btn-signup-submit" type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? 'Creando tu cuenta...' : 'Crear cuenta gratis'}
        </button>
      </form>
    </div>
  );
}
