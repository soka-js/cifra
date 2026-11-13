'use client';

import { CheckCircle2 } from 'lucide-react';
import { useActionState, useState } from 'react';
import { cop } from '@/lib/format';
import { saveCycleClosure, type FormState } from '../actions';

/** Compromisos sugeridos. El único monto sale del gasto diario de la persona. */
function suggestedCommitments(dailyVariableMinor: number): string[] {
  return [
    'Cancelar 1 suscripción que marqué como «no la uso» antes del próximo cobro',
    'Pedir domicilios y cafés fuera de casa máximo dos veces por semana',
    'Apartar un colchón apenas entre mi próximo pago',
    dailyVariableMinor > 0
      ? `Preguntar en ¿Puedo? antes de cualquier gasto mayor a lo que gasto en un día (${cop(dailyVariableMinor)})`
      : 'Preguntar en ¿Puedo? antes de cualquier gasto grande',
  ];
}

export function CycleClosureForm({
  initialCommitment,
  dailyVariableMinor,
}: {
  initialCommitment?: string | null;
  dailyVariableMinor: number;
}) {
  const SUGGESTED_COMMITMENTS = suggestedCommitments(dailyVariableMinor);
  const [state, action, pending] = useActionState<FormState, FormData>(saveCycleClosure, { status: 'idle' });
  const [text, setText] = useState(initialCommitment ?? SUGGESTED_COMMITMENTS[0]!);

  return (
    <form action={action} className="space-y-4">
      <div>
        <p className="label">Elige un solo ajuste realista para tu próximo ciclo</p>
        <div className="mt-2 flex flex-col gap-2">
          {SUGGESTED_COMMITMENTS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setText(item)}
              className={`rounded-xl border px-3.5 py-2.5 text-left text-[13.5px] transition-colors ${
                text === item
                  ? 'border-primary bg-primary-light font-semibold text-primary-dark'
                  : 'border-line bg-paper text-ink-soft hover:border-line-strong hover:bg-white'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="committedAction" className="label">
          O escríbelo con tus palabras
        </label>
        <input
          id="committedAction"
          name="committedAction"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          className="field"
        />
      </div>

      {state.status === 'error' && (
        <p role="alert" className="text-sm text-neg">
          {state.message}
        </p>
      )}
      {state.status === 'ok' && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-primary-light px-3.5 py-2.5 text-[14px] font-medium text-primary-dark">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{state.message}</span>
        </p>
      )}

      <button id="btn-save-cycle-closure" type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? 'Guardando cierre...' : 'Guardar cierre y compromiso'}
      </button>
    </form>
  );
}
