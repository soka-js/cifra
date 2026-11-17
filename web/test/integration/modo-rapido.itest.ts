import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import * as appActions from '@/app/app/actions';
import { db } from '@/lib/db';
import { commitments, users } from '@/lib/db/schema';
import { listManualAccounts } from '@/lib/manual';
import { parseQuickForm } from '@/lib/quick-form';
import { run } from './fake-next';
import { createUser, loginAs, truncateAll } from './world';

/**
 * El modo rápido con cuenta lee el formulario con la misma función que la prueba sin cuenta
 * (parseQuickForm). Lo que la persona vio como su cifra en la página pública es lo que se guarda.
 */

const idle = { status: 'idle' } as const;

/** Un formulario como el que envía la pantalla, con filas de cobros fijos repetidas. */
function quickForm(fields: Record<string, string | string[]>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const one of Array.isArray(v) ? v : [v]) form.append(k, one);
  return form;
}

const COMPLETO = {
  frequency: 'semanal',
  weekday: '5',
  balance: '1.200.000',
  fixedName: ['Arriendo', '', 'Gimnasio'],
  fixedAmount: ['450.000', '', '90.000'],
  fixedDay: ['14', '', '3'],
  daily: '175.000',
  period: 'semana',
  where: 'Nequi',
};

beforeEach(async () => {
  await truncateAll();
});

async function newcomer() {
  const user = await createUser({ onboardedAt: null, incomeFrequency: null, incomeDays: null, dailySpendMinor: null });
  await loginAs(user);
  return user;
}

describe('modo rápido con cuenta: la misma lectura que la prueba sin cuenta', () => {
  it('guarda exactamente lo que lee parseQuickForm', async () => {
    const user = await newcomer();
    const expected = parseQuickForm(quickForm(COMPLETO));
    if (!expected.ok) throw new Error(expected.message);

    const outcome = await run(() => appActions.saveQuickStart(idle, quickForm(COMPLETO)));
    expect(outcome.redirect).toBe('/app?listo=rapido');

    const [saved] = await db.select().from(users).where(eq(users.id, user.id));
    expect(saved!.incomeFrequency).toBe(expected.values.frequency);
    expect(saved!.incomeDays).toEqual(expected.values.days);
    expect(Number(saved!.dailySpendMinor)).toBe(expected.values.dailyMinor);
    expect(saved!.onboardedAt).not.toBeNull();

    const [account] = await listManualAccounts(user.id);
    expect(Number(account!.balanceMinor)).toBe(expected.values.balanceMinor);
    expect(account!.entityName).toBe('Nequi');

    const fixed = await db.select().from(commitments).where(eq(commitments.userId, user.id));
    expect(
      fixed.map((c) => ({ name: c.name, amountMinor: Number(c.amountMinor), dayOfMonth: c.dayOfMonth })).sort((a, b) => a.name.localeCompare(b.name)),
    ).toEqual([...expected.values.fixed].sort((a, b) => a.name.localeCompare(b.name)));
  });

  it('un error vuelve al mismo paso y con el mismo mensaje que en la prueba, sin guardar nada', async () => {
    const user = await newcomer();
    const casos = [
      { ...COMPLETO, frequency: 'mensual', day1: '' },
      { ...COMPLETO, balance: 'mucho' },
      { ...COMPLETO, fixedDay: ['', '', '3'] },
      { ...COMPLETO, daily: '' },
    ];
    for (const caso of casos) {
      const expected = parseQuickForm(quickForm(caso));
      expect(expected.ok).toBe(false);
      if (expected.ok) continue;
      const outcome = await run(() => appActions.saveQuickStart(idle, quickForm(caso)));
      expect(outcome.result).toEqual({ status: 'error', step: expected.step, message: expected.message });
    }

    const [saved] = await db.select().from(users).where(eq(users.id, user.id));
    expect(saved!.onboardedAt).toBeNull();
    expect(await listManualAccounts(user.id)).toEqual([]);
    expect(await db.select().from(commitments).where(eq(commitments.userId, user.id))).toEqual([]);
  });
});
