export interface BogotaZone {
  slug: string;
  name: string;
  localidad: string;
  lat: number;
  lng: number;
  description: string;
}

export const BOGOTA_ZONES: BogotaZone[] = [
  {
    slug: 'las-aguas',
    name: 'Las Aguas · Centro / Uniandes',
    localidad: 'La Candelaria / Santa Fe',
    lat: 4.6026,
    lng: -74.0663,
    description: 'Eje universitario CityU, Las Aguas y Carrera Séptima.',
  },
  {
    slug: 'chapinero',
    name: 'Chapinero Central y Alto',
    localidad: 'Chapinero',
    lat: 4.6432,
    lng: -74.0631,
    description: 'Entre calles 45 y 72, alta densidad de estudiantes y primer empleo.',
  },
  {
    slug: 'teusaquillo',
    name: 'Teusaquillo · Parkway',
    localidad: 'Teusaquillo',
    lat: 4.6305,
    lng: -74.0748,
    description: 'Parkway, La Soledad y Palermo: comercio independiente de barrio.',
  },
  {
    slug: 'usaquen',
    name: 'Usaquén · Cedritos',
    localidad: 'Usaquén',
    lat: 4.7165,
    lng: -74.0418,
    description: 'Zonas residenciales del norte con alto comercio de cercanía.',
  },
  {
    slug: 'modelia',
    name: 'Modelia · Salitre',
    localidad: 'Fontibón / Teusaquillo',
    lat: 4.6652,
    lng: -74.1135,
    description: 'Corredor residencial y de oficinas del occidente.',
  },
  {
    slug: 'suba',
    name: 'Suba · Colina y Niza',
    localidad: 'Suba',
    lat: 4.7248,
    lng: -74.0695,
    description: 'Barrios residenciales familiares con comercio tradicional.',
  },
  {
    slug: 'kennedy',
    name: 'Kennedy · Mandalay y Castilla',
    localidad: 'Kennedy',
    lat: 4.6321,
    lng: -74.1462,
    description: 'Alta densidad de micronegocios de barrio en el suroccidente.',
  },
];

export function getZoneBySlug(slug: string | null | undefined): BogotaZone {
  return BOGOTA_ZONES.find((z) => z.slug === slug) ?? BOGOTA_ZONES[1]!;
}

/** Distancia en kilómetros entre dos puntos usando la fórmula de Haversine. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const meters = Math.max(50, Math.round((km * 1000) / 10) * 10);
    return `A ${meters} m`;
  }
  return `A ${km.toFixed(1).replace('.', ',')} km`;
}
