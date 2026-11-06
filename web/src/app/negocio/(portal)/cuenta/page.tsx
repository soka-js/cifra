import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { BackButton } from '@/components/ui/back-button';
import { requireMerchantAccess } from '@/lib/auth/session';
import { bogotaDate } from '@/lib/data';
import { COMMISSION_POLICY } from '@/lib/engine/commission-cycle';
import { cop, shortDate } from '@/lib/format';
import {
  formatPeriodMonth,
  generateBrebQrSvg,
  loadMerchantDashboard,
} from '@/lib/merchant-data';
import { PaymentReportForm } from './payment-form';

export const metadata = { title: 'Corte de comisiones y facturación · Negocio CIFRA' };

export default async function MerchantBillingPage() {
  const access = await requireMerchantAccess();
  const data = await loadMerchantDashboard(access.merchant);

  const cifraBrebKey = process.env.CIFRA_BREB_KEY ?? '@cifrapagos';
  const cifraNequi = process.env.CIFRA_NEQUI_NUMBER ?? '300 555 0199';
  const wompiPublicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || undefined;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const brebQrSvg = await generateBrebQrSvg(cifraBrebKey);

  const { billingHealth, cycleSummary } = data;

  const payableInvoice = data.invoices.find(
    (inv) =>
      inv.commissionTotalMinor > 0 &&
      (inv.status === 'abierta' || inv.status === 'pendiente_pago'),
  );

  return (
    <div className="space-y-6">
      <BackButton href="/negocio" label="Volver a Inicio de Negocio" className="mb-2" />

      {/* Cabecera principal */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge-terra">Corte consolidado quincenal</span>
          <span className="badge-neutral">Comisión 5 % solo sobre venta cobrada</span>
        </div>
        <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink">
          Corte de comisiones y facturación
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          Tranquilidad operativa total: Olvídate de hacer pagos micro cliente por cliente ($900 cada vez). CIFRA consolida tus ventas en cortes quincenales claros con 5 días de gracia para liquidar por Bre-B, Nequi o débito automático.
        </p>
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
                Tienes plazo de gracia hasta el <strong>{shortDate(billingHealth.activeCycle.graceDueDate)}</strong> para enviar el comprobante o pagar por Bre-B / Nequi sin interrumpir tus campañas activas.
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
                Estamos conciliando tu comprobante de liquidación
              </h2>
              <p className="text-[14px] text-sky-800">
                Tu reporte fue recibido. Mientras nuestro equipo administrativo valida la transferencia, tus ofertas continúan encendidas con total normalidad.
              </p>
            </div>
          </div>
        </section>
      )}

      {billingHealth.status === 'al_dia' && (
        <section className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-5 text-emerald-950 sm:p-6">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <CheckCircle2 size={24} aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-200 px-3 py-0.5 text-[12px] font-bold uppercase tracking-wider text-emerald-900">
                  Al día · Corte en curso
                </span>
                <span className="text-[13px] text-emerald-800">
                  Próximo corte: <strong>{shortDate(billingHealth.activeCycle.cutDate)}</strong> ({billingHealth.activeCycle.daysUntilCut} días)
                </span>
              </div>
              <h2 className="font-display text-[20px] font-bold text-emerald-950">
                {billingHealth.activeCycle.label}
              </h2>
              <p className="text-[14px] text-emerald-800">
                No tienes cobros pendientes de ciclos anteriores. Las comisiones del 5 % de este periodo se acumulan automáticamente y se liquidan consolidadas al final de la quincena.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Resumen numérico del corte actual (con comas y diseño financiero) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[20px] font-bold text-ink">
            Acumulado del corte activo ({billingHealth.activeCycle.label})
          </h2>
          <span className="text-[13px] text-ink-muted">
            Cierre de corte: {shortDate(billingHealth.activeCycle.cutDate)}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="surface-card p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
              <Receipt size={14} aria-hidden="true" />
              Ventas con CIFRA
            </p>
            <p className="tnum mt-1.5 font-display text-[24px] font-bold text-ink">
              {cop(cycleSummary.grossSalesMinor)}
            </p>
            <p className="mt-1 text-[12.5px] text-ink-soft">
              {cycleSummary.salesCount} {cycleSummary.salesCount === 1 ? 'pedido atendido' : 'pedidos atendidos'}
            </p>
          </div>

          <div className="surface-card p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-terra-dark">
              <Coins size={14} aria-hidden="true" />
              Descuentos clientes
            </p>
            <p className="tnum mt-1.5 font-display text-[24px] font-bold text-terra-dark">
              {cop(cycleSummary.discountsGrantedMinor)}
            </p>
            <p className="mt-1 text-[12.5px] text-ink-soft">
              Inversión en atraer clientes
            </p>
          </div>

          <div className="surface-card p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
              <Wallet size={14} aria-hidden="true" />
              Cobrado en tu caja
            </p>
            <p className="tnum mt-1.5 font-display text-[24px] font-bold text-ink">
              {cop(cycleSummary.collectedInCashMinor)}
            </p>
            <p className="mt-1 text-[12.5px] text-ink-soft">
              Entró a tu caja / Nequi
            </p>
          </div>

          <div className="surface-card border-terra/30 bg-terra-pale/40 p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-terra-dark">
              <TrendingUp size={14} aria-hidden="true" />
              Comisión CIFRA (5 %)
            </p>
            <p className="tnum mt-1.5 font-display text-[26px] font-bold text-terra-dark">
              {cop(cycleSummary.accumulatedCommissionMinor)}
            </p>
            <p className="mt-1 text-[12.5px] text-ink-soft">
              A liquidar tras el corte del {shortDate(billingHealth.activeCycle.cutDate)}
            </p>
          </div>
        </div>

        {/* Franja de plata neta libre retenida por el tendero */}
        <div className="rounded-2xl border border-primary/25 bg-primary-pale/80 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-primary-dark">
                Rentabilidad neta retenida por tu negocio
              </p>
              <p className="mt-0.5 text-[14px] text-ink-soft">
                El 95 % del dinero cobrado permanece 100 % en tus manos:
              </p>
            </div>
            <p className="tnum font-display text-[32px] font-bold text-primary-dark sm:text-right">
              {cop(cycleSummary.merchantNetKeepMinor)}
            </p>
          </div>
        </div>
      </section>

      {/* Banner de Garantía Operativa de Karol Benavides */}
      <section className="rounded-2xl border border-line bg-paper p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary-dark">
            <ShieldCheck size={24} aria-hidden="true" />
          </span>
          <div className="space-y-1.5 text-[14px]">
            <h3 className="font-display text-[17px] font-bold text-ink">
              Garantía operativa: cero cobros micro por venta individual
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

      {/* Datos oficiales de recaudo y formulario de liquidación */}
      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div
            className="shrink-0 overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-sm"
            dangerouslySetInnerHTML={{ __html: brebQrSvg }}
          />
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wider text-primary-dark">
              <ShieldCheck size={15} aria-hidden="true" />
              Canales oficiales de liquidación CIFRA
            </p>
            <h2 className="font-display text-[20px] font-bold text-ink">
              Liquida tu corte quincenal en segundos por Bre-B o Nequi
            </h2>
            <div className="flex flex-wrap gap-3 pt-1 text-[14px]">
              <span className="rounded-xl border border-line bg-paper px-3.5 py-2">
                Llave Bre-B: <strong className="font-mono text-ink">{cifraBrebKey}</strong>
              </span>
              <span className="rounded-xl border border-line bg-paper px-3.5 py-2">
                Nequi: <strong className="font-mono text-ink">{cifraNequi}</strong>
              </span>
            </div>
            <p className="text-[13px] text-ink-muted">
              Transfiere el valor exacto de tu estado de cuenta y reporta el comprobante abajo. La plataforma lo concilia y actualiza tu cuenta al día al instante.
            </p>
          </div>
        </div>

        {payableInvoice && (
          <div className="mt-5 border-t border-line pt-5">
            <PaymentReportForm
              invoiceId={payableInvoice.id}
              periodLabel={formatPeriodMonth(payableInvoice.periodMonth)}
              amountMinor={payableInvoice.commissionTotalMinor}
              wompiPublicKey={wompiPublicKey}
              siteUrl={siteUrl}
            />
          </div>
        )}
      </section>

      {/* Historial de estados de cuenta y cortes */}
      <section className="space-y-3">
        <h2 className="font-display text-[20px] font-bold text-ink">Historial de cortes de comisiones</h2>

        {data.invoices.length === 0 ? (
          <div className="surface-card flex items-center gap-3 p-5 text-[14px] text-ink-muted">
            <Receipt size={19} className="shrink-0 text-terra" aria-hidden="true" />
            <span>
              Todavía no tienes comisiones acumuladas. Tu primer estado de cuenta se abrirá automáticamente cuando cobres tu primera venta con código CIFRA en Caja.
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
                        Comisión CIFRA (5 %)
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
          <h2 className="font-display text-[18px] font-bold text-ink">Comprobantes de pago enviados</h2>
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
