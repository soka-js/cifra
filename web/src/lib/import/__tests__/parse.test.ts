import { describe, expect, it } from 'vitest';
import { buildTransactions, detectColumns, parseAmount, parseDate } from '../parse';

describe('montos', () => {
  it.each([
    ['1.234.567,89', 123456789],
    ['1,234,567.89', 123456789],
    ['-45.000', -4500000],
    ['$ -45.000', -4500000],
    ['(45.000)', -4500000],
    ['45.000-', -4500000],
    ['45000.5', 4500050],
    ['26,90', 2690],
    ['2.500.000', 250000000],
    ['-$ 1.200', -120000],
  ])('%s', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });
  it('números y vacíos', () => {
    expect(parseAmount(-45000)).toBe(-4500000);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('fechas', () => {
  it.each([
    ['2026-10-15', '2026-10-15'],
    ['15/10/2026', '2026-10-15'],
    ['15-10-26', '2026-10-15'],
    ['20261015', '2026-10-15'],
    ['15 oct 2026', '2026-10-15'],
    ['15-OCT-2026', '2026-10-15'],
    ['oct 15, 2026', '2026-10-15'],
  ])('%s', (raw, expected) => {
    expect(parseDate(raw)).toBe(expected);
  });
  it('serial de Excel y Date', () => {
    expect(parseDate(46310)).toBe('2026-10-15');
    expect(parseDate(new Date(Date.UTC(2026, 9, 15)))).toBe('2026-10-15');
  });
  it('rechaza fechas imposibles', () => {
    expect(parseDate('31/02/2026')).toBeNull();
  });
});

describe('columnas', () => {
  it('encuentra encabezados después de filas de título y lee débitos y créditos', () => {
    const rows = [
      ['Banco Ejemplo', null, null, null, null],
      ['Extracto de cuenta de ahorros', null, null, null, null],
      ['Fecha', 'Descripción', 'Débitos', 'Créditos', 'Saldo'],
      ['01/10/2026', 'TRANSFERENCIA A JUAN PEREZ', '900.000', '', '1.600.000'],
      ['05/10/2026', 'COMPRA INTL NETFLIX.COM', '26.900', '', '1.573.100'],
      ['30/10/2026', 'PAGO NOMINA EMPRESA SAS', '', '2.500.000', '4.073.100'],
      ['', 'Total', '', '', ''],
    ];
    const map = detectColumns(rows)!;
    expect(map).toMatchObject({ headerRow: 2, date: 0, description: 1, debit: 2, credit: 3, balance: 4, amount: null });
    const res = buildTransactions(rows, map);
    expect(res.txs).toHaveLength(3);
    expect(res.txs[0]).toMatchObject({ postedOn: '2026-10-01', amountMinor: -90000000 });
    expect(res.txs[2]!.amountMinor).toBe(250000000);
    expect(res.latestBalanceMinor).toBe(407310000);
    expect(res.skipped).toBe(1);
  });
  it('columna única con signo y extracto de nuevo a viejo', () => {
    const rows = [
      ['FECHA', 'DESCRIPCION', 'VALOR', 'SALDO'],
      ['20261030', 'ABONO NOMINA', '2500000.00', '4073100.00'],
      ['20261005', 'COMPRA NETFLIX', '-26900.00', '1573100.00'],
    ];
    const map = detectColumns(rows)!;
    expect(map.amount).toBe(2);
    const res = buildTransactions(rows, map);
    expect(res.latestBalanceMinor).toBe(407310000);
    expect(res.from).toBe('2026-10-05');
    expect(res.to).toBe('2026-10-30');
  });
});
