'use client';

import { ArrowRight, Store } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { selfRegisterMerchant, type MerchantActionState } from '@/app/actions/merchant';
import { MerchantConsent } from '@/components/negocio/merchant-consent';
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

const STEPS = 2;
const TITLES = ['Tu negocio', 'Tus datos'];

/**
 * Registro del negocio en dos pasos cortos: primero el negocio (lo que necesita una oferta para
 * existir), después quién lo atiende y su acceso. El barrio, el horario, la llave de pago y el
 * punto exacto en el mapa se agregan después en Perfil; aquí no se inventa ninguno.
 */
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
  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(selfRegisterMerchant, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const zone = BOGOTA_ZONES.find((z) => z.slug === zoneSlug) ?? initialZone;

  useEffect(() => {
    if (mounted.current) headingRef.current?.focus();
    mounted.current = true;
  }, [step]);

  /**
   * Lo que el formulario enviaría en ese campo. Se lee con FormData y no con `elements.namedItem`,
   * que también busca por id: la compra promedio tiene la caja visible con id="typicalTicket" y el
   * valor limpio en un campo oculto con name="typicalTicket", y con dos resultados no lee ninguno.
   */
  function value(name: string): string {
    const form = formRef.current;
    return form ? String(new FormData(form).get(name) ?? '') : '';
  }

  /** Lo mínimo para que el negocio y su primera oferta existan. El servidor lo vuelve a revisar. */
  function checkBusiness(): string | null {
    if (value('businessName').trim().length < 2) return 'Escribe el nombre de tu negocio.';
    if (value('address').trim().length < 4) return 'Escribe la dirección del local.';
    if (!value('typicalTicket').trim()) return 'Escribe cuánto compra en promedio un cliente en tu negocio.';
    return null;
  }

  function next() {
    const problem = checkBusiness();
    setLocalError(problem);
    if (!problem) setStep(1);
  }

  const error = localError ?? (state.status === 'error' && step === STEPS - 1 ? state.message : null);

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-5"
      onChange={() => {
        if (localError) setLocalError(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && step === 0 && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          next();
        }
      }}
      onSubmit={(e) => {
        if (step === 0) {
          e.preventDefault();
          next();
        }
      }}
    >
      {/* El punto en el mapa arranca en el centro de la zona; el tendero lo afina en Perfil. */}
      <input type="hidden" name="lat" value={zone.lat} />
      <input type="hidden" name="lng" value={zone.lng} />

      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-terra' : 'bg-line'}`} />
          ))}
        </div>
        <span className="tnum text-[13px] font-semibold text-ink-muted">
          Paso {step + 1} de {STEPS}
        </span>
      </div>

      <h2 ref={headingRef} tabIndex={-1} className="font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink outline-none">
        {TITLES[step]}
      </h2>

      <fieldset hidden={step !== 0} className="space-y-4">
        <legend className="sr-only">Tu negocio</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="businessName" className="label">
              Nombre del negocio
            </label>
            <input id="businessName" name="businessName" type="text" required placeholder="Ej. Panadería La Espiga" className="field" />
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
            <label htmlFor="zoneSlug" className="label">
              Zona en Bogotá
            </label>
            <select id="zoneSlug" name="zoneSlug" value={zoneSlug} onChange={(e) => setZoneSlug(e.target.value)} className="field">
              {BOGOTA_ZONES.map((z) => (
                <option key={z.slug} value={z.slug}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="address" className="label">
              Dirección del local
            </label>
            <input id="address" name="address" type="text" required placeholder="Ej. Cra 9 # 58-14" className="field" />
          </div>
        </div>

        <div>
          <label htmlFor="typicalTicket" className="label">
            Compra promedio de un cliente ($)
          </label>
          <MoneyInput
            id="typicalTicket"
            name="typicalTicket"
            required
            placeholder="Lo que gasta un cliente en una visita"
            presets={[10000, 20000, 35000, 50000]}
          />
          <p className="mt-1.5 text-[12.5px] text-ink-faint">
            La usamos para proponerte el monto en la caja y para tus cuentas. Puedes cambiarla cuando quieras.
          </p>
        </div>

        <p className="text-[13px] leading-relaxed text-ink-muted">
          El barrio, el horario, tu llave de pago y el punto exacto en el mapa los agregas después en Perfil.
        </p>
      </fieldset>

      <fieldset hidden={step !== 1} className="space-y-4">
        <legend className="sr-only">Tus datos</legend>
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
            <input id="whatsapp" name="whatsapp" type="tel" required placeholder="Ej. 310 555 0192" className="field" />
          </div>
        </div>

        {!isLoggedIn && (
          <>
            <p className="text-[13.5px] font-semibold text-ink">Tu acceso, para entrar a la caja y ver tus ventas</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="label">
                  Tu correo electrónico
                </label>
                <input id="email" name="email" type="email" required placeholder="rosa@ejemplo.com" className="field" />
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
            <MerchantConsent />
          </>
        )}
      </fieldset>

      {error && (
        <div role="alert" className="rounded-xl border border-neg/25 bg-neg-light px-4 py-3 text-[14px] text-neg">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => {
              setLocalError(null);
              setStep(0);
            }}
            className="btn-ghost px-5"
          >
            Atrás
          </button>
        )}
        {step === 0 ? (
          <button id="btn-negocio-seguir" type="button" onClick={next} className="btn-terra flex-1 text-[16px]">
            Seguir <ArrowRight size={17} aria-hidden="true" />
          </button>
        ) : (
          <button type="submit" disabled={pending} className="btn-terra flex-1 text-[16px]">
            <Store size={18} aria-hidden="true" />
            {pending ? 'Creando tu negocio en CIFRA…' : 'Registrar mi negocio'}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  );
}
