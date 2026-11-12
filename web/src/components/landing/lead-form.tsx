'use client';

import { useActionState, useEffect, useRef } from 'react';
import { gaEvent, track } from '@/lib/analytics/client';
import { submitLead, type LeadState } from '@/app/actions/leads';

const initial: LeadState = { status: 'idle' };

export function LeadForm() {
  const [state, action, pending] = useActionState(submitLead, initial);
  const started = useRef(false);
  useEffect(() => {
    if (state.status === 'ok') gaEvent('generate_lead');
  }, [state.status]);

  if (state.status === 'ok') {
    return (
      <div role="status" className="rounded-2xl bg-white/10 p-6">
        <p className="font-display text-2xl font-bold">Recibimos tus datos.</p>
        <p className="mt-2 text-white/80">Te escribimos al correo que dejaste para agendar la demo.</p>
      </div>
    );
  }

  const err = (k: string) => (state.status === 'error' ? state.fields?.[k] : undefined);

  return (
    <form
      action={action}
      onFocus={() => {
        if (!started.current) {
          started.current = true;
          track('begin_lead');
        }
      }}
      className="grid gap-4 sm:grid-cols-2"
      noValidate
    >
      {[
        { name: 'name', label: 'Tu nombre', type: 'text', auto: 'name' },
        { name: 'email', label: 'Correo de trabajo', type: 'email', auto: 'email' },
        { name: 'organization', label: 'Entidad', type: 'text', auto: 'organization' },
        { name: 'role', label: 'Cargo', type: 'text', auto: 'organization-title' },
        { name: 'phone', label: 'Celular (opcional)', type: 'tel', auto: 'tel' },
      ].map((f) => (
        <div key={f.name}>
          <label htmlFor={`lead-${f.name}`} className="mb-1.5 block text-sm font-semibold text-white">
            {f.label}
          </label>
          <input
            id={`lead-${f.name}`}
            name={f.name}
            type={f.type}
            autoComplete={f.auto}
            aria-invalid={Boolean(err(f.name))}
            aria-describedby={err(f.name) ? `lead-${f.name}-err` : undefined}
            className="field border-white/20"
          />
          {err(f.name) && (
            <p id={`lead-${f.name}-err`} className="mt-1 text-sm text-[#FFB4A8]">
              {err(f.name)}
            </p>
          )}
        </div>
      ))}
      <div>
        <label htmlFor="lead-members" className="mb-1.5 block text-sm font-semibold text-white">
          Asociados o clientes
        </label>
        <select id="lead-members" name="members" className="field border-white/20" defaultValue="">
          <option value="" disabled>
            Elige un rango
          </option>
          <option>Menos de 5.000</option>
          <option>5.000 a 20.000</option>
          <option>20.000 a 100.000</option>
          <option>Más de 100.000</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="lead-message" className="mb-1.5 block text-sm font-semibold text-white">
          ¿Qué te gustaría saber? (opcional)
        </label>
        <textarea id="lead-message" name="message" rows={3} maxLength={1000} className="field border-white/20" />
      </div>
      {/* Campo trampa para bots: las personas no lo ven. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="flex items-start gap-3 text-sm text-white/80 sm:col-span-2">
        <input type="checkbox" name="consent" className="mt-0.5 h-5 w-5 accent-[#6FB8AE]" />
        <span>
          Autorizo a CIFRA a usar estos datos solo para contactarme sobre la demo, según la{' '}
          <a href="/privacidad" className="underline">
            política de tratamiento de datos
          </a>
          .
        </span>
      </label>
      {err('consent') && <p className="-mt-2 text-sm text-[#FFB4A8] sm:col-span-2">{err('consent')}</p>}
      {state.status === 'error' && state.message && <p className="text-sm text-[#FFB4A8] sm:col-span-2">{state.message}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="btn min-h-12 bg-white px-6 text-ink hover:bg-primary-light">
          {pending ? 'Enviando...' : 'Pedir una demo'}
        </button>
      </div>
    </form>
  );
}
