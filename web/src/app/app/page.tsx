import { AlertTriangle, CalendarCheck2, ChevronRight, PencilLine, Repeat, TrendingUp, Upload } from 'lucide-react';
import Link from 'next/link';
import { BalancePrompt, BalanceRow } from '@/components/app/balance-editor';
import { CifraPrivacyHero } from '@/components/app/cifra-privacy-hero';
import { DailyPulseCard } from '@/components/app/daily-pulse-card';
import { GaOnce } from '@/components/app/ga-once';
import { TrackView } from '@/components/app/track-view';
import { ExpandableSmartMap } from '@/components/map/expandable-smart-map';
import { requireUser } from '@/lib/auth/session';
import { loadCifra, loadMarksDetailed, loadSpendDeviation } from '@/lib/data';
import { STALE_BALANCE_WARNING } from '@/lib/engine/cifra';
import { shortDate, todayInBogota } from '@/lib/engine/dates';
import { cop } from '@/lib/format';
import {
  currentBogotaHour,
  loadPersonaDailyValueBundle,
  loadSmartMapBundle,
} from '@/lib/v3-data';

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
  const [c, marksDetail, smartMap, sp] = await Promise.all([
    loadCifra(user),
    loadMarksDetailed(user.id),
    loadSmartMapBundle(user),
    searchParams,
  ]);
  const [deviation, dailyBundle] = c.ready
    ? await Promise.all([loadSpendDeviation(user, c), loadPersonaDailyValueBundle(user, c)])
    : [null, null];
  const editable = c.accounts
    .filter((a) => a.editable !== false)
    .map((a) => ({ id: a.accountId, name: a.name, balanceMinor: a.balanceMinor }));

  // Estado vacío inicial: dos caminos directos (rápido en 1 min o extracto).
  if (c.missing.includes('movimientos') && c.missing.includes('saldo')) {
    return (
      <section className="surface-card p-6 sm:p-8">
        <span className="badge-primary">Empieza en menos de 3 minutos</span>
        <h1 className="mt-3 font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">
          Calculemos tu primera cifra.
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-muted">
          Sabrás en un solo número cuánto puedes gastar hasta tu próximo pago sin descuadrar el arriendo ni tus cobros fijos. Sin pedirte claves bancarias.
        </p>
        <div className="mt-7 space-y-3">
          <Link id="cta-empty-quick" href="/app/bienvenida" className="btn-primary w-full">
            <PencilLine size={18} aria-hidden="true" /> Calcularla en 1 minuto (4 datos)
          </Link>
          <Link id="cta-empty-import" href="/app/datos/importar?primera=1" className="btn-ghost w-full">
            <Upload size={18} aria-hidden="true" /> Subir extracto de mi banco
          </Link>
        </div>
      </section>
    );
  }

  if (c.missing.includes('saldo')) {
    return (
      <section className="surface-card space-y-5 p-6 sm:p-8">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Falta tu saldo de hoy.</h1>
        <BalancePrompt accounts={editable} note="Lo que tienes líquido hoy en cuentas y billeteras, sin sumar cupos de tarjeta." />
      </section>
    );
  }

  if (c.missing.includes('movimientos')) {
    return (
      <section className="surface-card p-6 sm:p-8">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Falta tu gasto del día a día.</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-muted">
          Ya tenemos tu saldo. Dinos un aproximado de comida, transporte y salidas, o sube tu extracto y lo calculamos con tus compras reales.
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

  const askBalance = editable.length > 0 && (c.balanceAgeDays ?? 0) >= 1;
  const warnings = askBalance ? c.warnings.filter((w) => !w.startsWith(STALE_BALANCE_WARNING)) : c.warnings;

  const recurringActive = c.recurring.filter((r) => r.active && marksDetail[r.merchantKey]?.mark !== 'no_es_fijo');
  const monthlyRecurring = recurringActive.reduce((s, r) => s + r.monthlyMinor, 0);

  const written = c.commitments.filter((x) => !c.matchedCommitments.includes(x.id));
  const fixedCount = recurringActive.length + written.length;
  const fixedMonthly = monthlyRecurring + written.reduce((s, x) => s + x.amountMinor, 0);

  // Nunca mostramos "deuda total" de golpe (Dolor 7): mostramos el margen disponible o el ajuste necesario del ciclo actual con tono empático.
  const negative = c.availableMinor < 0;
  const big = negative ? -c.availableMinor : c.availableMinor;
  const numberColor = negative ? 'text-neg' : c.status === 'justo' ? 'text-warn' : 'text-ink';
  const statusBadge = negative
    ? { cls: 'badge-neg', text: 'Ciclo apretado · Revisemos juntos' }
    : c.status === 'justo'
      ? { cls: 'badge-warn', text: 'Margen justo hasta tu pago' }
      : { cls: 'badge-primary', text: 'Vas con buen margen' };

  return (
    <div className="space-y-5">
      <TrackView name="view_cifra" props={{ status: c.status, ready: c.ready, daily: c.dailySource }} />
      {sp.listo === 'rapido' && <GaOnce name="quick_start" />}

      {/* Tiquete principal CIFRA con Modo Ojo (Privacidad TransMilenio), Quick Actions Hub y cálculo seguro */}
      <CifraPrivacyHero
        availableMinor={c.availableMinor}
        negative={negative}
        perDayMinor={c.perDayMinor}
        daysLeft={c.daysLeft}
        nextIncomeOn={c.nextIncomeOn}
        statusBadge={statusBadge}
        numberColor={numberColor}
        captureAccounts={dailyBundle?.captureAccounts ?? editable}
        todayIso={todayInBogota()}
        currentHour={currentBogotaHour()}
      >
        <div aria-labelledby="resta">
          <div className="flex items-baseline justify-between">
            <h2 id="resta" className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
              De dónde sale tu cifra
            </h2>
            {c.internalTransfers > 0 && (
              <span className="text-[12px] text-ink-faint">{c.internalTransfers} traslados propios excluidos</span>
            )}
          </div>

          <div className="tnum mt-3 space-y-3 text-[15px]">
            <BalanceRow
              accounts={editable}
              hint={c.balanceAgeDays === 0 ? 'Saldo líquido de hoy' : c.balanceOn ? `Saldo al ${shortDate(c.balanceOn)}` : 'Sin saldo'}
              value={cop(c.balanceMinor)}
            />
            <Row
              label="Cobros fijos que faltan"
              hint={
                c.pending.length === 0
                  ? 'Ninguno pendiente antes de tu próximo ingreso'
                  : `${c.pending.length} cobro${c.pending.length === 1 ? '' : 's'} antes del ${shortDate(c.nextIncomeOn)}`
              }
              value={`- ${cop(c.pendingMinor)}`}
            />
            {c.pending.length > 0 && (
              <details className="-mt-1">
                <summary className="cursor-pointer text-[13px] font-semibold text-primary-dark">
                  Ver cobros reservados de este ciclo
                </summary>
                <ul className="mt-2 space-y-1.5 border-l-2 border-line pl-3 text-[13.5px] text-ink-muted">
                  {c.pending.map((p) => (
                    <li key={`${p.key}-${p.date}`} className="flex justify-between gap-3">
                      <span>
                        {p.name} <span className="text-ink-faint">· {shortDate(p.date)}</span>
                      </span>
                      <span className="font-medium text-ink">
                        {p.estimated ? 'aprox. ' : ''}
                        {cop(p.amountMinor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <Row
              label="Tu día a día proyectado"
              hint={
                c.dailySource === 'declarado' ? (
                  <>
                    {cop(c.dailyVariableMinor)}/día × {c.projectionDays} días (declarado por ti).{' '}
                    <Link href="/app/ajustes#dia-a-dia" className="underline underline-offset-2 hover:text-ink">
                      Ajustar
                    </Link>
                  </>
                ) : (
                  `${cop(c.dailyVariableMinor)}/día × ${c.projectionDays} días, calculado con tus últimas semanas`
                )
              }
              value={`- ${cop(c.projectedVariableMinor)}`}
            />
            {c.bufferMinor > 0 && (
              <Row label="Colchón de tranquilidad" hint="Apartado para imprevistos" value={`- ${cop(c.bufferMinor)}`} />
            )}
            <div
              className={`flex items-baseline justify-between gap-3 border-t border-dashed border-line-strong pt-3 text-[16px] font-bold ${
                negative ? 'text-neg' : 'text-primary-dark'
              }`}
            >
              <span>= Disponible seguro</span>
              <span>{cop(c.availableMinor)}</span>
            </div>
          </div>
        </div>
      </CifraPrivacyHero>

      {dailyBundle && (
        <DailyPulseCard
          pulse={dailyBundle.pulse}
          pendingCharges={c.pending}
          paidCharges={dailyBundle.paidCharges}
          cycleEnd={c.nextIncomeOn}
          captureAccounts={dailyBundle.captureAccounts}
          todayIso={todayInBogota()}
          currentHour={currentBogotaHour()}
        />
      )}

      {askBalance && <BalancePrompt accounts={editable} note={ageNote(c.balanceAgeDays, c.balanceOn)} />}

      {/* Mapa inteligente desplegable: cruce de gastos reales × cercanía × ofertas por franja horaria */}
      <ExpandableSmartMap
        bundle={smartMap}
        compactTitle="Tiendas de tu cuadra que cruzan con tus gastos"
        compactSubtitle="Despliega el mapa para ver locales a pocos minutos caminando con descuentos en las horas en que sueles comprar."
      />

      {/* Alerta temprana de desviación frente al propio patrón (Etapa 4 del recorrido C.5) */}
      {deviation?.triggered && (
        <section className="surface-card border-warn/30 bg-warn-light/70 px-5 py-4">
          <div className="flex items-start gap-3">
            <TrendingUp size={20} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold text-ink">
                Esta semana tu ritmo diario subió a <span className="tnum">{cop(deviation.recent7dDailyMinor)}</span>/día
              </p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
                Tu promedio habitual es <span className="tnum font-semibold">{cop(deviation.baselineDailyMinor)}</span>/día
                {deviation.topDriverName ? ` (impulsado sobre todo por ${deviation.topDriverName})` : ''}. Bajar un cambio los próximos 3 días protege tu cierre de quincena.
              </p>
              <Link
                href="/app/movimientos"
                className="mt-2 inline-block text-[13px] font-semibold text-warn underline underline-offset-2"
              >
                Revisar gastos de los últimos 7 días →
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

      {c.dailySource === 'declarado' && (
        <Link
          href="/app/datos/importar"
          className="flex items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-white/70 px-5 py-4 transition-colors hover:bg-white"
        >
          <Upload size={19} className="shrink-0 text-primary-dark" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Afina tu cifra con un extracto real</span>
            <span className="block text-[13.5px] text-ink-muted">
              {c.historyDays > 0
                ? `Tenemos ${c.historyDays} ${c.historyDays === 1 ? 'día' : 'días'} de movimientos. Con tres semanas calculamos tu gasto diario real.`
                : 'Detectamos cobros olvidados, gastos hormiga y tu promedio diario exacto.'}
            </span>
          </span>
          <ChevronRight size={18} className="text-ink-faint" aria-hidden="true" />
        </Link>
      )}

      <section className="divide-y divide-line rounded-2xl border border-line bg-white shadow-card">
        <Link href="/app/cobros" className="flex items-center gap-3 px-5 py-4 hover:bg-paper/60">
          <Repeat size={19} className="shrink-0 text-ink-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">
              {fixedCount === 1 ? '1 cobro fijo detectado' : `${fixedCount} cobros fijos`}
            </span>
            <span className="tnum block text-[13.5px] text-ink-muted">
              {cop(fixedMonthly)} al mes
              {written.length > 0 && recurringActive.length > 0
                ? ` (${written.length} escritos por ti)`
                : written.length > 0
                  ? ' (escritos por ti)'
                  : ''}
            </span>
          </span>
          <ChevronRight size={18} className="text-ink-faint" aria-hidden="true" />
        </Link>

        <Link href="/app/cierre" className="flex items-center gap-3 px-5 py-4 hover:bg-paper/60">
          <CalendarCheck2 size={19} className="shrink-0 text-ink-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Cierre de ciclo y compromiso</span>
            <span className="block text-[13.5px] text-ink-muted">
              Compara este mes con el anterior y deja un solo ajuste para el próximo pago.
            </span>
          </span>
          <ChevronRight size={18} className="text-ink-faint" aria-hidden="true" />
        </Link>

        <Link href="/app/ajustes#ingreso" className="flex items-center gap-3 px-5 py-4 hover:bg-paper/60">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Próximo ingreso: {shortDate(c.nextIncomeOn)}</span>
            <span className="block text-[13.5px] text-ink-muted">
              {c.income.origin === 'sin_datos'
                ? 'No lo encontramos en tus movimientos. Dinos cuándo te pagan.'
                : c.income.origin === 'detectado'
                  ? `Detectado: ingreso ${FREQ_LABEL[c.income.frequency]}${c.income.payer ? ` de ${c.income.payer}` : ''}. Toca para ajustar.`
                  : `Configurado como ${FREQ_LABEL[c.income.frequency]}.`}
            </span>
          </span>
          <ChevronRight size={18} className="text-ink-faint" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
