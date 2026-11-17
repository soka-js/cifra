'use client';

import { useState } from 'react';
import { DayPicker, WeekdayPicker } from '@/components/ui/day-picker';

type Freq = 'mensual' | 'quincenal' | 'semanal' | 'irregular';

export function IncomeFields({ frequency, days }: { frequency: Freq | null; days: number[] | null }) {
  const [freq, setFreq] = useState<Freq | ''>(frequency ?? '');
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="label">Frecuencia</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['mensual', 'Una vez al mes'],
              ['quincenal', 'Cada quincena'],
              ['semanal', 'Cada semana'],
              ['irregular', 'No es fijo'],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 text-[15px] ${freq === v ? 'border-primary bg-primary-light font-semibold' : 'border-line bg-white'}`}>
              <input type="radio" name="frequency" value={v} checked={freq === v} onChange={() => setFreq(v)} className="accent-[#0E6E63]" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      {freq === 'mensual' && (
        <div>
          <label htmlFor="day1" className="label">¿Qué día del mes?</label>
          <DayPicker id="day1" name="day1" defaultValue={days?.[0] ?? 30} />
        </div>
      )}
      {freq === 'quincenal' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="day1" className="label">Primer pago</label>
            <DayPicker id="day1" name="day1" defaultValue={days?.[0] ?? 15} max={20} />
          </div>
          <div>
            <label htmlFor="day2" className="label">Segundo pago</label>
            <DayPicker id="day2" name="day2" defaultValue={days?.[1] ?? 30} min={15} align="right" />
          </div>
        </div>
      )}
      {freq === 'semanal' && (
        <WeekdayPicker name="weekday" defaultValue={days?.[0] ?? 5} legend="¿Qué día de la semana?" />
      )}
      {freq === 'irregular' && (
        <p className="rounded-xl bg-paper-deep px-4 py-3 text-[14px] text-ink-muted">Calculamos tu cifra hasta el final de cada mes.</p>
      )}
    </div>
  );
}
