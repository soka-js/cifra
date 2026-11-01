import { requireUser } from '@/lib/auth/session';
import { loadCifra, loadMarks } from '@/lib/data';
import { shortDate } from '@/lib/engine/dates';
import { CATEGORY_LABEL } from '@/lib/engine/merchant';
import type { RecurringSeries } from '@/lib/engine/recurring';
import { cop } from '@/lib/format';
import { markRecurring } from '../actions';

export const metadata = { title: 'Cobros que se repiten' };

const CADENCE: Record<RecurringSeries['cadence'], string> = {
  semanal: 'cada semana',
  quincenal: 'cada quince días',
  mensual: 'cada mes',
  bimestral: 'cada dos meses',
  trimestral: 'cada tres meses',
  anual: 'cada año',
};

function MarkButton({ k, mark, current, children }: { k: string; mark: string; current?: string; children: React.ReactNode }) {
  const active = current === mark;
  return (
    <form action={markRecurring}>
      <input type="hidden" name="key" value={k} />
      <input type="hidden" name="mark" value={active ? 'quitar' : mark} />
      <button
        type="submit"
        aria-pressed={active}
        className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-muted hover:border-ink-faint'}`}
      >
        {children}
      </button>
    </form>
  );
}

export default async function CobrosPage() {
  const user = await requireUser();
  const [c, marks] = await Promise.all([loadCifra(user), loadMarks(user.id)]);
  // c.recurring ya excluye los marcados como "no es fijo"; aquí se muestran todos para poder deshacer.
  const all = c.recurring;
  const active = all.filter((r) => r.active);
  const inactive = all.filter((r) => !r.active);
  const total = active.reduce((s, r) => s + r.monthlyMinor, 0);
  const unused = active.filter((r) => marks[r.merchantKey] === 'no_lo_uso');
  const unusedMonthly = unused.reduce((s, r) => s + r.monthlyMinor, 0);
  const hidden = Object.entries(marks).filter(([, m]) => m === 'no_es_fijo');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Cobros que se repiten</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          Los encontramos en tus movimientos: mismo comercio, montos parecidos y cada cierto tiempo.
        </p>
      </div>

      {active.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-5 text-[15px] text-ink-muted">
          Todavía no vemos cobros que se repitan. Con dos o tres meses de movimientos aparecen solos.
        </p>
      ) : (
        <>
          <div className="rounded-2xl bg-white px-5 py-4">
            <p className="text-[14px] text-ink-muted">Pagas al mes</p>
            <p className="tnum font-display text-[40px] font-extrabold leading-none tracking-[-0.03em]">{cop(total)}</p>
            {unusedMonthly > 0 && (
              <p className="mt-2 text-[14.5px] text-primary-dark">
                Si cancelas lo que marcaste como &quot;no lo uso&quot;, te ahorras {cop(unusedMonthly)} al mes y {cop(unusedMonthly * 12)} al año.
              </p>
            )}
          </div>
          <ul className="space-y-3">
            {active.map((r) => (
              <li key={r.merchantKey} className="rounded-2xl border border-line bg-white px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold">{r.name}</p>
                    <p className="text-[13px] text-ink-faint">
                      {CATEGORY_LABEL[r.category]}, {CADENCE[r.cadence]}. Próximo: {shortDate(r.nextDate)}
                    </p>
                  </div>
                  <p className="tnum shrink-0 font-semibold">
                    {r.variableAmount ? 'aprox. ' : ''}
                    {cop(r.typicalMinor)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <MarkButton k={r.merchantKey} mark="lo_uso" current={marks[r.merchantKey]}>Lo uso</MarkButton>
                  <MarkButton k={r.merchantKey} mark="no_lo_uso" current={marks[r.merchantKey]}>No lo uso</MarkButton>
                  <MarkButton k={r.merchantKey} mark="no_es_fijo" current={marks[r.merchantKey]}>No es un cobro fijo</MarkButton>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {inactive.length > 0 && (
        <section>
          <h2 className="text-[15px] font-semibold">Ya no aparecen</h2>
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-white text-[14.5px]">
            {inactive.map((r) => (
              <li key={r.merchantKey} className="flex justify-between gap-3 px-5 py-3 text-ink-muted">
                <span>{r.name}</span>
                <span>Último: {shortDate(r.lastDate)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hidden.length > 0 && (
        <section>
          <h2 className="text-[15px] font-semibold">Marcados como &quot;no es un cobro fijo&quot;</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {hidden.map(([key]) => (
              <li key={key}>
                <MarkButton k={key} mark="no_es_fijo" current="no_es_fijo">
                  {key.replace(/_/g, ' ')} (deshacer)
                </MarkButton>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
