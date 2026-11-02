import { describe, expect, it } from 'vitest';
import { buildTransactions, detectColumns } from '../parse';
import { dominantYear, pdfLinesToRows, type PdfLine } from '../pdf';

/** Línea de PDF a partir de pares [x, texto]; el ancho se aproxima a 5 puntos por carácter. */
const L = (y: number, ...parts: Array<[number, string]>): PdfLine => ({ page: 1, y, items: parts.map(([x, str]) => ({ x, str, w: str.length * 5 })) });

describe('extractos en PDF', () => {
  it('arma la tabla con títulos, une descripciones partidas y completa el año', () => {
    const lines = [
      L(800, [40, 'BANCO DE PRUEBA'], [400, 'Periodo: 01/10/2026 a 31/10/2026']),
      L(760, [40, 'Fecha'], [110, 'Descripción'], [380, 'Débitos'], [460, 'Créditos'], [540, 'Saldo']),
      L(740, [40, '01/10'], [110, 'TRANSFERENCIA A JUAN PEREZ'], [380, '900.000,00'], [540, '1.600.000,00']),
      L(728, [110, 'ARRIENDO OCTUBRE']),
      L(716, [40, '05/10'], [110, 'COMPRA INTL NETFLIX.COM'], [395, '26.900,00'], [540, '1.573.100,00']),
      L(704, [40, '30/10'], [110, 'PAGO NOMINA EMPRESA SAS'], [460, '2.500.000,00'], [540, '4.073.100,00']),
      L(60, [40, 'Página 1 de 1']),
    ];
    const rows = pdfLinesToRows(lines, 'Periodo: 01/10/2026 a 31/10/2026 ... 2026')!;
    expect(rows[0]).toEqual(['Fecha', 'Descripción', 'Débitos', 'Créditos', 'Saldo']);
    expect(rows).toHaveLength(4);
    expect(rows[1]![1]).toBe('TRANSFERENCIA A JUAN PEREZ ARRIENDO OCTUBRE');
    const map = detectColumns(rows)!;
    const res = buildTransactions(rows, map);
    expect(res.txs.map((t) => [t.postedOn, t.amountMinor])).toEqual([
      ['2026-10-01', -90000000],
      ['2026-10-05', -2690000],
      ['2026-10-30', 250000000],
    ]);
    expect(res.latestBalanceMinor).toBe(407310000);
  });

  it('sin títulos: fecha al inicio, montos al final y signo por el cambio de saldo', () => {
    const lines = [
      L(700, [40, '30 OCT 2026'], [120, 'Recibiste de Mamá'], [400, '$ 300.000'], [500, '$ 451.000']),
      L(688, [40, '29 OCT 2026'], [120, 'Pago en Rappi'], [400, '$ 49.000'], [500, '$ 151.000']),
      L(676, [40, '28 OCT 2026'], [120, 'Envío a Laura'], [400, '$ 20.000'], [500, '$ 200.000']),
    ];
    const rows = pdfLinesToRows(lines, '2026')!;
    const res = buildTransactions(rows, detectColumns(rows)!);
    expect(res.txs.map((t) => t.amountMinor)).toEqual([30000000, -4900000, -2000000]);
  });

  it('año dominante del documento', () => {
    expect(dominantYear('Extracto 2026 corte 31/10/2026, generado 2026, cliente desde 2019')).toBe(2026);
  });
});
