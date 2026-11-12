'use client';

import { ArrowRight, Store } from 'lucide-react';
import { useActionState, useState } from 'react';
import { selfRegisterMerchant, type MerchantActionState } from '@/app/actions/merchant';
import { LazyNeighborhoodMap } from '@/components/map/neighborhood-map-lazy';
import { MoneyInput } from '@/components/ui/money-input';
import { BOGOTA_ZONES } from '@/lib/zones';

const INITIAL: MerchantActionState = { status: 'idle' };

const CATEGORY_OPTIONS = [
  { value: 'panaderia', label: 'Panadería / Pastelería' },
  { value: 'cafeteria', label: 'Cafetería / Onces' },
  { value: 'restaurante', label: 'Restaurante / Almuerzos' },
  { value: 'tienda', label: 'Tienda de barrio / Minimercado' },
  { value: 'fruver', label: 'Fruver / Carnicería' },
  { value: 'papeleria', label: 'Papelería / Miscelánea' },
  { value: 'drogueria', label: 'Droguería / Farmacia independiente' },
  { value: 'peluqueria', label: 'Peluquería / Barbería' },
  { value: 'servicios', label: 'Servicios del hogar / Lavandería' },
  { value: 'otro', label: 'Otro comercio independiente' },
];

export function RegisterMerchantForm({
  isLoggedIn,
  defaultOwnerName,
  defaultZoneSlug = 'chapinero',
}: {
  isLoggedIn: boolean;
  defaultOwnerName?: string | null;
  defaultZoneSlug?: string | null;
}) {
  const initialZone = BOGOTA_ZONES.find((z) => z.slug === defaultZoneSlug) ?? BOGOTA_ZONES[1]!;
  const [zoneSlug, setZoneSlug] = useState(initialZone.slug);
  const [lat, setLat] = useState(initialZone.lat);
  const [lng, setLng] = useState(initialZone.lng);
  const [state, action, pending] = useActionState(selfRegisterMerchant, INITIAL);

  function handleZoneChange(nextSlug: string) {
    setZoneSlug(nextSlug);
    const z = BOGOTA_ZONES.find((item) => item.slug === nextSlug);
    if (z) {
      setLat(z.lat);
      setLng(z.lng);
    }
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />

      {state.status === 'error' && (
        <div role="alert" className="rounded-xl border border-neg/25 bg-neg-light px-4 py-3 text-[14px] text-neg">
          {state.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="businessName" className="label">
            Nombre del negocio
          </label>
          <input
            id="businessName"
            name="businessName"
            type="text"
            required
            placeholder="Ej. Panadería La Espiga"
            className="field"
          />
        </div>

        <div>
          <label htmlFor="businessCategory" className="label">
            Tipo de comercio
          </label>
          <select id="businessCategory" name="businessCategory" defaultValue="panaderia" className="field">
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ownerName" className="label">
            Tu nombre (dueño o encargado)
          </label>
          <input
            id="ownerName"
            name="ownerName"
            type="text"
            required
            defaultValue={defaultOwnerName ?? ''}
            placeholder="Ej. Rosa Martínez"
            className="field"
          />
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
            placeholder="Ej. 310 555 0192"
            className="field"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="zoneSlug" className="label">
            Zona en Bogotá
          </label>
          <select
            id="zoneSlug"
            name="zoneSlug"
            value={zoneSlug}
            onChange={(e) => handleZoneChange(e.target.value)}
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
            Barrio específico
          </label>
          <input
            id="neighborhood"
            name="neighborhood"
            type="text"
            placeholder="Ej. Chapinero Central"
            className="field"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="address" className="label">
            Dirección del local
          </label>
          <input
            id="address"
            name="address"
            type="text"
            required
            placeholder="Ej. Cra 9 # 58-14"
            className="field"
          />
        </div>

        <div>
          <label htmlFor="typicalTicket" className="label">
            Compra promedio de un cliente ($)
          </label>
          <MoneyInput
            id="typicalTicket"
            name="typicalTicket"
            defaultValue={20000}
            placeholder="20.000"
            presets={[10000, 20000, 35000, 50000]}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="hoursText" className="label">
            Horario habitual
          </label>
          <input
            id="hoursText"
            name="hoursText"
            type="text"
            defaultValue="Lun a Sáb 7:00 a. m. – 8:00 p. m."
            className="field"
          />
        </div>

        <div>
          <label htmlFor="brebKey" className="label">
            Llave Bre-B o Nequi (opcional)
          </label>
          <input
            id="brebKey"
            name="brebKey"
            type="text"
            placeholder="Ej. @laespiga o 3105550192"
            className="field"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="label">
          Ubica el punto de tu local en el mapa (toca o arrastra el marcador)
        </span>
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
        <p className="tnum text-[12px] text-ink-faint">
          Coordenadas: {lat.toFixed(5)}, {lng.toFixed(5)} — sirve para mostrar tu oferta a vecinos que caminan cerca.
        </p>
      </div>

      {!isLoggedIn && (
        <div className="space-y-4 rounded-2xl border border-line bg-paper p-4">
          <p className="text-[13.5px] font-semibold text-ink">
            Crea tu cuenta para entrar a la caja y ver tus ventas atribuidas
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="label">
                Tu correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="rosa@ejemplo.com"
                className="field"
              />
            </div>
            <div>
              <label htmlFor="password" className="label">
                Contraseña (mínimo 10 caracteres)
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={10}
                placeholder="Mínimo 10 caracteres"
                className="field"
              />
            </div>
          </div>
        </div>
      )}

      <button type="submit" disabled={pending} className="btn-terra w-full text-[16px]">
        <Store size={18} aria-hidden="true" />
        {pending ? 'Creando tu vitrina en CIFRA...' : 'Registrar mi negocio y crear primera oferta'}
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </form>
  );
}
