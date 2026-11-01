import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, nextDayOfMonth, nextWeekday, shortDate, todayInBogota } from '../dates';

describe('fechas', () => {
  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(daysBetween('2026-10-01', '2026-11-01')).toBe(31);
  });
  it('el 30 de febrero cae el último día del mes', () => {
    expect(nextDayOfMonth('2027-02-10', [30])).toBe('2027-02-28');
    expect(nextDayOfMonth('2028-02-10', [30])).toBe('2028-02-29');
  });
  it('quincenal toma la fecha más cercana después de hoy', () => {
    expect(nextDayOfMonth('2026-11-01', [15, 30])).toBe('2026-11-15');
    expect(nextDayOfMonth('2026-11-15', [15, 30])).toBe('2026-11-30');
    expect(nextDayOfMonth('2026-11-30', [15, 30])).toBe('2026-12-15');
  });
  it('próximo viernes', () => {
    expect(nextWeekday('2026-11-01', 5)).toBe('2026-11-06');
  });
  it('hoy en Bogotá es UTC-5', () => {
    expect(todayInBogota(new Date('2026-11-02T03:00:00Z'))).toBe('2026-11-01');
    expect(todayInBogota(new Date('2026-11-02T06:00:00Z'))).toBe('2026-11-02');
  });
  it('formato corto', () => {
    expect(shortDate('2026-11-15')).toBe('15 nov');
  });
});
