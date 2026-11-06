'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  List,
  Map as MapIcon,
  MapPin,
  QrCode,
  Sparkles,
  Store,
  Tag,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  claimOfferCode,
  confirmRedemptionByUser,
  disputeRedemptionByUser,
} from '@/app/actions/merchant';
import { LazyNeighborhoodMap } from '@/components/map/neighborhood-map-lazy';
import type { MapOfferPin } from '@/components/map/neighborhood-map';
import type { RankedOffer } from '@/lib/engine/attribution';
import { cop, shortDate } from '@/lib/format';
import type { ActiveCodeView, UserRedemptionView } from '@/lib/merchant-data';

interface OffersClientProps {
  centerLat: number;
  centerLng: number;
  zoneLabel: string;
  ranked: RankedOffer[];
  activeCodes: Record<string, ActiveCodeView>;
  recentRedemptions: UserRedemptionView[];
}

function CountdownLabel({ expiresAtIso }: { expiresAtIso: string }) {
  const [remainingMin, setRemainingMin] = useState<number>(() =>
    Math.max(1, Math.ceil((new Date(expiresAtIso).getTime() - Date.now()) / 60_000)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      const mins = Math.max(0, Math.ceil((new Date(expiresAtIso).getTime() - Date.now()) / 60_000));
      setRemainingMin(mins);
    }, 15_000);
    return () => clearInterval(id);
  }, [expiresAtIso]);

  if (remainingMin <= 0) {
    return <span className="text-neg">Código vencido · recarga para generar uno nuevo</span>;
  }
  return <span>Vigente por {remainingMin} min en mostrador</span>;
}

export function OffersClient({
  centerLat,
  centerLng,
  zoneLabel,
  ranked,
  activeCodes,
  recentRedemptions,
}: OffersClientProps) {
  const [view, setView] = useState<'both' | 'map'>('both');
  const [selectedId, setSelectedId] = useState<string | null>(ranked[0]?.offer.id ?? null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [disputingId, setDisputingId] = useState<string | null>(null);

  const pins: MapOfferPin[] = ranked.map((item) => ({
    id: item.offer.id,
    lat: item.offer.lat,
    lng: item.offer.lng,
    merchantName: item.offer.merchantName,
    title: item.offer.title,
    badgeText:
      item.offer.discountKind === 'percent'
        ? `${item.offer.discountPercent}% OFF`
        : `-${cop(item.offer.discountFixedMinor ?? 0)}`,
    neighborhood: item.offer.neighborhood,
  }));

  function handleSelectPin(id: string) {
    setSelectedId(id);
    const el = document.getElementById(`offer-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Ignorar si el navegador restringe portapapeles
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-[13.5px] text-ink-soft">
          <MapPin size={16} className="text-terra" aria-hidden="true" />
          <span>
            Zona activa: <strong className="font-semibold text-ink">{zoneLabel}</strong>
          </span>
          <Link href="/app/ajustes#zona" className="ml-1 text-[12.5px] font-semibold text-primary-dark underline">
            Cambiar
          </Link>
        </div>

        {ranked.length > 0 && (
          <div className="inline-flex rounded-xl bg-paper p-1">
            <button
              type="button"
              onClick={() => setView('both')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                view === 'both' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <List size={14} aria-hidden="true" />
              Lista + Mapa
            </button>
            <button
              type="button"
              onClick={() => setView('map')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                view === 'map' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <MapIcon size={14} aria-hidden="true" />
              Mapa grande
            </button>
          </div>
        )}
      </div>

      {ranked.length > 0 && (
        <LazyNeighborhoodMap
          centerLat={centerLat}
          centerLng={centerLng}
          pins={pins}
          selectedId={selectedId}
          onSelectPin={handleSelectPin}
          heightClassName={view === 'map' ? 'h-[420px]' : 'h-64'}
        />
      )}

      {ranked.length === 0 ? (
        <div className="surface-card space-y-3 p-6">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-terra-light text-terra-dark">
            <Store size={20} aria-hidden="true" />
          </div>
          <p className="text-[16px] font-semibold text-ink">Aún no hay campañas elegibles para ti hoy</p>
          <p className="text-[14px] leading-relaxed text-ink-muted">
            Mostramos únicamente beneficios reales de comercios independientes cercanos y en rubros donde compras. Ajusta tu barrio en{' '}
            <Link href="/app/ajustes#zona" className="font-semibold text-primary-dark underline">
              Ajustes
            </Link>{' '}
            o, si tienes un negocio de barrio,{' '}
            <Link href="/negocio/unirse" className="font-semibold text-terra-dark underline">
              publica tu primera campaña sin pagar por adelantado
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {ranked.map((item) => {
            const activeCode = activeCodes[item.offer.id];
            const isSelected = selectedId === item.offer.id;
            const discountText =
              item.offer.discountKind === 'percent'
                ? `${item.offer.discountPercent} % de descuento`
                : `${cop(item.offer.discountFixedMinor ?? 0)} de descuento`;

            return (
              <li
                id={`offer-${item.offer.id}`}
                key={item.offer.id}
                onClick={() => setSelectedId(item.offer.id)}
                className={`surface-card overflow-hidden transition-colors ${
                  isSelected ? 'border-terra/60' : ''
                }`}
              >
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge-terra">
                          <Tag size={12} aria-hidden="true" />
                          {discountText}
                        </span>
                        {item.isNewCustomer && item.offer.newCustomersOnly && (
                          <span className="badge-primary">
                            <Sparkles size={11} aria-hidden="true" />
                            Primera visita
                          </span>
                        )}
                        <span className="text-[13px] font-semibold text-ink-muted">
                          {item.offer.merchantName}
                        </span>
                      </div>

                      <h2 className="font-display text-[20px] font-bold leading-snug text-ink">
                        {item.offer.title}
                      </h2>

                      {item.offer.description && (
                        <p className="text-[14px] leading-relaxed text-ink-soft">{item.offer.description}</p>
                      )}
                    </div>

                    <div className="rounded-xl bg-primary-pale px-3 py-2 text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-dark">
                        Ahorro estimado
                      </p>
                      <p className="tnum text-[17px] font-bold text-primary-dark">
                        ~{cop(item.estimatedSavingsMinor)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={13} className="text-terra" aria-hidden="true" />
                      {item.whyRelevant} · {item.offer.address}
                    </span>
                    {item.offer.hoursText && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={13} aria-hidden="true" />
                        {item.offer.hoursText}
                      </span>
                    )}
                    {item.offer.minPurchaseMinor > 0 && (
                      <span>Compra mínima: {cop(item.offer.minPurchaseMinor)}</span>
                    )}
                  </div>

                  {activeCode ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-terra/50 bg-terra-pale/60 p-4">
                      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                        <div
                          className="shrink-0 overflow-hidden rounded-xl border border-line bg-white p-2 shadow-sm"
                          dangerouslySetInnerHTML={{ __html: activeCode.qrSvg }}
                        />
                        <div className="flex-1 text-center sm:text-left">
                          <p className="text-[12px] font-semibold uppercase tracking-wider text-terra-dark">
                            Código único de un solo uso
                          </p>
                          <div className="mt-1 flex items-center justify-center gap-2 sm:justify-start">
                            <span className="tnum rounded-xl border border-line bg-white px-3.5 py-1.5 font-mono text-[26px] font-bold tracking-[0.2em] text-ink">
                              {activeCode.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyCode(activeCode.code)}
                              className="btn-sm border border-line bg-white text-ink hover:bg-paper"
                            >
                              <Copy size={14} aria-hidden="true" />
                              {copiedCode === activeCode.code ? 'Copiado' : 'Copiar'}
                            </button>
                          </div>
                          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                            Muéstrale este QR o díctale las 6 letras a quien te atiende en caja. El descuento se aplica de inmediato y se suma a tus{' '}
                            <strong className="font-semibold text-ink">pesos ahorrados con CIFRA</strong>.
                          </p>
                          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted">
                            <Clock size={13} aria-hidden="true" />
                            <CountdownLabel expiresAtIso={activeCode.expiresAtIso} />
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form action={claimOfferCode} className="mt-4">
                      <input type="hidden" name="offerId" value={item.offer.id} />
                      <button type="submit" className="btn-terra w-full sm:w-auto">
                        <QrCode size={17} aria-hidden="true" />
                        Generar código y QR para usar en caja
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {recentRedemptions.length > 0 && (
        <section id="recientes" className="space-y-3 pt-2">
          <div>
            <h2 className="font-display text-[20px] font-bold text-ink">
              Beneficios usados recientemente
            </h2>
            <p className="text-[13.5px] text-ink-muted">
              Confirmación bilateral: verifica que el descuento recibido en caja coincida con tu compra.
            </p>
          </div>

          <ul className="space-y-2.5">
            {recentRedemptions.map((r) => (
              <li key={r.id} className="surface-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold text-ink">
                      {r.merchantName} · <span className="font-normal text-ink-soft">{r.offerTitle}</span>
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-ink-muted">
                      {shortDate(r.redeemedOn)} · Cuenta de {cop(r.grossAmountMinor)} → pagaste{' '}
                      <strong className="tnum font-semibold text-ink">{cop(r.netPaidByUserMinor)}</strong>
                    </p>
                  </div>
                  <span className="badge-primary tnum">Ahorraste {cop(r.discountMinor)}</span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  {r.disputed ? (
                    <span className="badge-warn">
                      <AlertTriangle size={12} aria-hidden="true" />
                      En revisión por el equipo CIFRA
                    </span>
                  ) : r.confirmed ? (
                    <span className="badge-primary">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      Confirmado por ti
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={confirmRedemptionByUser}>
                        <input type="hidden" name="redemptionId" value={r.id} />
                        <button
                          type="submit"
                          className="btn-sm bg-primary text-white hover:bg-primary-dark"
                        >
                          <CheckCircle2 size={14} aria-hidden="true" />
                          Sí, recibí este descuento
                        </button>
                      </form>
                      <button
                        type="button"
                        onClick={() => setDisputingId(disputingId === r.id ? null : r.id)}
                        className="btn-sm border border-line bg-white text-ink-muted hover:text-ink"
                      >
                        Reportar diferencia
                      </button>
                    </div>
                  )}
                </div>

                {disputingId === r.id && !r.disputed && (
                  <form action={disputeRedemptionByUser} className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="redemptionId" value={r.id} />
                    <input
                      type="text"
                      name="reason"
                      required
                      placeholder="Cuéntanos qué ocurrió en caja (ej. monto distinto)"
                      className="field py-2 text-[14px]"
                    />
                    <button type="submit" className="btn-sm shrink-0 bg-ink text-white">
                      Enviar reporte
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
