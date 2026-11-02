import { describe, expect, it } from 'vitest';
import { parseBalanceInput, parsePesosInput, toDailyMinor } from '../format';

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
