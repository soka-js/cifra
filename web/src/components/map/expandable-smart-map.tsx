'use client';

import {
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  LocateFixed,
  MapPin,
  QrCode,
  Sparkles,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { claimOfferCodeInlineAction } from '@/app/actions/v3';
import type { MapOfferPin } from '@/components/map/neighborhood-map';
import { LazyNeighborhoodMap } from '@/components/map/neighborhood-map-lazy';
import {
  crossReferenceOffers,
  TIME_BAND_META,
  type MapTimeFilter,
} from '@/lib/engine/crossref';
import { cop } from '@/lib/format';
import type { SmartMapBundle, SmartMapPendingCode } from '@/lib/v3-data';

interface ExpandableSmartMapProps {
  bundle: SmartMapBundle;
  defaultExpanded?: boolean;
  initialCategoryFilter?: string | null;
  compactTitle?: string;
  compactSubtitle?: string;
}

const TIME_PILLS: Array<{ key: MapTimeFilter; label: string }> = [
  { key: 'todas', label: 'Todas las franjas' },
  { key: 'ahora', label: 'Activas ahora' },
  { key: 'manana', label: 'Mañana' },
  { key: 'almuerzo', label: 'Mediodía' },
  { key: 'tarde', label: 'Tarde · Cero merma' },
  { key: 'noche', label: 'Noche' },
];

const CATEGORY_LABELS: Record<string, string> = {
  comida: 'Comida y café',
  mercado: 'Mercado y fruver',
  salud: 'Droguería y salud',
  educacion: 'Papelería y estudio',
  ocio: 'Salidas',
};

export function ExpandableSmartMap({
  bundle,
  defaultExpanded = false,
  initialCategoryFilter = null,
  compactTitle = 'Mapa inteligente de tu cuadra',
  compactSubtitle,
}: ExpandableSmartMapProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [timeFilter, setTimeFilter] = useState<MapTimeFilter>('todas');
  const [catFilter, setCatFilter] = useState<string | null>(initialCategoryFilter);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: bundle.defaultLat,
    lng: bundle.defaultLng,
  });
  const [gpsStatus, setGpsStatus] = useState<'zona' | 'buscando' | 'exacta' | 'denegada'>('zona');
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [codes, setCodes] = useState<Record<string, SmartMapPendingCode>>(bundle.pendingCodesByOfferId);
  const [claimError, setClaimError] = useState<Record<string, string>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const matched = useMemo(
    () =>
      crossReferenceOffers({
        offers: bundle.offers,
        profile: bundle.profile,
        userLat: userCoords.lat,
        userLng: userCoords.lng,
        currentHour: bundle.currentHour,
        dayOfWeek: bundle.dayOfWeek,
        filter: timeFilter,
        categoryFilter: catFilter,
      }),
    [bundle, userCoords, timeFilter, catFilter],
  );

  const flashCount = useMemo(() => matched.filter((m) => m.isFlash).length, [matched]);
  const habitCount = useMemo(() => matched.filter((m) => m.habitMatched).length, [matched]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const o of bundle.offers) set.add(o.targetCategory);
    return [...set];
  }, [bundle.offers]);

  const pins: MapOfferPin[] = useMemo(
    () =>
      matched.map((o) => ({
        id: o.offerId,
        lat: o.lat,
        lng: o.lng,
        merchantName: o.merchantName,
        title: o.title,
        badgeText:
          o.discountKind === 'percent'
            ? `${o.discountPercent}% OFF`
            : `-${cop(o.discountFixedMinor ?? 0)}`,
        neighborhood: o.neighborhood,
        isFlash: o.isFlash,
        distanceText:
          o.walkMinutes !== null && o.distanceMeters !== null
            ? `A ${o.walkMinutes} min caminando (${o.distanceMeters} m)`
            : undefined,
      })),
    [matched],
  );

  function requestLiveGps() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('denegada');
      return;
    }
    setGpsStatus('buscando');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setGpsStatus('exacta');
      },
      () => {
        setGpsStatus('denegada');
      },
      { enableHighAccuracy: true, timeout: 7000 },
    );
  }

  function handleSelectPin(id: string) {
    setSelectedOfferId(id);
    const el = document.getElementById(`smart-offer-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function handleClaim(offerId: string) {
    setClaimingId(offerId);
    setClaimError((prev) => ({ ...prev, [offerId]: '' }));
    startTransition(async () => {
      const res = await claimOfferCodeInlineAction(offerId);
      setClaimingId(null);
      if (!res.ok || !res.code || !res.qrDataUrl || !res.expiresAtIso) {
        setClaimError((prev) => ({
          ...prev,
          [offerId]: res.error ?? 'No pudimos generar el código en este momento.',
        }));
        return;
      }
      setCodes((prev) => ({
        ...prev,
        [offerId]: {
          code: res.code!,
          qrDataUrl: res.qrDataUrl!,
          expiresAtIso: res.expiresAtIso!,
        },
      }));
    });
  }

  async function copyToClipboard(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // ignore
    }
  }

  if (bundle.offers.length === 0) return null;

  return (
    <section className="surface-card overflow-hidden border-terra/25">
      {/* Cabecera colapsable / desplegable */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-terra-pale/70 via-white to-primary-pale/50 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-terra inline-flex items-center gap-1">
              <Zap size={12} aria-hidden="true" />
              {flashCount > 0
                ? `${flashCount} relámpago${flashCount === 1 ? '' : 's'} viva${flashCount === 1 ? '' : 's'}`
                : `${matched.length} locales cerca`}
            </span>
            {habitCount > 0 && (
              <span className="badge-primary inline-flex items-center gap-1">
                <Sparkles size={12} aria-hidden="true" />
                {habitCount} cruza{habitCount === 1 ? '' : 'n'} con tus gastos
              </span>
            )}
          </div>
          <h2 className="mt-2 font-display text-[19px] font-bold leading-snug text-ink">
            {compactTitle}
          </h2>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">
            {compactSubtitle ??
              `Cruzamos tus rubros reales de consumo con comercios en ${bundle.zoneLabel}, distancia a pie y descuentos por franja horaria.`}
          </p>
        </div>

        <button
          id="btn-toggle-smart-map"
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={expanded ? 'btn-ghost shrink-0 text-[13.5px]' : 'btn-ink shrink-0 text-[13.5px]'}
          aria-expanded={expanded}
        >
          <MapPin size={15} aria-hidden="true" />
          {expanded ? 'Plegar mapa' : 'Desplegar mapa y descuentos'}
          {expanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-line p-4 sm:p-5">
          {/* Barra de ubicación GPS en vivo + filtros horarios */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
              <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                <MapPin size={15} className="text-terra" aria-hidden="true" />
                {gpsStatus === 'exacta' ? 'Tu GPS exacto activo' : `Zona base: ${bundle.zoneLabel}`}
              </span>
              <button
                type="button"
                onClick={requestLiveGps}
                disabled={gpsStatus === 'buscando'}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2.5 py-1 text-[12px] font-semibold text-primary-dark hover:border-primary/40 hover:bg-primary-pale"
              >
                <LocateFixed size={13} aria-hidden="true" />
                {gpsStatus === 'buscando'
                  ? 'Ubicando…'
                  : gpsStatus === 'exacta'
                    ? 'Actualizar GPS'
                    : 'Usar mi ubicación actual'}
              </button>
              {gpsStatus === 'denegada' && (
                <span className="text-[12px] text-ink-faint">
                  (Sin permiso GPS · calculando desde {bundle.zoneLabel})
                </span>
              )}
            </div>

            {availableCategories.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCatFilter(null)}
                  className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                    catFilter === null
                      ? 'bg-ink text-white'
                      : 'border border-line bg-white text-ink-muted hover:text-ink'
                  }`}
                >
                  Todo rubro
                </button>
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatFilter(cat === catFilter ? null : cat)}
                    className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                      catFilter === cat
                        ? 'bg-ink text-white'
                        : 'border border-line bg-white text-ink-muted hover:text-ink'
                    }`}
                  >
                    {CATEGORY_LABELS[cat] ?? cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Píldoras de franjas horarias */}
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar por franja horaria">
            {TIME_PILLS.map((pill) => {
              const active = timeFilter === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTimeFilter(pill.key)}
                  className={`rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    active
                      ? 'bg-primary text-white shadow-sm'
                      : 'border border-line bg-paper text-ink-muted hover:bg-white hover:text-ink'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Mapa interactivo Leaflet */}
          <LazyNeighborhoodMap
            centerLat={userCoords.lat}
            centerLng={userCoords.lng}
            zoom={15}
            pins={pins}
            selectedId={selectedOfferId ?? matched[0]?.offerId ?? null}
            onSelectPin={handleSelectPin}
            heightClassName="h-72 sm:h-80"
          />

          {/* Leyenda rápida de pines */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-faint">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-grid h-4 w-4 place-items-center rounded-full bg-amber-600 text-[9px] font-bold text-white">
                  ⚡
                </span>
                Oferta relámpago / cero merma con cupos vivos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-terra" />
                Descuento permanente del barrio
              </span>
            </div>
            <span>Hora local Bogotá: {bundle.currentHour}:00</span>
          </div>

          {/* Tarjetas cruzadas con el gasto real del usuario */}
          {matched.length === 0 ? (
            <div className="rounded-2xl border border-line bg-paper p-5 text-center text-[14px] text-ink-muted">
              No hay ofertas activas exactamente en esa franja horaria.{' '}
              <button
                type="button"
                onClick={() => {
                  setTimeFilter('todas');
                  setCatFilter(null);
                }}
                className="font-semibold text-primary-dark underline"
              >
                Ver todas las franjas del barrio
              </button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {matched.slice(0, 6).map((item) => {
                const activeCode = codes[item.offerId];
                const isSelected = selectedOfferId === item.offerId;
                const errMsg = claimError[item.offerId];

                return (
                  <article
                    id={`smart-offer-${item.offerId}`}
                    key={item.offerId}
                    onClick={() => setSelectedOfferId(item.offerId)}
                    className={`rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? 'border-terra bg-terra-pale/35 ring-1 ring-terra/30'
                        : 'border-line bg-white hover:border-line-strong'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.isFlash ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11.5px] font-bold text-amber-900">
                            ⚡ Relámpago
                            {item.stockRemaining !== null ? ` · Quedan ${item.stockRemaining}` : ''}
                          </span>
                        ) : (
                          <span className="badge-terra text-[11.5px]">
                            {item.discountKind === 'percent'
                              ? `-${item.discountPercent}%`
                              : `-${cop(item.discountFixedMinor ?? 0)}`}
                          </span>
                        )}
                        {item.walkMinutes !== null && (
                          <span className="rounded-full bg-paper px-2.5 py-0.5 text-[11.5px] font-medium text-ink-muted">
                            🚶 {item.walkMinutes} min ({item.distanceMeters} m)
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/b/${item.merchantSlug}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary-dark hover:underline"
                      >
                        Ver vitrina <ExternalLink size={12} aria-hidden="true" />
                      </Link>
                    </div>

                    <div className="mt-2.5 flex items-baseline justify-between gap-2">
                      <div>
                        <p className="text-[12.5px] font-semibold text-terra-dark">
                          {item.merchantName} · {item.neighborhood}
                        </p>
                        <h3 className="font-display text-[17px] font-bold leading-snug text-ink">
                          {item.title}
                        </h3>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="block text-[11px] uppercase tracking-wide text-ink-faint">
                          Ahorras aprox.
                        </span>
                        <span className="tnum font-display text-[18px] font-extrabold text-primary-dark">
                          {cop(item.vsHabitualSavingsMinor)}
                        </span>
                      </div>
                    </div>

                    <p className="mt-1.5 rounded-xl bg-paper px-3 py-2 text-[12.5px] leading-snug text-ink-soft">
                      <strong className="font-semibold text-ink">Cruce CIFRA:</strong> {item.whyThisMatches}
                      {item.userAvgTicketMinor ? (
                        <span className="tnum text-ink-muted">
                          {' '}
                          · Tu ticket habitual en este rubro: {cop(item.userAvgTicketMinor)}.
                        </span>
                      ) : null}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-faint">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} aria-hidden="true" /> {item.windowLabel}
                      </span>
                      <span>
                        {item.activeBands.length < 4
                          ? item.activeBands.map((b) => TIME_BAND_META[b].shortLabel).join(', ')
                          : 'Todo el día'}
                      </span>
                    </div>

                    {errMsg && <p className="mt-2 text-[12.5px] font-medium text-neg">{errMsg}</p>}

                    {activeCode ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary-pale/60 p-3"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activeCode.qrDataUrl}
                          alt={`QR ${activeCode.code}`}
                          className="h-20 w-20 shrink-0 rounded-lg border border-line bg-white p-1"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-primary-dark">
                            Muéstralo en caja
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="tnum font-mono text-[22px] font-extrabold tracking-widest text-ink">
                              {activeCode.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(activeCode.code)}
                              className="rounded-lg border border-line bg-white px-2 py-1 text-[11.5px] font-semibold text-ink-soft hover:text-ink"
                            >
                              <Copy size={12} className="inline" aria-hidden="true" />{' '}
                              {copiedCode === activeCode.code ? 'Copiado' : 'Copiar'}
                            </button>
                          </div>
                          <p className="mt-1 text-[11.5px] text-ink-muted">
                            Válido 30 min · Al pasar en caja actualiza tu tope de hoy solo.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <button
                          type="button"
                          disabled={isPending && claimingId === item.offerId}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClaim(item.offerId);
                          }}
                          className="btn-sm w-full justify-center bg-ink text-white hover:bg-ink/90"
                        >
                          <QrCode size={14} aria-hidden="true" />
                          {isPending && claimingId === item.offerId
                            ? 'Generando código…'
                            : 'Activar descuento y ver QR de caja'}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
