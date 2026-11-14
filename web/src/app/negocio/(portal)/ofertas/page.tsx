import { and, eq, ne, sql } from 'drizzle-orm';
import { Pause, Play, RefreshCw, ShieldAlert, Sparkles, Tag } from 'lucide-react';
import Link from 'next/link';
import { renewOfferCampaign, toggleOfferStatus } from '@/app/actions/merchant';
import { requireMerchantAccess } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { merchantInvoices, offers, redemptions } from '@/lib/db/schema';
import { evaluateMerchantBillingHealth } from '@/lib/engine/commission-cycle';
import { todayInBogota } from '@/lib/engine/dates';
import { cop, shortDate } from '@/lib/format';
import { OfferCreator } from './offer-creator';

export const metadata = { title: 'Mis ofertas · Negocio CIFRA' };

export default async function MerchantOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenida?: string }>;
}) {
  const sp = await searchParams;
  const access = await requireMerchantAccess();

  const [merchantOffers, usageRows, invoices] = await Promise.all([
    db.select().from(offers).where(eq(offers.merchantId, access.merchant.id)),
    db
      .select({
        offerId: redemptions.offerId,
        used: sql<number>`count(*)::int`,
      })
      .from(redemptions)
      .where(and(eq(redemptions.merchantId, access.merchant.id), ne(redemptions.status, 'anulada')))
      .groupBy(redemptions.offerId),
    db
      .select()
      .from(merchantInvoices)
      .where(eq(merchantInvoices.merchantId, access.merchant.id)),
  ]);

  const health = evaluateMerchantBillingHealth(invoices, todayInBogota());
  const usedMap = new Map(usageRows.map((u) => [u.offerId, u.used]));
  const sortedOffers = [...merchantOffers].sort((a, b) =>
    b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return (
    <div className="space-y-6">
      {sp.bienvenida === '1' && (
        <div className="rounded-2xl border border-primary/25 bg-primary-pale px-4 py-3 text-[14px] text-primary-dark">
          <strong>¡Negocio registrado!</strong> Crea abajo tu primera oferta en 1 minuto para empezar a recibir clientes nuevos de tu barrio.
        </div>
      )}

      {/* Alerta de corte vencido / pausa preventiva (política Karol Benavides) */}
      {!health.canPublishOffers && (
        <section className="rounded-2xl border border-red-300 bg-red-50 p-5 text-red-950">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <ShieldAlert size={22} aria-hidden="true" />
            </span>
            <div className="space-y-2">
              <span className="rounded-full bg-red-200 px-3 py-0.5 text-[12px] font-bold uppercase tracking-wider text-red-900">
                Pausa preventiva de ofertas
              </span>
              <h2 className="font-display text-[19px] font-bold text-red-950">
                Tienes un corte de comisiones pendiente de liquidar ({cop(health.overdueAmountMinor)})
              </h2>
              <p className="text-[13.5px] text-red-800">
                {health.lockReason}
              </p>
              <div className="pt-1">
                <Link
                  href="/negocio/cuenta"
                  className="btn-sm inline-flex items-center gap-1.5 bg-red-700 text-white hover:bg-red-800"
                >
                  Liquidar corte en Mi Cuenta
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink">
          Mis ofertas en CIFRA
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          Prende, pausa o renueva tus ofertas cuando quieras. Sin permanencia.
        </p>
      </div>

      {sortedOffers.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-[19px] font-bold text-ink">Tus ofertas</h2>
          <ul className="space-y-3">
            {sortedOffers.map((o) => {
              const used = usedMap.get(o.id) ?? 0;
              const isActive = o.status === 'activa';
              return (
                <li key={o.id} className="surface-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={isActive ? 'badge-primary' : 'badge-neutral'}>
                          {o.status === 'activa'
                            ? 'Encendida'
                            : o.status === 'pausada'
                              ? 'En pausa'
                              : 'Finalizada'}
                        </span>
                        <span className="badge-terra">
                          <Tag size={11} aria-hidden="true" />
                          {o.discountKind === 'percent'
                            ? `${o.discountPercent} %`
                            : cop(o.discountFixedMinor ?? 0)}
                        </span>
                        {o.isFlash && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11.5px] font-bold text-amber-900">
                            ⚡ Por horas
                            {o.stockRemaining !== null ? ` · Quedan ${o.stockRemaining}/${o.stockLimit ?? o.stockRemaining}` : ''}
                          </span>
                        )}
                        {o.newCustomersOnly && (
                          <span className="badge-neutral">
                            <Sparkles size={11} aria-hidden="true" />
                            Solo clientes nuevos
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1.5 font-display text-[19px] font-bold text-ink">{o.title}</h3>
                      {o.description && (
                        <p className="mt-0.5 text-[13.5px] text-ink-soft">{o.description}</p>
                      )}
                      <p className="mt-2 text-[12.5px] text-ink-muted">
                        Vigente hasta {shortDate(o.validUntil)}
                        {o.activeHoursText ? ` · Franja ${o.activeHoursText}` : ''}
                        {o.minPurchaseMinor > 0 ? ` · Compra mínima ${cop(o.minPurchaseMinor)}` : ''}
                        {o.monthlyCapRedemptions ? ` · Cupo ${used}/${o.monthlyCapRedemptions} ventas` : ` · ${used} ventas registradas`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {o.status !== 'vencida' && (
                        <form action={toggleOfferStatus}>
                          <input type="hidden" name="offerId" value={o.id} />
                          <input
                            type="hidden"
                            name="nextStatus"
                            value={isActive ? 'pausada' : 'activa'}
                          />
                          <button type="submit" className="btn-sm border border-line bg-white text-ink hover:bg-paper">
                            {isActive ? (
                              <>
                                <Pause size={14} aria-hidden="true" />
                                Pausar
                              </>
                            ) : (
                              <>
                                <Play size={14} aria-hidden="true" />
                                Encender
                              </>
                            )}
                          </button>
                        </form>
                      )}

                      <form action={renewOfferCampaign}>
                        <input type="hidden" name="offerId" value={o.id} />
                        <button type="submit" className="btn-sm bg-terra-pale text-terra-dark hover:bg-terra-light">
                          <RefreshCw size={14} aria-hidden="true" />
                          Renovar +30 días
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <OfferCreator
        typicalTicketMinor={access.merchant.typicalTicketMinor}
        commissionBps={access.merchant.commissionBps}
        businessCategory={access.merchant.businessCategory}
      />
    </div>
  );
}
