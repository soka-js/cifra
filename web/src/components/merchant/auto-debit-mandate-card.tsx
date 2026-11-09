'use client';

import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Lock,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  executeMerchantAutoDebitCutoffAction,
  reopenMerchantCutoffInvoiceAction,
  saveMerchantMandateConfigAction,
  topUpMerchantPrepaidAction,
} from '@/app/actions/v3';
import type { MerchantMandateConfig } from '@/lib/db/schema';
import { cop, shortDate } from '@/lib/format';

interface AutoDebitMandateCardProps {
  merchantName: string;
  merchantNequi: string | null;
  merchantBrebKey: string | null;
  accumulatedCommissionMinor: number;
  cutDateIso: string;
  daysUntilCut: number;
  salesCount: number;
  initialConfig?: MerchantMandateConfig;
  isCurrentInvoicePaid?: boolean;
}

type CollectionMethod = 'debito_automatico' | 'bolsa_prepago';
type DebitChannel = 'breb' | 'nequi' | 'bancolombia_ach';

export function AutoDebitMandateCard({
  merchantName,
  merchantNequi,
  merchantBrebKey,
  accumulatedCommissionMinor,
  cutDateIso,
  daysUntilCut,
  salesCount,
  initialConfig,
  isCurrentInvoicePaid = false,
}: AutoDebitMandateCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [collectionMethod, setCollectionMethod] = useState<CollectionMethod>(
    initialConfig?.collectionMethod ?? 'debito_automatico',
  );
  const [mandateActive, setMandateActive] = useState<boolean>(
    initialConfig?.mandateActive ?? true,
  );
  const [selectedChannel, setSelectedChannel] = useState<DebitChannel>(
    initialConfig?.selectedChannel ?? 'breb',
  );
  const [safetyCapMinor, setSafetyCapMinor] = useState<number>(
    initialConfig?.safetyCapMinor ?? 150_000_00,
  );
  const [prepaidBalanceMinor, setPrepaidBalanceMinor] = useState<number>(
    initialConfig?.prepaidBalanceMinor ?? 85_000_00,
  );
  const [settledRef, setSettledRef] = useState<string | undefined>(
    initialConfig?.lastAutoSettledRef,
  );
  const [settledAmountMinor, setSettledAmountMinor] = useState<number | undefined>(
    initialConfig?.lastAutoSettledAmountMinor,
  );
  const [settledState, setSettledState] = useState<boolean>(
    Boolean(isCurrentInvoicePaid || initialConfig?.lastAutoSettledRef),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  function selectMethod(next: CollectionMethod) {
    setCollectionMethod(next);
    startTransition(async () => {
      const res = await saveMerchantMandateConfigAction({ collectionMethod: next });
      setStatusMessage(res.message);
      router.refresh();
    });
  }

  function selectChannel(next: DebitChannel) {
    setSelectedChannel(next);
    startTransition(async () => {
      const res = await saveMerchantMandateConfigAction({ selectedChannel: next });
      setStatusMessage(res.message);
      router.refresh();
    });
  }

  function changeSafetyCap(nextCap: number) {
    setSafetyCapMinor(nextCap);
    startTransition(async () => {
      const res = await saveMerchantMandateConfigAction({ safetyCapMinor: nextCap });
      setStatusMessage(res.message);
      router.refresh();
    });
  }

  function toggleMandate() {
    const next = !mandateActive;
    setMandateActive(next);
    startTransition(async () => {
      const res = await saveMerchantMandateConfigAction({ mandateActive: next });
      setStatusMessage(res.message);
      router.refresh();
    });
  }

  function handleTopUpPrepaid(amountMinor: number) {
    startTransition(async () => {
      const res = await topUpMerchantPrepaidAction(amountMinor);
      if (res.ok) {
        setPrepaidBalanceMinor(res.config.prepaidBalanceMinor);
        setStatusMessage(res.message);
        router.refresh();
      }
    });
  }

  function handleExecuteCutoffSettlement() {
    startTransition(async () => {
      const res = await executeMerchantAutoDebitCutoffAction();
      if (res.ok) {
        setSettledState(true);
        setSettledRef(res.reference);
        setSettledAmountMinor(res.settledAmountMinor);
        setPrepaidBalanceMinor(res.config.prepaidBalanceMinor);
        setStatusMessage(res.message);
        router.refresh();
      }
    });
  }

  function handleReopenCutoff() {
    startTransition(async () => {
      const res = await reopenMerchantCutoffInvoiceAction();
      if (res.ok) {
        setSettledState(false);
        setSettledRef(undefined);
        setSettledAmountMinor(undefined);
        setStatusMessage(res.message);
        router.refresh();
      }
    });
  }

  const remainingPrepaidMinor = Math.max(0, prepaidBalanceMinor - accumulatedCommissionMinor);

  return (
    <section
      aria-label="Mandato de Débito Automático y Bolsa Prepago"
      className="overflow-hidden rounded-3xl border border-terra/30 bg-white shadow-sm"
    >
      {/* Cabecera */}
      <div className="border-b border-line bg-gradient-to-r from-terra-pale/75 via-white to-paper px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-terra text-white shadow-xs">
              <Zap size={19} aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-terra px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
                  Recaudo B2B sin fricción
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900">
                  {mandateActive ? 'Mandato Autorizado Activo' : 'Modo Manual'}
                </span>
              </div>
              <h2 className="mt-1.5 font-display text-[21px] font-bold leading-tight text-ink sm:text-[23px]">
                Mandato de Débito Automático Quincenal y Bolsa Prepago
              </h2>
              <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-muted">
                Para que <strong>{merchantName}</strong> nunca tenga que acordarse de transferir ni subir comprobantes manuales: autorizas el débito automático al cierre de cada quincena o descuentas tus comisiones del 5 % de una bolsa prepago con recarga automática.
              </p>
            </div>
          </div>

          <div className="inline-flex rounded-xl border border-line bg-white p-1 text-[12px] shadow-2xs">
            <button
              type="button"
              disabled={isPending}
              onClick={() => selectMethod('debito_automatico')}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${
                collectionMethod === 'debito_automatico'
                  ? 'bg-terra text-white'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Débito Automático
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => selectMethod('bolsa_prepago')}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${
                collectionMethod === 'bolsa_prepago'
                  ? 'bg-terra text-white'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Bolsa Prepago
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            role="status"
            className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-[12.5px] font-semibold text-emerald-900"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>{statusMessage}</span>
            </span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-[11px] underline hover:no-underline"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* Cuerpo del mecanismo seleccionado */}
      <div className="p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          {collectionMethod === 'debito_automatico' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold uppercase tracking-wider text-ink-muted">
                  1. Canal vinculado para débito automático al corte
                </h3>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={toggleMandate}
                  className="text-[12px] font-semibold text-terra-dark underline hover:text-ink"
                >
                  {mandateActive ? 'Pausar mandato' : 'Reactivar mandato'}
                </button>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => selectChannel('breb')}
                  className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition ${
                    selectedChannel === 'breb'
                      ? 'border-terra bg-terra-pale/45 shadow-xs'
                      : 'border-line bg-paper/40 hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Zap size={16} className="text-terra-dark" />
                    {selectedChannel === 'breb' && (
                      <CheckCircle2 size={15} className="text-terra-dark" />
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="text-[13px] font-bold text-ink">Llave Bre-B Comercio</p>
                    <p className="mt-0.5 font-mono text-[11.5px] text-ink-muted">
                      {merchantBrebKey ?? '@laespiga.chapinero'}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => selectChannel('nequi')}
                  className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition ${
                    selectedChannel === 'nequi'
                      ? 'border-terra bg-terra-pale/45 shadow-xs'
                      : 'border-line bg-paper/40 hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Smartphone size={16} className="text-terra-dark" />
                    {selectedChannel === 'nequi' && (
                      <CheckCircle2 size={15} className="text-terra-dark" />
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="text-[13px] font-bold text-ink">Nequi Negocios</p>
                    <p className="mt-0.5 font-mono text-[11.5px] text-ink-muted">
                      {merchantNequi ?? '312 456 7890'}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => selectChannel('bancolombia_ach')}
                  className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition ${
                    selectedChannel === 'bancolombia_ach'
                      ? 'border-terra bg-terra-pale/45 shadow-xs'
                      : 'border-line bg-paper/40 hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Building2 size={16} className="text-terra-dark" />
                    {selectedChannel === 'bancolombia_ach' && (
                      <CheckCircle2 size={15} className="text-terra-dark" />
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="text-[13px] font-bold text-ink">Débito ACH / Wompi</p>
                    <p className="mt-0.5 font-mono text-[11.5px] text-ink-muted">
                      Ahorros **** 4821
                    </p>
                  </div>
                </button>
              </div>

              <div className="rounded-2xl border border-line bg-paper/55 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink">
                      <Lock size={14} className="text-primary-dark" aria-hidden="true" />
                      <span>Tope máximo de seguridad autorizado por quincena</span>
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-muted">
                      CIFRA jamás podrá debitar por encima de este tope sin tu confirmación adicional por WhatsApp.
                    </p>
                  </div>
                  <select
                    value={safetyCapMinor}
                    disabled={isPending}
                    onChange={(e) => changeSafetyCap(Number(e.target.value))}
                    className="rounded-xl border border-line-strong bg-white px-3 py-1.5 font-mono text-[13px] font-bold text-ink"
                  >
                    <option value={80_000_00}>$80,000 / quincena</option>
                    <option value={150_000_00}>$150,000 / quincena</option>
                    <option value={300_000_00}>$300,000 / quincena</option>
                    <option value={500_000_00}>$500,000 / quincena</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold uppercase tracking-wider text-ink-muted">
                  1. Bolsa de saldo prepago de comisiones (5 %)
                </h3>
                <span className="rounded-full bg-primary-pale px-2.5 py-0.5 text-[11px] font-bold text-primary-dark">
                  Descuento en tiempo real al vender
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-line bg-paper/45 p-3.5">
                  <span className="text-[11px] font-semibold text-ink-muted">Cupo prepago cargado</span>
                  <p className="tnum mt-1 font-display text-[21px] font-extrabold text-ink">
                    {cop(prepaidBalanceMinor)}
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-paper/45 p-3.5">
                  <span className="text-[11px] font-semibold text-terra-dark">Usado en {salesCount} ventas</span>
                  <p className="tnum mt-1 font-display text-[21px] font-extrabold text-terra-dark">
                    -{cop(accumulatedCommissionMinor)}
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/30 bg-primary-pale/55 p-3.5">
                  <span className="text-[11px] font-bold text-primary-dark">Disponible hoy</span>
                  <p className="tnum mt-1 font-display text-[21px] font-extrabold text-primary-dark">
                    {cop(remainingPrepaidMinor)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-paper/55 p-3.5">
                <span className="text-[12.5px] font-semibold text-ink">
                  Recargar saldo prepago al instante:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[20_000_00, 50_000_00, 100_000_00].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      disabled={isPending}
                      onClick={() => handleTopUpPrepaid(amt)}
                      className="inline-flex items-center gap-1 rounded-xl border border-terra/40 bg-white px-2.5 py-1 text-[12px] font-bold text-terra-dark transition hover:bg-terra hover:text-white"
                    >
                      <PlusCircle size={12} aria-hidden="true" />
                      <span>+{cop(amt)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Columna Derecha: Ejecución Real del Corte Quincenal */}
          <div className="flex flex-col justify-between rounded-2xl border border-terra/30 bg-terra-pale/25 p-4 sm:p-5">
            {!settledState ? (
              <>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-terra-dark">
                      <CalendarClock size={13} aria-hidden="true" />
                      <span>Liquidación consolidada</span>
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-ink">
                      En {daysUntilCut} {daysUntilCut === 1 ? 'día' : 'días'} ({shortDate(cutDateIso)})
                    </span>
                  </div>

                  <p className="tnum mt-3 font-display text-[32px] font-extrabold leading-none text-ink">
                    {cop(accumulatedCommissionMinor)}
                  </p>
                  <p className="mt-1 text-[12.5px] text-ink-muted">
                    Consolidado de <strong>{salesCount} ventas verificadas</strong> en caja este corte ({cop(Math.round(accumulatedCommissionMinor / Math.max(1, salesCount)))} promedio por venta).
                  </p>

                  <div className="mt-3.5 space-y-1.5 rounded-xl bg-white/90 p-3 text-[12px] text-ink-soft">
                    <p className="flex items-center justify-between">
                      <span>Modalidad activa:</span>
                      <strong className="text-ink">
                        {collectionMethod === 'debito_automatico'
                          ? `Débito ${selectedChannel === 'breb' ? 'Bre-B' : selectedChannel === 'nequi' ? 'Nequi' : 'ACH'}`
                          : 'Bolsa Prepago Automática'}
                      </strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Intervención manual requerida:</span>
                      <strong className="text-primary-dark">0 comprobantes manuales</strong>
                    </p>
                  </div>
                </div>

                <button
                  id="btn-execute-cutoff-debit"
                  type="button"
                  disabled={isPending}
                  onClick={handleExecuteCutoffSettlement}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-terra px-4 py-3 text-[13.5px] font-bold text-white shadow-xs transition hover:bg-terra-dark"
                >
                  <CreditCard size={16} aria-hidden="true" />
                  <span>
                    {isPending ? 'Liquidando corte...' : 'Ejecutar liquidación automática del corte ahora'}
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </>
            ) : (
              <div className="flex h-full flex-col justify-between space-y-3 rounded-xl bg-emerald-50/90 p-4 text-emerald-950">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-emerald-700" aria-hidden="true" />
                    <span className="text-[12px] font-bold uppercase tracking-wider text-emerald-800">
                      Corte quincenal conciliado en base de datos
                    </span>
                  </div>
                  <h4 className="mt-2 font-display text-[19px] font-bold text-emerald-950">
                    {cop(settledAmountMinor ?? accumulatedCommissionMinor)} liquidados sin fricción
                  </h4>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-emerald-900">
                    El débito automático consolidado se registró en tu estado de cuenta oficial y se generó el paz y salvo quincenal de <strong>{merchantName}</strong>. Tus ofertas continúan activas en el mapa del barrio sin interrupción.
                  </p>
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-2.5 font-mono text-[11.5px] text-emerald-900">
                    Ref: {settledRef ?? `AUTODEB-${cutDateIso.replace(/-/g, '')}`} · Estado: CONCILIADO
                  </div>
                </div>

                <button
                  id="btn-reopen-cutoff-debit"
                  type="button"
                  disabled={isPending}
                  onClick={handleReopenCutoff}
                  className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-800 underline hover:text-emerald-950"
                >
                  <RefreshCw size={12} aria-hidden="true" />
                  <span>Reabrir corte para nueva operación</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
