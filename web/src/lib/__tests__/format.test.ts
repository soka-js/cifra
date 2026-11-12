import { describe, expect, it } from 'vitest';
import { cop, formatThousands, parseBalanceInput, parsePesosInput, toDailyMinor } from '../format';

describe('saldo escrito a mano', () => {
  it('entiende puntos, signo pesos y "mil"', () => {
    expect(parseBalanceInput('1.250.000')).toBe(1_250_000_00);
    expect(parseBalanceInput('$ 980.500')).toBe(980_500_00);
    expect(parseBalanceInput('300mil')).toBe(300_000_00);
  });
  it('acepta cero y negativos (sobregiro)', () => {
    expect(parseBalanceInput('0')).toBe(0);
    expect(parseBalanceInput('$0')).toBe(0);
    expect(parseBalanceInput('-50.000')).toBe(-50_000_00);
  });
  it('rechaza lo que no es un monto', () => {
    expect(parseBalanceInput('')).toBeNull();
    expect(parseBalanceInput('mucho')).toBeNull();
    expect(parsePesosInput('0')).toBeNull();
  });
});

describe('gasto del día a día', () => {
  it('lleva semana y mes a pesos por día', () => {
    expect(toDailyMinor(30_000_00, 'dia')).toBe(30_000_00);
    expect(toDailyMinor(210_000_00, 'semana')).toBe(30_000_00);
    expect(toDailyMinor(900_000_00, 'mes')).toBe(30_000_00);
    // 100.000 a la semana son 14.285,71 al día: se redondea a pesos enteros.
    expect(toDailyMinor(100_000_00, 'semana')).toBe(14_286_00);
  });
});

describe('pesos en pantalla (formato colombiano)', () => {
  it('usa punto de miles y no muestra centavos', () => {
    expect(cop(180_822_800)).toBe('$1.808.228');
    expect(cop(1_200_000_00)).toBe('$1.200.000');
    expect(cop(900_00)).toBe('$900');
    expect(cop(0)).toBe('$0');
  });
  it('redondea a pesos enteros', () => {
    expect(cop(99_950)).toBe('$1.000');
    expect(cop(14_285_71)).toBe('$14.286');
  });
  it('pone el signo antes del símbolo', () => {
    expect(cop(-50_000_00)).toBe('-$50.000');
    expect(cop(2_000_00, { sign: true })).toBe('+$2.000');
    expect(cop(0, { sign: true })).toBe('$0');
  });
  it('formatea enteros sueltos con el mismo separador', () => {
    expect(formatThousands(1234567)).toBe('1.234.567');
    expect(formatThousands(999)).toBe('999');
    expect(formatThousands('1.250.000')).toBe('1.250.000');
  });
  it('lo que se muestra se puede volver a leer', () => {
    for (const minor of [900_00, 18_000_00, 1_100_000_00, 1_808_228_00]) {
      expect(parsePesosInput(cop(minor))).toBe(minor);
      expect(parsePesosInput(formatThousands(minor / 100))).toBe(minor);
    }
  });
});
