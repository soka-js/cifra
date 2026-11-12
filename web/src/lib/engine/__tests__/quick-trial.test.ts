import { describe, expect, it } from 'vitest';
import { parseQuickForm } from '../../quick-form';
import { canISpend, compareGuess, computeQuickCifra } from '../quick';

/** La prueba pública sin cuenta: los cuatro datos, calculados en el navegador. */

function form(fields: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const item of Array.isArray(v) ? v : [v]) f.append(k, item);
  }
  return f;
}

const BRIEF = { frequency: 'quincenal', day1: '15', day2: '30', balance: '1.200.000', daily: '25.000', period: 'dia' };

describe('prueba sin cuenta: el caso del brief', () => {
  it('saldo $1.200.000, $25.000 al día y pago en 4 días da $1.100.000', () => {
    const parsed = parseQuickForm(form(BRIEF));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const c = computeQuickCifra({ today: '2026-11-11', ...parsed.values });
    expect(c.ready).toBe(true);
    expect(c.nextIncomeOn).toBe('2026-11-15');
    expect(c.daysLeft).toBe(4);
    expect(c.balanceMinor).toBe(1_200_000_00);
    expect(c.pendingMinor).toBe(0);
    expect(c.projectedVariableMinor).toBe(100_000_00);
    expect(c.availableMinor).toBe(1_100_000_00);
    // La única equivalencia por día: la cifra entre los días que faltan.
    expect(c.perDayMinor).toBe(275_000_00);
    expect(c.warnings).toEqual([]);
  });

  it('la resta que se muestra cierra exacta: saldo − fijos − día a día = cifra', () => {
    const parsed = parseQuickForm(
      form({ ...BRIEF, fixedName: ['Arriendo', 'Celular'], fixedAmount: ['650.000', '45.000'], fixedDay: ['13', '20'] }),
    );
    if (!parsed.ok) throw new Error(parsed.message);
    const c = computeQuickCifra({ today: '2026-11-11', ...parsed.values });
    // Antes del 15 solo cae el arriendo del 13; el celular del 20 es del siguiente ciclo.
    expect(c.pending.map((p) => p.name)).toEqual(['Arriendo']);
    expect(c.balanceMinor - c.pendingMinor - c.projectedVariableMinor - c.bufferMinor).toBe(c.availableMinor);
    expect(c.availableMinor).toBe(1_200_000_00 - 650_000_00 - 100_000_00);
  });

  it('si no alcanza, la cifra es negativa y no se disfraza', () => {
    const parsed = parseQuickForm(form({ ...BRIEF, balance: '50.000' }));
    if (!parsed.ok) throw new Error(parsed.message);
    const c = computeQuickCifra({ today: '2026-11-11', ...parsed.values });
    expect(c.availableMinor).toBe(-50_000_00);
    expect(c.status).toBe('en_rojo');
    expect(c.perDayMinor).toBe(0);
  });

  it('"¿puedo gastar?" responde contra la misma cifra', () => {
    const parsed = parseQuickForm(form(BRIEF));
    if (!parsed.ok) throw new Error(parsed.message);
    const c = computeQuickCifra({ today: '2026-11-11', ...parsed.values });
    expect(canISpend(c, 120_000_00)).toMatchObject({ verdict: 'si', remainingMinor: 980_000_00 });
    expect(canISpend(c, 1_080_000_00).verdict).toBe('justo');
    expect(canISpend(c, 1_300_000_00)).toMatchObject({ verdict: 'no', shortfallMinor: 200_000_00 });
  });
});

describe('prueba sin cuenta: lectura del formulario', () => {
  it('acepta el gasto por semana o por mes y lo lleva a pesos por día', () => {
    const parsed = parseQuickForm(form({ ...BRIEF, daily: '175.000', period: 'semana' }));
    expect(parsed.ok && parsed.values.dailyMinor).toBe(25_000_00);
  });

  it('acepta saldo en cero y gasto diario en cero', () => {
    const parsed = parseQuickForm(form({ ...BRIEF, balance: '0', daily: '0' }));
    expect(parsed.ok && parsed.values.balanceMinor).toBe(0);
    expect(parsed.ok && parsed.values.dailyMinor).toBe(0);
  });

  it('dice en qué paso falta el dato', () => {
    expect(parseQuickForm(form({ ...BRIEF, frequency: '' }))).toMatchObject({ ok: false, step: 0 });
    expect(parseQuickForm(form({ ...BRIEF, frequency: 'mensual', day1: '' }))).toMatchObject({ ok: false, step: 0 });
    expect(parseQuickForm(form({ ...BRIEF, balance: 'mucho' }))).toMatchObject({ ok: false, step: 1 });
    expect(
      parseQuickForm(form({ ...BRIEF, fixedName: ['Arriendo'], fixedAmount: ['650.000'], fixedDay: [''] })),
    ).toMatchObject({ ok: false, step: 2 });
    expect(parseQuickForm(form({ ...BRIEF, daily: '' }))).toMatchObject({ ok: false, step: 3 });
  });

  it('ignora las filas de cobros que quedaron vacías', () => {
    const parsed = parseQuickForm(form({ ...BRIEF, fixedName: ['', 'Gimnasio'], fixedAmount: ['', '90.000'], fixedDay: ['', '12'] }));
    expect(parsed.ok && parsed.values.fixed).toEqual([{ name: 'Gimnasio', amountMinor: 90_000_00, dayOfMonth: 12 }]);
  });

  it('pago irregular: la cifra va hasta fin de mes', () => {
    const parsed = parseQuickForm(form({ ...BRIEF, frequency: 'irregular' }));
    if (!parsed.ok) throw new Error(parsed.message);
    const c = computeQuickCifra({ today: '2026-11-11', ...parsed.values });
    expect(c.nextIncomeOn > '2026-11-11').toBe(true);
    expect(c.availableMinor).toBe(1_200_000_00 - 25_000_00 * c.projectionDays);
  });
});

describe('lo que creía frente a su cifra', () => {
  it('creía poder gastar más', () => {
    expect(compareGuess(1_300_000_00, 1_100_000_00)).toMatchObject({ direction: 'mas', overMinor: 200_000_00 });
  });
  it('creía poder gastar menos', () => {
    expect(compareGuess(800_000_00, 1_100_000_00)).toMatchObject({ direction: 'menos', overMinor: -300_000_00 });
  });
  it('acertó si la diferencia es menor al 5 %', () => {
    expect(compareGuess(1_120_000_00, 1_100_000_00).direction).toBe('igual');
    expect(compareGuess(1_160_000_00, 1_100_000_00).direction).toBe('mas');
  });
  it('con cifras pequeñas o negativas usa un margen de $5.000', () => {
    expect(compareGuess(4_000_00, 0).direction).toBe('igual');
    expect(compareGuess(100_000_00, -50_000_00).direction).toBe('mas');
  });
});
