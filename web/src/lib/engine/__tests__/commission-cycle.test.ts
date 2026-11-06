import { describe, expect, it } from 'vitest';
import {
  computeCycleSummary,
  evaluateMerchantBillingHealth,
  getCurrentCommissionCycle,
  COMMISSION_POLICY,
} from '../commission-cycle';

describe('commission-cycle engine', () => {
  it('calculates Q1 bounds for first half of the month', () => {
    const cycle = getCurrentCommissionCycle('2026-11-06');
    expect(cycle.cycleId).toBe('2026-11-Q1');
    expect(cycle.startDate).toBe('2026-11-01');
    expect(cycle.cutDate).toBe('2026-11-15');
    expect(cycle.graceDueDate).toBe('2026-11-20');
    expect(cycle.daysUntilCut).toBe(9); // 15 - 6
    expect(cycle.isCutClosed).toBe(false);
    expect(cycle.label).toContain('1.ª Quincena');
  });

  it('calculates Q2 bounds for second half of the month', () => {
    const cycle = getCurrentCommissionCycle('2026-11-20');
    expect(cycle.cycleId).toBe('2026-11-Q2');
    expect(cycle.startDate).toBe('2026-11-16');
    expect(cycle.cutDate).toBe('2026-11-30');
    expect(cycle.graceDueDate).toBe('2026-12-05');
    expect(cycle.daysUntilCut).toBe(10);
    expect(cycle.isCutClosed).toBe(false);
    expect(cycle.label).toContain('2.ª Quincena');
  });

  it('accurately computes cycle summary from redemptions', () => {
    const redemptions = [
      {
        grossAmountMinor: 2000000,
        discountMinor: 200000,
        netPaidByUserMinor: 1800000,
        cifraCommissionMinor: 90000,
        merchantNetKeepMinor: 1710000,
      },
      {
        grossAmountMinor: 3000000,
        discountMinor: 300000,
        netPaidByUserMinor: 2700000,
        cifraCommissionMinor: 135000,
        merchantNetKeepMinor: 2565000,
      },
    ];

    const summary = computeCycleSummary(redemptions);
    expect(summary.salesCount).toBe(2);
    expect(summary.grossSalesMinor).toBe(5000000); // $50,000
    expect(summary.discountsGrantedMinor).toBe(500000); // $5,000
    expect(summary.collectedInCashMinor).toBe(4500000); // $45,000
    expect(summary.accumulatedCommissionMinor).toBe(225000); // $2,250 (5% of 45k)
    expect(summary.merchantNetKeepMinor).toBe(4275000); // $42,750
    expect(summary.averageTicketMinor).toBe(2250000); // $22,500
  });

  it('marks health as al_dia when no overdue invoices exist', () => {
    const invoices = [
      {
        id: 'inv-1',
        periodMonth: '2026-10',
        dueOn: '2026-11-05',
        commissionTotalMinor: 500000,
        status: 'pagada',
      },
    ];

    const health = evaluateMerchantBillingHealth(invoices, '2026-11-06');
    expect(health.status).toBe('al_dia');
    expect(health.canPublishOffers).toBe(true);
    expect(health.lockReason).toBeNull();
    expect(health.overdueAmountMinor).toBe(0);
  });

  it('marks health as pendiente_pago during the 5-day grace period', () => {
    const invoices = [
      {
        id: 'inv-2',
        periodMonth: '2026-10',
        dueOn: '2026-11-10',
        commissionTotalMinor: 1840000,
        status: 'abierta',
      },
    ];

    const health = evaluateMerchantBillingHealth(invoices, '2026-11-06');
    expect(health.status).toBe('pendiente_pago');
    expect(health.canPublishOffers).toBe(true);
    expect(health.pendingAmountMinor).toBe(1840000);
    expect(health.graceDaysRemaining).toBe(4);
  });

  it('enforces offer pause (canPublishOffers: false) when overdue past 5-day grace period', () => {
    const invoices = [
      {
        id: 'inv-3',
        periodMonth: '2026-09',
        dueOn: '2026-10-05',
        commissionTotalMinor: 3500000,
        status: 'abierta',
      },
    ];

    const health = evaluateMerchantBillingHealth(invoices, '2026-11-06');
    expect(health.status).toBe('en_mora');
    expect(health.canPublishOffers).toBe(false);
    expect(health.overdueAmountMinor).toBe(3500000);
    expect(health.lockReason).toContain('pausa');
  });

  it('allows publishing offers in good faith while payment is under verification', () => {
    const invoices = [
      {
        id: 'inv-4',
        periodMonth: '2026-09',
        dueOn: '2026-10-05',
        commissionTotalMinor: 2000000,
        status: 'en_verificacion',
      },
    ];

    const health = evaluateMerchantBillingHealth(invoices, '2026-11-06');
    expect(health.status).toBe('en_verificacion');
    expect(health.canPublishOffers).toBe(true);
    expect(health.lockReason).toBeNull();
  });

  it('guarantees commission policy explanation covers zero micro-billing', () => {
    expect(COMMISSION_POLICY.guaranteeText).toContain('Cero cobros sorpresa');
    expect(COMMISSION_POLICY.guaranteeText).toContain('corte quincenal');
    expect(COMMISSION_POLICY.delinquencyRule).toContain('Protección mutua');
  });
});
