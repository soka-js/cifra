import { CheckCircle2, Clock, Receipt, ShieldCheck } from 'lucide-react';
import { requireMerchantAccess } from '@/lib/auth/session';
import { bogotaDate } from '@/lib/data';
import { cop, shortDate } from '@/lib/format';
import {
  formatPeriodMonth,
  generateBrebQrSvg,
  loadMerchantDashboard,
} from '@/lib/merchant-data';
import { PaymentReportForm } from './payment-form';

export const metadata = { title: 'Comisiones y pagos · Negocio CIFRA' };

export default async function MerchantBillingPage() {
  const access = await requireMerchantAccess();
  const data = await loadMerchantDashboard(access.merchant);

  const cifraBrebKey = process.env.CIFRA_BREB_KEY ?? '@cifrapagos';
  const cifraNequi = process.env.CIFRA_NEQUI_NUMBER ?? '300 555 0199';
  const wompiPublicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || undefined;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const brebQrSvg = await generateBrebQrSvg(cifraBrebKey);

  const payableInvoice = data.invoices.find(
    (inv) =>
      inv.commissionTotalMinor > 0 &&
      (inv.status === 'abierta' || inv.status === 'pendiente_pago'),
  );

  return (
    <div className="space-y-6">
      <div>
        <span className="badge-terra">5 % solo después de vender</span>
        <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink">
          Comisiones y estado de cuenta
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          Sin cobros sorpresa: aquí ves el 5 % acumulado sobre las ventas efectivamente cobradas en tu caja y puedes conciliarlo al cierre del mes por Bre-B o Nequi.
        </p>
      </div>

      {/* Datos oficiales de recaudo CIFRA */}
      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div
            className="shrink-0 overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-sm"
            dangerouslySetInnerHTML={{ __html: brebQrSvg }}
          />
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wider text-primary-dark">
              <ShieldCheck size={15} aria-hidden="true" />
              Recaudo oficial CIFRA sin costo de transacción
            </p>
            <h2 className="font-display text-[20px] font-bold text-ink">
              Paga tu comisión mensual en segundos con Bre-B o Nequi
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
              Envía el valor exacto de tu estado de cuenta y pega abajo el código de comprobante. Nuestro equipo lo concilia en el panel administrativo.
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

      {/* Historial mensual de estados de cuenta */}
      <section className="space-y-3">
        <h2 className="font-display text-[20px] font-bold text-ink">Estados de cuenta por mes</h2>

        {data.invoices.length === 0 ? (
          <div className="surface-card flex items-center gap-3 p-5 text-[14px] text-ink-muted">
            <Receipt size={19} className="shrink-0 text-terra" aria-hidden="true" />
            <span>
              Todavía no tienes comisiones acumuladas. Tu primer estado de cuenta se abrirá automáticamente cuando cobres tu primera venta con código CIFRA.
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
                  <span className="badge-terra">Abierta ({inv.status === 'abierta' ? 'mes en curso' : 'pendiente'})</span>
                );

              return (
                <li key={inv.id} className="surface-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-[19px] font-bold capitalize text-ink">
                          {formatPeriodMonth(inv.periodMonth)}
                        </h3>
                        {statusBadge}
                      </div>
                      <p className="mt-1 text-[13px] text-ink-muted">
                        {inv.redemptionsCount} ventas atribuidas · Cobrado en tu caja:{' '}
                        <strong className="tnum text-ink">{cop(inv.netSalesMinor)}</strong>
                        {inv.dueOn ? ` · Fecha límite sugerida: ${shortDate(inv.dueOn)}` : ''}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
                        Comisión 5 %
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

      {data.payments.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-[18px] font-bold text-ink">Comprobantes enviados</h2>
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
