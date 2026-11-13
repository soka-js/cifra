'use client';

import { CheckCircle2, Save } from 'lucide-react';
import { useActionState, useState } from 'react';
import { updateMerchantProfile, type MerchantActionState } from '@/app/actions/merchant';
import { LazyNeighborhoodMap } from '@/components/map/neighborhood-map-lazy';
import { MoneyInput } from '@/components/ui/money-input';
import type { Merchant } from '@/lib/db/schema';
import { BOGOTA_ZONES } from '@/lib/zones';

const INITIAL: MerchantActionState = { status: 'idle' };

export function MerchantProfileForm({ merchant }: { merchant: Merchant }) {
  const [state, action, pending] = useActionState(updateMerchantProfile, INITIAL);
  const [zoneSlug, setZoneSlug] = useState(merchant.zoneSlug);
  const [lat, setLat] = useState(merchant.lat);
  const [lng, setLng] = useState(merchant.lng);

  return (
    <form action={action} className="surface-card space-y-5 p-5 sm:p-7">
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />

      {state.status === 'ok' && (
        <div className="flex items-center gap-2 rounded-xl bg-primary-pale px-4 py-3 text-[14px] font-medium text-primary-dark">
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      )}

      {state.status === 'error' && (
        <div role="alert" className="rounded-xl bg-neg-light px-4 py-3 text-[14px] text-neg">
          {state.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">
            Nombre del negocio
          </label>
          <input id="name" name="name" type="text" required defaultValue={merchant.name} className="field" />
        </div>

        <div>
          <label htmlFor="whatsapp" className="label">
            WhatsApp de contacto
          </label>
          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            required
            defaultValue={merchant.whatsapp}
            className="field"
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="label">
          Descripción breve para tus vecinos
        </label>
        <input
          id="description"
          name="description"
          type="text"
          defaultValue={merchant.description ?? ''}
          placeholder="Ej. Pan de masa madre horneado cada mañana y café de origen."
          className="field"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="zoneSlug" className="label">
            Zona
          </label>
          <select
            id="zoneSlug"
            name="zoneSlug"
            value={zoneSlug}
            onChange={(e) => setZoneSlug(e.target.value)}
            className="field"
          >
            {BOGOTA_ZONES.map((z) => (
              <option key={z.slug} value={z.slug}>
                {z.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="neighborhood" className="label">
            Barrio
          </label>
          <input
            id="neighborhood"
            name="neighborhood"
            type="text"
            defaultValue={merchant.neighborhood}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="address" className="label">
            Dirección
          </label>
          <input
            id="address"
            name="address"
            type="text"
            required
            defaultValue={merchant.address}
            className="field"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="hoursText" className="label">
            Horario de atención
          </label>
          <input
            id="hoursText"
            name="hoursText"
            type="text"
            defaultValue={merchant.hoursText ?? ''}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="typicalTicket" className="label">
            Pedido promedio de un cliente ($)
          </label>
          <MoneyInput
            id="typicalTicket"
            name="typicalTicket"
            defaultValue={Math.round(merchant.typicalTicketMinor / 100)}
            placeholder="20.000"
            presets={[10000, 20000, 35000, 50000]}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="brebKey" className="label">
            Tu llave Bre-B (opcional)
          </label>
          <input
            id="brebKey"
            name="brebKey"
            type="text"
            defaultValue={merchant.brebKey ?? ''}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="nequiNumber" className="label">
            Tu número Nequi (opcional)
          </label>
          <input
            id="nequiNumber"
            name="nequiNumber"
            type="text"
            defaultValue={merchant.nequiNumber ?? ''}
            className="field"
          />
        </div>
      </div>

      <div>
        <label htmlFor="matchKeywords" className="label">
          ¿Cómo aparece tu datáfono o QR en los extractos bancarios? (separado por comas)
        </label>
        <input
          id="matchKeywords"
          name="matchKeywords"
          type="text"
          defaultValue={merchant.matchKeywords.join(', ')}
          placeholder="Ej. PANADERIA LA ESPIGA, BOLD LA ESPIGA"
          className="field"
        />
        <p className="mt-1 text-[12px] text-ink-muted">
          Nos permite identificar automáticamente quién ya era cliente tuyo y cuántos clientes nuevos vuelven después sin usar descuento.
        </p>
      </div>

      <div className="space-y-1.5">
        <span className="label">Ubicación exacta en el mapa del barrio</span>
        <LazyNeighborhoodMap
          centerLat={lat}
          centerLng={lng}
          pickerLat={lat}
          pickerLng={lng}
          onPickLocation={(nextLat, nextLng) => {
            setLat(nextLat);
            setLng(nextLng);
          }}
          heightClassName="h-56"
        />
      </div>

      <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
        <Save size={16} aria-hidden="true" />
        {pending ? 'Guardando...' : 'Guardar datos de mi negocio'}
      </button>
    </form>
  );
}
