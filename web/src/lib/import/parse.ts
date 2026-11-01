/**
 * Lectura de extractos en CSV o Excel de cualquier banco. Corre en el navegador:
 * el archivo nunca sale del dispositivo; solo se envían los movimientos ya leídos.
 */

import { stripAccents } from '../engine/merchant';

export type Cell = string | number | Date | null | undefined;

const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, jan: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4, apr: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8, aug: 8,
  sep: 9, sept: 9, septiembre: 9, set: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12, dec: 12,
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function validDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export type DayOrder = 'dmy' | 'mdy';

/** Lee una fecha en los formatos comunes de bancos colombianos. Devuelve 'AAAA-MM-DD' o null. */
export function parseDate(value: Cell, order: DayOrder = 'dmy'): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return validDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === 'number') {
    // Número de serie de Excel (días desde 1899-12-30).
    if (value > 30000 && value < 80000) {
      const dt = new Date(Math.round((value - 25569) * 86_400_000));
      return validDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
    if (value > 20000101 && value < 21001231) return parseDate(String(value), order);
    return null;
  }
  const s = stripAccents(String(value)).trim().toLowerCase();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return validDate(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return validDate(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const a = +m[1]!, b = +m[2]!, y = +m[3]!;
    return order === 'dmy' ? validDate(y, b, a) : validDate(y, a, b);
  }
  m = s.match(/^(\d{1,2})[\s/-]+([a-z]{3,10})\.?[\s/-]+(\d{2,4})/);
  if (m && MONTHS[m[2]!]) return validDate(+m[3]!, MONTHS[m[2]!]!, +m[1]!);
  m = s.match(/^([a-z]{3,10})\.?[\s/-]+(\d{1,2}),?[\s/-]+(\d{4})/);
  if (m && MONTHS[m[1]!]) return validDate(+m[3]!, MONTHS[m[1]!]!, +m[2]!);
  return null;
}

/** Decide si las fechas con barras vienen como día/mes o mes/día mirando toda la columna. */
export function detectDayOrder(values: Cell[]): DayOrder {
  let dmy = 0, mdy = 0;
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const m = v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (!m) continue;
    if (+m[1]! > 12) dmy++;
    if (+m[2]! > 12) mdy++;
  }
  return mdy > dmy ? 'mdy' : 'dmy';
}

/**
 * Convierte un monto de texto a centavos. Acepta "1.234.567,89", "1,234,567.89", "-45.000",
 * "$ -45.000", "(45.000)", "45.000-" y números. Devuelve null si no es un monto.
 */
export function parseAmount(value: Cell): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : null;
  if (value instanceof Date) return null;
  let s = String(value).trim().replace(/−/g, '-');
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/-\s*$/.test(s)) {
    negative = true;
    s = s.replace(/-\s*$/, '');
  }
  s = s.replace(/cop|\$|\s/gi, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandSep = decimalSep === '.' ? ',' : '.';
    normalized = s.split(thousandSep).join('').replace(decimalSep, '.');
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    normalized = (s.match(/,/g)!.length === 1 && decimals <= 2) ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const decimals = s.length - lastDot - 1;
    normalized = (s.match(/\./g)!.length === 1 && decimals <= 2) ? s : s.replace(/\./g, '');
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  const minor = Math.round(n * 100);
  return negative ? -minor : minor;
}

export interface ColumnMapping {
  headerRow: number;
  date: number;
  description: number;
  /** Columna con signo (negativo = salida). */
  amount: number | null;
  /** O dos columnas separadas para salidas y entradas. */
  debit: number | null;
  credit: number | null;
  balance: number | null;
}

const HEADER_HINTS = {
  date: ['fecha', 'date', 'fecha transaccion', 'fecha movimiento', 'f. movimiento'],
  description: ['descripcion', 'concepto', 'detalle', 'movimiento', 'transaccion', 'referencia', 'description', 'nombre', 'comercio'],
  amount: ['valor', 'monto', 'importe', 'amount', 'valor transaccion', 'valor movimiento'],
  debit: ['debito', 'debitos', 'cargo', 'cargos', 'retiro', 'retiros', 'salida', 'salidas', 'egreso', 'egresos', 'debe'],
  credit: ['credito', 'creditos', 'abono', 'abonos', 'deposito', 'depositos', 'entrada', 'entradas', 'ingreso', 'ingresos', 'haber'],
  balance: ['saldo', 'saldo disponible', 'balance', 'saldo final'],
};

function norm(c: Cell): string {
  return stripAccents(String(c ?? '')).toLowerCase().replace(/[^a-z0-9. ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchHeader(cell: Cell, hints: string[]): boolean {
  const h = norm(cell);
  if (!h) return false;
  return hints.some((x) => h === x || h.startsWith(x + ' ') || h.endsWith(' ' + x) || h.includes(x));
}

/** Busca la fila de encabezados y adivina qué columna es cuál. La persona confirma antes de importar. */
export function detectColumns(rows: Cell[][]): ColumnMapping | null {
  const limit = Math.min(rows.length, 40);
  for (let r = 0; r < limit; r++) {
    const row = rows[r] ?? [];
    const find = (hints: string[], exclude: number[] = []) =>
      row.findIndex((c, i) => !exclude.includes(i) && matchHeader(c, hints));
    const date = find(HEADER_HINTS.date);
    if (date < 0) continue;
    const balance = find(HEADER_HINTS.balance, [date]);
    const debit = find(HEADER_HINTS.debit, [date, balance]);
    const credit = find(HEADER_HINTS.credit, [date, balance, debit]);
    const amount = find(HEADER_HINTS.amount, [date, balance, debit, credit]);
    const description = find(HEADER_HINTS.description, [date, balance, debit, credit, amount]);
    if (description < 0) continue;
    if (amount < 0 && (debit < 0 || credit < 0)) continue;
    return {
      headerRow: r,
      date,
      description,
      amount: amount >= 0 ? amount : null,
      debit: amount >= 0 ? null : debit,
      credit: amount >= 0 ? null : credit,
      balance: balance >= 0 ? balance : null,
    };
  }
  return null;
}

export interface ParsedTx {
  postedOn: string;
  description: string;
  amountMinor: number;
  balanceMinor: number | null;
}

export interface ParseResult {
  txs: ParsedTx[];
  skipped: number;
  from: string | null;
  to: string | null;
  /** Saldo de la fila más reciente, si el extracto trae columna de saldo. */
  latestBalanceMinor: number | null;
}

export function buildTransactions(rows: Cell[][], map: ColumnMapping, opts: { invertSign?: boolean } = {}): ParseResult {
  const body = rows.slice(map.headerRow + 1);
  const order = detectDayOrder(body.map((r) => r[map.date]));
  const txs: ParsedTx[] = [];
  let skipped = 0;
  body.forEach((row) => {
    const postedOn = parseDate(row[map.date], order);
    const description = String(row[map.description] ?? '').replace(/\s+/g, ' ').trim();
    let amount: number | null = null;
    if (map.amount !== null) {
      amount = parseAmount(row[map.amount]);
    } else {
      const debit = map.debit !== null ? parseAmount(row[map.debit]) : null;
      const credit = map.credit !== null ? parseAmount(row[map.credit]) : null;
      if (debit) amount = -Math.abs(debit);
      else if (credit) amount = Math.abs(credit);
      else if (debit === 0 || credit === 0) amount = 0;
    }
    if (!postedOn || amount === null || amount === 0 || !description) {
      if (row.some((c) => c !== null && c !== undefined && String(c).trim() !== '')) skipped++;
      return;
    }
    if (opts.invertSign) amount = -amount;
    const balance = map.balance !== null ? parseAmount(row[map.balance]) : null;
    txs.push({ postedOn, description: description.slice(0, 300), amountMinor: amount, balanceMinor: balance });
  });
  const dates = txs.map((t) => t.postedOn).sort();
  let latestBalance: number | null = null;
  if (map.balance !== null && txs.length) {
    // Con varias filas el mismo día, el saldo final depende del orden del extracto:
    // la última fila si va de viejo a nuevo, la primera si va de nuevo a viejo.
    const newestFirst = txs[0]!.postedOn >= txs[txs.length - 1]!.postedOn;
    const sameDay = txs.filter((t) => t.postedOn === dates[dates.length - 1]);
    const pick = newestFirst ? sameDay[0] : sameDay[sameDay.length - 1];
    latestBalance = pick?.balanceMinor ?? null;
  }
  return { txs, skipped, from: dates[0] ?? null, to: dates[dates.length - 1] ?? null, latestBalanceMinor: latestBalance };
}
