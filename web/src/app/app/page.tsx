import { AlertTriangle, ChevronRight, Repeat, Upload } from 'lucide-react';
import Link from 'next/link';
import { TrackView } from '@/components/app/track-view';
import { requireUser } from '@/lib/auth/session';
import { loadCifra, loadMarks } from '@/lib/data';
import { shortDate } from '@/lib/engine/dates';
import { cop } from '@/lib/format';

function Row({ label, hint, value }: { label: string; hint: React.ReactNode; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>
        {label}
        <span className="block text-[12.5px] text-ink-faint">{hint}</span>
      </span>
      <span className="shrink-0 font-semibold">{value}</span>
    </div>
  );
}

const FREQ_LABEL = { mensual: 'mensual', quincenal: 'quincenal', semanal: 'semanal', irregular: 'irregular' } as const;

export default async function HoyPage() {
  const user = await requireUser();
  const [c, marks] = await Promise.all([loadCifra(user), loadMarks(user.id)]);

  if (c.missing.includes('movimientos') && c.missing.includes('saldo')) {
    return (
      <section className="pt-6">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Falta tu extracto para calcular tu cifra.</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-muted">
          Descarga los movimientos de tu cuenta en CSV o Excel desde la sucursal virtual de tu banco y súbelos aquí. Con dos o
          tres meses la cifra sale mejor.
        </p>
        <Link href="/app/datos/importar" className="btn-primary mt-7 w-full">
          <Upload size={18} aria-hidden="true" /> Subir extracto
        </Link>
      </section>
    );
  }

  const recurringActive = c.recurring.filter((r) => r.active && marks[r.merchantKey] !== 'no_es_fijo');
  const monthlyRecurring = recurringActive.reduce((s, r) => s + r.monthlyMinor, 0);
  const negative = c.availableMinor < 0;
  const big = negative ? -c.availableMinor : c.availableMinor;
  const numberColor = negative ? 'text-neg' : c.status === 'justo' ? 'text-warn' : 'text-ink';

  return (
    <div className="space-y-6">
      <TrackView name="view_cifra" props={{ status: c.status, ready: c.ready }} />
      <section aria-labelledby="cifra-label" className="pt-2">
        <p id="cifra-label" className="text-[15px] font-medium text-ink-muted">
          {negative ? `Hasta el ${shortDate(c.nextIncomeOn)} te faltarían` : `Puedes gastar hasta el ${shortDate(c.nextIncomeOn)}`}
        </p>
        <p className={`tnum mt-1 font-display text-[60px] font-extrabold leading-none tracking-[-0.04em] ${numberColor}`}>{cop(big)}</p>
        <p className="mt-3 text-[15px] leading-snug text-ink-muted">
          {negative
            ? 'Lo comprometido y tu gasto normal suman más de lo que tienes. Revisa los cobros fijos o tu día a día.'
            : `Unos ${cop(c.perDayMinor)} extra por día durante ${c.daysLeft} ${c.daysLeft === 1 ? 'día' : 'días'}, además de tu gasto normal.`}
        </p>
        <Link href="/app/gasto" className="btn-primary mt-6 w-full">
          ¿Puedo hacer un gasto?
        </Link>
      </section>

      {c.warnings.length > 0 && (
        <ul className="space-y-2">
          {c.warnings.map((w) => (
            <li key={w} className="flex gap-2.5 rounded-xl bg-warn-light px-4 py-3 text-[14px] leading-snug text-warn">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="resta" className="rounded-2xl border border-line bg-white px-5 py-4">
        <h2 id="resta" className="text-[14px] font-semibold text-ink-muted">De dónde sale</h2>
        <div className="tnum mt-3 space-y-3 text-[15px]">
          <Row
            label="Tienes hoy"
            hint={
              <>
                {c.balanceOn ? `Saldo al ${shortDate(c.balanceOn)}` : 'Sin saldo'}{' '}
                <Link href="/app/datos" className="underline">actualizar</Link>
              </>
            }
            value={cop(c.balanceMinor)}
          />
          <Row
            label="Cobros fijos que faltan"
            hint={c.pending.length === 0 ? 'Ninguno antes de tu próximo ingreso' : `${c.pending.length} antes del ${shortDate(c.nextIncomeOn)}`}
            value={`- ${cop(c.pendingMinor)}`}
          />
          {c.pending.length > 0 && (
            <details className="-mt-1">
              <summary className="cursor-pointer text-[13px] font-semibold text-primary-dark">Ver cuáles</summary>
              <ul className="mt-2 space-y-1.5 border-l-2 border-line pl-3 text-[14px] text-ink-muted">
                {c.pending.map((p) => (
                  <li key={`${p.key}-${p.date}`} className="flex justify-between gap-3">
                    <span>
                      {p.name} <span className="text-ink-faint">{shortDate(p.date)}</span>
                    </span>
                    <span>
                      {p.estimated ? 'aprox. ' : ''}
                      {cop(p.amountMinor)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <Row
            label="Tu día a día"
            hint={`${cop(c.dailyVariableMinor)} diarios por ${c.projectionDays} días, según tus últimas semanas`}
            value={`- ${cop(c.projectedVariableMinor)}`}
          />
          {c.bufferMinor > 0 && <Row label="Colchón" hint="Lo apartas para imprevistos" value={`- ${cop(c.bufferMinor)}`} />}
          <div className={`flex items-baseline justify-between gap-3 border-t-2 border-dashed border-ink/20 pt-3 font-bold ${negative ? 'text-neg' : 'text-primary-dark'}`}>
            <span>= Puedes gastar</span>
            <span>{cop(c.availableMinor)}</span>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-faint">Esto no es tu saldo. Es lo que queda libre después de lo comprometido.</p>
      </section>

      <section className="divide-y divide-line rounded-2xl border border-line bg-white">
        <Link href="/app/cobros" className="flex items-center gap-3 px-5 py-4 hover:bg-paper">
          <Repeat size={19} className="text-ink-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">
              {recurringActive.length === 1 ? '1 cobro que se repite' : `${recurringActive.length} cobros que se repiten`}
            </span>
            <span className="tnum block text-[13.5px] text-ink-muted">{cop(monthlyRecurring)} al mes</span>
          </span>
          <ChevronRight size={18} className="text-ink-faint" aria-hidden="true" />
        </Link>
        <Link href="/app/ajustes#ingreso" className="flex items-center gap-3 px-5 py-4 hover:bg-paper">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Próximo ingreso: {shortDate(c.nextIncomeOn)}</span>
            <span className="block text-[13.5px] text-ink-muted">
              {c.income.origin === 'sin_datos'
                ? 'No lo encontramos en tus movimientos. Dinos cuándo te pagan.'
                : c.income.origin === 'detectado'
                  ? `Detectado: ingreso ${FREQ_LABEL[c.income.frequency]}${c.income.payer ? ` de ${c.income.payer}` : ''}. Toca para corregir.`
                  : `Tú lo configuraste como ${FREQ_LABEL[c.income.frequency]}.`}
            </span>
          </span>
          <ChevronRight size={18} className="text-ink-faint" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
