import type { FairFunnelDay } from '@/lib/analytics/fair-funnel';
import { shortDate } from '@/lib/engine/dates';

const share = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '');

/** Una celda "x de y (z %)", o solo "x" cuando no hay base para el porcentaje. */
function Step({ value, of }: { value: number; of?: number }) {
  const p = of === undefined ? '' : share(value, of);
  return (
    <span className="tnum">
      <strong className="text-ink">{value}</strong>
      {p && <span className="text-ink-muted"> ({p})</span>}
    </span>
  );
}

/**
 * Embudo de la feria: cuántas personas abren la página pública, calculan su cifra y la guardan.
 * Los porcentajes de cada paso son sobre el paso anterior. Todo sale de la tabla `events`
 * (visitantes distintos por día de Bogotá, sin montos): ver `loadFairFunnel`.
 */
export function FairFunnelSection({ days }: { days: FairFunnelDay[] }) {
  const today = days[0];
  const answered = (d: FairFunnelDay) => d.guessMore + d.guessLess + d.guessSame;
  return (
    <section id="feria" className="surface-card p-6">
      <h2 className="font-display text-[20px] font-bold text-ink">Feria: del QR a la cifra guardada</h2>
      <p className="mt-1 text-[13.5px] text-ink-muted">
        Personas distintas por día en la página pública (la que abre el QR). Cada porcentaje es sobre el paso
        anterior. No incluye montos: la prueba los calcula en el celular de cada persona.
      </p>

      {today && (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Hoy">
          <div className="rounded-xl border border-line bg-white p-3">
            <dt className="text-[12px] text-ink-muted">Hoy abrieron la página</dt>
            <dd className="tnum font-display text-[26px] font-bold text-ink">{today.visitors}</dd>
          </div>
          <div className="rounded-xl border border-line bg-white p-3">
            <dt className="text-[12px] text-ink-muted">Hoy vieron su cifra</dt>
            <dd className="tnum font-display text-[26px] font-bold text-primary-dark">{today.done}</dd>
          </div>
          <div className="rounded-xl border border-line bg-white p-3">
            <dt className="text-[12px] text-ink-muted">Hoy guardaron su cifra</dt>
            <dd className="tnum font-display text-[26px] font-bold text-ink">{today.signedUp}</dd>
          </div>
          <div className="rounded-xl border border-line bg-white p-3">
            <dt className="text-[12px] text-ink-muted">Hoy creían poder gastar más</dt>
            <dd className="tnum font-display text-[26px] font-bold text-ink">
              {answered(today) > 0 ? `${today.guessMore} de ${answered(today)}` : 'sin respuestas'}
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-[13px]">
          <thead className="text-[12px] text-ink-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-3 font-semibold">Día</th>
              <th className="py-2 pr-3 font-semibold">Abrieron la página</th>
              <th className="py-2 pr-3 font-semibold">Empezaron</th>
              <th className="py-2 pr-3 font-semibold">Vieron su cifra</th>
              <th className="py-2 pr-3 font-semibold">Tocaron «Guardar»</th>
              <th className="py-2 pr-3 font-semibold">Crearon su cuenta</th>
              <th className="py-2 pr-3 font-semibold">Creían poder gastar más</th>
              <th className="py-2 font-semibold">Tiempo mediano</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d.day} className="border-b border-line/70" data-day={d.day}>
                <td className="py-2 pr-3 font-semibold text-ink">{i === 0 ? `Hoy, ${shortDate(d.day)}` : shortDate(d.day)}</td>
                <td className="py-2 pr-3">
                  <Step value={d.visitors} />
                </td>
                <td className="py-2 pr-3">
                  <Step value={d.started} of={d.visitors} />
                </td>
                <td className="py-2 pr-3">
                  <Step value={d.done} of={d.started} />
                </td>
                <td className="py-2 pr-3">
                  <Step value={d.saved} of={d.done} />
                </td>
                <td className="py-2 pr-3">
                  <Step value={d.signedUp} of={d.saved} />
                </td>
                <td className="tnum py-2 pr-3 text-ink">
                  {answered(d) > 0 ? `${d.guessMore} de ${answered(d)}` : <span className="text-ink-muted">sin respuestas</span>}
                </td>
                <td className="tnum py-2 text-ink">
                  {d.medianSeconds === null ? <span className="text-ink-muted">sin datos</span> : `${d.medianSeconds} s`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-ink-muted">
        «Creían poder gastar más» cuenta solo a quienes llenaron el campo opcional «¿cuánto crees que puedes
        gastar?» y su respuesta superó la cifra por más del margen de la prueba. El tiempo es desde la primera
        respuesta hasta ver la cifra.
      </p>
    </section>
  );
}
