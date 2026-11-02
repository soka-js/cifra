/**
 * Extractos en PDF. pdf.js da cada pedazo de texto con su posición; aquí se arman las filas de la tabla
 * de movimientos y se entregan en el mismo formato que un CSV, para pasar por la misma detección de columnas
 * y la misma revisión antes de guardar. Corre en el navegador: el PDF no sale del dispositivo.
 */

import { stripAccents } from '../engine/merchant';
import { parseAmount, parseDate, type Cell } from './parse';

export interface PdfItem {
  x: number;
  w: number;
  str: string;
}

export interface PdfLine {
  page: number;
  y: number;
  items: PdfItem[];
}

const AMOUNT_HINTS = ['valor', 'debito', 'credito', 'monto', 'saldo', 'retiro', 'deposito', 'cargo', 'abono', 'importe', 'egreso', 'ingreso'];
const MONTHS = 'ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic|jan|apr|aug|dec';
const DATE_NO_YEAR = new RegExp(`^(\\d{1,2})[/\\-. ](\\d{1,2}|${MONTHS})\\.?$`, 'i');
const AMOUNT_TOKEN = /^[-(+]?\$?\s?-?\d{1,3}([.,\s]\d{3})*([.,]\d{1,2})?\)?-?$|^[-+]?\$?\d+([.,]\d{1,2})?-?$/;

function norm(s: string) {
  return stripAccents(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

interface CellBox {
  text: string;
  x0: number;
  x1: number;
}

/** Une pedazos de texto cercanos en celdas (una palabra suelta no es una columna). */
function cellsOf(line: PdfLine, gap = 6): CellBox[] {
  const items = [...line.items].filter((i) => i.str.trim()).sort((a, b) => a.x - b.x);
  const out: CellBox[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && it.x - last.x1 <= gap) {
      last.text += (it.x - last.x1 > 1 ? ' ' : '') + it.str;
      last.x1 = Math.max(last.x1, it.x + it.w);
    } else {
      out.push({ text: it.str, x0: it.x, x1: it.x + it.w });
    }
  }
  return out.map((c) => ({ ...c, text: c.text.replace(/\s+/g, ' ').trim() }));
}

/** Año más repetido en el documento, para fechas que vienen sin año ("15/10", "15 OCT"). */
export function dominantYear(text: string): number | null {
  const counts = new Map<number, number>();
  for (const m of text.matchAll(/\b(20[2-3]\d)\b/g)) counts.set(+m[1]!, (counts.get(+m[1]!) ?? 0) + 1);
  let best: number | null = null;
  for (const [y, n] of counts) if (best === null || n > (counts.get(best) ?? 0)) best = y;
  return best;
}

function withYear(raw: string, year: number | null): string {
  const t = raw.trim();
  if (year && DATE_NO_YEAR.test(t)) return `${t} ${year}`.replace(/^(\d{1,2})[/\-.](\d{1,2}) (\d{4})$/, '$1/$2/$3');
  return t;
}

function isDate(raw: string, year: number | null): boolean {
  return parseDate(withYear(raw, year)) !== null;
}

/** Convierte las líneas del PDF en filas de celdas, con una fila de títulos al principio. */
export function pdfLinesToRows(lines: PdfLine[], fullText: string): Cell[][] | null {
  const year = dominantYear(fullText);
  const headerIdx = lines.findIndex((l) => {
    const t = norm(l.items.map((i) => i.str).join(' '));
    return /\bfecha\b/.test(t) && AMOUNT_HINTS.some((h) => t.includes(h));
  });

  if (headerIdx >= 0) {
    const header = cellsOf(lines[headerIdx]!, 8);
    if (header.length >= 3) {
      const centers = header.map((c) => (c.x0 + c.x1) / 2);
      // Cada pedazo va a la columna cuyo título se le superpone más; si no toca ninguno, a la más cercana.
      const colOf = (c: CellBox) => {
        let best = -1;
        let bestOverlap = 0;
        header.forEach((h, i) => {
          const overlap = Math.min(h.x1, c.x1) - Math.max(h.x0, c.x0);
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            best = i;
          }
        });
        if (best >= 0) return best;
        const mid = (c.x0 + c.x1) / 2;
        return centers.reduce((bi, cx, i) => (Math.abs(cx - mid) < Math.abs(centers[bi]! - mid) ? i : bi), 0);
      };
      const headerText = norm(header.map((h) => h.text).join(' '));
      const dateCol = header.findIndex((h) => /fecha/.test(norm(h.text)));
      const descCol = header.findIndex((h) => /(descrip|concepto|detalle|movimiento|transacc|referencia|nombre)/.test(norm(h.text)));
      const rows: Cell[][] = [header.map((h) => h.text)];
      for (const line of lines.slice(headerIdx + 1)) {
        const cells = cellsOf(line);
        if (!cells.length) continue;
        if (norm(cells.map((c) => c.text).join(' ')) === headerText) continue; // título repetido en otra página
        const row: string[] = header.map(() => '');
        for (const c of cells) {
          const col = colOf(c);
          row[col] = row[col] ? `${row[col]} ${c.text}` : c.text;
        }
        const dateCell = row[dateCol] ?? '';
        if (dateCell && isDate(dateCell.split(' ').slice(0, 3).join(' '), year)) {
          const dateToken = dateCell.match(/^\S+(\s+(\S+)(\s+\d{4})?)?/)?.[0] ?? dateCell;
          const clean = isDate(dateToken, year) ? dateToken : dateCell.split(' ')[0]!;
          row[dateCol] = withYear(clean, year);
          rows.push(row);
        } else if (rows.length > 1 && descCol >= 0) {
          // Descripción que continúa en la línea siguiente.
          const onlyText = row.every((v, i) => i === descCol || !v);
          if (onlyText && row[descCol]) {
            const prev = rows[rows.length - 1]!;
            prev[descCol] = `${prev[descCol] ?? ''} ${row[descCol]}`.trim();
          }
        }
      }
      if (rows.length > 1) return rows;
    }
  }

  // Sin títulos reconocibles: líneas que empiezan por fecha y terminan en uno o dos montos.
  const rows: Cell[][] = [];
  let withBalance = false;
  for (const line of lines) {
    const cells = cellsOf(line);
    if (cells.length < 2) continue;
    const first = cells[0]!.text;
    const firstTwo = cells.length > 2 ? `${cells[0]!.text} ${cells[1]!.text}` : first;
    let dateText: string | null = null;
    let rest = cells.slice(1);
    if (isDate(first, year)) dateText = withYear(first, year);
    else if (isDate(firstTwo, year)) {
      dateText = withYear(firstTwo, year);
      rest = cells.slice(2);
    }
    if (!dateText) continue;
    const amounts: string[] = [];
    while (rest.length && AMOUNT_TOKEN.test(rest[rest.length - 1]!.text.replace(/\s/g, '')) && amounts.length < 2) {
      amounts.unshift(rest.pop()!.text);
    }
    const description = rest.map((c) => c.text).join(' ').trim();
    if (!amounts.length || !description) continue;
    if (amounts.length === 2) withBalance = true;
    rows.push([dateText, description, amounts[0]!, amounts[1] ?? '']);
  }
  if (!rows.length) return null;
  inferSigns(rows, withBalance);
  return [['Fecha', 'Descripción', 'Valor', 'Saldo'], ...rows];
}

const INCOMING = /\b(RECIBISTE|RECIBIDO|ABONO|DEPOSITO|CONSIGNACION|NOMINA|SALARIO|DEVOLUCION|REEMBOLSO|INTERESES|TE ENVIO|TE ENVIARON)\b/;

/**
 * Cuando los montos vienen sin signo: el cambio de saldo dice si fue entrada o salida. Donde no se puede
 * (la primera fila, o extractos sin saldo), se mira la descripción; si no dice que entró plata, es salida.
 * La persona revisa el resultado antes de guardar.
 */
function inferSigns(rows: Cell[][], withBalance: boolean) {
  const parsed = rows.map((r) => ({ date: parseDate(r[0]) ?? '', amount: parseAmount(r[2]), balance: parseAmount(r[3]) }));
  if (parsed.some((p) => p.amount !== null && p.amount < 0)) return; // ya traen signo
  const newestFirst = parsed[0]!.date > parsed[parsed.length - 1]!.date;
  for (let i = 0; i < rows.length; i++) {
    const cur = parsed[i]!;
    if (cur.amount === null) continue;
    let sign = 0;
    // El saldo "anterior" a esta fila: la siguiente si el extracto va de nuevo a viejo, la anterior si va de viejo a nuevo.
    const before = newestFirst ? parsed[i + 1] : parsed[i - 1];
    if (withBalance && cur.balance !== null && before && before.balance !== null) {
      const delta = cur.balance - before.balance;
      if (Math.abs(delta) === Math.abs(cur.amount)) sign = Math.sign(delta);
    }
    if (sign === 0) sign = INCOMING.test(stripAccents(String(rows[i]![1] ?? '')).toUpperCase()) ? 1 : -1;
    if (sign < 0) rows[i]![2] = `-${String(rows[i]![2]).replace(/^-/, '')}`;
  }
}

/** Lee un PDF en el navegador y devuelve filas de celdas. */
export async function readPdfRows(file: File): Promise<Cell[][]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (doc.numPages > 40) throw new Error('El PDF tiene más de 40 páginas. Descarga un rango de fechas más corto.');
  const lines: PdfLine[] = [];
  let fullText = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const byY = new Map<number, PdfItem[]>();
    for (const raw of content.items) {
      if (!('str' in raw) || !raw.str.trim()) continue;
      const [, , , , x, y] = raw.transform as number[];
      // Agrupa por renglón con tolerancia de 2 puntos.
      const key = [...byY.keys()].find((k) => Math.abs(k - y!) <= 2) ?? Math.round(y!);
      const list = byY.get(key) ?? [];
      list.push({ x: x!, w: raw.width, str: raw.str });
      byY.set(key, list);
      fullText += raw.str + ' ';
    }
    for (const [y, items] of [...byY.entries()].sort((a, b) => b[0] - a[0])) lines.push({ page: p, y, items });
  }
  if (!fullText.trim()) throw new Error('Este PDF es una imagen escaneada y no tiene texto. Descarga el extracto digital desde tu banco.');
  const rows = pdfLinesToRows(lines, fullText);
  if (!rows) throw new Error('No encontramos una tabla de movimientos en este PDF. Prueba con el CSV o Excel de tu banco.');
  return rows;
}
