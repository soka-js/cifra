import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { DEFAULT_COMMISSION_BPS, DEFAULT_COMMISSION_LABEL } from '../commission';
import { merchants, redemptions } from '../db/schema';

describe('comisión que se anuncia a un negocio nuevo', () => {
  it('es la misma que pone la base por defecto a un negocio y a cada venta', () => {
    expect(getTableColumns(merchants).commissionBps.default).toBe(DEFAULT_COMMISSION_BPS);
    expect(getTableColumns(redemptions).commissionBps.default).toBe(DEFAULT_COMMISSION_BPS);
  });

  it('se muestra con un espacio que no se parte antes del %', () => {
    expect(DEFAULT_COMMISSION_LABEL).toBe('5 %');
  });
});
