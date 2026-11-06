import { addDays, daysBetween } from './dates';
import {
  CATEGORY_LABEL,
  categoryOf,
  flowOf,
  identifyMerchant,
  type Category,
  type UserCategoryOverride,
} from './merchant';
import { splitInternalTransfers } from './transfers';
import type { Tx } from './types';

export interface CategoryComparisonRow {
  category: Category;
  label: string;
  currentMinor: number;
  previousMinor: number;
  deltaMinor: number;
  deltaPercent: number | null;
  sharePercent: number;
  txCount: number;
}

export interface CycleBreakdown {
  windowDays: number;
  currentTotalMinor: number;
  previousTotalMinor: number;
  deltaTotalMinor: number;
  rows: CategoryComparisonRow[];
}

/**
 * Compara en qué se fue la plata en los últimos N días contra los N días inmediatamente anteriores,
 * excluyendo transferencias entre cuentas propias y pagos de tarjeta para no duplicar gastos.
 */
export function computeCategoryComparison(
  rawTxs: Tx[],
  today: string,
  windowDays = 30,
  overrides?: Record<string, UserCategoryOverride>,
): CycleBreakdown {
  const { external } = splitInternalTransfers(rawTxs);
  const curStart = addDays(today, -(windowDays - 1));
  const prevEnd = addDays(curStart, -1);
  const prevStart = addDays(prevEnd, -(windowDays - 1));

  const curMap = new Map<Category, { sum: number; count: number }>();
  const prevMap = new Map<Category, number>();

  for (const t of external) {
    if (t.amountMinor >= 0) continue;
    const flow = flowOf(t.description, t.amountMinor);
    if (flow === 'pago_tarjeta') continue;
    const cat = categoryOf(t.description, t.amountMinor, overrides);
    const val = -t.amountMinor;
    if (t.postedOn >= curStart && t.postedOn <= today) {
      const prev = curMap.get(cat) ?? { sum: 0, count: 0 };
      curMap.set(cat, { sum: prev.sum + val, count: prev.count + 1 });
    } else if (t.postedOn >= prevStart && t.postedOn <= prevEnd) {
      prevMap.set(cat, (prevMap.get(cat) ?? 0) + val);
    }
  }

  const allCats = new Set<Category>([...curMap.keys(), ...prevMap.keys()]);
  const currentTotalMinor = [...curMap.values()].reduce((s, x) => s + x.sum, 0);
  const previousTotalMinor = [...prevMap.values()].reduce((s, x) => s + x, 0);

  const rows: CategoryComparisonRow[] = [];
  for (const cat of allCats) {
    const cur = curMap.get(cat)?.sum ?? 0;
    const txCount = curMap.get(cat)?.count ?? 0;
    const prev = prevMap.get(cat) ?? 0;
    if (cur === 0 && prev === 0) continue;
    const deltaMinor = cur - prev;
    const deltaPercent = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
    const sharePercent = currentTotalMinor > 0 ? Math.round((cur / currentTotalMinor) * 100) : 0;
    rows.push({
      category: cat,
      label: CATEGORY_LABEL[cat],
      currentMinor: cur,
      previousMinor: prev,
      deltaMinor,
      deltaPercent,
      sharePercent,
      txCount,
    });
  }

  rows.sort((a, b) => b.currentMinor - a.currentMinor);
  return {
    windowDays,
    currentTotalMinor,
    previousTotalMinor,
    deltaTotalMinor: currentTotalMinor - previousTotalMinor,
    rows,
  };
}

export interface AntExpenseCluster {
  merchantKey: string;
  name: string;
  category: Category;
  count: number;
  averageMinor: number;
  totalMinor: number;
}

/**
 * Encuentra "gastos hormiga": compras individuales pequeñas (<= $28.000 COP) repetidas 3+ veces
 * en los últimos 30 días que pasan desapercibidas una por una pero pesan juntas (Etapa 1 del mapa C.5).
 */
export function detectAntExpenses(
  rawTxs: Tx[],
  today: string,
  overrides?: Record<string, UserCategoryOverride>,
  maxUnitMinor = 28_000_00,
): AntExpenseCluster[] {
  const { external } = splitInternalTransfers(rawTxs);
  const start = addDays(today, -29);
  const groups = new Map<string, { name: string; category: Category; amounts: number[] }>();

  for (const t of external) {
    if (t.amountMinor >= 0 || t.postedOn < start || t.postedOn > today) continue;
    const abs = -t.amountMinor;
    if (abs > maxUnitMinor || abs <= 0) continue;
    const flow = flowOf(t.description, t.amountMinor);
    if (flow === 'pago_tarjeta' || flow === 'efectivo') continue;
    const cat = categoryOf(t.description, t.amountMinor, overrides);
    if (cat === 'comisiones' || cat === 'servicios_hogar' || cat === 'suscripciones') continue;
    const m = identifyMerchant(t.description, overrides);
    if (m.key === 'sin_nombre') continue;
    const g = groups.get(m.key) ?? { name: m.name, category: cat, amounts: [] };
    g.amounts.push(abs);
    groups.set(m.key, g);
  }

  const out: AntExpenseCluster[] = [];
  for (const [merchantKey, g] of groups) {
    if (g.amounts.length < 3) continue;
    const totalMinor = g.amounts.reduce((s, v) => s + v, 0);
    if (totalMinor < 35_000_00) continue;
    out.push({
      merchantKey,
      name: g.name,
      category: g.category,
      count: g.amounts.length,
      averageMinor: Math.round(totalMinor / g.amounts.length),
      totalMinor,
    });
  }

  return out.sort((a, b) => b.totalMinor - a.totalMinor).slice(0, 6);
}

export interface SpendDeviationAlert {
  triggered: boolean;
  recent7dDailyMinor: number;
  baselineDailyMinor: number;
  ratio: number;
  excessWeeklyMinor: number;
  topDriverName: string | null;
}

/**
 * Detecta desviación temprana frente al propio patrón de la persona (Etapa 4 del mapa C.5 y G.10):
 * compara el ritmo variable de los últimos 7 días contra su línea base diaria.
 */
export function detectSpendDeviation(params: {
  rawTxs: Tx[];
  fixedMerchantKeys: Set<string>;
  baselineDailyMinor: number;
  today: string;
  overrides?: Record<string, UserCategoryOverride>;
}): SpendDeviationAlert {
  const { rawTxs, fixedMerchantKeys, baselineDailyMinor, today, overrides } = params;
  if (baselineDailyMinor <= 0 || rawTxs.length === 0) {
    return {
      triggered: false,
      recent7dDailyMinor: 0,
      baselineDailyMinor,
      ratio: 0,
      excessWeeklyMinor: 0,
      topDriverName: null,
    };
  }

  const { external } = splitInternalTransfers(rawTxs);
  const lastTx = external.reduce<string>((max, t) => (t.postedOn > max ? t.postedOn : max), external[0]!.postedOn);
  const refEnd = daysBetween(lastTx, today) <= 7 ? today : lastTx;
  const start = addDays(refEnd, -6);

  let sum7d = 0;
  const byMerchant = new Map<string, { name: string; sum: number }>();

  for (const t of external) {
    if (t.amountMinor >= 0 || t.postedOn < start || t.postedOn > refEnd) continue;
    const flow = flowOf(t.description, t.amountMinor);
    if (flow === 'pago_tarjeta') continue;
    const m = identifyMerchant(t.description, overrides);
    if (fixedMerchantKeys.has(m.key)) continue;
    const val = -t.amountMinor;
    sum7d += val;
    const cur = byMerchant.get(m.key) ?? { name: m.name, sum: 0 };
    cur.sum += val;
    byMerchant.set(m.key, cur);
  }

  const recent7dDailyMinor = Math.round(sum7d / 7);
  const ratio = Number((recent7dDailyMinor / baselineDailyMinor).toFixed(2));
  const excessWeeklyMinor = Math.max(0, sum7d - baselineDailyMinor * 7);
  const top = [...byMerchant.values()].sort((a, b) => b.sum - a.sum)[0] ?? null;

  return {
    triggered: ratio >= 1.28 && excessWeeklyMinor >= 30_000_00,
    recent7dDailyMinor,
    baselineDailyMinor,
    ratio,
    excessWeeklyMinor,
    topDriverName: top?.name ?? null,
  };
}

export interface ParsedSpendQuery {
  amountMinor: number | null;
  concept: string;
}

/**
 * Interpreta consultas naturales como "¿puedo gastar 180 mil el viernes con amigos?",
 * "250k zapatos", "$1.200.000 viaje" o "95.000" sin depender de un LLM externo.
 */
export function parseNaturalSpendQuery(raw: string): ParsedSpendQuery {
  const trimmed = raw.trim();
  if (!trimmed) return { amountMinor: null, concept: '' };

  // Patrones con sufijo "mil" o "k" o "millón/millones"
  const millonMatch = trimmed.match(/(\d+(?:[.,]\d+)?)\s*(millones|millon|millón|palos|palo)\b/i);
  if (millonMatch) {
    const num = Number(millonMatch[1]!.replace(',', '.'));
    if (Number.isFinite(num) && num > 0) {
      const minor = Math.round(num * 1_000_000 * 100);
      const concept = cleanConcept(trimmed.replace(millonMatch[0], ''));
      return { amountMinor: minor, concept };
    }
  }

  const milMatch = trimmed.match(/\$?\s*(\d+(?:[.,]\d+)?)\s*(mil|k|lucas)\b/i);
  if (milMatch) {
    const num = Number(milMatch[1]!.replace(',', '.'));
    if (Number.isFinite(num) && num > 0) {
      const minor = Math.round(num * 1_000 * 100);
      const concept = cleanConcept(trimmed.replace(milMatch[0], ''));
      return { amountMinor: minor, concept };
    }
  }

  // Número formateado en pesos: 1.250.000 o 180000 o $85.000
  const numberMatch = trimmed.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,9})\b/);
  if (numberMatch) {
    const digits = numberMatch[1]!.replace(/[.,]/g, '');
    const pesos = Number(digits);
    if (Number.isFinite(pesos) && pesos > 0) {
      const concept = cleanConcept(trimmed.replace(numberMatch[0], ''));
      return { amountMinor: pesos * 100, concept };
    }
  }

  return { amountMinor: null, concept: cleanConcept(trimmed) };
}

function cleanConcept(s: string): string {
  return s
    .replace(/[¿?¡!$]/g, ' ')
    .replace(/\b(puedo|podria|podría|hacer|gastar|pagar|comprar|me|alcanza|para|en|un|una|el|la|los|las|de|pesos|cop|este|esta)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
