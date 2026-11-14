import {
  CheckCircle2,
  Clock,
  Receipt,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { requireMerchantAccess } from '@/lib/auth/session';
import { bogotaDate } from '@/lib/data';
import { COMMISSION_POLICY } from '@/lib/engine/commission-cycle';
import { cop, percentFromBps, shortDate } from '@/lib/format';
import {
  formatPeriodMonth,
  generateBrebQrSvg,
  loadMerchantDashboard,
} from '@/lib/merchant-data';
import { checkoutUrl } from '@/lib/payments/wompi';
import { PaymentReportForm } from './payment-form';
import { siteUrl as publicSiteUrl } from '@/lib/site';

export const metadata = { title: 'Corte de comisiones y facturación · Negocio CIFRA' };

export default async function MerchantBillingPage() {
  const access = await requireMerchantAccess();
  const data = await loadMerchantDashboard(access.merchant);

  // Los canales de pago salen SOLO de la configuración. Si no están, no se muestra ninguno:
  // un número de relleno aquí haría que un negocio le transfiera plata a un desconocido.
  const cifraBrebKey = process.env.CIFRA_BREB_KEY?.trim() || null;
  const cifraNequi = process.env.CIFRA_NEQUI_NUMBER?.trim() || null;
  const hasPaymentChannel = Boolean(cifraBrebKey || cifraNequi);
  const brebQrSvg = cifraBrebKey ? await generateBrebQrSvg(cifraBrebKey) : null;

  const { billingHealth, cycleSummary } = data;
  // La comisión de este negocio, tal como está guardada; no se supone un 5 %.
  const commissionLabel = percentFromBps(access.merchant.commissionBps);

  const payableInvoice = data.invoices.find(
    (inv) =>
      inv.commissionTotalMinor > 0 &&
      (inv.status === 'abierta' || inv.status === 'pendiente_pago'),
  );

  // Pago en línea solo con las dos llaves de Wompi: la pública abre el pago y la de integridad
  // firma el monto, para que nadie pueda cambiarlo en la dirección y pagar menos.
  const wompiPublicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY?.trim();
  const wompiIntegritySecret = process.env.WOMPI_INTEGRITY_SECRET?.trim();
  const wompiUrl =
    payableInvoice && wompiPublicKey && wompiIntegritySecret
      ? checkoutUrl({
          publicKey: wompiPublicKey,
          integritySecret: wompiIntegritySecret,
          invoiceId: payableInvoice.id,
          amountInCents: payableInvoice.commissionTotalMinor,
          redirectUrl: `${publicSiteUrl()}/negocio/cuenta`,
        })
      : null;

  return (
    <div className="space-y-6">

      {/* Cabecera principal */}
      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink">Tu cuenta con CIFRA</h1>
        <p className="mt-1 text-[15px] font-medium text-ink">Comisión del {commissionLabel}, solo sobre lo que cobraste con código.</p>
      </div>

      {/* Alerta de Salud Financiera y Estado del Corte */}
      {billingHealth.status === 'en_mora' && (
        <section className="rounded-2xl border border-red-300 bg-red-50 p-5 text-red-950 sm:p-6">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <ShieldAlert size={24} aria-hidden="true" />
            </span>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-red-200 px-3 py-0.5 text-[12px] font-bold uppercase tracking-wider text-red-900">
                  Corte vencido · Pausa preventiva de ofertas
                </span>
              </div>
              <h2 className="font-display text-[20px] font-bold text-red-950">
                Saldo pendiente en mora: {cop(billingHealth.overdueAmountMinor)}
              </h2>
              <p className="text-[14px] text-red-800">
                {billingHealth.lockReason}
              </p>
            </div>
          </div>
        </section>
      )}

      {billingHealth.status === 'pendiente_pago' && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 sm:p-6">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <Clock size={24} aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-200 px-3 py-0.5 text-[12px] font-bold uppercase tracking-wider text-amber-900">
                  Corte por liquidar · {billingHealth.graceDaysRemaining} días de gracia restantes
                </span>
              </div>
              <h2 className="font-display text-[20px] font-bold text-amber-950">
                Comisión acumulada a liquidar: {cop(billingHealth.pendingAmountMinor)}
              </h2>
              <p className="text-[14px] text-amber-800">
                Tienes plazo de gracia hasta el <strong>{shortDate(billingHealth.activeCycle.graceDueDate)}</strong> para pagar y reportar el comprobante sin que se pausen tus ofertas.
              </p>
            </div>
          </div>
        </section>
      )}

      {billingHealth.status === 'en_verificacion' && (
        <section className="rounded-2xl border border-sky-300 bg-sky-50 p-5 text-sky-950 sm:p-6">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800">
              <Clock size={24} aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <span className="rounded-full bg-sky-200 px-3 py-0.5 text-[12px] font-bold uppercase tracking-wider text-sky-900">
                Comprobante en verificación
              </span>
              <h2 className="font-display text-[20px] font-bold text-sky-950">
                Estamos revisando tu comprobante
              </h2>
              <p className="text-[14px] text-sky-800">
                Recibimos tu reporte. Mientras lo revisamos, tus ofertas siguen encendidas.
              </p>
            </div>
          </div>
        </section>
      )}

      {billingHealth.status === 'al_dia' && (
        <p className="flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50/70 px-4 py-3 text-[14px] text-emerald-900">
          <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />
          <span>
            <strong>Estás al día.</strong> Próximo corte: {shortDate(billingHealth.activeCycle.cutDate)} ({billingHealth.activeCycle.daysUntilCut}{' '}
            {billingHealth.activeCycle.daysUntilCut === 1 ? 'día' : 'días'}).
          </span>
        </p>
      )}

      {/* La quincena en curso, como una resta: de lo vendido a lo que le queda al tendero. */}
      <section className="surface-card p-5 sm:p-6" aria-labelledby="quincena">
        <h2 id="quincena" className="font-display text-[20px] font-bold text-ink">Esta quincena</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {billingHealth.activeCycle.label}. Cierra el {shortDate(billingHealth.activeCycle.cutDate)}.
        </p>
        <dl className="tnum mt-4 space-y-3 text-[15px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt>
              <span className="font-medium text-ink">Ventas con código CIFRA</span>
              <span className="block text-[12.5px] text-ink-faint">
                {cycleSummary.salesCount} {cycleSummary.salesCount === 1 ? 'venta' : 'ventas'}, a precio sin descuento
              </span>
            </dt>
            <dd className="shrink-0 font-semibold text-ink">{cop(cycleSummary.grossSalesMinor)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-medium text-ink">Descuentos que diste</dt>
            <dd className="shrink-0 font-semibold text-ink">− {cop(cycleSummary.discountsGrantedMinor)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-medium text-ink">Cobraste en tu caja</dt>
            <dd className="shrink-0 font-semibold text-ink">{cop(cycleSummary.collectedInCashMinor)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt>
              <span className="font-medium text-ink">Comisión CIFRA ({commissionLabel})</span>
              <span className="block text-[12.5px] text-ink-faint">Se paga después del corte, no venta por venta</span>
            </dt>
            <dd className="shrink-0 font-semibold text-terra-dark">− {cop(cycleSummary.accumulatedCommissionMinor)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-line-strong pt-3 text-[16px] font-bold text-primary-dark">
            <dt>= Lo que te queda</dt>
            <dd>{cop(cycleSummary.merchantNetKeepMinor)}</dd>
          </div>
        </dl>
      </section>

      {/* Cómo funciona el cobro de la comisión */}
      <section className="rounded-2xl border border-line bg-paper p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary-dark">
            <ShieldCheck size={24} aria-hidden="true" />
          </span>
          <div className="space-y-1.5 text-[14px]">
            <h3 className="font-display text-[17px] font-bold text-ink">
              Un solo cobro por quincena, no uno por venta
            </h3>
            <p className="text-ink-soft">
              {COMMISSION_POLICY.guaranteeText}
            </p>
            <p className="text-[13px] text-ink-faint">
              {COMMISSION_POLICY.delinquencyRule}
            </p>
          </div>
        </div>
      </section>

      {/* Cómo pagar la comisión y formulario para reportar el pago */}
      <section className="surface-card p-5 sm:p-6">
        {hasPaymentChannel ? (
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            {brebQrSvg && (
              <div
                className="shrink-0 overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-sm"
                dangerouslySetInnerHTML={{ __html: brebQrSvg }}
              />
            )}
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wider text-primary-dark">
                <ShieldCheck size={15} aria-hidden="true" />
                Dónde pagar la comisión
              </p>
              <h2 className="font-display text-[20px] font-bold text-ink">Paga tu corte por transferencia</h2>
              <div className="flex flex-wrap gap-3 pt-1 text-[14px]">
                {cifraBrebKey && (
                  <span className="rounded-xl border border-line bg-paper px-3.5 py-2">
                    Llave Bre-B: <strong className="font-mono text-ink">{cifraBrebKey}</strong>
                  </span>
                )}
                {cifraNequi && (
                  <span className="rounded-xl border border-line bg-paper px-3.5 py-2">
                    Nequi: <strong className="font-mono text-ink">{cifraNequi}</strong>
                  </span>
                )}
              </div>
              <p className="text-[13px] text-ink-muted">
                Transfiere el valor exacto de tu corte y reporta el comprobante abajo. Nuestro equipo lo revisa y marca
                el corte como pagado.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 text-[14px] text-ink-muted">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
            <p>
              Todavía no hay un canal de pago publicado. Cuando tengas un corte por pagar, el equipo de CIFRA te escribe
              al WhatsApp del negocio con los datos. No le transfieras a ningún número que no aparezca en esta pantalla.
            </p>
          </div>
        )}

        {payableInvoice && (
          <div className="mt-5 border-t border-line pt-5">
            <PaymentReportForm
              invoiceId={payableInvoice.id}
              periodLabel={formatPeriodMonth(payableInvoice.periodMonth)}
              amountMinor={payableInvoice.commissionTotalMinor}
              wompiUrl={wompiUrl}
            />
          </div>
        )}
      </section>

      {/* Historial de estados de cuenta y cortes */}
      <section className="space-y-3">
        <h2 className="font-display text-[20px] font-bold text-ink">Cortes anteriores</h2>

        {data.invoices.length === 0 ? (
          <div className="surface-card flex items-center gap-3 p-5 text-[14px] text-ink-muted">
            <Receipt size={19} className="shrink-0 text-terra" aria-hidden="true" />
            <span>
              Todavía no hay cortes. El primero se abre cuando cobres tu primera venta con código en la Caja.
            </span>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.invoices.map((inv) => {
              const statusBadge =
                inv.status === 'pagada' ? (
                  <span className="badge-primary">
                    <CheckCircle2 size={12} aria-hidden="true" />
                    Pagada
                  </span>
                ) : inv.status === 'en_verificacion' ? (
                  <span className="badge-warn">
                    <Clock size={12} aria-hidden="true" />
                    En verificación
                  </span>
                ) : (
                  <span className="badge-terra">
                    Abierta ({inv.status === 'abierta' ? 'en curso' : 'pendiente'})
                  </span>
                );

              return (
                <li key={inv.id} className="surface-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-[19px] font-bold first-letter:uppercase text-ink">
                          {formatPeriodMonth(inv.periodMonth)}
                        </h3>
                        {statusBadge}
                      </div>
                      <p className="mt-1 text-[13px] text-ink-muted">
                        {inv.redemptionsCount} {inv.redemptionsCount === 1 ? 'venta atribuida' : 'ventas atribuidas'} · Cobrado en tu caja:{' '}
                        <strong className="tnum text-ink">{cop(inv.netSalesMinor)}</strong>
                        {inv.dueOn ? ` · Fecha límite de pago: ${shortDate(inv.dueOn)}` : ''}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
                        Comisión CIFRA
                      </p>
                      <p className="tnum font-display text-[24px] font-bold text-ink">
                        {cop(inv.commissionTotalMinor)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Historial de comprobantes de pago enviados */}
      {data.payments.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-[18px] font-bold text-ink">Pagos que reportaste</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {data.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-[13.5px]">
                <div>
                  <span className="font-semibold uppercase text-ink">{p.method}</span> · Ref.{' '}
                  <span className="font-mono text-ink-soft">{p.reference}</span>
                  <span className="ml-2 text-ink-faint">({shortDate(bogotaDate(p.createdAt))})</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="tnum font-bold text-ink">{cop(p.amountMinor)}</span>
                  <span
                    className={
                      p.status === 'aprobado'
                        ? 'badge-primary'
                        : p.status === 'rechazado'
                          ? 'badge-neg'
                          : 'badge-warn'
                    }
                  >
                    {p.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
