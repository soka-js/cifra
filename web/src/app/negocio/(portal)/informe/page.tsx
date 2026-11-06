import Link from 'next/link';
import { LogoMark } from '@/components/logo';
import { requireMerchantAccess } from '@/lib/auth/session';
import { cop } from '@/lib/format';
import { currentPeriodMonth, formatPeriodMonth, loadMerchantDashboard } from '@/lib/merchant-data';
import { ReportActions } from './report-actions';

export const metadata = { title: 'Informe mensual de 1 página · CIFRA' };

function recentMonths(count = 4): string[] {
  const cur = currentPeriodMonth();
  const [yStr, mStr] = cur.split('-');
  let y = Number(yStr);
  let m = Number(mStr);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export default async function MerchantOnePageReport({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const sp = await searchParams;
  const access = await requireMerchantAccess();
  const months = recentMonths(4);
  const selectedMonth = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : months[0]!;
  const data = await loadMerchantDashboard(access.merchant, selectedMonth);
  const { report } = data;

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {months.map((m) => (
            <Link
              key={m}
              href={`/negocio/informe?mes=${m}`}
              className={`rounded-xl px-3 py-1.5 text-[13px] font-semibold capitalize transition ${
                m === selectedMonth
                  ? 'bg-terra text-white'
                  : 'border border-line bg-white text-ink-muted hover:text-ink'
              }`}
            >
              {formatPeriodMonth(m)}
            </Link>
          ))}
        </div>

        <ReportActions whatsappSummary={report.whatsappSummary} />
      </div>

      {/* Hoja única de resultados en lenguaje llano (G.10) */}
      <article className="ticket-surface space-y-6 p-6 sm:p-9 print:rounded-none print:border-0 print:p-4 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div className="flex items-center gap-3">
            <LogoMark size={34} />
            <div>
              <p className="text-[11.5px] font-bold uppercase tracking-widest text-terra-dark">
                Informe mensual de resultados · 1 página
              </p>
              <h1 className="font-display text-[26px] font-bold leading-tight text-ink">
                {access.merchant.name}
              </h1>
              <p className="text-[13.5px] text-ink-muted">
                {access.merchant.neighborhood} · {access.merchant.address}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">Periodo evaluado</p>
            <p className="font-display text-[20px] font-bold capitalize text-ink">{report.periodLabel}</p>
            <p className="text-[12.5px] text-ink-muted">Propietario/a: {access.merchant.ownerName}</p>
          </div>
        </header>

        {/* Las 4 métricas clave de G.10 */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-paper/70 p-4">
            <p className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">
              1 · Ventas traídas con oferta CIFRA
            </p>
            <p className="tnum mt-1 font-display text-[30px] font-bold text-ink">
              {report.redemptionsCount} {report.redemptionsCount === 1 ? 'venta' : 'ventas'}
            </p>
            <p className="mt-1 text-[13px] text-ink-soft">
              Valor original de los pedidos:{' '}
              <strong className="tnum text-ink">{cop(report.grossAttributedSalesMinor)}</strong>
            </p>
          </div>

          <div className="rounded-2xl border border-primary/25 bg-primary-pale/60 p-4">
            <p className="text-[12px] font-bold uppercase tracking-wider text-primary-dark">
              2 · Plata neta que conservaste en caja
            </p>
            <p className="tnum mt-1 font-display text-[30px] font-bold text-primary-dark">
              {cop(report.merchantNetKeptMinor)}
            </p>
            <p className="mt-1 text-[13px] text-ink-soft">
              Después del descuento al vecino y del 5 % de comisión CIFRA.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-paper/70 p-4">
            <p className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">
              3 · Clientes nuevos frente a conocidos
            </p>
            <p className="tnum mt-1 font-display text-[30px] font-bold text-ink">
              {report.newCustomersCount} nuevos
            </p>
            <p className="mt-1 text-[13px] text-ink-soft">
              {report.repeatOfferCustomersCount > 0
                ? `Más ${report.repeatOfferCustomersCount} clientes que repitieron oferta.`
                : '100 % vecinos sin compras recientes previas en tu local.'}
            </p>
          </div>

          <div className="rounded-2xl border border-primary/25 bg-primary-pale/60 p-4">
            <p className="text-[12px] font-bold uppercase tracking-wider text-primary-dark">
              4 · Volvieron después SIN descuento
            </p>
            <p className="tnum mt-1 font-display text-[30px] font-bold text-primary-dark">
              {report.organicReturnCustomersCount}{' '}
              {report.organicReturnCustomersCount === 1 ? 'cliente' : 'clientes'}
            </p>
            <p className="mt-1 text-[13px] text-ink-soft">
              {report.organicReturnSalesMinor > 0
                ? `Compras posteriores a precio completo por ${cop(report.organicReturnSalesMinor)} ($0 comisión).`
                : 'Compras posteriores a precio normal sin costo ni comisión para ti.'}
            </p>
          </div>
        </section>

        {/* Desglose contable renglón por renglón */}
        <section className="rounded-2xl border border-line p-5">
          <h2 className="font-display text-[17px] font-bold text-ink">
            Desglose exacto en pesos (cómo salió cada peso)
          </h2>
          <dl className="mt-3 divide-y divide-line text-[14px]">
            <div className="flex justify-between py-2">
              <dt className="text-ink-soft">Valor de los pedidos antes de descuento</dt>
              <dd className="tnum font-semibold text-ink">{cop(report.grossAttributedSalesMinor)}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-ink-soft">Descuentos entregados a los clientes en mostrador</dt>
              <dd className="tnum font-medium text-ink-muted">−{cop(report.discountsGrantedMinor)}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="font-medium text-ink">Total cobrado efectivamente en tu caja</dt>
              <dd className="tnum font-bold text-ink">{cop(report.netCollectedSalesMinor)}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-ink-soft">Comisión de éxito CIFRA (5 % sobre lo cobrado en caja)</dt>
              <dd className="tnum font-semibold text-terra-dark">−{cop(report.cifraCommissionMinor)}</dd>
            </div>
            <div className="flex justify-between py-2.5 text-[15px]">
              <dt className="font-bold text-primary-dark">Plata libre que quedó en tu negocio</dt>
              <dd className="tnum font-bold text-primary-dark">{cop(report.merchantNetKeptMinor)}</dd>
            </div>
          </dl>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-line-strong pt-4 text-[12px] text-ink-muted">
          <span>
            Control de incrementalidad activo: grupo de comparación sin oferta ({report.holdoutOrganicBuyersCount}{' '}
            compradores orgánicos observados).
          </span>
          <span>CIFRA · Cuentas claras para comercios de barrio en Colombia</span>
        </footer>
      </article>
    </div>
  );
}
