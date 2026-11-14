import { AlertTriangle, CalendarCheck2, ChevronRight, ListChecks, PencilLine, Plus, Repeat, Tag, TrendingUp, Upload } from 'lucide-react';
import Link from 'next/link';
import { AskInline } from '@/components/app/ask-inline';
import { BalancePrompt, BalanceRow } from '@/components/app/balance-editor';
import { CifraHero } from '@/components/app/cifra-hero';
import { GaOnce } from '@/components/app/ga-once';
import { PendingCharges } from '@/components/app/pending-charges';
import { QuickCaptureModal } from '@/components/app/quick-capture-modal';
import { TrackView } from '@/components/app/track-view';
import { requireUser } from '@/lib/auth/session';
import { loadCifra, loadMarksDetailed, loadRankedOffersForUser, loadSpendDeviation } from '@/lib/data';
import { STALE_BALANCE_WARNING } from '@/lib/engine/cifra';
import { shortDate, todayInBogota } from '@/lib/engine/dates';
import { cop } from '@/lib/format';
import { currentBogotaHour, loadCycleExtras } from '@/lib/v3-data';

/**
 * Hoy: un solo número con su recibo.
 *
 * Arriba, cuánto puede gastar la persona hasta su próximo pago y la resta de dónde sale.
 * Debajo, "¿Puedo gastar?" contestado contra ese mismo número. Todo lo demás vive en su sección.
 * Regla: ningún peso de esta pantalla sale de otro lado que de los datos de la persona.
 */

function Row({ label, hint, value }: { label: string; hint: React.ReactNode; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>
        <span className="font-medium text-ink">{label}</span>
        <span className="block text-[12.5px] text-ink-faint">{hint}</span>
      </span>
      <span className="shrink-0 font-semibold text-ink">{value}</span>
    </div>
  );
}

const FREQ_LABEL = { mensual: 'mensual', quincenal: 'quincenal', semanal: 'semanal', irregular: 'irregular' } as const;

function ageNote(days: number | null, on: string | null): string {
  if (days === null || !on) return 'Todavía no hay saldo. Con el de hoy calculamos tu cifra.';
  if (days === 1) return 'Tu saldo es de ayer. Escribe el de hoy y la cifra se ajusta al instante.';
  return `Tu saldo es del ${shortDate(on)}. Escribe el de hoy y la cifra se ajusta al instante.`;
}

export default async function HoyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const [c, marksDetail, sp] = await Promise.all([loadCifra(user), loadMarksDetailed(user.id), searchParams]);
  const editable = c.accounts
    .filter((a) => a.editable !== false)
    .map((a) => ({ id: a.accountId, name: a.name, balanceMinor: a.balanceMinor }));

  // Sin saldo ni gasto todavía: dos caminos para la primera cifra.
  if (c.missing.includes('movimientos') && c.missing.includes('saldo')) {
    return (
      <section className="surface-card p-6 sm:p-8">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">Calculemos tu primera cifra.</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-muted">
          Sabrás en un solo número cuánto puedes gastar hasta tu próximo pago, después del arriendo y tus cobros fijos. Sin
          pedirte claves del banco.
        </p>
        <div className="mt-7 space-y-3">
          <Link id="cta-empty-quick" href="/app/bienvenida" className="btn-primary w-full">
            <PencilLine size={18} aria-hidden="true" /> Calcularla con 4 datos
          </Link>
          <Link id="cta-empty-import" href="/app/datos/importar?primera=1" className="btn-ghost w-full">
            <Upload size={18} aria-hidden="true" /> Subir el extracto de mi banco
          </Link>
        </div>
      </section>
    );
  }

  if (c.missing.includes('saldo')) {
    return (
      <section className="surface-card space-y-5 p-6 sm:p-8">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Falta tu saldo de hoy.</h1>
        <BalancePrompt accounts={editable} note="Lo que tienes hoy en cuentas y billeteras, sin sumar cupos de tarjeta." />
      </section>
    );
  }

  if (c.missing.includes('movimientos')) {
    return (
      <section className="surface-card p-6 sm:p-8">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Falta tu gasto del día a día.</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-muted">
          Ya tenemos tu saldo. Dinos un aproximado de comida, transporte y salidas, o sube tu extracto y lo calculamos con tus
          compras.
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

  const [deviation, extras, offers] = await Promise.all([
    loadSpendDeviation(user, c),
    loadCycleExtras(user, c),
    loadRankedOffersForUser(user, 4),
  ]);

  const askBalance = editable.length > 0 && (c.balanceAgeDays ?? 0) >= 1;
  const warnings = askBalance ? c.warnings.filter((w) => !w.startsWith(STALE_BALANCE_WARNING)) : c.warnings;

  const recurringActive = c.recurring.filter((r) => r.active && marksDetail[r.merchantKey]?.mark !== 'no_es_fijo');
  const written = c.commitments.filter((x) => !c.matchedCommitments.includes(x.id));
  const fixedCount = recurringActive.length + written.length;
  const fixedMonthly =
    recurringActive.reduce((s, r) => s + r.monthlyMinor, 0) + written.reduce((s, x) => s + x.amountMinor, 0);

  const negative = c.availableMinor < 0;
  const projectionWord = c.projectionDays === 1 ? 'día' : 'días';

  return (
    <div className="space-y-4">
      <TrackView name="view_cifra" props={{ status: c.status, ready: c.ready, daily: c.dailySource }} />
      {sp.listo === 'rapido' && <GaOnce name="quick_start" />}
      {sp.listo === 'rapido' && (
        <section aria-label="Bienvenida" data-testid="bienvenida-hoy" className="rounded-2xl border border-primary/25 bg-primary-pale/70 px-5 py-4">
          <p className="text-[15.5px] font-semibold text-ink">Listo. Esta es tu cifra.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] leading-snug text-ink-soft">
            <li>Es lo que puedes gastar hasta tu próximo pago. Debajo ves de dónde sale.</li>
            <li>Antes de comprar, escribe el valor en "¿Puedo gastar?".</li>
            <li>En el menú de abajo están tus gastos, las ofertas cerca y tus cobros.</li>
          </ul>
          <Link href="/app" className="mt-2.5 inline-block text-[14px] font-semibold text-primary-dark underline underline-offset-2">
            Entendido
          </Link>
        </section>
      )}

      <CifraHero
        availableMinor={c.availableMinor}
        perDayMinor={c.perDayMinor}
        daysLeft={c.daysLeft}
        nextIncomeOn={c.nextIncomeOn}
        status={c.status}
      >
        <div aria-labelledby="resta">
          <div className="flex items-baseline justify-between">
            <h2 id="resta" className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
              De dónde sale
            </h2>
            {c.internalTransfers > 0 && (
              <span className="text-[12px] text-ink-faint">
                {c.internalTransfers} {c.internalTransfers === 1 ? 'traslado propio no cuenta' : 'traslados propios no cuentan'}
              </span>
            )}
          </div>

          <div className="tnum mt-3 space-y-3 text-[15px]">
            <BalanceRow
              accounts={editable}
              hint={c.balanceAgeDays === 0 ? 'Saldo de hoy' : c.balanceOn ? `Saldo al ${shortDate(c.balanceOn)}` : 'Sin saldo'}
              value={cop(c.balanceMinor)}
            />
            <Row
              label="Cobros fijos que faltan"
              hint={
                c.pending.length === 0
                  ? 'Ninguno antes de tu próximo pago'
                  : `${c.pending.length} ${c.pending.length === 1 ? 'cobro' : 'cobros'} antes del ${shortDate(c.nextIncomeOn)}`
              }
              value={`− ${cop(c.pendingMinor)}`}
            />
            <PendingCharges pending={c.pending} paid={extras.paidCharges} cycleEnd={c.nextIncomeOn} />
            <Row
              label="Tu día a día"
              hint={
                c.dailySource === 'declarado' ? (
                  <>
                    {cop(c.dailyVariableMinor)} por día × {c.projectionDays} {projectionWord}, según lo que escribiste.{' '}
                    <Link href="/app/ajustes#dia-a-dia" className="underline underline-offset-2 hover:text-ink">
                      Cambiar
                    </Link>
                  </>
                ) : (
                  `${cop(c.dailyVariableMinor)} por día × ${c.projectionDays} ${projectionWord}, según tus últimas semanas`
                )
              }
              value={`− ${cop(c.projectedVariableMinor)}`}
            />
            {c.bufferMinor > 0 && (
              <Row label="Tu colchón" hint="Lo que pediste apartar para imprevistos" value={`− ${cop(c.bufferMinor)}`} />
            )}
            <div
              className={`flex items-baseline justify-between gap-3 border-t border-dashed border-line-strong pt-3 text-[16px] font-bold ${
                negative ? 'text-neg' : 'text-primary-dark'
              }`}
            >
              <span>{negative ? '= Te faltan' : '= Puedes gastar'}</span>
              <span>{cop(Math.abs(c.availableMinor))}</span>
            </div>
          </div>
        </div>
      </CifraHero>

      {askBalance && <BalancePrompt accounts={editable} note={ageNote(c.balanceAgeDays, c.balanceOn)} />}

      <AskInline
        cifra={{
          availableMinor: c.availableMinor,
          dailyVariableMinor: c.dailyVariableMinor,
          daysLeft: c.daysLeft,
          nextIncomeOn: c.nextIncomeOn,
        }}
        where="hoy"
        moreHref="/app/gasto"
      />

      {/* Anotar un gasto: en el flujo de la página, no flotando, para que no tape "Preguntar". */}
      <QuickCaptureModal
        accounts={extras.captureAccounts.length ? extras.captureAccounts : editable}
        todayIso={todayInBogota()}
        currentHour={currentBogotaHour()}
        buttonId="btn-anotar-gasto"
        buttonClassName="btn-ghost w-full"
      >
        <Plus size={18} aria-hidden="true" />
        <span>Anotar un gasto</span>
      </QuickCaptureModal>

      {/* Aviso cuando el gasto de la semana se aleja del ritmo propio. Solo aparece con movimientos reales. */}
      {deviation.triggered && (
        <section className="surface-card border-warn/30 bg-warn-light/70 px-5 py-4">
          <div className="flex items-start gap-3">
            <TrendingUp size={20} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold text-ink">
                Esta semana vas gastando <span className="tnum">{cop(deviation.recent7dDailyMinor)}</span> por día
              </p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
                Lo tuyo es <span className="tnum font-semibold">{cop(deviation.baselineDailyMinor)}</span> por día
                {deviation.topDriverName ? ` (lo que más pesó: ${deviation.topDriverName})` : ''}.
              </p>
              <Link href="/app/movimientos" className="mt-2 inline-block text-[13px] font-semibold text-warn underline underline-offset-2">
                Ver los gastos de los últimos 7 días
              </Link>
            </div>
          </div>
        </section>
      )}

      {c.commitmentSuggestions.length > 0 && (
        <Link href="/app/cobros#escritos" className="flex gap-2.5 rounded-xl bg-warn-light px-4 py-3 text-[14px] leading-snug text-warn">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {c.commitmentSuggestions.length === 1
              ? 'Un cobro que escribiste puede ser el mismo que vemos en tus movimientos y lo estaríamos contando dos veces.'
              : `${c.commitmentSuggestions.length} cobros que escribiste pueden ser los mismos que vemos en tus movimientos.`}{' '}
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

      <section className="divide-y divide-line rounded-2xl border border-line bg-white shadow-card">
        {c.dailySource === 'declarado' && (
          <Link href="/app/datos/importar" className="flex items-center gap-3 px-5 py-4 hover:bg-paper/60">
            <Upload size={19} className="shrink-0 text-primary-dark" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Afina tu cifra con tu extracto</span>
              <span className="block text-[13.5px] text-ink-muted">
                {c.historyDays > 0
                  ? `Tenemos ${c.historyDays} ${c.historyDays === 1 ? 'día' : 'días'} de movimientos. Con tres semanas calculamos tu gasto diario con tus compras.`
                  : 'Encuentra cobros que no recordabas y calcula tu gasto diario con tus compras.'}
              </span>
            </span>
            <ChevronRight size={18} className="text-ink-faint" aria-hidden="true" />
          </Link>
        )}

        <Link href="/app/cobros" className="flex items-center gap-3 px-5 py-4 hover:bg-paper/60">
          <Repeat size={19} className="shrink-0 text-ink-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">
              {fixedCount === 0 ? 'Cobros fijos' : fixedCount === 1 ? '1 cobro fijo' : `${fixedCount} cobros fijos`}
            </span>
            <span className="tnum block text-[13.5px] text-ink-muted">
              {fixedCount === 0
                ? 'Todavía no hay ninguno. Agrégalos o sube tu extracto.'
                : `${cop(fixedMonthly)} al mes${written.length > 0 ? (recurringActive.length > 0 ? ` (${written.length} escritos por ti)` : ' (escritos por ti)') : ''}`}
            </span>
          </span>
          <ChevronRight size={18} className="text-ink-faint" aria-hidden="true" />
        </Link>

        {offers.length > 0 && (
          <Link href="/app/ofertas" className="flex items-center gap-3 px-5 py-4 hover:bg-paper/60">
            <Tag size={19} className="shrink-0 text-terra-dark" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Ofertas cerca de ti</span>
              <span className="block truncate text-[13.5px] text-ink-muted">
                {offers
                  .slice(0, 2)
                  .map((o) => o.offer.merchantName)
                  .join(' · ')}
              </span>
            </span>
            <ChevronRight size={18} className="text-ink-faint" aria-hidden="true" />
          </Link>
        )}

        <Link href="/app/cierre" className="flex items-center gap-3 px-5 py-4 hover:bg-paper/60">
          <ListChecks size={19} className="shrink-0 text-ink-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Cierre del ciclo</span>
            <span className="block text-[13.5px] text-ink-muted">Mira cómo te fue y deja un ajuste para el próximo pago.</span>
          </span>
          <ChevronRight size={18} className="text-ink-faint" aria-hidden="true" />
        </Link>

        <Link href="/app/ajustes#ingreso" className="flex items-center gap-3 px-5 py-4 hover:bg-paper/60">
          <CalendarCheck2 size={19} className="shrink-0 text-ink-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Próximo pago: {shortDate(c.nextIncomeOn)}</span>
            <span className="block text-[13.5px] text-ink-muted">
              {c.income.origin === 'sin_datos'
                ? 'No lo encontramos en tus movimientos. Dinos cuándo te pagan.'
                : c.income.origin === 'detectado'
                  ? `Lo encontramos en tus movimientos: ingreso ${FREQ_LABEL[c.income.frequency]}${c.income.payer ? ` de ${c.income.payer}` : ''}. Toca para cambiarlo.`
                  : `Lo escribiste como ${FREQ_LABEL[c.income.frequency]}. Toca para cambiarlo.`}
            </span>
          </span>
          <ChevronRight size={18} className="text-ink-faint" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
