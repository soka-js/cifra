import { ShieldCheck, Store } from 'lucide-react';
import Link from 'next/link';
import { ExpandableSmartMap } from '@/components/map/expandable-smart-map';
import { requireUser } from '@/lib/auth/session';
import { loadPersonaOffersBundle } from '@/lib/merchant-data';
import { loadSmartMapBundle } from '@/lib/v3-data';
import { getZoneBySlug } from '@/lib/zones';
import { OffersClient } from './offers-client';

export const metadata = { title: 'Ofertas cerca de ti' };

export default async function OfertasPage() {
  const user = await requireUser();
  const zone = getZoneBySlug(user.zoneSlug);
  const [{ ranked, activeCodes, recentRedemptions }, smartMap] = await Promise.all([
    loadPersonaOffersBundle(user),
    loadSmartMapBundle(user),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge-terra">Cruce inteligente: gastos × distancia × franja horaria</span>
          <h1 className="mt-2.5 font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">
            Ofertas cerca de ti
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            Cruzamos tus rubros reales de consumo con comercios independientes cercanos y sus ventanas de descuento u ofertas relámpago de cero merma.
          </p>
        </div>

        <Link
          href="/negocio"
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-muted hover:border-line-strong hover:text-ink"
        >
          <Store size={15} className="text-terra" aria-hidden="true" />
          ¿Tienes un negocio? Portal tendero →
        </Link>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary-pale/70 px-4 py-3 text-[13px] text-ink-soft">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
        <p>
          <strong className="font-semibold text-ink">Privacidad protegida:</strong> ningún comercio recibe tu nombre completo, tu correo ni tus movimientos bancarios. El cruce ocurre en tu cuenta y en caja solo ven un código temporal de 6 letras.
        </p>
      </div>

      <ExpandableSmartMap
        bundle={smartMap}
        defaultExpanded={true}
        compactTitle="Mapa en vivo por franjas horarias y cercanía"
        compactSubtitle="Filtra por hora (Mañana, Mediodía, Tarde · Cero merma, Noche) o activa tu GPS para ver cuántos minutos caminando te separan."
      />

      <OffersClient
        centerLat={user.lat ?? zone.lat}
        centerLng={user.lng ?? zone.lng}
        zoneLabel={zone.name}
        ranked={ranked}
        activeCodes={activeCodes}
        recentRedemptions={recentRedemptions}
        hideMapWidget={smartMap.offers.length > 0}
      />
    </div>
  );
}
