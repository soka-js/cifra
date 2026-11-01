'use client';

import { useState } from 'react';

type Freq = 'mensual' | 'quincenal' | 'semanal' | 'irregular';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

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
          <select id="day1" name="day1" defaultValue={days?.[0] ?? 30} className="field">
            {DAYS.map((d) => <option key={d} value={d}>{d === 30 ? '30 (o el último día del mes)' : d}</option>)}
          </select>
        </div>
      )}
      {freq === 'quincenal' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="day1" className="label">Primer pago</label>
            <select id="day1" name="day1" defaultValue={days?.[0] ?? 15} className="field">
              {DAYS.slice(0, 20).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="day2" className="label">Segundo pago</label>
            <select id="day2" name="day2" defaultValue={days?.[1] ?? 30} className="field">
              {DAYS.slice(14).map((d) => <option key={d} value={d}>{d === 30 ? '30 (o último día)' : d}</option>)}
            </select>
          </div>
        </div>
      )}
      {freq === 'semanal' && (
        <div>
          <label htmlFor="weekday" className="label">¿Qué día de la semana?</label>
          <select id="weekday" name="weekday" defaultValue={days?.[0] ?? 5} className="field">
            {WEEKDAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select>
        </div>
      )}
      {freq === 'irregular' && (
        <p className="rounded-xl bg-paper-deep px-4 py-3 text-[14px] text-ink-muted">Calculamos tu cifra hasta el final de cada mes.</p>
      )}
    </div>
  );
}
