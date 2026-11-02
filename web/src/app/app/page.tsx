import { AlertTriangle, ChevronRight, PencilLine, Repeat, Upload } from 'lucide-react';
import Link from 'next/link';
import { BalancePrompt, BalanceRow } from '@/components/app/balance-editor';
import { GaOnce } from '@/components/app/ga-once';
import { TrackView } from '@/components/app/track-view';
import { requireUser } from '@/lib/auth/session';
import { loadCifra, loadMarks } from '@/lib/data';
import { STALE_BALANCE_WARNING } from '@/lib/engine/cifra';
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

function ageNote(days: number | null, on: string | null): string {
  if (days === null || !on) return 'Todavía no hay saldo. Con el de hoy calculamos tu cifra.';
  if (days === 1) return 'Tu saldo es de ayer. Escribe el de hoy y la cifra se ajusta.';
  return `Tu saldo es del ${shortDate(on)}. Escribe el de hoy y la cifra se ajusta.`;
}

export default async function HoyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const [c, marks, sp] = await Promise.all([loadCifra(user), loadMarks(user.id), searchParams]);
  const editable = c.accounts.filter((a) => a.editable !== false).map((a) => ({ id: a.accountId, name: a.name, balanceMinor: a.balanceMinor }));

  // Nada todavía: dos caminos, y el rápido primero.
  if (c.missing.includes('movimientos') && c.missing.includes('saldo')) {
    return (
      <section className="pt-6">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Calculemos tu cifra.</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-muted">
          En un minuto, con cuatro datos que escribes: cuándo te pagan, cuánto tienes, tus cobros fijos y tu gasto del día a día. O con el
          extracto de tu banco, si lo tienes a mano.
        </p>
        <div className="mt-7 space-y-3">
          <Link href="/app/bienvenida" className="btn-primary w-full">
            <PencilLine size={18} aria-hidden="true" /> Calcularla en un minuto
          </Link>
          <Link href="/app/datos/importar" className="btn-ghost w-full">
            <Upload size={18} aria-hidden="true" /> Subir un extracto
          </Link>
        </div>
      </section>
    );
  }

  if (c.missing.includes('saldo')) {
    return (
      <section className="space-y-5 pt-6">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Falta tu saldo de hoy.</h1>
        <BalancePrompt accounts={editable} note="Lo que tienes en tus cuentas y billeteras, sin tarjetas de crédito." />
      </section>
    );
  }

  if (c.missing.includes('movimientos')) {
    return (
      <section className="pt-6">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Falta tu gasto del día a día.</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-muted">
          Ya tenemos tu saldo. Para saber cuánto te queda libre, dinos más o menos cuánto gastas en comida, transporte y salidas, o sube un
          extracto y lo calculamos con tus movimientos.
        </p>
        <div className="mt-7 space-y-3">
          <Link href="/app/ajustes#dia-a-dia" className="btn-primary w-full">
            <PencilLine size={18} aria-hidden="true" /> Escribir mi gasto diario
          </Link>
          <Link href="/app/datos/importar" className="btn-ghost w-full">
            <Upload size={18} aria-hidden="true" /> Subir un extracto
          </Link>
        </div>
      </section>
    );
  }

  // El saldo no es de hoy y la persona puede escribirlo: se pregunta arriba, en vez del aviso.
  const askBalance = editable.length > 0 && (c.balanceAgeDays ?? 0) >= 1;
  const warnings = askBalance ? c.warnings.filter((w) => !w.startsWith(STALE_BALANCE_WARNING)) : c.warnings;

  const recurringActive = c.recurring.filter((r) => r.active && marks[r.merchantKey] !== 'no_es_fijo');
  const monthlyRecurring = recurringActive.reduce((s, r) => s + r.monthlyMinor, 0);
  // Los cobros fijos escritos a mano que no son el mismo cobro que ya se ve en los movimientos.
  const written = c.commitments.filter((x) => !c.matchedCommitments.includes(x.id));
  const fixedCount = recurringActive.length + written.length;
  const fixedMonthly = monthlyRecurring + written.reduce((s, x) => s + x.amountMinor, 0);
  const negative = c.availableMinor < 0;
  const big = negative ? -c.availableMinor : c.availableMinor;
  const numberColor = negative ? 'text-neg' : c.status === 'justo' ? 'text-warn' : 'text-ink';

  return (
    <div className="space-y-6">
      <TrackView name="view_cifra" props={{ status: c.status, ready: c.ready, daily: c.dailySource }} />
      {sp.listo === 'rapido' && <GaOnce name="quick_start" />}
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

      {askBalance && <BalancePrompt accounts={editable} note={ageNote(c.balanceAgeDays, c.balanceOn)} />}

      {c.commitmentSuggestions.length > 0 && (
        <Link href="/app/cobros#escritos" className="flex gap-2.5 rounded-xl bg-warn-light px-4 py-3 text-[14px] leading-snug text-warn">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {c.commitmentSuggestions.length === 1
              ? 'Un cobro que escribiste puede ser el mismo que vemos en tus movimientos y lo estaríamos contando dos veces.'
              : `${c.commitmentSuggestions.length} cobros que escribiste pueden ser los mismos que vemos en tus movimientos y los estaríamos contando dos veces.`}{' '}
            <span className="font-semibold underline underline-offset-2">Revisar</span>
          </span>
        </Link>
      )}

      {warnings.length > 0 && (
        <ul className="space-y-2">
          {warnings.map((w) => (
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
          <BalanceRow
            accounts={editable}
            hint={c.balanceAgeDays === 0 ? 'Saldo de hoy' : c.balanceOn ? `Saldo al ${shortDate(c.balanceOn)}` : 'Sin saldo'}
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
            hint={
              c.dailySource === 'declarado' ? (
                <>
                  {cop(c.dailyVariableMinor)} diarios por {c.projectionDays} días, según lo que escribiste.{' '}
                  <Link href="/app/ajustes#dia-a-dia" className="underline underline-offset-2 hover:text-ink">
                    Cambiar
                  </Link>
                </>
              ) : (
                `${cop(c.dailyVariableMinor)} diarios por ${c.projectionDays} días, según tus últimas semanas`
              )
            }
            value={`- ${cop(c.projectedVariableMinor)}`}
          />
          {c.bufferMinor > 0 && <Row label="Colchón" hint="Lo apartas para imprevistos" value={`- ${cop(c.bufferMinor)}`} />}
          <div className={`flex items-baseline justify-between gap-3 border-t-2 border-dashed border-ink/20 pt-3 font-bold ${negative ? 'text-neg' : 'text-primary-dark'}`}>
            <span>= Puedes gastar</span>
            <span>{cop(c.availableMinor)}</span>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-faint">
          Esto no es tu saldo. Es lo que queda libre después de lo comprometido.
          {c.internalTransfers > 0 && ` No contamos ${c.internalTransfers} movimientos entre tus propias cuentas.`}
        </p>
        {c.historyDays > 0 ? (
          <Link href="/app/movimientos" className="mt-3 inline-block text-[13.5px] font-semibold text-primary-dark underline-offset-2 hover:underline">
            Ver movimientos
          </Link>
        ) : null}
      </section>

      {c.dailySource === 'declarado' && (
        <Link href="/app/datos/importar" className="flex items-center gap-3 rounded-2xl border border-dashed border-ink/25 px-5 py-4 hover:bg-white">
          <Upload size={19} className="shrink-0 text-primary-dark" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Afínala con tu extracto</span>
            <span className="block text-[13.5px] text-ink-muted">
              {c.historyDays > 0
                ? `Tenemos ${c.historyDays} ${c.historyDays === 1 ? 'día' : 'días'} de movimientos. Con tres semanas, tu gasto diario sale de ellos y no de un aproximado.`
                : 'Con tus movimientos reales calculamos tu gasto diario y encontramos los cobros que se repiten.'}
            </span>
          </span>
          <ChevronRight size={18} className="text-ink-faint" aria-hidden="true" />
        </Link>
      )}

      <section className="divide-y divide-line rounded-2xl border border-line bg-white">
        <Link href="/app/cobros" className="flex items-center gap-3 px-5 py-4 hover:bg-paper">
          <Repeat size={19} className="text-ink-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">
              {fixedCount === 1 ? '1 cobro fijo' : `${fixedCount} cobros fijos`}
            </span>
            <span className="tnum block text-[13.5px] text-ink-muted">
              {cop(fixedMonthly)} al mes
              {written.length > 0 && recurringActive.length > 0 ? `, ${written.length} escritos por ti` : written.length > 0 ? ', escritos por ti' : ''}
            </span>
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
