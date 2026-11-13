import { describe, expect, it } from 'vitest';
import {
  buildUserConsumptionProfile,
  computeHonestMerchantMargin,
  computeMerchantBreakEven,
  crossReferenceOffers,
} from '../crossref';
import { cop } from '../../format';
import { detectMoneyLeaks, simulateCreditInstallments } from '../daily-value';
import {
  parseChatExpenses,
  parseColombianBankAlert,
  parseColombianMoneyMinor,
} from '../quick-capture';

describe('quick-capture: expresiones de dinero, frases rápidas y SMS bancarios colombianos', () => {
  it('convierte expresiones en pesos y abreviaturas k/mil/millones a centavos exactos', () => {
    expect(parseColombianMoneyMinor('18k')).toBe(18_000_00);
    expect(parseColombianMoneyMinor('18.5 mil')).toBe(18_500_00);
    expect(parseColombianMoneyMinor('$24.900,00')).toBe(24_900_00);
    expect(parseColombianMoneyMinor('$45,000.00')).toBe(45_000_00);
    expect(parseColombianMoneyMinor('1.2 millones')).toBe(1_200_000_00);
  });

  it('parsea múltiples gastos rápidos en una sola frase tipo WhatsApp', () => {
    const items = parseChatExpenses('almuerzo 18k nequi, uber 14500 y panadería 8.500', '2026-11-06', 13);
    expect(items).toHaveLength(3);
    expect(items[0]?.amountMinor).toBe(-18_000_00);
    expect(items[0]?.category).toBe('comida');
    expect(items[1]?.amountMinor).toBe(-14_500_00);
    expect(items[1]?.category).toBe('transporte');
    expect(items[2]?.amountMinor).toBe(-8_500_00);
    expect(items[2]?.category).toBe('comida');
  });

  it('extrae monto, comercio, banco y hora de alertas reales de Bancolombia y Nequi/Bre-B', () => {
    const sms = `Bancolombia le informa Compra por $24.900,00 en CREPES Y WAFFLES 14:35. 06/11/2026 T.Deb *4821

Pagaste $18.500,00 en PANADERIA LA ESPIGA con tu Nequi a las 5:20 p. m.`;

    const parsed = parseColombianBankAlert(sms, '2026-11-06', 12);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.sourceBank).toBe('Bancolombia');
    expect(parsed[0]?.amountMinor).toBe(-24_900_00);
    expect(parsed[0]?.spentHour).toBe(14);
    expect(parsed[0]?.category).toBe('comida');

    expect(parsed[1]?.sourceBank).toBe('Nequi');
    expect(parsed[1]?.amountMinor).toBe(-18_500_00);
    expect(parsed[1]?.spentHour).toBe(17);
  });
});

describe('daily-value: simulador de cuotas de tarjeta y gastos que se repiten', () => {
  it('simula cuotas de tarjeta de crédito con tasa efectiva anual colombiana', () => {
    const sim = simulateCreditInstallments(300_000_00, 30.8, [1, 3, 6, 12]);
    expect(sim.options[0]?.interestLostMinor).toBe(0);
    expect(sim.options[2]?.installments).toBe(6);
    expect(sim.options[2]?.interestLostMinor).toBeGreaterThan(20_000_00);
    expect(sim.options[3]?.interestLostMinor).toBeGreaterThan(sim.options[2]!.interestLostMinor);
  });

  it('el consejo del simulador cita los intereses que calculó', () => {
    const sim = simulateCreditInstallments(300_000_00, 30.8, [1, 3, 6, 12]);
    expect(sim.plainAdvice).toContain(`A 12 cuotas pagarías ${cop(sim.options[3]!.interestLostMinor)} más`);
    expect(simulateCreditInstallments(300_000_00, 0).plainAdvice).toMatch(/no pagas intereses/);
  });

  it('muestra lo que de verdad se pagó en domicilios y en cobros del banco, sin estimar ahorros', () => {
    const leaks = detectMoneyLeaks({
      today: '2026-11-06',
      txs: [
        { accountId: 'a1', postedOn: '2026-11-02', description: 'COMPRA RAPPI COLOMBIA', amountMinor: -42_000_00, spentHour: 20 },
        { accountId: 'a1', postedOn: '2026-11-04', description: 'COMPRA DIDI FOOD', amountMinor: -36_000_00, spentHour: 21 },
        { accountId: 'a1', postedOn: '2026-11-05', description: 'CUOTA DE MANEJO TARJETA DEBITO', amountMinor: -16_900_00 },
      ],
    });
    expect(leaks.find((l) => l.id === 'domicilios_app')).toMatchObject({ amountMinor: 78_000_00, count: 2 });
    expect(leaks.find((l) => l.id === 'cobros_bancarios')).toMatchObject({ amountMinor: 16_900_00, count: 1 });
    // Ningún texto trae un monto que no esté en los movimientos.
    for (const l of leaks) expect(`${l.evidence} ${l.concreteAction}`).not.toMatch(/\$\d/);
    // Los más grandes primero.
    expect(leaks.map((l) => l.amountMinor)).toEqual([...leaks.map((l) => l.amountMinor)].sort((a, b) => b - a));
  });
});

describe('crossref: cruce gasto real × hora × cercanía GPS y economía honesta del tendero', () => {
  it('prioriza ofertas relámpago cercanas en la franja y categoría donde el usuario suele gastar', () => {
    const profile = buildUserConsumptionProfile([
      { accountId: 'a1', postedOn: '2026-11-01', description: 'COMPRA RAPPI HAMBURGUESA', amountMinor: -32_000_00, spentHour: 17 },
      { accountId: 'a1', postedOn: '2026-11-03', description: 'CAFE JUAN VALDEZ', amountMinor: -24_000_00, spentHour: 16 },
    ]);

    const ranked = crossReferenceOffers({
      profile,
      userLat: 4.6432,
      userLng: -74.0631,
      currentHour: 17,
      dayOfWeek: 5,
      filter: 'ahora',
      offers: [
        {
          offerId: 'o-flash',
          merchantId: 'm1',
          merchantSlug: 'la-espiga',
          merchantName: 'Panadería La Espiga',
          businessCategory: 'panaderia',
          neighborhood: 'Chapinero',
          address: 'Cra 9 # 58-14',
          hoursText: '6:30 a. m. - 8:00 p. m.',
          lat: 4.6448,
          lng: -74.0622,
          typicalTicketMinor: 20_000_00,
          title: 'Relámpago de las 5 p. m.: -25 % en horneados del día',
          description: null,
          targetCategory: 'comida',
          discountKind: 'percent',
          discountPercent: 25,
          discountFixedMinor: null,
          minPurchaseMinor: 10_000_00,
          isFlash: true,
          startHour: 16,
          endHour: 19,
          activeDays: [1, 2, 3, 4, 5, 6],
          stockLimit: 8,
          stockRemaining: 5,
          activeHoursText: '4:00 p. m. - 7:00 p. m.',
          estimatedSavingsMinor: 5_000_00,
          newCustomersOnly: false,
        },
        {
          offerId: 'o-far',
          merchantId: 'm2',
          merchantSlug: 'papeleria',
          merchantName: 'Papelería Lejana',
          businessCategory: 'papeleria',
          neighborhood: 'Suba',
          address: 'Calle 145',
          hoursText: null,
          lat: 4.74,
          lng: -74.09,
          typicalTicketMinor: 18_000_00,
          title: '10 % en cuadernos',
          description: null,
          targetCategory: 'educacion',
          discountKind: 'percent',
          discountPercent: 10,
          discountFixedMinor: null,
          minPurchaseMinor: 10_000_00,
          isFlash: false,
          startHour: null,
          endHour: null,
          activeDays: [0, 1, 2, 3, 4, 5, 6],
          stockLimit: null,
          stockRemaining: null,
          activeHoursText: null,
          estimatedSavingsMinor: 1_800_00,
          newCustomersOnly: true,
        },
      ],
    });

    expect(ranked[0]?.offerId).toBe('o-flash');
    expect(ranked[0]?.habitMatched).toBe(true);
    expect(ranked[0]?.habitTimeMatched).toBe(true);
    expect(ranked[0]?.vsHabitualSavingsMinor).toBeGreaterThan(10_000_00);
  });

  it('calcula margen real del tendero frente a la comisión de app que él escribe y detecta encarecimiento de insumos', () => {
    // Sin comisión de app escrita, no se supone ninguna: la "venta por app" queda igual a la venta normal.
    const sinApp = computeHonestMerchantMargin({ regularPriceMinor: 20_000_00, unitCostMinor: 9_000_00, discountKind: 'percent', discountPercent: 10 });
    expect(sinApp.deliveryAppCommissionMinor).toBe(0);

    const margin = computeHonestMerchantMargin({
      regularPriceMinor: 20_000_00,
      unitCostMinor: 9_000_00,
      discountKind: 'percent',
      discountPercent: 10,
      deliveryAppCommissionPct: 28,
    });
    expect(margin.cifraNetInRegisterMinor).toBe(17_100_00);
    expect(margin.cifraFirstVisitProfitMinor).toBe(8_100_00);
    expect(margin.deliveryAppProfitMinor).toBe(5_400_00);
    expect(margin.advantageVsAppMinor).toBe(2_700_00);
    expect(margin.isLosingMoney).toBe(false);

    const be = computeMerchantBreakEven({
      today: '2026-11-06',
      dailyBreakEvenMinor: 450_000_00,
      entries: [
        { entryOn: '2026-11-06', kind: 'venta_mostrador', categoryLabel: 'Mostrador mañana', amountMinor: 310_000_00 },
        { entryOn: '2026-11-06', kind: 'venta_cifra', categoryLabel: 'Venta CIFRA', amountMinor: 36_000_00 },
        { entryOn: '2026-10-12', kind: 'insumos', categoryLabel: 'Harina y mantequilla', supplierName: 'Molinos del Sol', amountMinor: 200_000_00 },
        { entryOn: '2026-11-04', kind: 'insumos', categoryLabel: 'Harina y mantequilla', supplierName: 'Molinos del Sol', amountMinor: 245_000_00 },
      ],
    });
    expect(be.todaySalesMinor).toBe(346_000_00);
    expect(be.gapTodayMinor).toBe(104_000_00);
    expect(be.needsFlashBoost).toBe(true);
    expect(be.supplyAlerts).toHaveLength(1);
    expect(be.supplyAlerts[0]?.increasePct).toBe(23);

    // Sin meta escrita por el tendero no se inventa una: no hay brecha ni porcentaje.
    const noGoal = computeMerchantBreakEven({
      today: '2026-11-06',
      dailyBreakEvenMinor: null,
      entries: [{ entryOn: '2026-11-06', kind: 'venta_mostrador', categoryLabel: 'Mostrador', amountMinor: 80_000_00 }],
    });
    expect(noGoal).toMatchObject({
      dailyBreakEvenMinor: null,
      todaySalesMinor: 80_000_00,
      gapTodayMinor: 0,
      progressPct: 0,
      reachedBreakEven: false,
      needsFlashBoost: false,
    });
  });
});
