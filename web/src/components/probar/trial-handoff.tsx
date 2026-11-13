'use client';

import { useEffect, useRef, useState } from 'react';
import { saveQuickStart } from '@/app/app/actions';
import { TRIAL_STORAGE_KEY } from './try-cifra';

/**
 * Puente entre la prueba sin cuenta y la cuenta nueva. Si la persona calculó su cifra en la
 * página pública y acaba de crear su cuenta, lo que escribió sigue en este dispositivo
 * (sessionStorage). Aquí se guarda en su cuenta con la misma acción del modo rápido, para que no
 * tenga que escribirlo otra vez. Si no hay nada guardado, o algo falla, se muestra el flujo normal.
 */

interface StoredTrial {
  v: number;
  frequency: 'mensual' | 'quincenal' | 'semanal' | 'irregular';
  days: number[];
  balanceMinor: number;
  fixed: Array<{ name: string; amountMinor: number; dayOfMonth: number }>;
  dailyMinor: number;
}

function readTrial(): StoredTrial | null {
  try {
    const raw = sessionStorage.getItem(TRIAL_STORAGE_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredTrial;
    if (t?.v !== 1 || typeof t.balanceMinor !== 'number' || typeof t.dailyMinor !== 'number' || !Array.isArray(t.days)) return null;
    return t;
  } catch {
    return null;
  }
}

/** Los mismos campos que envía el formulario del modo rápido. */
function toForm(t: StoredTrial): FormData {
  const form = new FormData();
  const pesos = (minor: number) => String(Math.round(minor / 100));
  form.set('frequency', t.frequency);
  if (t.frequency === 'mensual' && t.days[0]) form.set('day1', String(t.days[0]));
  if (t.frequency === 'quincenal') {
    if (t.days[0]) form.set('day1', String(t.days[0]));
    if (t.days[1]) form.set('day2', String(t.days[1]));
  }
  if (t.frequency === 'semanal' && t.days[0]) form.set('weekday', String(t.days[0]));
  form.set('balance', pesos(t.balanceMinor));
  for (const f of t.fixed ?? []) {
    form.append('fixedName', f.name);
    form.append('fixedAmount', pesos(f.amountMinor));
    form.append('fixedDay', String(f.dayOfMonth));
  }
  form.set('daily', pesos(t.dailyMinor));
  form.set('period', 'dia');
  return form;
}

export function TrialHandoff({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [phase, setPhase] = useState<'checking' | 'saving' | 'manual'>(enabled ? 'checking' : 'manual');
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    const trial = readTrial();
    if (!trial) {
      setPhase('manual');
      return;
    }
    setPhase('saving');
    // Se borra antes de guardar: pase lo que pase, esto se intenta una sola vez.
    try {
      sessionStorage.removeItem(TRIAL_STORAGE_KEY);
    } catch {
      // Sin almacenamiento disponible.
    }
    saveQuickStart({ status: 'idle' }, toForm(trial))
      // Si todo sale bien la acción redirige al Hoy y esto no llega a ejecutarse.
      .then(() => setPhase('manual'))
      .catch(() => setPhase('manual'));
  }, [enabled]);

  if (phase === 'manual') return <>{children}</>;
  return (
    <section className="surface-card p-6 sm:p-8" aria-live="polite">
      <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em]">
        {phase === 'saving' ? 'Guardando la cifra que calculaste…' : 'Un momento…'}
      </h1>
      {phase === 'saving' && (
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">No tienes que escribir nada otra vez.</p>
      )}
    </section>
  );
}
