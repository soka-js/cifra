'use client';

import {
  Building2,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cop, shortDate } from '@/lib/format';

interface AutoDebitMandateCardProps {
  merchantName: string;
  merchantNequi: string | null;
  merchantBrebKey: string | null;
  accumulatedCommissionMinor: number;
  cutDateIso: string;
  daysUntilCut: number;
  salesCount: number;
}

type CollectionMethod = 'debito_quincenal' | 'bolsa_prepago';
type ChannelId = 'nequi_auto' | 'ach_bancolombia' | 'breb_recurrente';

export function AutoDebitMandateCard({
  merchantName,
  merchantNequi,
  merchantBrebKey,
  accumulatedCommissionMinor,
  cutDateIso,
  daysUntilCut,
  salesCount,
}: AutoDebitMandateCardProps) {
  const [method, setMethod] = useState<CollectionMethod>('debito_quincenal');
  const [mandateActive, setMandateActive] = useState<boolean>(true);
  const [selectedChannel, setSelectedChannel] = useState<ChannelId>('nequi_auto');
  const [safetyCapMinor, setSafetyCapMinor] = useState<number>(150_000_00);
  const [prepaidBalanceMinor, setPrepaidBalanceMinor] = useState<number>(50_000_00);
  const [simulatedSettled, setSimulatedSettled] = useState<boolean>(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const m = localStorage.getItem('cifra_merchant_collection_method');
      if (m === 'debito_quincenal' || m === 'bolsa_prepago') setMethod(m);
      const act = localStorage.getItem('cifra_merchant_mandate_active');
      if (act !== null) setMandateActive(act === 'true');
    } catch {
      // Ignorar
    }
  }, []);

  function notify(msg: string) {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 2800);
  }

  function handleSelectMethod(next: CollectionMethod) {
    setMethod(next);
    try {
      localStorage.setItem('cifra_merchant_collection_method', next);
    } catch {
      // Ignorar
    }
    notify(
      next === 'debito_quincenal'
        ? 'Activado: Débito automático consolidado al cierre de quincena'
        : 'Activado: Bolsa prepago con descuento automático del 10 % en comisión',
    );
  }

  function handleToggleMandate() {
    setMandateActive((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cifra_merchant_mandate_active', String(next));
      } catch {
        // Ignorar
      }
      notify(
        next
          ? 'Mandato de débito automático activado y respaldado'
          : 'Mandato automático pausado (pasarás a reporte manual al corte)',
      );
      return next;
    });
  }

  const channels: Array<{
    id: ChannelId;
    title: string;
    subtitle: string;
    detail: string;
    icon: typeof Smartphone;
  }> = [
    {
      id: 'nequi_auto',
      title: 'Nequi Negocios',
      subtitle: 'Débito automático sin costo',
      detail: merchantNequi || '310 555 0192',
      icon: Smartphone,
    },
    {
      id: 'ach_bancolombia',
      title: 'Bancolombia ACH',
      subtitle: 'Débito cuenta empresarial',
      detail: 'Ahorros ····8821',
      icon: Building2,
    },
    {
      id: 'breb_recurrente',
      title: 'Llave Bre-B',
      subtitle: 'Riel Banco de la República',
      detail: merchantBrebKey || '@laespiga58',
      icon: CreditCard,
    },
  ];

  const activeChannelObj = channels.find((c) => c.id === selectedChannel) ?? channels[0]!;
  const discountedCommissionMinor = Math.round(accumulatedCommissionMinor * 0.9);
  const remainingPrepaidMinor = Math.max(0, prepaidBalanceMinor - discountedCommissionMinor);
  const prepaidUsedPct = Math.min(
    100,
    Math.max(4, Math.round((discountedCommissionMinor / Math.max(1, prepaidBalanceMinor)) * 100)),
  );

  return (
    <section
      id="mandato-debito-automatico-b2b"
      className="surface-card scroll-mt-20 overflow-hidden border-primary/30 p-5 sm:p-6"
      aria-label="Mandato de débito automático y garantía de recaudo quincenal"
    >
      {/* Cabecera de ancho completo + Selector de modalidad */}
      <div className="space-y-3.5 border-b border-line pb-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-light text-primary-dark">
            <Zap size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge-primary">
                <ShieldCheck size={12} aria-hidden="true" /> Garantía de Recaudo Automático · Cero fricción
              </span>
              {mandateActive ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11.5px] font-bold text-emerald-900">
                  ● Mandato activo y respaldado
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11.5px] font-bold text-amber-900">
                  Modo manual al corte
                </span>
              )}
            </div>
            <h2 className="mt-1.5 font-display text-[20px] font-bold text-ink">
              Liquidación automática en 1 solo cobro al corte (sin micro-pagos por venta)
            </h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
              Como el libro de códigos canjeados en Caja se concilia en tiempo real ({salesCount}{' '}
              {salesCount === 1 ? 'venta registrada' : 'ventas registradas'} en este ciclo), CIFRA ejecuta el cobro acumulado en una sola operación el{' '}
              <strong className="text-ink">{shortDate(cutDateIso)}</strong>.
            </p>
          </div>
        </div>

        {/* Selector de modalidad automática */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">
            Modalidad de recaudo elegida por tu comercio:
          </span>
          <div className="inline-flex rounded-xl border border-line bg-paper p-1 text-[12px] font-bold">
            <button
              id="btn-mode-debito-quincenal"
              type="button"
              onClick={() => handleSelectMethod('debito_quincenal')}
              className={`rounded-lg px-3 py-1.5 transition ${
                method === 'debito_quincenal'
                  ? 'bg-ink text-white shadow-2xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Débito automático al corte
            </button>
            <button
              id="btn-mode-bolsa-prepago"
              type="button"
              onClick={() => handleSelectMethod('bolsa_prepago')}
              className={`rounded-lg px-3 py-1.5 transition ${
                method === 'bolsa_prepago'
                  ? 'bg-ink text-white shadow-2xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Bolsa prepago (-10 % comisión)
            </button>
          </div>
        </div>
      </div>

      {savedToast && (
        <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-primary-light px-3.5 py-2 text-[12.5px] font-bold text-primary-dark">
          <CheckCircle2 size={15} aria-hidden="true" />
          <span>{savedToast}</span>
        </div>
      )}

      {method === 'debito_quincenal' ? (
        <div className="mt-5 grid items-stretch gap-4 lg:grid-cols-12">
          {/* Columna Izquierda: Selector limpio de canal vinculado (filas horizontales sin texto partido) */}
          <div className="flex flex-col justify-between rounded-2xl border border-line bg-paper p-4 lg:col-span-7">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11.5px] font-bold uppercase tracking-wider text-ink-faint">
                  Instrumento vinculado para el débito consolidado
                </span>
                <span className="tnum rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-bold text-primary-dark border border-line">
                  Corte en {daysUntilCut} {daysUntilCut === 1 ? 'día' : 'días'} ({shortDate(cutDateIso)})
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {channels.map((ch) => {
                  const Icon = ch.icon;
                  const active = selectedChannel === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => {
                        setSelectedChannel(ch.id);
                        notify(`Canal principal actualizado: ${ch.title}`);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                        active
                          ? 'border-primary bg-white shadow-2xs'
                          : 'border-line bg-white/65 hover:border-line-strong hover:bg-white'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                            active
                              ? 'bg-primary text-white'
                              : 'bg-paper text-ink-muted'
                          }`}
                        >
                          <Icon size={17} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <span className="block truncate font-display text-[13.5px] font-bold text-ink">
                            {ch.title}
                          </span>
                          <span className="block truncate text-[11.5px] text-ink-muted">
                            {ch.subtitle}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2.5">
                        <span className="rounded-lg bg-paper px-2.5 py-1 font-mono text-[11.5px] font-bold text-ink">
                          {ch.detail}
                        </span>
                        <span
                          className={`grid h-5 w-5 place-items-center rounded-full border ${
                            active
                              ? 'border-primary bg-primary text-white'
                              : 'border-line-strong bg-white'
                          }`}
                        >
                          {active && <Check size={12} aria-hidden="true" />}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[12px]">
              <span className="font-medium text-ink-muted">
                Tope máximo de seguridad autorizado por quincena:
              </span>
              <div className="tnum inline-flex gap-1.5 font-bold">
                {[100_000_00, 150_000_00, 300_000_00].map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => {
                      setSafetyCapMinor(cap);
                      notify(`Tope máximo por quincena ajustado a ${cop(cap)}`);
                    }}
                    className={`rounded-lg border px-2.5 py-1 text-[11.5px] transition ${
                      safetyCapMinor === cap
                        ? 'border-ink bg-ink text-white'
                        : 'border-line bg-white text-ink-muted hover:text-ink'
                    }`}
                  >
                    {cop(cap)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Resumen de ejecución programada + Simulador de Cierre en 1 Clic */}
          <div className="flex flex-col justify-between rounded-2xl border border-primary/25 bg-primary-pale/55 p-4 lg:col-span-5">
            {!simulatedSettled ? (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-bold uppercase tracking-wider text-primary-dark">
                    Próximo cobro consolidado
                  </span>
                  <Clock size={15} className="text-primary-dark" aria-hidden="true" />
                </div>
                <p className="tnum mt-1.5 font-display text-[32px] font-extrabold leading-none text-ink">
                  {cop(accumulatedCommissionMinor)}
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
                  Conciliado en tiempo real sobre <strong>{salesCount} ventas</strong> verificadas en Caja de {merchantName} vía{' '}
                  <strong className="text-ink">{activeChannelObj.title.split('·')[0]}</strong>. Recibirás pre-aviso por WhatsApp 24 h antes del {shortDate(cutDateIso)}.
                </p>

                <button
                  id="btn-simulate-cutoff-debit"
                  type="button"
                  onClick={() => {
                    setSimulatedSettled(true);
                    notify(
                      `Débito automático #AUTODEB-20261115 por ${cop(accumulatedCommissionMinor)} ejecutado con éxito`,
                    );
                  }}
                  className="mt-3.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-3.5 py-2.5 text-[12.5px] font-bold text-white shadow-2xs transition hover:bg-ink/90"
                >
                  <Play size={13} aria-hidden="true" />
                  <span>Simular ejecución automática del corte</span>
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900">
                    <CheckCircle2 size={12} aria-hidden="true" /> Corte liquidado automáticamente
                  </span>
                  <span className="font-mono text-[11px] font-bold text-primary-dark">
                    #AUTODEB-20261115
                  </span>
                </div>
                <p className="tnum mt-2 font-display text-[28px] font-extrabold leading-none text-primary-dark">
                  $0 pendiente
                </p>
                <div className="tnum mt-2.5 space-y-1 rounded-xl bg-white/85 p-3 text-[12px] text-ink-soft">
                  <div className="flex justify-between">
                    <span>Débito ejecutado ({salesCount} ventas):</span>
                    <strong className="text-ink">{cop(accumulatedCommissionMinor)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Medio utilizado:</span>
                    <strong className="text-ink">{activeChannelObj.detail}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Estado del comercio:</span>
                    <strong className="text-primary-dark">Al día · Paz y salvo emitido</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSimulatedSettled(false)}
                  className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-bold text-ink-muted underline hover:text-ink"
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  <span>Restaurar vista previa al corte</span>
                </button>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 pt-3">
              <button
                id="btn-toggle-mandate"
                type="button"
                onClick={handleToggleMandate}
                className="text-[12px] font-bold text-primary-dark underline underline-offset-2 hover:text-ink"
              >
                {mandateActive ? 'Pausar débito automático' : 'Reactivar débito automático'}
              </button>
              <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-primary-dark shadow-2xs">
                0 cobros micro por venta
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Modo 2: Bolsa Prepago de Comisiones (Comisión reducida del 5% al 4.5%) */
        <div className="mt-5 grid gap-4 lg:grid-cols-12">
          <div className="rounded-2xl border border-line bg-paper p-4 lg:col-span-7">
            <span className="badge-terra">
              <Sparkles size={11} aria-hidden="true" /> Beneficio pronto pago: Comisión baja de 5.0 % a 4.5 %
            </span>
            <h3 className="mt-2 font-display text-[17px] font-bold text-ink">
              Bolsa prepago con descuento automático en tiempo real
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              Mantén saldo prepagado en tu cuenta comercial y cada vez que valides un código en Caja, la comisión se descuenta sola de tu bolsa con un <strong>10 % de descuento</strong>. Cero facturas a fin de quincena y 100 % de continuidad garantizada.
            </p>

            <div className="tnum mt-3.5 flex flex-wrap gap-2">
              {[50_000_00, 100_000_00, 200_000_00].map((topup) => (
                <button
                  key={topup}
                  type="button"
                  onClick={() => {
                    setPrepaidBalanceMinor(topup);
                    notify(`Bolsa prepago recargada a ${cop(topup)} por PSE / Bre-B`);
                  }}
                  className={`rounded-xl border px-3.5 py-2 text-[12.5px] font-bold transition ${
                    prepaidBalanceMinor === topup
                      ? 'border-primary bg-primary-pale text-primary-dark shadow-2xs'
                      : 'border-line bg-white text-ink hover:border-ink'
                  }`}
                >
                  Cupo {cop(topup)}
                </button>
              ))}
            </div>
          </div>

          <div className="tnum flex flex-col justify-between rounded-2xl border border-primary/25 bg-primary-pale/55 p-4 lg:col-span-5">
            <div>
              <div className="flex items-center justify-between text-[12px] font-bold uppercase tracking-wider text-primary-dark">
                <span>Estado de tu bolsa prepago</span>
                <span>{100 - prepaidUsedPct}% libre</span>
              </div>

              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${100 - prepaidUsedPct}%` }}
                />
              </div>

              <div className="mt-3 space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Cupo prepago cargado:</span>
                  <span className="font-bold text-ink">{cop(prepaidBalanceMinor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Comisión consumida (4.5 %):</span>
                  <span className="font-bold text-primary-dark">
                    -{cop(discountedCommissionMinor)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-primary/20 pt-2 text-[15px] font-extrabold text-ink">
                  <span>Saldo disponible hoy:</span>
                  <span className="text-primary-dark">{cop(remainingPrepaidMinor)}</span>
                </div>
              </div>
            </div>

            <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-[11.5px] text-ink-soft">
              Ahorraste <strong>{cop(accumulatedCommissionMinor - discountedCommissionMinor)}</strong> en este corte frente a la tarifa estándar del 5.0 %.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
