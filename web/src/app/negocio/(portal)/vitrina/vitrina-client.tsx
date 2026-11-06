'use client';

import { CheckCircle2, Copy, ExternalLink, MessageCircle, Printer, Share2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { saveMerchantFeaturedItemsAction, type V3ActionState } from '@/app/actions/v3';
import { LogoMark } from '@/components/logo';
import type { MerchantFeaturedItem } from '@/lib/db/schema';

const INITIAL: V3ActionState = { status: 'idle' };

export function VitrinaClient({
  merchantName,
  merchantSlug,
  neighborhood,
  address,
  description,
  hoursText,
  featuredItems,
  publicUrl,
  posterQrDataUrl,
  headlineOfferTitle,
}: {
  merchantName: string;
  merchantSlug: string;
  neighborhood: string;
  address: string;
  description: string;
  hoursText: string;
  featuredItems: MerchantFeaturedItem[];
  publicUrl: string;
  posterQrDataUrl: string;
  headlineOfferTitle: string;
}) {
  const [state, action, pending] = useActionState(saveMerchantFeaturedItemsAction, INITIAL);
  const [copied, setCopied] = useState(false);

  const slots = [0, 1, 2, 3].map((idx) => ({
    name: featuredItems[idx]?.name ?? '',
    pricePesos: featuredItems[idx]?.priceMinor ? String(Math.round(featuredItems[idx]!.priceMinor / 100)) : '',
    tag: featuredItems[idx]?.tag ?? '',
  }));

  const waShareHref = `https://wa.me/?text=${encodeURIComponent(
    `¡Hola vecino! Conoce nuestra vitrina y reclama nuestro descuento directo en mostrador aquí: ${publicUrl}`,
  )}`;

  return (
    <div className="space-y-6">
      {/* Cabecera y barra de compartir (se oculta al imprimir el afiche) */}
      <div className="no-print space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="badge-terra">Herramienta gratuita de mostrador y WhatsApp</span>
            <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink">
              Mi vitrina digital y afiche QR
            </h1>
            <p className="mt-1 text-[15px] text-ink-muted">
              Comparte tu página propia en estados de WhatsApp o Instagram e imprime el hablador QR para tu mostrador.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/b/${merchantSlug}`} target="_blank" className="btn-ghost text-[13.5px]">
              Ver mi vitrina en vivo <ExternalLink size={15} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-terra text-[13.5px]"
            >
              <Printer size={16} aria-hidden="true" />
              Imprimir afiche de mostrador
            </button>
          </div>
        </div>

        {/* Enlace compartible rápido */}
        <section className="surface-card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-terra-dark">
              <Share2 size={13} aria-hidden="true" />
              Tu enlace directo para WhatsApp Business e Instagram
            </p>
            <p className="mt-1 truncate font-mono text-[14.5px] font-semibold text-ink">{publicUrl}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(publicUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  // ignore
                }
              }}
              className="btn-sm border border-line bg-paper text-ink hover:bg-white"
            >
              <Copy size={14} aria-hidden="true" />
              {copied ? 'Enlace copiado' : 'Copiar enlace'}
            </button>
            <a
              href={waShareHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-sm bg-primary text-white hover:bg-primary-dark"
            >
              <MessageCircle size={14} aria-hidden="true" />
              Compartir por WhatsApp
            </a>
          </div>
        </section>

        {/* Editor de recomendados de la casa */}
        <form action={action} className="surface-card space-y-5 p-5 sm:p-6">
          <div>
            <span className="badge-primary">
              <Sparkles size={12} aria-hidden="true" />
              Precios directos sin sobreprecio de apps
            </span>
            <h2 className="mt-2 font-display text-[20px] font-bold text-ink">
              Productos estrella que verán tus vecinos en /b/{merchantSlug}
            </h2>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="vit-desc" className="label">
                Presentación corta de tu local
              </label>
              <input
                id="vit-desc"
                name="description"
                type="text"
                defaultValue={description}
                placeholder="Ej. Pan de masa madre recién horneado y café de origen."
                className="field"
              />
            </div>
            <div>
              <label htmlFor="vit-hours" className="label">
                Horario de atención
              </label>
              <input
                id="vit-hours"
                name="hoursText"
                type="text"
                defaultValue={hoursText}
                placeholder="Ej. Lun a Sáb 6:30 a. m. – 7:30 p. m."
                className="field"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {slots.map((slot, idx) => (
              <div key={idx} className="rounded-2xl border border-line bg-paper/65 p-3.5">
                <p className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">
                  Producto #{idx + 1}
                </p>
                <div className="mt-2 space-y-2.5">
                  <input
                    name={`itemName_${idx}`}
                    type="text"
                    defaultValue={slot.name}
                    placeholder="Ej. Combo croissant + capuchino"
                    className="field bg-white py-2 text-[14px]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      name={`itemPrice_${idx}`}
                      type="text"
                      inputMode="numeric"
                      defaultValue={slot.pricePesos}
                      placeholder="Precio ($) ej. 14500"
                      className="field tnum bg-white py-2 text-[14px]"
                    />
                    <input
                      name={`itemTag_${idx}`}
                      type="text"
                      defaultValue={slot.tag}
                      placeholder="Etiqueta (ej. Recién salido)"
                      className="field bg-white py-2 text-[13px]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {state.status !== 'idle' && (
            <p
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold ${
                state.status === 'error'
                  ? 'bg-neg-light text-neg-dark'
                  : 'bg-primary-light text-primary-dark'
              }`}
            >
              {state.status === 'ok' && <CheckCircle2 size={15} aria-hidden="true" />}
              {state.message}
            </p>
          )}

          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Guardando vitrina…' : 'Guardar productos y actualizar vitrina'}
          </button>
        </form>
      </div>

      {/* Afiche / Hablador QR imprimible de mostrador (visible en pantalla y protagonista al imprimir) */}
      <section
        aria-label="Afiche QR imprimible de mostrador"
        className="mx-auto max-w-md rounded-3xl border-2 border-ink bg-white p-7 text-center shadow-card print:max-w-none print:border-2 print:shadow-none"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-terra-pale px-3.5 py-1 text-[12px] font-bold uppercase tracking-wider text-terra-dark">
          Beneficio directo para vecinos de {neighborhood}
        </div>

        <h2 className="mt-3 font-display text-[28px] font-extrabold leading-tight text-ink">
          {merchantName}
        </h2>
        <p className="mt-1 text-[13.5px] text-ink-muted">{address}</p>

        <div className="my-5 inline-block rounded-3xl border-2 border-dashed border-terra/50 bg-paper p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={posterQrDataUrl}
            alt={`QR vitrina de ${merchantName}`}
            className="mx-auto h-52 w-52 rounded-xl bg-white p-2"
          />
        </div>

        <p className="rounded-2xl bg-primary-pale px-4 py-3 font-display text-[18px] font-bold leading-snug text-primary-dark">
          {headlineOfferTitle}
        </p>

        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
          Escanea con la cámara de tu celular, activa tu código en 5 segundos y muéstralo aquí en caja.{' '}
          <strong className="text-ink">Sin recargos de aplicaciones.</strong>
        </p>

        <div className="mt-5 flex items-center justify-center gap-2 border-t border-line pt-4 text-[12px] font-semibold text-ink-faint">
          <LogoMark size={18} />
          <span>Comercio independiente verificado en CIFRA</span>
        </div>
      </section>
    </div>
  );
}
