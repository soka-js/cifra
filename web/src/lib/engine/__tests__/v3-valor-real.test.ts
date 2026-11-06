import { describe, expect, it } from 'vitest';
import {
  buildUserConsumptionProfile,
  computeHonestMerchantMargin,
  computeMerchantBreakEven,
  crossReferenceOffers,
} from '../crossref';
import {
  computeDailyPulse,
  detectMoneyLeaks,
  simulateCreditInstallments,
} from '../daily-value';
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

describe('daily-value: tope diario vivo, simulador de cuotas TC y radiografía de fugas', () => {
  it('calcula el tope diario vivo y premia el ahorro diario hacia mañana', () => {
    const pulse = computeDailyPulse({
      safeAvailableMinor: 500_000_00,
      dailyVariableBaselineMinor: 20_000_00,
      daysUntilNextIncome: 10,
      todaySpentMinor: 10_000_00,
      todayTxCount: 1,
    });
    expect(pulse.dailyAllowanceMinor).toBeGreaterThan(40_000_00);
    expect(pulse.remainingTodayMinor).toBe(pulse.dailyAllowanceMinor - 10_000_00);
    expect(pulse.tomorrowDeltaMinor).toBeGreaterThan(0);
    expect(pulse.status).toBe('holgado');
  });

  it('simula cuotas de tarjeta de crédito con tasa efectiva anual colombiana', () => {
    const sim = simulateCreditInstallments(300_000_00, 30.8, [1, 3, 6, 12]);
    expect(sim.options[0]?.interestLostMinor).toBe(0);
    expect(sim.options[2]?.installments).toBe(6);
    expect(sim.options[2]?.interestLostMinor).toBeGreaterThan(20_000_00);
    expect(sim.options[3]?.interestLostMinor).toBeGreaterThan(sim.options[2]!.interestLostMinor);
  });

  it('detecta recargos ocultos en domicilios y cobros bancarios evitables', () => {
    const leaks = detectMoneyLeaks({
      today: '2026-11-06',
      txs: [
        { accountId: 'a1', postedOn: '2026-11-02', description: 'COMPRA RAPPI COLOMBIA', amountMinor: -42_000_00, spentHour: 20 },
        { accountId: 'a1', postedOn: '2026-11-04', description: 'COMPRA DIDI FOOD', amountMinor: -36_000_00, spentHour: 21 },
        { accountId: 'a1', postedOn: '2026-11-05', description: 'CUOTA DE MANEJO TARJETA DEBITO', amountMinor: -16_900_00 },
      ],
    });
    expect(leaks.some((l) => l.id === 'sobrecosto_domicilios')).toBe(true);
    expect(leaks.some((l) => l.id === 'cobros_bancarios')).toBe(true);
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

  it('calcula margen real del tendero frente a apps del 28 % y detecta encarecimiento de insumos', () => {
    const margin = computeHonestMerchantMargin({
      regularPriceMinor: 20_000_00,
      unitCostMinor: 9_000_00,
      discountKind: 'percent',
      discountPercent: 10,
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
  });
});
