import { addDays } from './dates';
import { categoryOf, identifyMerchant, type Category, type UserCategoryOverride } from './merchant';

export interface ParsedQuickMovement {
  description: string;
  merchantName: string;
  merchantKey: string;
  category: Category;
  /** En centavos: negativo = gasto, positivo = ingreso. */
  amountMinor: number;
  postedOn: string;
  spentHour: number | null;
  sourceBank: string | null;
  captureMethod: 'rapido' | 'sms_banco' | 'comprobante';
  confidence: 'alta' | 'media';
}

const NATURAL_CATEGORY_HINTS: Array<{ pattern: RegExp; category: Category }> = [
  {
    pattern: /\b(ALMUERZO|DESAYUNO|CENA|COMIDA|CORRIENTAZO|EJECUTIVO|TINTO|CAFE|PANADERIA|PAN|EMPANADA|ONCES|HAMBURGUESA|PIZZA|AREPAS?|POLLO|DOMICILIO|POSTRE|HELADO)\b/i,
    category: 'comida',
  },
  {
    pattern: /\b(BUS|TRANSMI|TRANSMILENIO|SITP|TAXI|UBER|DIDI|CABIFY|PASAJE|METRO|BICI|PARQUEADERO)\b/i,
    category: 'transporte',
  },
  {
    pattern: /\b(GASOLINA|TANQUEADA|PEAJE|ACPM|CORRIENTE)\b/i,
    category: 'combustible',
  },
  {
    pattern: /\b(MERCADO|FRUVER|VERDURA|FRUTA|LECHE|HUEVOS|CARNE|TIENDA|SUPERMERCADO|ASEO)\b/i,
    category: 'mercado',
  },
  {
    pattern: /\b(DROGUERIA|FARMACIA|PASTILLAS|MEDICAMENTO|MEDICO|CITA|ODONTOLOGO|EXAMEN)\b/i,
    category: 'salud',
  },
  {
    pattern: /\b(CINE|POLA|CERVEZA|BAR|RUMBA|CONCIERTO|SALIDA|JUEGO|BOLOS)\b/i,
    category: 'ocio',
  },
  {
    pattern: /\b(FOTOCOPIAS|IMPRESION|LIBRO|CUADERNO|PAPELERIA|CURSO|UNIVERSIDAD|SEMESTRE)\b/i,
    category: 'educacion',
  },
  {
    pattern: /\b(ARRIENDO|LUZ|AGUA|GAS|ADMINISTRACION|ENERGIA|ACUEDUCTO)\b/i,
    category: 'servicios_hogar',
  },
  {
    pattern: /\b(INTERNET|PLAN CELULAR|RECARGA|DATOS)\b/i,
    category: 'telefonia_internet',
  },
  {
    pattern: /\b(ROPA|CAMISA|PANTALON|TENIS|ZAPATOS|REGALO)\b/i,
    category: 'compras',
  },
];

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Convierte expresiones colombianas de dinero ("$24.900,00", "$45,000.00", "18k", "18.5 mil", "1.2m") a centavos enteros.
 */
export function parseColombianMoneyMinor(raw: string): number | null {
  const s = stripAccents(raw).toLowerCase().trim();
  if (!s) return null;

  // Formato con multiplicador explícito: 18k, 18.5k, 25 mil, 1.2 millones
  const multMatch = s.match(/([0-9]+(?:[.,][0-9]+)?)\s*(k|mil|miles|millon|millones|m)\b/i);
  if (multMatch) {
    const num = Number(multMatch[1]!.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) return null;
    const unit = multMatch[2]!.toLowerCase();
    const factor = unit === 'm' || unit.startsWith('millon') ? 1_000_000 : 1_000;
    return Math.round(num * factor * 100);
  }

  // Formato numérico bancario: "$24.900,00", "$45,000.00", "24.900", "24900"
  let cleaned = s.replace(/[^0-9.,]/g, '');
  if (!cleaned) return null;

  // Detectar decimales al final (,00 o .00)
  if (/,[0-9]{1,2}$/.test(cleaned)) {
    const [intPart, decPart] = cleaned.split(/,(?=[0-9]{1,2}$)/);
    const pesos = Number((intPart ?? '').replace(/[.,]/g, ''));
    const cents = Number((decPart ?? '0').padEnd(2, '0').slice(0, 2));
    if (!Number.isFinite(pesos) || pesos <= 0) return null;
    return pesos * 100 + cents;
  }
  if (/\.[0-9]{2}$/.test(cleaned) && (cleaned.includes(',') || cleaned.split('.').length === 2 && cleaned.indexOf('.') <= cleaned.length - 3)) {
    // Ojo: en Colombia "24.900" tiene 3 dígitos tras el punto (miles), mientras "45,000.00" tiene 2 dígitos (centavos).
    const [intPart, decPart] = cleaned.split(/\.(?=[0-9]{2}$)/);
    const pesos = Number((intPart ?? '').replace(/[.,]/g, ''));
    const cents = Number((decPart ?? '0').padEnd(2, '0').slice(0, 2));
    if (!Number.isFinite(pesos) || pesos <= 0) return null;
    return pesos * 100 + cents;
  }

  const pesosOnly = Number(cleaned.replace(/[.,]/g, ''));
  if (!Number.isFinite(pesosOnly) || pesosOnly <= 0) return null;
  return Math.round(pesosOnly * 100);
}

function inferCategoryWithHints(
  description: string,
  amountMinor: number,
  overrides?: Record<string, UserCategoryOverride>,
): Category {
  const base = categoryOf(description, amountMinor, overrides);
  if (base !== 'otros' && base !== 'transferencias') return base;
  const normalized = stripAccents(description);
  for (const h of NATURAL_CATEGORY_HINTS) {
    if (h.pattern.test(normalized)) return h.category;
  }
  return base;
}

function extractHourFromText(raw: string, fallbackHour: number | null): number | null {
  // 14:35 o 05:20 p. m. / 5:20pm / a las 2pm
  const ampm = raw.match(/\b(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)\b/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const isPm = ampm[3]!.toLowerCase().startsWith('p');
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return h;
  }
  const h24 = raw.match(/\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/);
  if (h24) {
    return Number(h24[1]);
  }
  const norm = stripAccents(raw).toLowerCase();
  if (/\b(desayuno|manana|tinto)\b/.test(norm)) return 8;
  if (/\b(almuerzo|corrientazo|mediodia)\b/.test(norm)) return 13;
  if (/\b(onces|tarde)\b/.test(norm)) return 17;
  if (/\b(cena|comida|noche)\b/.test(norm)) return 20;
  return fallbackHour;
}

function extractDateFromText(raw: string, today: string): string {
  const norm = stripAccents(raw).toLowerCase();
  if (/\banteayer\b/.test(norm)) return addDays(today, -2);
  if (/\bayer\b/.test(norm)) return addDays(today, -1);

  // Formatos DD/MM/YYYY o YYYY-MM-DD
  const iso = raw.match(/\b(20[2-3][0-9])-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\b/);
  if (iso) return iso[0]!;
  const dmy = raw.match(/\b(0?[1-9]|[12][0-9]|3[01])[/-](0?[1-9]|1[0-2])[/-](20[2-3][0-9]|[2-3][0-9])\b/);
  if (dmy) {
    const d = dmy[1]!.padStart(2, '0');
    const m = dmy[2]!.padStart(2, '0');
    const y = dmy[3]!.length === 2 ? `20${dmy[3]}` : dmy[3]!;
    return `${y}-${m}-${d}`;
  }
  return today;
}

/**
 * Parsea frases rápidas estilo chat o dictado por voz:
 * Ej.: "almuerzo 18k, uber 14500 y café en tostao 6.500"
 */
export function parseChatExpenses(
  input: string,
  today: string,
  currentBogotaHour = 12,
  overrides?: Record<string, UserCategoryOverride>,
): ParsedQuickMovement[] {
  const chunks = input
    .split(/(?:\r?\n|;|,(?!\d{1,2}\b)|\s+y\s+(?=[^0-9]*[0-9]))/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const results: ParsedQuickMovement[] = [];
  for (const chunk of chunks) {
    const isIncome =
      chunk.trim().startsWith('+') ||
      /\b(ingreso|recibi|me pagaron|abono|nomina|venta)\b/i.test(stripAccents(chunk));

    // Buscar expresión monetaria dentro del fragmento
    const amountRegex =
      /([+-]?\s*\$?\s*[0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{1,2})?|[+-]?\s*\$?\s*[0-9]+(?:[.,][0-9]+)?\s*(?:k|mil|miles|millon|millones|m)\b|[+-]?\s*\$?\s*[0-9]{3,9})/i;
    const m = chunk.match(amountRegex);
    if (!m) continue;

    const absMinor = parseColombianMoneyMinor(m[1]!);
    if (!absMinor || absMinor < 100_00) continue; // ignorar números menores a $100 COP (como horas sueltas)

    let concept = chunk
      .replace(m[0], ' ')
      .replace(/\b(ayer|anteayer|hoy|en efectivo|por nequi|nequi|bancolombia|daviplata|bre-?b)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '')
      .trim();

    if (!concept) concept = isIncome ? 'Ingreso registrado' : 'Gasto rápido';

    const signedMinor = isIncome ? absMinor : -absMinor;
    const info = identifyMerchant(concept, overrides);
    const cat = inferCategoryWithHints(concept, signedMinor, overrides);
    const postedOn = extractDateFromText(chunk, today);
    const spentHour = extractHourFromText(chunk, currentBogotaHour);

    results.push({
      description: concept,
      merchantName: info.key === 'sin_nombre' ? concept : info.name,
      merchantKey: info.key,
      category: cat,
      amountMinor: signedMinor,
      postedOn,
      spentHour,
      sourceBank: null,
      captureMethod: 'rapido',
      confidence: 'alta',
    });
  }

  return results;
}

/**
 * Parsea SMS, notificaciones push, correos de alerta bancaria o texto OCR de comprobantes
 * de Bancolombia, Nequi, Bre-B, Daviplata, Nu Colombia, Lulo Bank, Davivienda y BBVA.
 */
export function parseColombianBankAlert(
  rawText: string,
  today: string,
  currentBogotaHour = 12,
  captureMethod: 'sms_banco' | 'comprobante' = 'sms_banco',
  overrides?: Record<string, UserCategoryOverride>,
): ParsedQuickMovement[] {
  // Si cada línea tiene su propio monto ($...), procesamos línea por línea; si es un comprobante multilínea de un solo pago, por bloques vacíos.
  const nonEmptyLines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const linesWithMoney = nonEmptyLines.filter((l) => /\$\s*[0-9]/.test(l));
  const blocks =
    linesWithMoney.length >= 2 && nonEmptyLines.length === linesWithMoney.length
      ? nonEmptyLines
      : rawText
          .split(/\n{2,}/)
          .map((b) => b.trim())
          .filter((b) => b.length >= 8);

  const out: ParsedQuickMovement[] = [];

  for (const block of blocks) {
    const flat = block.replace(/\s+/g, ' ').trim();
    const norm = stripAccents(flat);

    // Detectar entidad
    let bank: string | null = null;
    if (/bancolombia/i.test(norm)) bank = 'Bancolombia';
    else if (/nequi/i.test(norm)) bank = 'Nequi';
    else if (/bre-?b/i.test(norm)) bank = 'Bre-B';
    else if (/daviplata/i.test(norm)) bank = 'Daviplata';
    else if (/davivienda/i.test(norm)) bank = 'Davivienda';
    else if (/\bnu\b|nucard|nu colombia/i.test(norm)) bank = 'Nu Colombia';
    else if (/lulo/i.test(norm)) bank = 'Lulo Bank';
    else if (/bbva/i.test(norm)) bank = 'BBVA';

    const isIncome = /\b(recibiste|te enviaron|abono|consignacion|transferencia recibida|pago recibido)\b/i.test(norm) &&
      !/\b(compraste|compra por|pagaste|enviaste|transferiste|retiro)\b/i.test(norm);

    // Extraer monto principal precedido por $, COP, por, valor, total
    const moneyCandidate =
      flat.match(/(?:valor|total|monto|por|compraste|pagaste|enviaste|transferiste|recibiste)[:\s]*\$\s*([0-9.,]+)/i) ??
      flat.match(/\$\s*([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{1,2})?|[0-9]{4,9}(?:[.,][0-9]{1,2})?)/);

    if (!moneyCandidate) continue;
    const absMinor = parseColombianMoneyMinor(moneyCandidate[1]!);
    if (!absMinor || absMinor < 100_00) continue;

    // Extraer comercio / destinatario
    let merchantRaw = '';
    const mEn =
      flat.match(/\b(?:comercio|establecimiento|para|destinatario)\s*:\s*([^.\n;|]+?)(?:\s+(?:hora|fecha|referencia|comprobante|con\s+tu|t\.deb|t\.cred|\d{1,2}:\d{2})|$)/i) ??
      flat.match(/\b(?:compra(?:ste)?|pagaste|pago)\s+(?:aprobada\s+)?(?:por\s+\$?[0-9.,]+\s+)?en\s+([A-Za-zÀ-ÿ0-9 &*'-]{2,42}?)(?:\s+(?:con\s+tu|el\s+\d|hora|\d{1,2}:\d{2}|t\.deb|t\.cred|tarjeta|exitos)|[.,;]|$)/i) ??
      flat.match(/\b(?:enviaste|transferiste)\s+(?:\$?[0-9.,]+\s+)?a\s+([A-Za-zÀ-ÿ0-9 &*'-]{2,38}?)(?:\s+(?:desde|el\s+\d|hora|\d{1,2}:\d{2}|con\s+llave)|[.,;]|$)/i);

    if (mEn?.[1]) {
      merchantRaw = mEn[1].trim();
    } else {
      merchantRaw = bank ? `${isIncome ? 'Abono' : 'Movimiento'} ${bank}` : 'Comprobante registrado';
    }

    const signedMinor = isIncome ? absMinor : -absMinor;
    const info = identifyMerchant(merchantRaw, overrides);
    const category = inferCategoryWithHints(merchantRaw, signedMinor, overrides);
    const postedOn = extractDateFromText(flat, today);
    const spentHour = extractHourFromText(flat, currentBogotaHour);

    out.push({
      description: bank ? `${merchantRaw} (${bank})` : merchantRaw,
      merchantName: info.key === 'sin_nombre' ? merchantRaw : info.name,
      merchantKey: info.key,
      category,
      amountMinor: signedMinor,
      postedOn,
      spentHour,
      sourceBank: bank,
      captureMethod,
      confidence: mEn?.[1] ? 'alta' : 'media',
    });
  }

  // Fallback si la persona pegó algo informal como "Nequi panadería 14.000"
  if (out.length === 0) {
    return parseChatExpenses(rawText, today, currentBogotaHour, overrides).map((r) => ({
      ...r,
      captureMethod,
      confidence: 'media',
    }));
  }

  return out;
}
