import { describe, expect, it } from 'vitest';
import {
  computeCategoryComparison,
  detectAntExpenses,
  detectSpendDeviation,
  parseNaturalSpendQuery,
} from '../insights';
import { getCancellationGuide, identifyMerchant } from '../merchant';
import type { Tx } from '../types';

describe('insights & natural query engine', () => {
  it('interpreta consultas naturales en español con miles, millones y pesos', () => {
    const q1 = parseNaturalSpendQuery('¿Puedo gastar 180 mil este viernes en cena con amigos?');
    expect(q1.amountMinor).toBe(180_000_00);
    expect(q1.concept.toLowerCase()).toContain('viernes');

    const q2 = parseNaturalSpendQuery('250k chaqueta');
    expect(q2.amountMinor).toBe(250_000_00);
    expect(q2.concept).toBe('chaqueta');

    const q3 = parseNaturalSpendQuery('$1.200.000 viaje a Santa Marta');
    expect(q3.amountMinor).toBe(1_200_000_00);
    expect(q3.concept).toContain('Santa Marta');

    const q4 = parseNaturalSpendQuery('1,5 millones computador');
    expect(q4.amountMinor).toBe(1_500_000_00);
  });

  it('detecta gastos hormiga frecuentes y su acumulado mensual', () => {
    const txs: Tx[] = [
      { accountId: 'a1', postedOn: '2026-11-01', description: 'COMPRA POS TOSTAO CAFE', amountMinor: -9_500_00 },
      { accountId: 'a1', postedOn: '2026-11-02', description: 'COMPRA POS TOSTAO CAFE', amountMinor: -12_000_00 },
      { accountId: 'a1', postedOn: '2026-11-03', description: 'COMPRA POS TOSTAO CAFE', amountMinor: -11_000_00 },
      { accountId: 'a1', postedOn: '2026-11-04', description: 'COMPRA POS TOSTAO CAFE', amountMinor: -10_500_00 },
    ];
    const ants = detectAntExpenses(txs, '2026-11-05');
    expect(ants).toHaveLength(1);
    expect(ants[0]!.merchantKey).toBe('tostao');
    expect(ants[0]!.count).toBe(4);
    expect(ants[0]!.totalMinor).toBe(43_000_00);
  });

  it('compara el gasto por categoría entre dos ciclos consecutivos respetando reglas del usuario', () => {
    const txs: Tx[] = [
      { accountId: 'a1', postedOn: '2026-09-20', description: 'COMPRA POS LOCAL BARRIO', amountMinor: -80_000_00 },
      { accountId: 'a1', postedOn: '2026-10-25', description: 'COMPRA POS LOCAL BARRIO', amountMinor: -120_000_00 },
    ];
    const m = identifyMerchant('COMPRA POS LOCAL BARRIO');
    const breakdown = computeCategoryComparison(txs, '2026-11-05', 30, {
      [m.key]: { category: 'mercado', customName: 'Tienda Don Luis' },
    });

    expect(breakdown.currentTotalMinor).toBe(120_000_00);
    expect(breakdown.previousTotalMinor).toBe(80_000_00);
    expect(breakdown.rows[0]!.category).toBe('mercado');
    expect(breakdown.rows[0]!.deltaPercent).toBe(50);
  });

  it('activa alerta temprana cuando el ritmo semanal supera la línea base de la persona', () => {
    const txs: Tx[] = [
      { accountId: 'a1', postedOn: '2026-11-01', description: 'RAPPI RESTAURANTE', amountMinor: -95_000_00 },
      { accountId: 'a1', postedOn: '2026-11-02', description: 'CREPES & WAFFLES', amountMinor: -85_000_00 },
      { accountId: 'a1', postedOn: '2026-11-04', description: 'CINE COLOMBIA', amountMinor: -70_000_00 },
      { accountId: 'a1', postedOn: '2026-11-05', description: 'UBER TRIP', amountMinor: -65_000_00 },
    ];
    const alert = detectSpendDeviation({
      rawTxs: txs,
      fixedMerchantKeys: new Set(),
      baselineDailyMinor: 25_000_00,
      today: '2026-11-05',
    });
    expect(alert.triggered).toBe(true);
    expect(alert.excessWeeklyMinor).toBeGreaterThan(100_000_00);
  });

  it('entrega guías accionables de cancelación para servicios y comisiones en Colombia', () => {
    const cuota = getCancellationGuide('cuota_manejo', 'Cuota de manejo', 'comisiones');
    expect(cuota.legalNote).toContain('Ley 2009');
    expect(cuota.steps.length).toBeGreaterThanOrEqual(2);

    const netflix = getCancellationGuide('netflix', 'Netflix', 'suscripciones');
    expect(netflix.url).toContain('netflix.com');
  });
});
