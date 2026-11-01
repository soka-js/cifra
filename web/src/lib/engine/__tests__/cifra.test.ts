import { describe, expect, it } from 'vitest';
import { canISpend, computeCifra, type CifraInput } from '../cifra';
import { detectIncome } from '../income';
import { ledger } from './fixtures';

const base = (overrides: Partial<CifraInput> = {}): CifraInput => ({
  today: '2026-11-01',
  accounts: [{ accountId: 'a1', name: 'Ahorros', balanceMinor: 2_800_000_00, balanceOn: '2026-11-01', includeInCifra: true }],
  transactions: ledger().filter((t) => t.postedOn <= '2026-10-31'),
  income: { frequency: null, days: null },
  bufferMinor: 0,
  commitments: [],
  marks: {},
  ...overrides,
});

describe('ingreso', () => {
  it('detecta la nómina mensual del 30', () => {
    const inc = detectIncome(ledger())!;
    expect(inc.frequency).toBe('mensual');
    expect(inc.days).toEqual([30]);
    expect(inc.typicalMinor).toBe(2_500_000_00);
  });
});

describe('la cifra', () => {
  const r = computeCifra(base());

  it('está lista con saldo y movimientos', () => {
    expect(r.ready).toBe(true);
    expect(r.nextIncomeOn).toBe('2026-11-30');
    expect(r.daysLeft).toBe(29);
  });

  it('resta los cobros fijos que faltan antes del próximo ingreso', () => {
    const names = r.pending.map((p) => p.key);
    // El arriendo del 1 de noviembre todavía no aparece en los movimientos: está pendiente.
    expect(names).toEqual(expect.arrayContaining(['transferencia_juan_carlos', 'smart_fit', 'netflix', 'enel', 'spotify', 'claro']));
    expect(r.pendingMinor).toBeGreaterThan(1_150_000_00);
  });

  it('la resta cuadra: saldo menos pendientes menos gasto normal menos colchón', () => {
    expect(r.availableMinor).toBe(r.balanceMinor - r.pendingMinor - r.projectedVariableMinor - r.bufferMinor);
    // El gasto diario simulado ronda los 30.000 pesos (80 % de los días, entre 15.000 y 60.000).
    expect(r.dailyVariableMinor).toBeGreaterThan(20_000_00);
    expect(r.dailyVariableMinor).toBeLessThan(40_000_00);
  });

  it('el colchón y los compromisos manuales bajan la cifra', () => {
    const withBuffer = computeCifra(base({ bufferMinor: 100_000_00, commitments: [{ id: 'c1', name: 'Cuota moto', amountMinor: 250_000_00, dayOfMonth: 15 }] }));
    expect(withBuffer.availableMinor).toBe(r.availableMinor - 100_000_00 - 250_000_00);
  });

  it('marcar un cobro como "no es fijo" lo saca de los pendientes', () => {
    const marked = computeCifra(base({ marks: { claro: 'no_es_fijo' } }));
    expect(marked.pending.map((p) => p.key)).not.toContain('claro');
  });

  it('respeta el día de pago configurado', () => {
    const q = computeCifra(base({ income: { frequency: 'quincenal', days: [15, 30] } }));
    expect(q.nextIncomeOn).toBe('2026-11-15');
    expect(q.income.origin).toBe('configurado');
  });

  it('avisa si el saldo está viejo y proyecta el gasto desde esa fecha', () => {
    const stale = computeCifra(base({ accounts: [{ accountId: 'a1', name: 'Ahorros', balanceMinor: 2_000_000_00, balanceOn: '2026-10-25', includeInCifra: true }] }));
    expect(stale.warnings.join(' ')).toMatch(/25 oct/);
    expect(stale.projectionDays).toBe(36);
  });

  it('sin saldo no está lista y lo dice', () => {
    const none = computeCifra(base({ accounts: [] }));
    expect(none.ready).toBe(false);
    expect(none.missing).toContain('saldo');
  });
});

describe('¿puedo hacer este gasto?', () => {
  const r = computeCifra(base());
  it('sí, cuando cabe con margen', () => {
    const a = canISpend(r, 10_000_00);
    expect(a.verdict).toBe('si');
    expect(a.remainingMinor).toBe(r.availableMinor - 10_000_00);
  });
  it('no, cuando pasa lo libre, y dice cuánto falta', () => {
    const a = canISpend(r, r.availableMinor + 50_000_00);
    expect(a.verdict).toBe('no');
    expect(a.shortfallMinor).toBe(50_000_00);
  });
  it('justo, cuando cabe pero deja menos de tres días de gasto normal', () => {
    const a = canISpend(r, r.availableMinor - r.dailyVariableMinor);
    expect(a.verdict).toBe('justo');
  });
});
