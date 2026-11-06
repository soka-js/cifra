import { and, eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { requireMerchantAccess } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { offers } from '@/lib/db/schema';
import { VitrinaClient } from './vitrina-client';

export const metadata = { title: 'Mi vitrina y afiche QR · Negocio CIFRA' };

export default async function MerchantVitrinaPage() {
  const access = await requireMerchantAccess();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cifra-inky.vercel.app';
  const publicUrl = `${baseUrl.replace(/\/$/, '')}/b/${access.merchant.slug}`;

  const [activeOffers, posterQrDataUrl] = await Promise.all([
    db
      .select()
      .from(offers)
      .where(and(eq(offers.merchantId, access.merchant.id), eq(offers.status, 'activa'))),
    QRCode.toDataURL(publicUrl, {
      margin: 1,
      width: 320,
      color: { dark: '#101D1A', light: '#FFFFFF' },
    }),
  ]);

  const topOffer = activeOffers.sort((a, b) => Number(b.isFlash) - Number(a.isFlash))[0] ?? null;

  return (
    <VitrinaClient
      merchantName={access.merchant.name}
      merchantSlug={access.merchant.slug}
      neighborhood={access.merchant.neighborhood}
      address={access.merchant.address}
      description={access.merchant.description ?? ''}
      hoursText={access.merchant.hoursText ?? ''}
      featuredItems={access.merchant.featuredItems ?? []}
      publicUrl={publicUrl}
      posterQrDataUrl={posterQrDataUrl}
      headlineOfferTitle={topOffer?.title ?? 'Descuento directo para vecinos del barrio'}
    />
  );
}
