'use client';

import { Check, Copy, KeyRound, MessageCircle, Plus, Send } from 'lucide-react';
import { useActionState, useState } from 'react';
import {
  createPartnerWithKey,
  createStreetMerchant,
  generateNewInviteLink,
  type AdminActionResult,
} from './actions';
import { BOGOTA_ZONES } from '@/lib/zones';

const INITIAL: AdminActionResult = { status: 'idle' };

export function StreetMerchantCrmForm() {
  const [state, action, pending] = useActionState(createStreetMerchant, INITIAL);
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <form action={action} className="surface-card space-y-4 p-5">
      <div>
        <h3 className="font-display text-[19px] font-bold text-ink">
          Afiliar micronegocio de calle y generar link de WhatsApp
        </h3>
        <p className="text-[13.5px] text-ink-muted">
          Canal de adquisición directa (J.4): registra a Rosa en la visita de 10 minutos y envíale su acceso en 1 toque.
        </p>
      </div>

      {state.status === 'error' && (
        <div className="rounded-xl bg-neg-light px-3.5 py-2.5 text-[13.5px] text-neg">{state.message}</div>
      )}

      {state.status === 'ok' && (
        <div className="space-y-2.5 rounded-2xl border border-primary/30 bg-primary-pale p-4 text-[13.5px]">
          <p className="font-semibold text-primary-dark">{state.message}</p>
          {state.inviteUrl && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-1.5 font-mono text-[12px] text-ink">
                {state.inviteUrl}
              </code>
              <button
                type="button"
                onClick={() => copy(state.inviteUrl!)}
                className="btn-sm border border-line bg-white text-ink"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar link'}
              </button>
              {state.whatsappHref && (
                <a
                  href={state.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-sm bg-primary text-white"
                >
                  <MessageCircle size={14} />
                  Enviar por WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3.5 sm:grid-cols-3">
        <div>
          <label className="label">Nombre del comercio</label>
          <input name="name" required placeholder="Panadería La Espiga" className="field py-2.5 text-[14px]" />
        </div>
        <div>
          <label className="label">Propietario/a</label>
          <input name="ownerName" required placeholder="Rosa Martínez" className="field py-2.5 text-[14px]" />
        </div>
        <div>
          <label className="label">WhatsApp</label>
          <input name="whatsapp" required placeholder="3105550192" className="field py-2.5 text-[14px]" />
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-4">
        <div>
          <label className="label">Categoría</label>
          <select name="businessCategory" defaultValue="panaderia" className="field py-2.5 text-[14px]">
            <option value="panaderia">Panadería</option>
            <option value="cafeteria">Cafetería</option>
            <option value="restaurante">Restaurante</option>
            <option value="tienda">Tienda de barrio</option>
            <option value="fruver">Fruver</option>
            <option value="papeleria">Papelería</option>
            <option value="drogueria">Droguería</option>
            <option value="peluqueria">Peluquería</option>
            <option value="servicios">Servicios</option>
          </select>
        </div>
        <div>
          <label className="label">Zona Bogotá</label>
          <select name="zoneSlug" defaultValue="chapinero" className="field py-2.5 text-[14px]">
            {BOGOTA_ZONES.map((z) => (
              <option key={z.slug} value={z.slug}>
                {z.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Dirección</label>
          <input name="address" required placeholder="Cra 9 # 58-14" className="field py-2.5 text-[14px]" />
        </div>
        <div>
          <label className="label">Compra promedio de un cliente ($)</label>
          <input
            name="typicalTicket"
            inputMode="numeric"
            required
            placeholder="La que diga el tendero"
            className="field py-2.5 text-[14px] tnum"
          />
        </div>
      </div>

      <button type="submit" disabled={pending} className="btn-terra text-[14px]">
        <Plus size={16} aria-hidden="true" />
        {pending ? 'Creando...' : 'Registrar comercio y generar link de WhatsApp'}
      </button>
    </form>
  );
}

export function ReissueInviteButton({ merchantId }: { merchantId: string }) {
  const [state, action, pending] = useActionState(generateNewInviteLink, INITIAL);

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="merchantId" value={merchantId} />
        <button type="submit" disabled={pending} className="btn-sm border border-line bg-white text-[12px] text-ink">
          <Send size={12} aria-hidden="true" />
          {pending ? 'Generando...' : 'Link WhatsApp'}
        </button>
      </form>
      {state.status === 'ok' && state.whatsappHref && (
        <a
          href={state.whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="text-[11.5px] font-semibold text-primary-dark underline"
        >
          Abrir WhatsApp →
        </a>
      )}
    </div>
  );
}

export function CreatePartnerForm() {
  const [state, action, pending] = useActionState(createPartnerWithKey, INITIAL);
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <form action={action} className="surface-card space-y-4 p-5">
      <div>
        <h3 className="font-display text-[19px] font-bold text-ink">
          Crear aliado (cooperativa, caja o billetera) y emitir llave API (J.3)
        </h3>
        <p className="text-[13.5px] text-ink-muted">
          El aliado conserva la relación con sus asociados y recibe el 30 % de la comisión de las ofertas que redimen sus asociados.
        </p>
      </div>

      {state.status === 'error' && (
        <div className="rounded-xl bg-neg-light px-3.5 py-2.5 text-[13.5px] text-neg">{state.message}</div>
      )}

      {state.status === 'ok' && (
        <div className="space-y-2.5 rounded-2xl border border-primary/30 bg-primary-pale p-4 text-[13.5px]">
          <p className="font-semibold text-primary-dark">{state.message}</p>
          {state.apiKeyPlain && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg bg-ink px-3 py-2 font-mono text-[13px] text-white">
                {state.apiKeyPlain}
              </code>
              <button
                type="button"
                onClick={() => copy(state.apiKeyPlain!)}
                className="btn-sm border border-line bg-white text-ink"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiada' : 'Copiar llave'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3.5 sm:grid-cols-3">
        <div>
          <label className="label">Nombre de la entidad</label>
          <input name="name" required placeholder="Cooperativa Coopfuturo" className="field py-2.5 text-[14px]" />
        </div>
        <div>
          <label className="label">Correo técnico / comercial</label>
          <input name="contactEmail" type="email" placeholder="integraciones@entidad.co" className="field py-2.5 text-[14px]" />
        </div>
        <div>
          <label className="label">Reparto de comisión (%)</label>
          <input
            name="sharePercent"
            type="number"
            min={5}
            max={41}
            defaultValue={30}
            className="field py-2.5 text-[14px] tnum"
          />
        </div>
      </div>

      <button type="submit" disabled={pending} className="btn-primary text-[14px]">
        <KeyRound size={16} aria-hidden="true" />
        {pending ? 'Emitiendo llave...' : 'Crear aliado y emitir llave cfk_'}
      </button>
    </form>
  );
}
