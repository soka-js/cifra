import { describe, expect, it } from 'vitest';
import { detectRecurring } from '../recurring';
import { ledger } from './fixtures';

describe('cobros que se repiten', () => {
  const series = detectRecurring(ledger(), '2026-11-01');
  const keys = series.map((s) => s.merchantKey);

  it('encuentra suscripciones, servicios y el arriendo', () => {
    expect(keys).toEqual(expect.arrayContaining(['netflix', 'spotify', 'claro', 'enel', 'smart_fit', 'transferencia_juan_carlos']));
  });
  it('no confunde el mercado ni los domicilios con cobros fijos', () => {
    expect(keys).not.toContain('d1');
    expect(keys).not.toContain('rappi');
    expect(keys).not.toContain('uber');
  });
  it('calcula la próxima fecha y el monto típico', () => {
    const netflix = series.find((s) => s.merchantKey === 'netflix')!;
    expect(netflix.cadence).toBe('mensual');
    expect(netflix.typicalMinor).toBe(2_690_000);
    expect(netflix.nextDate).toBe('2026-11-05');
    expect(netflix.active).toBe(true);
    const enel = series.find((s) => s.merchantKey === 'enel')!;
    expect(enel.variableAmount).toBe(true);
  });
  it('un cobro que dejó de aparecer ya no está vigente', () => {
    const old = detectRecurring(ledger(), '2027-02-01').find((s) => s.merchantKey === 'netflix')!;
    expect(old.active).toBe(false);
  });
});
