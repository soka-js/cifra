import {
  ArrowRight,
  CheckCircle2,
  FileText,
  PlusCircle,
  QrCode,
  Repeat2,
  Sparkles,
  Tag,
  UserPlus,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { requireMerchantAccess } from '@/lib/auth/session';
import { bogotaDate } from '@/lib/data';
import { cop, shortDate } from '@/lib/format';
import { loadMerchantDashboard } from '@/lib/merchant-data';
import { loadMerchantBreakEvenData } from '@/lib/v3-data';

export const metadata = { title: 'Resumen de mi negocio · CIFRA' };

export default async function MerchantHomePage({
  searchParams,
}: {
  searchParams: Promise<{ activado?: string; oferta?: string }>;
}) {
  const sp = await searchParams;
  const access = await requireMerchantAccess();
  const [data, cuadre] = await Promise.all([
    loadMerchantDashboard(access.merchant),
    loadMerchantBreakEvenData(access.merchant),
  ]);
  const { report } = data;
  const activeOffers = data.offers.filter((o) => o.status === 'activa');
  const firstName = access.merchant.ownerName.split(' ')[0] || 'Hola';

  return (
    <div className="space-y-6">
      {(sp.activado === '1' || sp.oferta === 'publicada') && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-primary/30 bg-primary-pale px-4 py-3 text-[14px] font-medium text-primary-dark">
          <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />
          <span>
            {sp.oferta === 'publicada'
              ? '¡Tu oferta ya está publicada y visible para vecinos elegibles de tu zona!'
              : '¡Bienvenido! Tu negocio ya está activo en CIFRA.'}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge-terra">{data.periodLabel}</span>
          <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink">
            Hola, {firstName} · {access.merchant.name}
          </h1>
          <p className="mt-1 text-[15px] text-ink-muted">
            Cuentas claras de tu día y de tu mes en pesos reales, sin enredos técnicos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/negocio/vitrina" className="btn-ghost text-[14px]">
            Mi vitrina y QR
          </Link>
          <Link href="/negocio/informe" className="btn-ghost text-[14px]">
            <FileText size={16} aria-hidden="true" />
            Informe de 1 página
          </Link>
        </div>
      </div>

      {/* Termómetro vivo del día: valor desde el Día 1 aunque aún lleguen pocos códigos */}
      <section className="surface-card border-terra/25 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className={cuadre.summary.reachedBreakEven ? 'badge-primary' : 'badge-terra'}>
              Punto de equilibrio de hoy
            </span>
            <p className="tnum mt-2 font-display text-[26px] font-extrabold leading-none text-ink">
              {cop(cuadre.summary.todaySalesMinor)}{' '}
              {cuadre.summary.dailyBreakEvenMinor !== null && (
                <span className="text-[14px] font-normal text-ink-muted">
                  de {cop(cuadre.summary.dailyBreakEvenMinor)} ({cuadre.summary.progressPct} %)
                </span>
              )}
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              {cuadre.summary.dailyBreakEvenMinor === null
                ? 'Vendido hoy. En el cuadre puedes escribir cuánto necesitas vender al día y te decimos cuánto te falta.'
                : cuadre.summary.reachedBreakEven
                  ? 'Ya cubriste tu meta de hoy.'
                  : `Te faltan ${cop(cuadre.summary.gapToBreakEvenMinor)} hoy. Puedes anotar ventas de mostrador o prender una oferta por horas.`}
            </p>
          </div>
          <Link href="/negocio/cuadre" className="btn-ink shrink-0 text-[13.5px]">
            Abrir cuadre e insumos →
          </Link>
        </div>
        {cuadre.summary.dailyBreakEvenMinor !== null && (
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-paper-deep">
            <div
              className={`h-full rounded-full ${cuadre.summary.reachedBreakEven ? 'bg-primary' : 'bg-terra'}`}
              style={{ width: `${Math.min(100, Math.max(4, cuadre.summary.progressPct))}%` }}
            />
          </div>
        )}
      </section>

      {/* Acceso gigante a Caja para mostrador */}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Link
          href="/negocio/caja"
          className="group flex items-center justify-between gap-4 rounded-2xl bg-terra p-5 text-white shadow-card transition hover:bg-terra-dark"
        >
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-white/80">
              Atención rápida en mostrador
            </p>
            <p className="mt-1 font-display text-[22px] font-bold leading-snug">
              Cobrar código o QR en Caja
            </p>
            <p className="mt-1 text-[13.5px] text-white/85">
              Valida las 6 letras del cliente y calcula cuánto cobrarle al instante.
            </p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <QrCode size={24} aria-hidden="true" />
          </span>
        </Link>

        <Link
          href="/negocio/ofertas"
          className="surface-card flex items-center justify-between gap-4 p-5 transition hover:border-line-strong"
        >
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-terra-dark">
              {activeOffers.length > 0
                ? `${activeOffers.length} ${activeOffers.length === 1 ? 'oferta encendida' : 'ofertas encendidas'}`
                : 'Aún sin oferta activa'}
            </p>
            <p className="mt-1 font-display text-[21px] font-bold leading-snug text-ink">
              {activeOffers.length > 0 ? 'Ajustar mis ofertas' : 'Publicar mi primera oferta'}
            </p>
            <p className="mt-1 text-[13.5px] text-ink-muted">
              Ofertas para clientes nuevos u ofertas por horas para los ratos tranquilos.
            </p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-terra-pale text-terra-dark">
            <PlusCircle size={23} aria-hidden="true" />
          </span>
        </Link>
      </div>

      {/* Las 4 cifras llanas definidas en G.10 */}
      <section aria-label="Las 4 cifras del mes" className="space-y-3">
        <h2 className="font-display text-[20px] font-bold text-ink">
          Las 4 cifras de tu negocio este mes
        </h2>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink-muted">
                1. Ventas con oferta CIFRA
              </span>
              <Tag size={17} className="text-terra" aria-hidden="true" />
            </div>
            <p className="tnum mt-2 font-display text-[32px] font-bold text-ink">
              {report.redemptionsCount} {report.redemptionsCount === 1 ? 'compra' : 'compras'}
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Pedidos por valor original de{' '}
              <strong className="tnum font-semibold text-ink">{cop(report.grossAttributedSalesMinor)}</strong>
            </p>
          </div>

          <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink-muted">
                2. Plata libre que te queda en caja
              </span>
              <Wallet size={17} className="text-primary-dark" aria-hidden="true" />
            </div>
            <p className="tnum mt-2 font-display text-[32px] font-bold text-primary-dark">
              {cop(report.merchantNetKeptMinor)}
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Cobraste <span className="tnum font-medium text-ink">{cop(report.netCollectedSalesMinor)}</span> · Comisión CIFRA (5 %):{' '}
              <span className="tnum font-medium text-ink">{cop(report.cifraCommissionMinor)}</span>
            </p>
          </div>

          <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink-muted">
                3. Clientes nuevos para tu local
              </span>
              <UserPlus size={17} className="text-terra" aria-hidden="true" />
            </div>
            <p className="tnum mt-2 font-display text-[32px] font-bold text-ink">
              {report.newCustomersCount} {report.newCustomersCount === 1 ? 'vecino nuevo' : 'vecinos nuevos'}
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              {report.newCustomersCount > 0
                ? `No te habían comprado en los últimos 90 días · inversión promedio ${cop(report.averageCostPerNewCustomerMinor)} por cliente nuevo`
                : 'Apenas lleguen tus primeros clientes nuevos los verás aquí.'}
            </p>
          </div>

          <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink-muted">
                4. Volvieron después sin descuento
              </span>
              <Repeat2 size={17} className="text-primary-dark" aria-hidden="true" />
            </div>
            <p className="tnum mt-2 font-display text-[32px] font-bold text-primary-dark">
              {report.organicReturnCustomersCount}{' '}
              {report.organicReturnCustomersCount === 1 ? 'cliente volvió' : 'clientes volvieron'}
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              {report.organicReturnSalesMinor > 0
                ? `Te dejaron ${cop(report.organicReturnSalesMinor)} adicionales a precio completo y $0 de comisión.`
                : 'Cuando quienes te conocieron con oferta vuelvan a precio normal, medimos esas compras sin cobrarte comisión.'}
            </p>
          </div>
        </div>
      </section>

      {/* Últimas ventas pasadas por Caja */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[20px] font-bold text-ink">Últimos cobros en Caja</h2>
          <Link href="/negocio/cuenta" className="text-[13.5px] font-semibold text-terra-dark hover:underline">
            Ver estado de cuenta →
          </Link>
        </div>

        {data.recentRedemptions.length === 0 ? (
          <div className="surface-card p-5 text-[14px] text-ink-muted">
            Todavía no has registrado ventas con código CIFRA. Cuando un vecino llegue a tu mostrador con un código de 6 letras, entra a{' '}
            <Link href="/negocio/caja" className="font-semibold text-terra-dark underline">
              Caja
            </Link>{' '}
            para validarlo en segundos.
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            {data.recentRedemptions.slice(0, 8).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14.5px] font-semibold text-ink">{r.customerFirstName}</p>
                    {r.isNewCustomer && (
                      <span className="badge-primary">
                        <Sparkles size={11} aria-hidden="true" />
                        Cliente nuevo
                      </span>
                    )}
                    {r.userConfirmedAt && (
                      <span className="badge-neutral">Confirmado por el cliente</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">
                    {shortDate(bogotaDate(r.redeemedAt))} · {r.offerTitle}
                  </p>
                </div>

                <div className="text-right">
                  <p className="tnum text-[15px] font-bold text-ink">
                    Cobraste {cop(r.netPaidByUserMinor)}
                  </p>
                  <p className="tnum text-[12px] text-ink-muted">
                    Te quedan {cop(r.merchantNetKeepMinor)} · Comisión {cop(r.cifraCommissionMinor)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end">
        <Link href="/negocio/informe" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-terra-dark hover:underline">
          Abrir informe mensual imprimible y enviar por WhatsApp
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
