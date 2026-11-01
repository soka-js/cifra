/**
 * Convierte la descripción cruda de un extracto ("COMPRA INTL SPOTIFY P1A2B3 STOCKHOLM")
 * en un comercio reconocible ("Spotify") y una llave estable para agrupar cobros que se repiten.
 */

export type Category =
  | 'suscripciones'
  | 'telefonia_internet'
  | 'servicios_hogar'
  | 'mercado'
  | 'comida'
  | 'transporte'
  | 'combustible'
  | 'salud'
  | 'gimnasio'
  | 'educacion'
  | 'efectivo'
  | 'comisiones'
  | 'transferencias'
  | 'pagos_tarjeta'
  | 'ingresos'
  | 'otros';

export const CATEGORY_LABEL: Record<Category, string> = {
  suscripciones: 'Suscripciones',
  telefonia_internet: 'Celular e internet',
  servicios_hogar: 'Servicios del hogar',
  mercado: 'Mercado',
  comida: 'Comida y domicilios',
  transporte: 'Transporte',
  combustible: 'Gasolina',
  salud: 'Salud y droguería',
  gimnasio: 'Gimnasio',
  educacion: 'Educación',
  efectivo: 'Retiros en efectivo',
  comisiones: 'Cuotas e impuestos bancarios',
  transferencias: 'Transferencias',
  pagos_tarjeta: 'Pagos de tarjeta',
  ingresos: 'Ingresos',
  otros: 'Otros',
};

interface KnownMerchant {
  key: string;
  name: string;
  category: Category;
  pattern: RegExp;
}

// Orden importa: el primero que coincide gana (por ejemplo, RAPPI PRIME antes que RAPPI).
const KNOWN: KnownMerchant[] = [
  { key: 'netflix', name: 'Netflix', category: 'suscripciones', pattern: /\bNETFLIX/ },
  { key: 'spotify', name: 'Spotify', category: 'suscripciones', pattern: /\bSPOTIFY/ },
  { key: 'youtube', name: 'YouTube Premium', category: 'suscripciones', pattern: /\bYOUTUBE|GOOGLE\s*\*?\s*YOUTUBE/ },
  { key: 'disney', name: 'Disney+', category: 'suscripciones', pattern: /\bDISNEY/ },
  { key: 'max', name: 'Max', category: 'suscripciones', pattern: /\bHBO|\bMAX\.COM|\bHBOMAX/ },
  { key: 'prime_video', name: 'Prime Video', category: 'suscripciones', pattern: /PRIME\s*VIDEO|AMAZON\s*PRIME|PRIMEVIDEO/ },
  { key: 'apple', name: 'Apple (iCloud, App Store)', category: 'suscripciones', pattern: /\bAPPLE\.COM|\bAPPLE\b|\bICLOUD|ITUNES/ },
  { key: 'google_one', name: 'Google One', category: 'suscripciones', pattern: /GOOGLE\s*\*?\s*(ONE|STORAGE)/ },
  { key: 'google_play', name: 'Google Play', category: 'suscripciones', pattern: /GOOGLE\s*\*?\s*PLAY|GOOGLE\s*PLAY/ },
  { key: 'microsoft', name: 'Microsoft 365 / Xbox', category: 'suscripciones', pattern: /\bMICROSOFT|\bMSFT|\bXBOX/ },
  { key: 'playstation', name: 'PlayStation', category: 'suscripciones', pattern: /PLAYSTATION|\bSONY\s*NETWORK/ },
  { key: 'openai', name: 'ChatGPT', category: 'suscripciones', pattern: /\bOPENAI|CHATGPT/ },
  { key: 'crunchyroll', name: 'Crunchyroll', category: 'suscripciones', pattern: /CRUNCHYROLL/ },
  { key: 'deezer', name: 'Deezer', category: 'suscripciones', pattern: /\bDEEZER/ },
  { key: 'paramount', name: 'Paramount+', category: 'suscripciones', pattern: /PARAMOUNT/ },
  { key: 'canva', name: 'Canva', category: 'suscripciones', pattern: /\bCANVA/ },
  { key: 'duolingo', name: 'Duolingo', category: 'suscripciones', pattern: /DUOLINGO/ },
  { key: 'rappi_prime', name: 'Rappi Prime', category: 'suscripciones', pattern: /RAPPI\s*PRIME|RAPPIPRIME/ },
  { key: 'claro', name: 'Claro', category: 'telefonia_internet', pattern: /\bCLARO\b|COMCEL|TELMEX/ },
  { key: 'movistar', name: 'Movistar', category: 'telefonia_internet', pattern: /MOVISTAR|TELEFONICA/ },
  { key: 'tigo', name: 'Tigo', category: 'telefonia_internet', pattern: /\bTIGO\b|\bUNE\b|COLOMBIA\s*MOVIL/ },
  { key: 'wom', name: 'WOM', category: 'telefonia_internet', pattern: /\bWOM\b|PARTNERS\s*TELECOM/ },
  { key: 'etb', name: 'ETB', category: 'telefonia_internet', pattern: /\bETB\b|EMPRESA\s*DE\s*TELECOMUNICACIONES/ },
  { key: 'enel', name: 'Enel (energía)', category: 'servicios_hogar', pattern: /\bENEL\b|CODENSA/ },
  { key: 'vanti', name: 'Vanti (gas)', category: 'servicios_hogar', pattern: /\bVANTI\b|GAS\s*NATURAL/ },
  { key: 'acueducto', name: 'Acueducto', category: 'servicios_hogar', pattern: /ACUEDUCTO|\bEAAB\b/ },
  { key: 'epm', name: 'EPM', category: 'servicios_hogar', pattern: /\bEPM\b|EMPRESAS\s*PUBLICAS/ },
  { key: 'smart_fit', name: 'Smart Fit', category: 'gimnasio', pattern: /SMART\s*FIT|SMARTFIT/ },
  { key: 'bodytech', name: 'Bodytech', category: 'gimnasio', pattern: /BODYTECH|BODY\s*TECH/ },
  { key: 'rappi', name: 'Rappi', category: 'comida', pattern: /\bRAPPI/ },
  { key: 'ifood', name: 'iFood', category: 'comida', pattern: /\bIFOOD/ },
  { key: 'didi_food', name: 'DiDi Food', category: 'comida', pattern: /DIDI\s*FOOD/ },
  { key: 'uber', name: 'Uber', category: 'transporte', pattern: /\bUBER/ },
  { key: 'didi', name: 'DiDi', category: 'transporte', pattern: /\bDIDI/ },
  { key: 'cabify', name: 'Cabify', category: 'transporte', pattern: /CABIFY/ },
  { key: 'indrive', name: 'inDrive', category: 'transporte', pattern: /INDRIVE|INDRIVER/ },
  { key: 'tullave', name: 'TuLlave (TransMilenio)', category: 'transporte', pattern: /TU\s*LLAVE|TULLAVE|TRANSMILENIO|RECAUDO\s*BOGOTA/ },
  { key: 'exito', name: 'Éxito', category: 'mercado', pattern: /\bEXITO\b|ALMACENES\s*EXITO/ },
  { key: 'carulla', name: 'Carulla', category: 'mercado', pattern: /CARULLA/ },
  { key: 'd1', name: 'D1', category: 'mercado', pattern: /\bD1\b|KOBA/ },
  { key: 'ara', name: 'Ara', category: 'mercado', pattern: /\bARA\b|JERONIMO\s*MARTINS/ },
  { key: 'olimpica', name: 'Olímpica', category: 'mercado', pattern: /OLIMPICA/ },
  { key: 'jumbo', name: 'Jumbo', category: 'mercado', pattern: /\bJUMBO\b|CENCOSUD/ },
  { key: 'makro', name: 'Makro', category: 'mercado', pattern: /\bMAKRO\b/ },
  { key: 'pricesmart', name: 'PriceSmart', category: 'mercado', pattern: /PRICESMART/ },
  { key: 'isimo', name: 'Ísimo', category: 'mercado', pattern: /\bISIMO\b/ },
  { key: 'farmatodo', name: 'Farmatodo', category: 'salud', pattern: /FARMATODO/ },
  { key: 'cruz_verde', name: 'Cruz Verde', category: 'salud', pattern: /CRUZ\s*VERDE/ },
  { key: 'la_rebaja', name: 'Drogas La Rebaja', category: 'salud', pattern: /LA\s*REBAJA/ },
  { key: 'terpel', name: 'Terpel', category: 'combustible', pattern: /TERPEL/ },
  { key: 'primax', name: 'Primax', category: 'combustible', pattern: /PRIMAX/ },
  { key: 'juan_valdez', name: 'Juan Valdez', category: 'comida', pattern: /JUAN\s*VALDEZ/ },
  { key: 'starbucks', name: 'Starbucks', category: 'comida', pattern: /STARBUCKS/ },
  { key: 'mcdonalds', name: "McDonald's", category: 'comida', pattern: /MC\s*DONALDS|MCDONALDS/ },
  { key: 'gmf', name: 'Impuesto 4x1000', category: 'comisiones', pattern: /4\s*X\s*1000|GRAVAMEN|\bGMF\b|IMPTO\s*GOBIERNO/ },
  { key: 'cuota_manejo', name: 'Cuota de manejo', category: 'comisiones', pattern: /CUOTA\s*(DE\s*)?MANEJO/ },
];

const PREFIXES = [
  'COMPRA INTL',
  'COMPRA INTERNACIONAL',
  'COMPRA EN',
  'COMPRA POS',
  'COMPRA',
  'PAGO PSE',
  'PAGO SV',
  'PAGO EN',
  'PAGO DE',
  'PAGO A',
  'PAGO',
  'DEBITO AUTOMATICO',
  'DEB AUTOMATICO',
  'DEBITO',
  'CARGO',
  'COBRO',
];

const NOISE = /\b(S\.?A\.?S\.?|S\.?A\.?|LTDA|E\.?S\.?P\.?|COLOMBIA|COL|CO|BOGOTA|BOGOTA DC|BOG|MEDELLIN|CALI|BARRANQUILLA|DC|WWW|COM|NET|INC|LLC|REF|NRO|NO)\b/g;

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export interface MerchantInfo {
  key: string;
  name: string;
  category: Category | null;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length <= 2 && w !== 'la' && w !== 'el' ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ');
}

export function cleanDescription(raw: string): string {
  let s = stripAccents(raw).toUpperCase().replace(/\s+/g, ' ').trim();
  for (const p of PREFIXES) {
    if (s.startsWith(p + ' ')) {
      s = s.slice(p.length + 1);
      break;
    }
  }
  return s
    .replace(/[*#_/\\|:;,]+/g, ' ')
    .replace(/\.(COM|CO|NET)\b/g, ' ')
    .replace(/\b[A-Z]*\d[A-Z0-9]*\b/g, ' ') // referencias y códigos con números
    .replace(NOISE, ' ')
    .replace(/[^A-Z&' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function identifyMerchant(description: string): MerchantInfo {
  const upper = stripAccents(description).toUpperCase();
  for (const m of KNOWN) {
    if (m.pattern.test(upper)) return { key: m.key, name: m.name, category: m.category };
  }
  const cleaned = cleanDescription(description);
  const words = cleaned.split(' ').filter((w) => w.length > 1);
  const significant = words.slice(0, 3);
  if (significant.length === 0) {
    return { key: 'sin_nombre', name: 'Sin descripción', category: null };
  }
  return {
    key: significant.join('_').toLowerCase(),
    name: titleCase(significant.join(' ')),
    category: null,
  };
}

const TRANSFER = /\b(TRANSF|TRANSFERENCIA|TRASLADO|TRASL|ENVIO|ENVIASTE|TRANSFIYA|BRE-?B|LLAVE|PAGO INTERBANC|A NEQUI|DESDE NEQUI|DAVIPLATA)\b/;
const CARD_PAYMENT = /\b(PAGO|ABONO)\s*(A\s*)?(TARJ|TARJETA|TC|T\.C|CREDITO)\b|PAGO TARJETA/;
const CASH = /\b(RETIRO|AVANCE)\b/;
const PAYROLL = /\b(NOMINA|SALARIO|SUELDO|HONORARIOS|PRIMA|CESANTIAS|ABONO NOMINA|PAGO NOMINA)\b/;

export type Flow = 'ingreso' | 'transferencia' | 'pago_tarjeta' | 'efectivo' | 'gasto';

/** Qué tipo de movimiento es, más allá del comercio. */
export function flowOf(description: string, amountMinor: number): Flow {
  const upper = stripAccents(description).toUpperCase();
  if (amountMinor > 0) {
    if (PAYROLL.test(upper)) return 'ingreso';
    if (TRANSFER.test(upper)) return 'transferencia';
    return 'ingreso';
  }
  if (CARD_PAYMENT.test(upper)) return 'pago_tarjeta';
  if (CASH.test(upper)) return 'efectivo';
  if (TRANSFER.test(upper)) return 'transferencia';
  return 'gasto';
}

export function isPayroll(description: string): boolean {
  return PAYROLL.test(stripAccents(description).toUpperCase());
}

export function categoryOf(description: string, amountMinor: number): Category {
  const flow = flowOf(description, amountMinor);
  if (flow === 'pago_tarjeta') return 'pagos_tarjeta';
  if (flow === 'efectivo') return 'efectivo';
  if (amountMinor > 0) return flow === 'transferencia' ? 'transferencias' : 'ingresos';
  const m = identifyMerchant(description);
  if (m.category) return m.category;
  if (flow === 'transferencia') return 'transferencias';
  return 'otros';
}
