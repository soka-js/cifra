'use client';

import {
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
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
  const [selectedChannel, setSelectedChannel] = useState<'nequi_auto' | 'ach_bancolombia' | 'breb_recurrente'>('nequi_auto');
  const [safetyCapMinor, setSafetyCapMinor] = useState<number>(150_000_00);
  const [prepaidBalanceMinor, setPrepaidBalanceMinor] = useState<number>(50_000_00);
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
    setTimeout(() => setSavedToast(null), 2600);
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
        : 'Activado: Bolsa prepago con descuento automático en tiempo real',
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
          ? 'Mandato de débito automático activado y verificado'
          : 'Mandato automático pausado (pasarás a pago manual al corte)',
      );
      return next;
    });
  }

  const discountedCommissionMinor = Math.round(accumulatedCommissionMinor * 0.9);
  const remainingPrepaidMinor = Math.max(0, prepaidBalanceMinor - discountedCommissionMinor);

  return (
    <section
      id="mandato-debito-automatico-b2b"
      className="surface-card overflow-hidden border-primary/30 p-5 sm:p-6"
      aria-label="Mandato de débito automático y garantía de recaudo quincenal"
    >
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-light text-primary-dark">
            <Zap size={22} aria-hidden="true" />
          </span>
          <div>
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
              Liquidación automática en 1 solo cobro al corte (sin pagos por cada venta)
            </h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
              Como el libro de códigos canjeados en Caja se actualiza en vivo ({salesCount}{' '}
              {salesCount === 1 ? 'venta registrada' : 'ventas registradas'} en este ciclo), CIFRA liquida el acumulado completo en una sola operación automática al corte del{' '}
              <strong className="text-ink">{shortDate(cutDateIso)}</strong>.
            </p>
          </div>
        </div>

        {/* Selector de modalidad automática */}
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

      {savedToast && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary-light px-3.5 py-2 text-[12.5px] font-bold text-primary-dark">
          <CheckCircle2 size={15} aria-hidden="true" />
          <span>{savedToast}</span>
        </div>
      )}

      {method === 'debito_quincenal' ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-12">
          {/* Estado en tiempo real del próximo débito */}
          <div className="rounded-2xl border border-line bg-paper p-4 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">
                Instrumento vinculado para el débito consolidado
              </span>
              <span className="tnum text-[12px] font-semibold text-primary-dark">
                Se ejecuta en {daysUntilCut} {daysUntilCut === 1 ? 'día' : 'días'} ({shortDate(cutDateIso)})
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedChannel('nequi_auto');
                  notify('Medio principal actualizado: Nequi Negocios');
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  selectedChannel === 'nequi_auto'
                    ? 'border-primary bg-white shadow-2xs'
                    : 'border-line bg-white/60 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 text-primary-dark">
                  <Smartphone size={14} aria-hidden="true" />
                  <span className="text-[12.5px] font-bold text-ink">Nequi Débito Auto</span>
                </div>
                <span className="mt-1 block font-mono text-[11.5px] text-ink-muted">
                  {merchantNequi || '310 452 1980'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedChannel('ach_bancolombia');
                  notify('Medio principal actualizado: Débito ACH Bancolombia');
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  selectedChannel === 'ach_bancolombia'
                    ? 'border-primary bg-white shadow-2xs'
                    : 'border-line bg-white/60 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 text-primary-dark">
                  <Building2 size={14} aria-hidden="true" />
                  <span className="text-[12.5px] font-bold text-ink">ACH Bancolombia</span>
                </div>
                <span className="mt-1 block font-mono text-[11.5px] text-ink-muted">
                  Ahorros ····8821
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedChannel('breb_recurrente');
                  notify('Medio principal actualizado: Llave Bre-B Comercios');
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  selectedChannel === 'breb_recurrente'
                    ? 'border-primary bg-white shadow-2xs'
                    : 'border-line bg-white/60 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 text-primary-dark">
                  <CreditCard size={14} aria-hidden="true" />
                  <span className="text-[12.5px] font-bold text-ink">Llave Bre-B</span>
                </div>
                <span className="mt-1 block truncate font-mono text-[11.5px] text-ink-muted">
                  {merchantBrebKey || '@laespiga.chapinero'}
                </span>
              </button>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[12.5px]">
              <span className="text-ink-muted">
                Tope máximo de seguridad autorizado por quincena:
              </span>
              <div className="tnum inline-flex gap-1.5 font-semibold">
                {[100_000_00, 150_000_00, 300_000_00].map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => {
                      setSafetyCapMinor(cap);
                      notify(`Tope de seguridad ajustado a ${cop(cap)}`);
                    }}
                    className={`rounded-lg border px-2 py-0.5 text-[11.5px] transition ${
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

          {/* Resumen de ejecución programada */}
          <div className="flex flex-col justify-between rounded-2xl border border-primary/25 bg-primary-pale/55 p-4 lg:col-span-5">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] font-bold uppercase tracking-wider text-primary-dark">
                  Próximo cobro consolidado
                </span>
                <Clock size={15} className="text-primary-dark" aria-hidden="true" />
              </div>
              <p className="tnum mt-1.5 font-display text-[30px] font-extrabold leading-none text-ink">
                {cop(accumulatedCommissionMinor)}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-snug text-ink-soft">
                Conciliado en tiempo real sobre <strong>{salesCount} ventas</strong> verificadas en Caja de {merchantName}. Recibirás pre-aviso por WhatsApp 24 h antes del {shortDate(cutDateIso)}.
              </p>
            </div>

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
              Mantén un saldo a favor en tu cuenta de comercio y cada vez que valides un código en Caja, la comisión se descuenta sola de tu bolsa con un <strong>10 % de descuento</strong>. Te olvidas por completo de facturas a fin de quincena.
            </p>

            <div className="tnum mt-3.5 flex flex-wrap gap-2">
              {[50_000_00, 100_000_00, 200_000_00].map((topup) => (
                <button
                  key={topup}
                  type="button"
                  onClick={() => {
                    setPrepaidBalanceMinor(topup);
                    notify(`Bolsa simulada recargada a ${cop(topup)} por PSE / Bre-B`);
                  }}
                  className={`rounded-xl border px-3.5 py-2 text-[12.5px] font-bold transition ${
                    prepaidBalanceMinor === topup
                      ? 'border-primary bg-primary-pale text-primary-dark'
                      : 'border-line bg-white text-ink hover:border-ink'
                  }`}
                >
                  Recargar {cop(topup)}
                </button>
              ))}
            </div>
          </div>

          <div className="tnum flex flex-col justify-between rounded-2xl border border-primary/25 bg-primary-pale/55 p-4 lg:col-span-5">
            <div className="space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-ink-muted">Cupo prepago cargado:</span>
                <span className="font-bold text-ink">{cop(prepaidBalanceMinor)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Comisión del ciclo (con -10 %):</span>
                <span className="font-bold text-primary-dark">-{cop(discountedCommissionMinor)}</span>
              </div>
              <div className="flex justify-between border-t border-primary/20 pt-2 text-[15px] font-extrabold text-ink">
                <span>Saldo disponible para siguientes ventas:</span>
                <span className="text-primary-dark">{cop(remainingPrepaidMinor)}</span>
              </div>
            </div>

            <p className="mt-3 text-[11.5px] text-ink-soft">
              Ahorraste <strong>{cop(accumulatedCommissionMinor - discountedCommissionMinor)}</strong> en comisiones este ciclo gracias al modo prepago automático.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
