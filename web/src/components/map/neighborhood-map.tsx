'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

export interface MapOfferPin {
  id: string;
  lat: number;
  lng: number;
  merchantName: string;
  title: string;
  badgeText: string;
  neighborhood: string;
}

export interface NeighborhoodMapProps {
  centerLat: number;
  centerLng: number;
  zoom?: number;
  pins?: MapOfferPin[];
  selectedId?: string | null;
  onSelectPin?: (id: string) => void;
  pickerLat?: number;
  pickerLng?: number;
  onPickLocation?: (lat: number, lng: number) => void;
  heightClassName?: string;
}

function makePinIcon(active: boolean, color: 'terra' | 'primary') {
  const bg = color === 'terra' ? (active ? '#8E3B10' : '#B94E18') : '#0B6B58';
  const size = active ? 32 : 26;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:999px;background:${bg};border:3px solid #ffffff;box-shadow:0 4px 12px rgba(16,29,26,0.28);color:#fff;font-weight:800;font-size:11px;">●</span>`,
  });
}

export default function NeighborhoodMap({
  centerLat,
  centerLng,
  zoom = 14,
  pins = [],
  selectedId,
  onSelectPin,
  pickerLat,
  pickerLng,
  onPickLocation,
  heightClassName = 'h-72',
}: NeighborhoodMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [centerLat, centerLng],
      zoom,
      scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    if (onPickLocation) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onPickLocation(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;
    group.clearLayers();

    if (pickerLat != null && pickerLng != null) {
      const marker = L.marker([pickerLat, pickerLng], {
        icon: makePinIcon(true, 'primary'),
        draggable: Boolean(onPickLocation),
      });
      marker.bindTooltip('Ubicación de tu negocio', { direction: 'top', offset: [0, -12] });
      if (onPickLocation) {
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onPickLocation(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
        });
      }
      marker.addTo(group);
      map.setView([pickerLat, pickerLng], map.getZoom());
      return;
    }

    // Punto de referencia de la zona de la persona
    L.circleMarker([centerLat, centerLng], {
      radius: 7,
      color: '#0B6B58',
      fillColor: '#DDF2EC',
      fillOpacity: 0.9,
      weight: 2,
    })
      .bindTooltip('Tu zona de referencia', { direction: 'top' })
      .addTo(group);

    for (const pin of pins) {
      const active = pin.id === selectedId;
      const m = L.marker([pin.lat, pin.lng], { icon: makePinIcon(active, 'terra') });
      m.bindPopup(
        `<div style="font-family:system-ui,sans-serif;min-width:170px;">
          <div style="font-size:11px;font-weight:700;color:#B94E18;">${escapeHtml(pin.badgeText)}</div>
          <div style="font-size:14px;font-weight:700;color:#101D1A;margin-top:2px;">${escapeHtml(pin.merchantName)}</div>
          <div style="font-size:12.5px;color:#4A5B56;margin-top:2px;">${escapeHtml(pin.title)}</div>
          <div style="font-size:11.5px;color:#758580;margin-top:3px;">${escapeHtml(pin.neighborhood)}</div>
        </div>`,
      );
      m.on('click', () => onSelectPin?.(pin.id));
      m.addTo(group);
    }
  }, [centerLat, centerLng, pins, selectedId, onSelectPin, pickerLat, pickerLng, onPickLocation]);

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden rounded-2xl border border-line bg-paper-warm ${heightClassName}`}
      aria-label="Mapa interactivo de comercios de barrio"
    />
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
