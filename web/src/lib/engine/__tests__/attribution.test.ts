import { describe, expect, it } from 'vitest';
import {
  computeMerchantReport,
  computeRedemptionSplit,
  evaluateOfferEligibility,
  generateRedemptionCode,
  holdoutBucket,
  matchesMerchantKeywords,
  rankOffersForUser,
  type CandidateOffer,
} from '../attribution';
import { cop } from '../../format';

const SAMPLE_OFFER: CandidateOffer = {
  id: 'offer-1',
  merchantId: 'merchant-espiga',
  merchantName: 'Panadería La Espiga',
  merchantSlug: 'panaderia-la-espiga',
  merchantCategory: 'panaderia',
  neighborhood: 'Chapinero Central',
  zoneSlug: 'chapinero',
  address: 'Cra 13 # 54-12',
  hoursText: 'Lun–Sáb 6:30 a.m. – 8:00 p.m.',
  lat: 4.642,
  lng: -74.063,
  typicalTicketMinor: 20_000_00,
  commissionBps: 500,
  matchKeywords: ['PANADERIA LA ESPIGA', 'ESPIGA CHAPINERO'],
  title: '10 % en desayuno o pan de masa madre',
  description: 'Aplica en cualquier combo de panadería.',
  targetCategory: 'comida',
  discountKind: 'percent',
  discountPercent: 10,
  discountFixedMinor: null,
  maxDiscountMinor: 8_000_00,
  minPurchaseMinor: 10_000_00,
  newCustomersOnly: true,
  exclusivityDays: 60,
  holdoutPercent: 10,
  monthlyCapRedemptions: 80,
  monthlyRedemptionsUsed: 12,
  validFrom: '2026-10-01',
  validUntil: '2026-12-31',
  activeHoursText: null,
};

describe('attribution engine (G.10 & J.3)', () => {
  it('reproduce exactamente el cálculo de G.10: ticket $20.000, 10% dcto, 5% comisión -> $18.000 paga, $900 CIFRA, $17.100 negocio, CAC 14,5%', () => {
    const split = computeRedemptionSplit({
      grossAmountMinor: 20_000_00,
      discountKind: 'percent',
      discountPercent: 10,
      commissionBps: 500,
      channel: 'propio',
    });

    expect(split.eligibleByAmount).toBe(true);
    expect(split.discountMinor).toBe(2_000_00);
    expect(split.netPaidByUserMinor).toBe(18_000_00);
    expect(split.cifraCommissionMinor).toBe(900_00);
    expect(split.partnerShareMinor).toBe(0);
    expect(split.cifraNetRevenueMinor).toBe(900_00);
    expect(split.merchantNetKeepMinor).toBe(17_100_00);
    expect(split.totalMerchantCacMinor).toBe(2_900_00);
    expect(split.effectiveCacPercent).toBe(14.5);
  });

  it('calcula el reparto del 30% al aliado B2B2C en canal aliado manteniendo el mismo precio al negocio (J.3)', () => {
    const split = computeRedemptionSplit({
      grossAmountMinor: 20_000_00,
      discountKind: 'percent',
      discountPercent: 10,
      commissionBps: 500,
      channel: 'aliado',
      partnerShareBps: 3000,
    });

    expect(split.cifraCommissionMinor).toBe(900_00);
    expect(split.merchantNetKeepMinor).toBe(17_100_00);
    expect(split.partnerShareMinor).toBe(270_00);
    expect(split.cifraNetRevenueMinor).toBe(630_00);
  });

  it('respeta tope máximo de descuento y compra mínima', () => {
    const belowMin = computeRedemptionSplit({
      grossAmountMinor: 8_000_00,
      discountKind: 'percent',
      discountPercent: 15,
      minPurchaseMinor: 12_000_00,
    });
    expect(belowMin.eligibleByAmount).toBe(false);
    expect(belowMin.discountMinor).toBe(0);

    const capped = computeRedemptionSplit({
      grossAmountMinor: 100_000_00,
      discountKind: 'percent',
      discountPercent: 20,
      maxDiscountMinor: 10_000_00,
    });
    expect(capped.discountMinor).toBe(10_000_00);
    expect(capped.netPaidByUserMinor).toBe(90_000_00);
  });

  it('genera códigos de 6 caracteres sin letras ambiguas (0, O, 1, I, L)', () => {
    for (let i = 0; i < 40; i++) {
      const code = generateRedemptionCode(6);
      expect(code).toHaveLength(6);
      expect(code).not.toMatch(/[0O1IL]/);
    }
  });

  it('bloquea canibalización si la persona ya compró en el negocio según su extracto bancario', () => {
    // Buscamos un userId que no caiga en el 10 % de holdout para probar aislamiento de cliente previo.
    let eligibleUser = 'user-a';
    for (let i = 0; i < 100; i++) {
      const candidate = `user-treat-${i}`;
      if (holdoutBucket(candidate, SAMPLE_OFFER.merchantId) >= 15) {
        eligibleUser = candidate;
        break;
      }
    }

    const blocked = evaluateOfferEligibility({
      today: '2026-11-05',
      userId: eligibleUser,
      offer: SAMPLE_OFFER,
      userTransactions: [
        {
          accountId: 'acc-1',
          postedOn: '2026-10-18',
          description: 'COMPRA POS PANADERIA LA ESPIGA BOG',
          amountMinor: -16_500_00,
        },
      ],
      priorMerchantRedemptionDates: [],
    });
    expect(blocked.eligible).toBe(false);
    expect(blocked.reasonIfIneligible).toBe('ya_cliente_reciente');

    const allowed = evaluateOfferEligibility({
      today: '2026-11-05',
      userId: eligibleUser,
      offer: SAMPLE_OFFER,
      userTransactions: [],
      priorMerchantRedemptionDates: [],
    });
    expect(allowed.eligible).toBe(true);
    expect(allowed.isNewCustomer).toBe(true);
  });

  it('ordena ofertas por cercanía y gasto real en la categoría', () => {
    const ranked = rankOffersForUser({
      today: '2026-11-05',
      userId: 'demo-persona',
      userLat: 4.643,
      userLng: -74.063,
      userZoneSlug: 'chapinero',
      spendByCategory30d: { comida: 320_000_00 },
      userTransactions: [],
      redemptionsByMerchant: {},
      offers: [SAMPLE_OFFER],
      bypassHoldoutForDemo: true,
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.estimatedSavingsMinor).toBe(2_000_00);
    expect(ranked[0]!.whyRelevant).toContain('Categoría donde ya compras');
  });

  it('calcula las 4 cifras del informe mensual incluyendo retorno sin descuento', () => {
    expect(matchesMerchantKeywords('COMPRA QR ESPIGA CHAPINERO', SAMPLE_OFFER.matchKeywords)).toBe(true);

    const report = computeMerchantReport({
      merchantName: 'Panadería La Espiga',
      periodLabel: 'Noviembre 2026',
      redemptions: [
        {
          id: 'r1',
          userId: 'u1',
          redeemedOn: '2026-11-02',
          grossAmountMinor: 20_000_00,
          discountMinor: 2_000_00,
          netPaidByUserMinor: 18_000_00,
          cifraCommissionMinor: 900_00,
          merchantNetKeepMinor: 17_100_00,
          isNewCustomer: true,
        },
        {
          id: 'r2',
          userId: 'u2',
          redeemedOn: '2026-11-03',
          grossAmountMinor: 30_000_00,
          discountMinor: 3_000_00,
          netPaidByUserMinor: 27_000_00,
          cifraCommissionMinor: 1_350_00,
          merchantNetKeepMinor: 25_650_00,
          isNewCustomer: true,
        },
      ],
      organicObservations: [
        // u1 volvió 3 días después y pagó precio completo sin cupón
        { userId: 'u1', postedOn: '2026-11-05', amountMinor: -22_000_00, inHoldout: false },
        // u9 estaba en grupo de control
        { userId: 'u9', postedOn: '2026-11-04', amountMinor: -15_000_00, inHoldout: true },
      ],
      formatMoney: cop,
    });

    expect(report.redemptionsCount).toBe(2);
    expect(report.grossAttributedSalesMinor).toBe(50_000_00);
    expect(report.newCustomersCount).toBe(2);
    expect(report.organicReturnCustomersCount).toBe(1);
    expect(report.organicReturnSalesMinor).toBe(22_000_00);
    expect(report.cifraCommissionMinor).toBe(2_250_00);
    expect(report.merchantNetKeptMinor).toBe(42_750_00);
    expect(report.holdoutOrganicBuyersCount).toBe(1);
    expect(report.whatsappSummary).toContain('Panadería La Espiga');
  });
});
