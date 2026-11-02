import { describe, expect, it } from 'vitest';
import { computeCifra, sameCharge, type CifraInput } from '../cifra';
import { detectRecurring } from '../recurring';
import { ledger } from './fixtures';

/** Modo rápido: sin movimientos, solo lo que la persona escribe. */
const quick = (overrides: Partial<CifraInput> = {}): CifraInput => ({
  today: '2026-11-01',
  accounts: [{ accountId: 'm1', name: 'Saldo escrito', balanceMinor: 1_200_000_00, balanceOn: '2026-11-01', includeInCifra: true, editable: true }],
  transactions: [],
  income: { frequency: 'quincenal', days: [15, 30] },
  bufferMinor: 0,
  commitments: [
    { id: 'arriendo', name: 'Arriendo', amountMinor: 650_000_00, dayOfMonth: 5 },
    { id: 'celular', name: 'Celular', amountMinor: 45_000_00, dayOfMonth: 20 },
  ],
  marks: {},
  declaredDailyMinor: 25_000_00,
  ...overrides,
});

describe('modo rápido', () => {
  it('calcula la cifra sin movimientos con el gasto diario escrito', () => {
    const r = computeCifra(quick());
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.dailySource).toBe('declarado');
    expect(r.nextIncomeOn).toBe('2026-11-15');
    expect(r.daysLeft).toBe(14);
    // Antes del 15 solo cae el arriendo del 5; el celular del 20 queda para después del pago.
    expect(r.pending.map((p) => p.key)).toEqual(['compromiso:arriendo']);
    expect(r.projectedVariableMinor).toBe(25_000_00 * 14);
    expect(r.availableMinor).toBe(1_200_000_00 - 650_000_00 - 25_000_00 * 14);
    expect(r.warnings).toEqual([]);
  });

  it('sin gasto diario ni movimientos, falta ese dato', () => {
    const r = computeCifra(quick({ declaredDailyMinor: null }));
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(['movimientos']);
    expect(r.dailySource).toBe('sin_datos');
  });

  it('con menos de tres semanas de movimientos, sigue mandando lo escrito y no avisa de estimado preliminar', () => {
    const txs = ledger().filter((t) => t.postedOn >= '2026-10-20' && t.postedOn <= '2026-10-31');
    const r = computeCifra(quick({ transactions: txs }));
    expect(r.dailySource).toBe('declarado');
    expect(r.dailyVariableMinor).toBe(25_000_00);
    expect(r.warnings.some((w) => w.includes('tres semanas'))).toBe(false);
  });

  it('con tres semanas o más de movimientos, manda lo que muestran los movimientos', () => {
    const txs = ledger().filter((t) => t.postedOn <= '2026-10-31');
    const r = computeCifra(quick({ transactions: txs }));
    expect(r.dailySource).toBe('movimientos');
    expect(r.dailyVariableMinor).not.toBe(25_000_00);
  });

  it('reporta la edad del saldo', () => {
    expect(computeCifra(quick()).balanceAgeDays).toBe(0);
    const old = computeCifra(quick({ accounts: [{ accountId: 'm1', name: 'S', balanceMinor: 1_000_000_00, balanceOn: '2026-10-27', includeInCifra: true }] }));
    expect(old.balanceAgeDays).toBe(5);
    expect(old.warnings[0]).toMatch(/^Tu saldo es del/);
  });
});

describe('compromisos que ya aparecen en los movimientos', () => {
  const txs = ledger().filter((t) => t.postedOn <= '2026-10-31');
  const series = detectRecurring(txs, '2026-11-01').filter((r) => r.active);

  it('el mismo comercio por nombre es el mismo cobro', () => {
    const netflix = series.find((r) => r.merchantKey === 'netflix')!;
    expect(sameCharge({ id: 'n', name: 'Netflix', amountMinor: 1, dayOfMonth: 1 }, netflix)).toBe(true);
  });

  it('un compromiso escrito igual a un cobro detectado no se cuenta dos veces', () => {
    const rent = series.find((r) => r.merchantKey === 'transferencia_juan_carlos')!;
    const day = Number(rent.nextDate.slice(8, 10));
    const input = quick({ transactions: txs, commitments: [{ id: 'arr', name: 'Arriendo', amountMinor: rent.typicalMinor, dayOfMonth: day }] });
    const r = computeCifra(input);
    expect(r.matchedCommitments).toEqual(['arr']);
    expect(r.pending.filter((p) => p.origin === 'compromiso')).toEqual([]);
  });

  it('un compromiso distinto (otro monto) sí se cuenta', () => {
    const r = computeCifra(quick({ transactions: txs, commitments: [{ id: 'moto', name: 'Cuota moto', amountMinor: 250_000_00, dayOfMonth: 15 }] }));
    expect(r.matchedCommitments).toEqual([]);
    expect(r.pending.some((p) => p.key === 'compromiso:moto')).toBe(true);
  });
});

describe('cobros escritos que se parecen a uno detectado', () => {
  const txs = ledger().filter((t) => t.postedOn <= '2026-10-31');
  const r = (commitments: CifraInput['commitments']) => computeCifra(quick({ transactions: txs, commitments }));

  it('sugiere (no quita) cuando el nombre apunta a la categoría aunque el monto y el día no sean iguales', () => {
    const res = r([
      { id: 'arr', name: 'Arriendo', amountMinor: 650_000_00, dayOfMonth: 5 },
      { id: 'cel', name: 'Celular', amountMinor: 45_000_00, dayOfMonth: 20 },
    ]);
    expect(res.commitmentSuggestions.map((s) => [s.commitmentId, s.seriesKey])).toEqual([
      ['arr', 'transferencia_juan_carlos'],
      ['cel', 'claro'],
    ]);
    // Mientras la persona no confirme, se cuentan los dos: la cifra queda del lado prudente.
    expect(res.pending.some((p) => p.key === 'compromiso:arr')).toBe(true);
  });

  it('no vuelve a sugerir lo que la persona dijo que es distinto', () => {
    const res = r([{ id: 'cel', name: 'Celular', amountMinor: 45_000_00, dayOfMonth: 20, notSameAs: ['claro'] }]);
    expect(res.commitmentSuggestions).toEqual([]);
  });

  it('cada cobro detectado se sugiere para un solo compromiso', () => {
    const res = r([
      { id: 'a', name: 'Celular', amountMinor: 45_000_00, dayOfMonth: 20 },
      { id: 'b', name: 'Plan celular', amountMinor: 50_000_00, dayOfMonth: 19 },
    ]);
    expect(res.commitmentSuggestions.filter((s) => s.seriesKey === 'claro')).toHaveLength(1);
  });

  it('sin pista en el nombre y con otro monto, no sugiere nada', () => {
    expect(r([{ id: 'moto', name: 'Cuota moto', amountMinor: 250_000_00, dayOfMonth: 15 }]).commitmentSuggestions).toEqual([]);
  });
});
