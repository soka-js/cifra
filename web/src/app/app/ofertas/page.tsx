import { ShieldCheck } from 'lucide-react';
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
      <div>
        <div>
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">
            Ofertas cerca de ti
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            Descuentos de negocios de tu barrio. Generas un código, lo muestras en la caja y listo.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary-pale/70 px-4 py-3 text-[13px] text-ink-soft">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
        <p>
El negocio no ve tu nombre completo, tu correo ni tus movimientos: en la caja solo ve tu código de 6 letras.
        </p>
      </div>

      <ExpandableSmartMap
        bundle={smartMap}
        defaultExpanded={true}
        compactTitle="Mapa de ofertas"
        compactSubtitle="Filtra por hora o usa tu ubicación para ver qué tan cerca está cada negocio."
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
