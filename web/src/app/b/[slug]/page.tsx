import { and, eq, gt } from 'drizzle-orm';
import { Clock, MapPin, MessageCircle, ShieldCheck, Sparkles, Store, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { getCurrentUser } from '@/lib/auth/session';
import { LogoMark } from '@/components/logo';
import { LazyNeighborhoodMap } from '@/components/map/neighborhood-map-lazy';
import { db } from '@/lib/db';
import { merchants, offerCodes, offers } from '@/lib/db/schema';
import { todayInBogota } from '@/lib/engine/dates';
import { cop } from '@/lib/format';
import { StorefrontOfferClaim } from './storefront-claim';

const CATEGORY_TITLES: Record<string, string> = {
  panaderia: 'Panadería artesanal',
  tienda: 'Tienda de barrio',
  cafeteria: 'Cafetería independiente',
  restaurante: 'Cocina y almuerzos',
  fruver: 'Fruver y mercado fresco',
  papeleria: 'Papelería y estudio',
  drogueria: 'Droguería de barrio',
  peluqueria: 'Peluquería y cuidado',
  servicios: 'Servicios locales',
  otro: 'Comercio independiente',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [merchant] = await db.select().from(merchants).where(eq(merchants.slug, slug)).limit(1);
  if (!merchant || merchant.isDemo) return { title: 'Comercio no encontrado · CIFRA' };
  return {
    title: `${merchant.name} (${merchant.neighborhood}) · Vitrina CIFRA`,
    description:
      merchant.description ??
      `Conoce los productos y beneficios directos en mostrador de ${merchant.name} en ${merchant.neighborhood}.`,
  };
}

export default async function PublicMerchantStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [merchant] = await db.select().from(merchants).where(eq(merchants.slug, slug)).limit(1);
  if (!merchant) notFound();

  const today = todayInBogota();
  const user = await getCurrentUser();
  // Un negocio de demostración solo existe para quien está mirando la demo (un admin, desde /admin).
  if (merchant.isDemo && !user?.isDemo) notFound();

  const activeOffers = (
    await db
      .select()
      .from(offers)
      .where(and(eq(offers.merchantId, merchant.id), eq(offers.status, 'activa')))
  )
    .filter((o) => o.validFrom <= today && o.validUntil >= today && (o.stockRemaining === null || o.stockRemaining > 0))
    .sort((a, b) => Number(b.isFlash) - Number(a.isFlash));

  const existingCodesMap: Record<string, { code: string; qrDataUrl: string }> = {};
  if (user && activeOffers.length > 0) {
    const now = new Date();
    const pending = await db
      .select()
      .from(offerCodes)
      .where(
        and(
          eq(offerCodes.userId, user.id),
          eq(offerCodes.merchantId, merchant.id),
          eq(offerCodes.status, 'pendiente'),
          gt(offerCodes.expiresAt, now),
        ),
      );
    for (const c of pending) {
      const qrDataUrl = await QRCode.toDataURL(`CIFRA:${c.code}:${c.qrToken}`, {
        margin: 1,
        width: 200,
        color: { dark: '#101D1A', light: '#FFFFFF' },
      });
      existingCodesMap[c.offerId] = { code: c.code, qrDataUrl };
    }
  }

  const cleanPhone = merchant.whatsapp.replace(/[^0-9]/g, '');
  const waNumber = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    `Hola ${merchant.name}, vi su vitrina en CIFRA y quiero pasar por el local.`,
  )}`;

  const featured = merchant.featuredItems ?? [];

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Barra superior pública */}
      <header className="border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <LogoMark size={26} />
            <span className="font-display text-[19px] font-bold tracking-[-0.025em] text-ink">
              cifra
            </span>
          </Link>

          <Link
            href={user ? '/app' : '/entrar'}
            className="rounded-xl border border-line bg-paper px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-white"
          >
            {user ? 'Ir a mi CIFRA →' : 'Entrar / Crear cuenta'}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-7 sm:px-6 sm:py-10">
        {/* Hero del comercio */}
        <section className="surface-card overflow-hidden p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-terra">
              <Store size={12} aria-hidden="true" />
              {CATEGORY_TITLES[merchant.businessCategory] ?? 'Comercio local'}
            </span>
            <span className="badge-neutral">{merchant.neighborhood}</span>
          </div>

          <h1 className="mt-3 font-display text-[32px] font-extrabold leading-tight tracking-[-0.03em] text-ink sm:text-[38px]">
            {merchant.name}
          </h1>

          {merchant.description && (
            <p className="mt-2.5 text-[16px] leading-relaxed text-ink-soft">{merchant.description}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={15} className="text-terra" aria-hidden="true" />
              {merchant.address}, {merchant.neighborhood}
            </span>
            {merchant.hoursText && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={15} className="text-primary-dark" aria-hidden="true" />
                {merchant.hoursText}
              </span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-[14px]"
            >
              <MessageCircle size={17} aria-hidden="true" />
              Escribir por WhatsApp directo
            </a>
            <span className="text-[12.5px] text-ink-faint">
              Sin comisiones abusivas de apps · Trato directo con {merchant.ownerName.split(' ')[0]}
            </span>
          </div>
        </section>

        {/* Ofertas relámpago y beneficios activos hoy */}
        {activeOffers.length > 0 && (
          <section className="space-y-3.5">
            <h2 className="font-display text-[21px] font-bold text-ink">
              Beneficios activos hoy en mostrador
            </h2>

            {activeOffers.map((offer) => (
              <article
                key={offer.id}
                className={`surface-card p-5 sm:p-6 ${
                  offer.isFlash ? 'border-amber-400 bg-gradient-to-br from-amber-50/85 via-white to-terra-pale/30' : ''
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {offer.isFlash ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/85 px-3 py-1 text-[12px] font-bold text-amber-950">
                      <Zap size={13} aria-hidden="true" />
                      Oferta por horas
                      {offer.stockRemaining !== null ? ` · Quedan ${offer.stockRemaining} cupos hoy` : ''}
                    </span>
                  ) : (
                    <span className="badge-terra">
                      <Sparkles size={12} aria-hidden="true" />
                      Beneficio directo CIFRA
                    </span>
                  )}

                  <span className="badge-primary">
                    {offer.discountKind === 'percent'
                      ? `${offer.discountPercent} % de descuento`
                      : `-${cop(offer.discountFixedMinor ?? 0)}`}
                  </span>
                </div>

                <h3 className="mt-2.5 font-display text-[22px] font-bold leading-snug text-ink">
                  {offer.title}
                </h3>
                {offer.description && (
                  <p className="mt-1 text-[14.5px] text-ink-soft">{offer.description}</p>
                )}

                <p className="mt-2 text-[12.5px] text-ink-muted">
                  {offer.activeHoursText ? `Franja: ${offer.activeHoursText} · ` : ''}
                  {offer.minPurchaseMinor > 0
                    ? `Aplica desde ${cop(offer.minPurchaseMinor)}`
                    : 'Sin monto mínimo de compra'}
                </p>

                <StorefrontOfferClaim
                  offerId={offer.id}
                  isLoggedIn={Boolean(user)}
                  merchantSlug={merchant.slug}
                  initialCode={existingCodesMap[offer.id] ?? null}
                />
              </article>
            ))}
          </section>
        )}

        {/* Productos estrella de la casa */}
        {featured.length > 0 && (
          <section className="surface-card p-5 sm:p-6">
            <h2 className="font-display text-[20px] font-bold text-ink">
              Recomendados de la casa
            </h2>
            <p className="mt-0.5 text-[13.5px] text-ink-muted">
              Precios reales de mostrador, sin el sobreprecio del 25–30 % de las aplicaciones de domicilio:
            </p>

            <ul className="tnum mt-4 grid gap-3 sm:grid-cols-2">
              {featured.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper/70 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{item.name}</p>
                    {item.tag && <span className="text-[11.5px] text-terra-dark">{item.tag}</span>}
                  </div>
                  <span className="shrink-0 font-display text-[17px] font-extrabold text-primary-dark">
                    {cop(item.priceMinor)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Mapa de cómo llegar */}
        <section className="surface-card overflow-hidden p-5 sm:p-6">
          <h2 className="font-display text-[19px] font-bold text-ink">Dónde estamos</h2>
          <p className="mt-0.5 mb-3 text-[13.5px] text-ink-muted">
            {merchant.address} · {merchant.neighborhood}
          </p>
          <LazyNeighborhoodMap
            centerLat={merchant.lat}
            centerLng={merchant.lng}
            zoom={16}
            pins={[
              {
                id: merchant.id,
                lat: merchant.lat,
                lng: merchant.lng,
                merchantName: merchant.name,
                title: merchant.address,
                badgeText: merchant.neighborhood,
                neighborhood: merchant.neighborhood,
                isFlash: activeOffers.some((o) => o.isFlash),
              },
            ]}
            selectedId={merchant.id}
            heightClassName="h-60"
          />
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-4 text-[13px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={16} className="text-primary-dark" aria-hidden="true" />
            Vitrina gratuita impulsada por <strong className="text-ink">CIFRA</strong> para comercio independiente de barrio.
          </span>
          <Link href="/negocio/unirse" className="font-semibold text-terra-dark underline">
            ¿Tienes un local? Crea tu vitrina gratis →
          </Link>
        </footer>
      </main>
    </div>
  );
}
