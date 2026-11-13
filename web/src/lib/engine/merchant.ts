/**
 * Convierte la descripción cruda de un extracto ("COMPRA INTL SPOTIFY P1A2B3 STOCKHOLM")
 * en un comercio reconocible ("Spotify"), una llave estable para agrupar cobros que se repiten,
 * reglas personalizadas del usuario y guías accionables de cancelación para Colombia.
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
  | 'compras'
  | 'ocio'
  | 'efectivo'
  | 'comisiones'
  | 'transferencias'
  | 'pagos_tarjeta'
  | 'ingresos'
  | 'otros';

export const CATEGORY_LABEL: Record<Category, string> = {
  suscripciones: 'Suscripciones digitales',
  telefonia_internet: 'Celular e internet',
  servicios_hogar: 'Servicios del hogar',
  mercado: 'Mercado y tienda',
  comida: 'Comida, cafés y domicilios',
  transporte: 'Transporte y movilidad',
  combustible: 'Gasolina y peajes',
  salud: 'Salud y droguería',
  gimnasio: 'Gimnasio y deporte',
  educacion: 'Educación y libros',
  compras: 'Ropa y compras',
  ocio: 'Salidas y entretenimiento',
  efectivo: 'Retiros en efectivo',
  comisiones: 'Cuotas e impuestos bancarios',
  transferencias: 'Transferencias',
  pagos_tarjeta: 'Pagos de tarjeta',
  ingresos: 'Ingresos',
  otros: 'Otros gastos',
};

/** Categorías elegibles cuando una persona reclasifica un gasto en un toque. */
export const EDITABLE_CATEGORIES: Category[] = [
  'comida',
  'mercado',
  'transporte',
  'ocio',
  'compras',
  'suscripciones',
  'servicios_hogar',
  'telefonia_internet',
  'salud',
  'gimnasio',
  'educacion',
  'combustible',
  'comisiones',
  'transferencias',
  'otros',
];

export interface UserCategoryOverride {
  category: Category;
  customName?: string | null;
}

interface KnownMerchant {
  key: string;
  name: string;
  category: Category;
  pattern: RegExp;
}

// Orden importa: el primero que coincide gana (por ejemplo, RAPPI PRIME antes que RAPPI).
const KNOWN: KnownMerchant[] = [
  // Suscripciones y software
  { key: 'netflix', name: 'Netflix', category: 'suscripciones', pattern: /\bNETFLIX/ },
  { key: 'spotify', name: 'Spotify', category: 'suscripciones', pattern: /\bSPOTIFY/ },
  { key: 'youtube', name: 'YouTube Premium', category: 'suscripciones', pattern: /\bYOUTUBE|GOOGLE\s*\*?\s*YOUTUBE/ },
  { key: 'disney', name: 'Disney+', category: 'suscripciones', pattern: /\bDISNEY/ },
  { key: 'max', name: 'Max', category: 'suscripciones', pattern: /\bHBO|\bMAX\.COM|\bHBOMAX|\bWBD\s*MAX/ },
  { key: 'prime_video', name: 'Prime Video', category: 'suscripciones', pattern: /PRIME\s*VIDEO|AMAZON\s*PRIME|PRIMEVIDEO/ },
  { key: 'apple', name: 'Apple (iCloud, App Store)', category: 'suscripciones', pattern: /\bAPPLE\.COM|\bAPPLE\b|\bICLOUD|ITUNES/ },
  { key: 'google_one', name: 'Google One', category: 'suscripciones', pattern: /GOOGLE\s*\*?\s*(ONE|STORAGE)/ },
  { key: 'google_play', name: 'Google Play', category: 'suscripciones', pattern: /GOOGLE\s*\*?\s*PLAY|GOOGLE\s*PLAY/ },
  { key: 'microsoft', name: 'Microsoft 365 / Xbox', category: 'suscripciones', pattern: /\bMICROSOFT|\bMSFT|\bXBOX/ },
  { key: 'playstation', name: 'PlayStation', category: 'suscripciones', pattern: /PLAYSTATION|\bSONY\s*NETWORK/ },
  { key: 'openai', name: 'ChatGPT', category: 'suscripciones', pattern: /\bOPENAI|CHATGPT/ },
  { key: 'claude', name: 'Claude AI', category: 'suscripciones', pattern: /\bANTHROPIC|\bCLAUDE\.AI/ },
  { key: 'crunchyroll', name: 'Crunchyroll', category: 'suscripciones', pattern: /CRUNCHYROLL/ },
  { key: 'deezer', name: 'Deezer', category: 'suscripciones', pattern: /\bDEEZER/ },
  { key: 'paramount', name: 'Paramount+', category: 'suscripciones', pattern: /PARAMOUNT/ },
  { key: 'canva', name: 'Canva', category: 'suscripciones', pattern: /\bCANVA/ },
  { key: 'adobe', name: 'Adobe Creative Cloud', category: 'suscripciones', pattern: /\bADOBE\b/ },
  { key: 'github', name: 'GitHub', category: 'suscripciones', pattern: /\bGITHUB\b/ },
  { key: 'duolingo', name: 'Duolingo', category: 'suscripciones', pattern: /DUOLINGO/ },
  { key: 'rappi_prime', name: 'Rappi Prime', category: 'suscripciones', pattern: /RAPPI\s*PRIME|RAPPIPRIME/ },
  { key: 'meli_mas', name: 'Meli+ (Mercado Libre)', category: 'suscripciones', pattern: /MELI\s*MAS|NIVEL\s*6\s*MERCADOLIBRE/ },
  { key: 'el_tiempo', name: 'El Tiempo Digital', category: 'suscripciones', pattern: /CASA\s*EDITORIAL\s*EL\s*TIEMPO|ELTIEMPO\.COM/ },
  { key: 'el_espectador', name: 'El Espectador', category: 'suscripciones', pattern: /COMUNICAN\s*S|ELESPECTADOR/ },

  // Telefonía e internet Colombia
  { key: 'claro', name: 'Claro', category: 'telefonia_internet', pattern: /\bCLARO\b|COMCEL|TELMEX/ },
  { key: 'movistar', name: 'Movistar', category: 'telefonia_internet', pattern: /MOVISTAR|TELEFONICA|COLOMBIA\s*TELECOM/ },
  { key: 'tigo', name: 'Tigo', category: 'telefonia_internet', pattern: /\bTIGO\b|\bUNE\b|COLOMBIA\s*MOVIL/ },
  { key: 'wom', name: 'WOM', category: 'telefonia_internet', pattern: /\bWOM\b|PARTNERS\s*TELECOM/ },
  { key: 'etb', name: 'ETB', category: 'telefonia_internet', pattern: /\bETB\b|EMPRESA\s*DE\s*TELECOMUNICACIONES/ },
  { key: 'virgin', name: 'Virgin Mobile', category: 'telefonia_internet', pattern: /VIRGIN\s*MOBILE/ },

  // Servicios públicos del hogar
  { key: 'enel', name: 'Enel (energía)', category: 'servicios_hogar', pattern: /\bENEL\b|CODENSA/ },
  { key: 'vanti', name: 'Vanti (gas)', category: 'servicios_hogar', pattern: /\bVANTI\b|GAS\s*NATURAL/ },
  { key: 'acueducto', name: 'Acueducto de Bogotá', category: 'servicios_hogar', pattern: /ACUEDUCTO|\bEAAB\b/ },
  { key: 'epm', name: 'EPM', category: 'servicios_hogar', pattern: /\bEPM\b|EMPRESAS\s*PUBLICAS/ },
  { key: 'aseo_bogota', name: 'Aseo / Lime / Ciudad Limpia', category: 'servicios_hogar', pattern: /CIUDAD\s*LIMPIA|BOGOTA\s*LIMPIA|PROMOAMBIENTAL/ },
  { key: 'conjuntos', name: 'Administración edificio', category: 'servicios_hogar', pattern: /CONJUNTO\s*RESIDENCIAL|EDIFICIO\s+|PROP\s*HORIZ/ },

  // Gimnasio y deporte
  { key: 'smart_fit', name: 'Smart Fit', category: 'gimnasio', pattern: /SMART\s*FIT|SMARTFIT/ },
  { key: 'bodytech', name: 'Bodytech', category: 'gimnasio', pattern: /BODYTECH|BODY\s*TECH/ },
  { key: 'spinning_center', name: 'Spinning Center', category: 'gimnasio', pattern: /SPINNING\s*CENTER/ },
  { key: 'stark_gym', name: 'Stark Gym', category: 'gimnasio', pattern: /STARK\s*SMART|STARK\s*GYM/ },

  // Comida, cafés, panaderías y domicilios
  { key: 'rappi', name: 'Rappi', category: 'comida', pattern: /\bRAPPI/ },
  { key: 'ifood', name: 'iFood', category: 'comida', pattern: /\bIFOOD/ },
  { key: 'didi_food', name: 'DiDi Food', category: 'comida', pattern: /DIDI\s*FOOD/ },
  { key: 'juan_valdez', name: 'Juan Valdez', category: 'comida', pattern: /JUAN\s*VALDEZ|PROCACOL/ },
  { key: 'starbucks', name: 'Starbucks', category: 'comida', pattern: /STARBUCKS/ },
  { key: 'tostao', name: "Tostao' Café & Pan", category: 'comida', pattern: /TOSTAO|BBI\s*COLOMBIA/ },
  { key: 'oma', name: 'Oma', category: 'comida', pattern: /\bOMA\b\s*CAFE|RESTAURANTES\s*OMA/ },
  { key: 'crepes_waffles', name: 'Crepes & Waffles', category: 'comida', pattern: /CREPES\s*(AND|&|Y)?\s*WAFFLES/ },
  { key: 'el_corral', name: 'El Corral', category: 'comida', pattern: /EL\s*CORRAL|IRCC/ },
  { key: 'home_burgers', name: 'Home Burgers', category: 'comida', pattern: /HOME\s*BURGERS/ },
  { key: 'frisby', name: 'Frisby', category: 'comida', pattern: /\bFRISBY\b/ },
  { key: 'kokoriko', name: 'Kokoriko', category: 'comida', pattern: /KOKORIKO/ },
  { key: 'mcdonalds', name: "McDonald's", category: 'comida', pattern: /MC\s*DONALDS|MCDONALDS|ARCOS\s*DORADOS/ },
  { key: 'kfc', name: 'KFC', category: 'comida', pattern: /\bKFC\b/ },
  { key: 'subway', name: 'Subway', category: 'comida', pattern: /\bSUBWAY\b/ },
  { key: 'dominos', name: "Domino's Pizza", category: 'comida', pattern: /DOMINOS\s*PIZZA|DOMINO'S/ },
  { key: 'hornitos', name: 'Hornitos', category: 'comida', pattern: /HORNITOS/ },
  { key: 'pan_pa_ya', name: "Pan Pa' Ya!", category: 'comida', pattern: /PAN\s*PA\s*YA/ },
  { key: 'masa', name: 'Masa', category: 'comida', pattern: /MASA\s*(CAFE|PANADERIA|BOG)/ },

  // Transporte y movilidad
  { key: 'uber', name: 'Uber', category: 'transporte', pattern: /\bUBER/ },
  { key: 'didi', name: 'DiDi', category: 'transporte', pattern: /\bDIDI/ },
  { key: 'cabify', name: 'Cabify', category: 'transporte', pattern: /CABIFY/ },
  { key: 'indrive', name: 'inDrive', category: 'transporte', pattern: /INDRIVE|INDRIVER/ },
  { key: 'picap', name: 'Picap', category: 'transporte', pattern: /\bPICAP\b/ },
  { key: 'tullave', name: 'TuLlave (TransMilenio)', category: 'transporte', pattern: /TU\s*LLAVE|TULLAVE|TRANSMILENIO|RECAUDO\s*BOGOTA/ },
  { key: 'gopass', name: 'GoPass / Flypass (peajes y parqueo)', category: 'combustible', pattern: /GOPASS|FLYPASS|PARKING\s*INTERNATIONAL|APARCAR/ },

  // Mercado y tiendas de conveniencia
  { key: 'exito', name: 'Éxito', category: 'mercado', pattern: /\bEXITO\b|ALMACENES\s*EXITO/ },
  { key: 'carulla', name: 'Carulla', category: 'mercado', pattern: /CARULLA/ },
  { key: 'd1', name: 'D1', category: 'mercado', pattern: /\bD1\b|KOBA\s*COLOMBIA|\bKOBA\b/ },
  { key: 'ara', name: 'Tiendas Ara', category: 'mercado', pattern: /\bARA\b|JERONIMO\s*MARTINS/ },
  { key: 'olimpica', name: 'Olímpica', category: 'mercado', pattern: /OLIMPICA|SUPERTIENDAS\s*Y\s*DROGUERIAS/ },
  { key: 'jumbo', name: 'Jumbo / Metro', category: 'mercado', pattern: /\bJUMBO\b|CENCOSUD|\bTIENDAS\s*METRO\b/ },
  { key: 'makro', name: 'Makro', category: 'mercado', pattern: /\bMAKRO\b/ },
  { key: 'pricesmart', name: 'PriceSmart', category: 'mercado', pattern: /PRICESMART/ },
  { key: 'isimo', name: 'Ísimo', category: 'mercado', pattern: /\bISIMO\b/ },
  { key: 'oxxo', name: 'OXXO', category: 'mercado', pattern: /\bOXXO\b/ },
  { key: 'surtimax', name: 'Surtimax', category: 'mercado', pattern: /SURTIMAX/ },
  { key: 'colsubsidio_mkt', name: 'Supermercado Colsubsidio', category: 'mercado', pattern: /COLSUBSIDIO\s*(SUPER|MERCADO)/ },

  // Salud, droguerías y seguros médicos
  { key: 'farmatodo', name: 'Farmatodo', category: 'salud', pattern: /FARMATODO/ },
  { key: 'cruz_verde', name: 'Cruz Verde', category: 'salud', pattern: /CRUZ\s*VERDE/ },
  { key: 'la_rebaja', name: 'Drogas La Rebaja', category: 'salud', pattern: /LA\s*REBAJA|COPSERVIR/ },
  { key: 'locatel', name: 'Locatel', category: 'salud', pattern: /LOCATEL/ },
  { key: 'cafam_drog', name: 'Droguerías Cafam', category: 'salud', pattern: /CAFAM/ },
  { key: 'colsanitas', name: 'Colsanitas / EPS Sanitas', category: 'salud', pattern: /COLSANITAS|SANITAS/ },
  { key: 'sura_salud', name: 'Sura (Salud / Seguros)', category: 'salud', pattern: /SURAMERICANA|\bEPS\s*SURA|\bSEGUROS\s*SURA/ },
  { key: 'compensar', name: 'Compensar', category: 'salud', pattern: /COMPENSAR/ },

  // Combustible
  { key: 'terpel', name: 'Terpel', category: 'combustible', pattern: /TERPEL|\bEDS\s*TERPEL/ },
  { key: 'primax', name: 'Primax', category: 'combustible', pattern: /PRIMAX/ },
  { key: 'biomax', name: 'Biomax / Texaco', category: 'combustible', pattern: /BIOMAX|TEXACO/ },

  // Educación y papelería
  { key: 'uniandes', name: 'Universidad de los Andes', category: 'educacion', pattern: /UNIANDES|UNIVERSIDAD\s*DE\s*LOS\s*ANDES/ },
  { key: 'javeriana', name: 'Universidad Javeriana', category: 'educacion', pattern: /JAVERIANA/ },
  { key: 'panamericana', name: 'Panamericana', category: 'educacion', pattern: /PANAMERICANA/ },
  { key: 'platzi', name: 'Platzi', category: 'educacion', pattern: /\bPLATZI\b/ },

  // Compras y hogar
  { key: 'mercadolibre', name: 'Mercado Libre / Mercado Pago', category: 'compras', pattern: /MERCADOLIBRE|MERCADOPAGO|MELI\b/ },
  { key: 'amazon', name: 'Amazon', category: 'compras', pattern: /\bAMAZON\.COM|\bAMZN\b/ },
  { key: 'falabella', name: 'Falabella', category: 'compras', pattern: /FALABELLA/ },
  { key: 'homecenter', name: 'Homecenter', category: 'compras', pattern: /HOMECENTER|SODIMAC/ },
  { key: 'dollarcity', name: 'Dollarcity', category: 'compras', pattern: /DOLLARCITY/ },
  { key: 'decathlon', name: 'Decathlon', category: 'compras', pattern: /DECATHLON/ },
  { key: 'arturo_calle', name: 'Arturo Calle', category: 'compras', pattern: /ARTURO\s*CALLE/ },
  { key: 'koaj', name: 'Koaj', category: 'compras', pattern: /\bKOAJ\b|PERMODA/ },
  { key: 'zara', name: 'Zara / Bershka / Pull&Bear', category: 'compras', pattern: /\bZARA\b|BERSHKA|PULL\s*AND\s*BEAR/ },

  // Salidas, cine y entretenimiento
  { key: 'cine_colombia', name: 'Cine Colombia', category: 'ocio', pattern: /CINE\s*COLOMBIA|CINECOLOMBIA/ },
  { key: 'cinemark', name: 'Cinemark', category: 'ocio', pattern: /CINEMARK/ },
  { key: 'tuboleta', name: 'TuBoleta / TaquillaLive', category: 'ocio', pattern: /TUBOLETA|TAQUILLALIVE|ETICKET/ },
  { key: 'bbc', name: 'Bogotá Beer Company', category: 'ocio', pattern: /BOGOTA\s*BEER|\bBBC\b\s*PUB/ },

  // Comisiones, seguros bancarios e impuestos
  { key: 'gmf', name: 'Impuesto 4x1000', category: 'comisiones', pattern: /4\s*X\s*1000|GRAVAMEN|\bGMF\b|IMPTO\s*GOBIERNO/ },
  { key: 'cuota_manejo', name: 'Cuota de manejo', category: 'comisiones', pattern: /CUOTA\s*(DE\s*)?MANEJO/ },
  { key: 'seguro_banco', name: 'Seguro bancario / tarjeta', category: 'comisiones', pattern: /SEGURO\s*(DEUDOR|FRAUDE|TARJETA|PROTECCION)|CARDIF|ASSURANT/ },
];

export interface CancellationGuide {
  title: string;
  url?: string;
  steps: string[];
  legalNote?: string;
  estimatedMinutes: number;
}

const CANCELLATION_GUIDES: Record<string, CancellationGuide> = {
  netflix: {
    title: 'Cancelar Netflix sin perder los días ya pagados',
    url: 'https://www.netflix.com/cancelplan',
    estimatedMinutes: 2,
    steps: [
      'Entra a netflix.com/cancelplan desde tu navegador con tu sesión.',
      'Toca «Completar cancelación». Seguirás teniendo acceso hasta el cierre de tu ciclo actual.',
      'Si lo pagas dentro de una factura de Claro o Movistar, cancélalo desde la app Mi Claro / Mi Movistar en Servicios adicionales.',
    ],
  },
  spotify: {
    title: 'Pasar Spotify a plan gratuito',
    url: 'https://www.spotify.com/co-es/account/overview/',
    estimatedMinutes: 2,
    steps: [
      'Abre spotify.com/account desde el navegador (en la app de iPhone no siempre aparece el botón).',
      'En «Tu plan», toca «Cambiar plan» y baja hasta «Cancelar Spotify Premium».',
      'Tus listas de reproducción y canciones guardadas no se borran.',
    ],
  },
  disney: {
    title: 'Cancelar Disney+ antes de la renovación',
    url: 'https://www.disneyplus.com/account',
    estimatedMinutes: 2,
    steps: [
      'Ingresa a disneyplus.com/account → sección «Suscripción».',
      'Selecciona tu plan activo y toca «Cancelar suscripción».',
      'Si venía incluido con Mercado Libre (Meli+), cancélalo desde mercadolibre.com.co → Mi perfil → Suscripciones.',
    ],
  },
  max: {
    title: 'Cancelar Max (antes HBO Max)',
    url: 'https://auth.max.com/subscription',
    estimatedMinutes: 2,
    steps: [
      'Entra a max.com → foto de perfil → «Suscripción».',
      'Elige «Cancelar suscripción» y confirma en el último paso.',
      'Si se cobra por Apple App Store o Google Play, cancélalo desde Suscripciones de tu teléfono.',
    ],
  },
  prime_video: {
    title: 'Cancelar Amazon Prime Video',
    url: 'https://www.primevideo.com/settings/your-account',
    estimatedMinutes: 2,
    steps: [
      'Abre primevideo.com → Cuenta y configuración → «Tu cuenta».',
      'Haz clic en «Finalizar membresía» y confirma que no deseas pausar sino cancelar.',
    ],
  },
  youtube: {
    title: 'Cancelar YouTube Premium / Music',
    url: 'https://www.youtube.com/paid_memberships',
    estimatedMinutes: 2,
    steps: [
      'Ve a youtube.com/paid_memberships.',
      'Toca «Administrar membresía» → «Desactivar» → «Continuar para cancelar».',
    ],
  },
  apple: {
    title: 'Revisar y cortar cobros de Apple / App Store',
    url: 'https://reportaproblem.apple.com/',
    estimatedMinutes: 3,
    steps: [
      'En tu iPhone abre Configuración → toca tu nombre arriba → «Suscripciones».',
      'Revisa cuáles siguen activas y toca «Cancelar suscripción» en la que no uses.',
      'Si fue un cobro accidental reciente, pide reembolso en reportaproblem.apple.com.',
    ],
  },
  google_play: {
    title: 'Revisar suscripciones en Google Play',
    url: 'https://play.google.com/store/account/subscriptions',
    estimatedMinutes: 2,
    steps: [
      'Abre play.google.com/store/account/subscriptions con tu cuenta de Google.',
      'Selecciona la app que ya no usas y toca «Cancelar suscripción».',
    ],
  },
  rappi_prime: {
    title: 'Cancelar Rappi Prime',
    estimatedMinutes: 3,
    steps: [
      'Abre la app de Rappi → toca tu perfil abajo a la derecha → «Rappi Prime».',
      'Baja hasta «Necesito ayuda / Administrar membresía» → «Cancelar membresía».',
      'Confirma hasta ver el mensaje final (Rappi muestra dos pantallas de retención antes de cancelar).',
    ],
  },
  smart_fit: {
    title: 'Cancelar plan en Smart Fit Colombia',
    url: 'https://www.smartfit.com.co/espacio-del-cliente',
    estimatedMinutes: 10,
    steps: [
      'Verifica si tu plan es Smart (sin cláusula de permanencia) o Black (12 meses).',
      'Solicita la cancelación con al menos 30 días de anticipación a tu próximo cobro en recepción o en el Espacio del Cliente.',
      'Guarda el radicado por correo para evitar débitos posteriores.',
    ],
  },
  bodytech: {
    title: 'Cancelar débito automático de Bodytech',
    estimatedMinutes: 10,
    steps: [
      'Ingresa a la zona de afiliados de Bodytech o envía PQR escrita pidiendo la no renovación del débito recurrente.',
      'Hazlo mínimo 15 días hábiles antes del siguiente corte y exige número de radicado.',
    ],
  },
  cuota_manejo: {
    title: 'Reducir o eliminar cuota de manejo',
    estimatedMinutes: 8,
    legalNote: 'En Colombia la Ley 2009 de 2019 garantiza acceso a paquete mínimo sin costo adicional en cuentas de ahorro.',
    steps: [
      'Llama a la línea de retención de tu banco o escribe por el chat de la app pidiendo exoneración de cuota de manejo.',
      'En cuentas de ahorro: recuerda que puedes marcar una cuenta exenta de 4x1000 (hasta 350 UVT/mes) y pedir plan sin cuota.',
      'En tarjetas de crédito que casi no usas: pide exoneración por 6–12 meses o unificación de cupo antes de cancelar.',
    ],
  },
  seguro_banco: {
    title: 'Cancelar seguro bancario no usado',
    estimatedMinutes: 8,
    legalNote: 'Ningún seguro voluntario de tarjeta o protección de bolso es obligatorio para conservar tu cuenta.',
    steps: [
      'Identifica la aseguradora en la descripción (Cardif, Assurant, Sura, Bolívar) o llama a tu banco.',
      'Solicita la cancelación inmediata de la póliza voluntaria y pide el número de radicado.',
      'Exige el reintegro proporcional de la prima no causada si te cobraron periodo anticipado.',
    ],
  },
  gmf: {
    title: 'Marcar tu cuenta principal exenta del 4x1000',
    estimatedMinutes: 5,
    legalNote: 'Por ley en Colombia tienes derecho a exonerar hasta 350 UVT mensuales (~$17,4M COP) del 4x1000.',
    steps: [
      'Revisa en cuál cuenta o billetera mueves más dinero al mes.',
      'Desde la app de tu banco o Nequi (Ajustes → Tu cuenta libre de 4x1000), márcala como exenta.',
      'Si ya tenías otra cuenta marcada en otro banco, pide primero desmarcar la anterior.',
    ],
  },
};

export function getCancellationGuide(merchantKey: string, name: string, category: Category): CancellationGuide {
  const direct = CANCELLATION_GUIDES[merchantKey];
  if (direct) return direct;
  if (category === 'suscripciones') {
    return {
      title: `Cómo cancelar ${name}`,
      estimatedMinutes: 4,
      steps: [
        `Entra a la web oficial de ${name} e inicia sesión desde el navegador (suele ser más directo que la app).`,
        'Busca Perfil → Cuenta / Facturación / Suscripción y elige «Cancelar renovación automática».',
        'Revisa también Suscripciones en Apple App Store o Google Play por si se factura a través de tu teléfono.',
      ],
    };
  }
  if (category === 'telefonia_internet') {
    return {
      title: `Bajar tarifa o cancelar ${name}`,
      estimatedMinutes: 10,
      legalNote: 'Según la CRC en Colombia puedes cancelar sin penalidad en cualquier momento si no tienes equipo financiado.',
      steps: [
        `Entra a la app o portal web de ${name} con tu cédula.`,
        'Si pagas más de $45.000/mes en plan móvil, pide en retención igualar oferta de portabilidad (suele bajar 30–40 %).',
        'Para cancelar definitivo, radica la solicitud al menos 3 días hábiles antes de tu fecha de corte y guarda el CUN.',
      ],
    };
  }
  return {
    title: `Detener cobro recurrente de ${name}`,
    estimatedMinutes: 5,
    steps: [
      `Revisa en la app de tu banco la sección «Débitos automáticos / Suscripciones con tarjeta» para ${name}.`,
      'Cancela el servicio directamente con el proveedor y conserva el comprobante o radicado.',
      'Si sigue cobrándose tras cancelar, apaga compras en línea o pide bloqueo del comercio a tu emisor.',
    ],
  };
}

const PREFIXES = [
  'COMPRA INTL',
  'COMPRA INTERNACIONAL',
  'COMPRA EN',
  'COMPRA POS',
  'COMPRA QR',
  'COMPRA',
  'PAGO PSE',
  'PAGO SV',
  'PAGO QR',
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
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
    .replace(/\b[A-Z]*\d[A-Z0-9]*\b/g, ' ')
    .replace(NOISE, ' ')
    .replace(/[^A-Z&' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function identifyMerchant(description: string, overrides?: Record<string, UserCategoryOverride>): MerchantInfo {
  const upper = stripAccents(description).toUpperCase();
  for (const m of KNOWN) {
    if (m.pattern.test(upper)) {
      const ov = overrides?.[m.key];
      return {
        key: m.key,
        name: ov?.customName || m.name,
        category: ov?.category ?? m.category,
      };
    }
  }
  const cleaned = cleanDescription(description);
  const words = cleaned.split(' ').filter((w) => w.length > 1);
  const significant = words.slice(0, 3);
  if (significant.length === 0) {
    return { key: 'sin_nombre', name: 'Sin descripción', category: null };
  }
  const key = significant.join('_').toLowerCase();
  const ov = overrides?.[key];
  return {
    key,
    name: ov?.customName || titleCase(significant.join(' ')),
    category: ov?.category ?? null,
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

export function categoryOf(
  description: string,
  amountMinor: number,
  overrides?: Record<string, UserCategoryOverride>,
): Category {
  const flow = flowOf(description, amountMinor);
  if (flow === 'pago_tarjeta') return 'pagos_tarjeta';
  if (flow === 'efectivo') return 'efectivo';
  if (amountMinor > 0) return flow === 'transferencia' ? 'transferencias' : 'ingresos';
  const m = identifyMerchant(description, overrides);
  if (m.category) return m.category;
  if (flow === 'transferencia') return 'transferencias';
  return 'otros';
}
