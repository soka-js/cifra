import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import * as v3Actions from '@/app/actions/v3';
import { db } from '@/lib/db';
import { merchants } from '@/lib/db/schema';
import { fd, run } from './fake-next';
import { buildWorld, loginAs, truncateAll, type World } from './world';

/**
 * La vitrina pública muestra lo que el tendero escribió y nada más. Si borra su horario o su
 * presentación, la vitrina deja de mostrarlos; antes el campo vacío conservaba el valor viejo.
 */

const idle = { status: 'idle' } as const;
let w: World;

beforeEach(async () => {
  await truncateAll();
  w = await buildWorld();
  await db
    .update(merchants)
    .set({ hoursText: 'Lun a Sáb 7:00 a. m. – 8:00 p. m.', description: 'Pan de la casa.' })
    .where(eq(merchants.id, w.victimMerchant.id));
  await loginAs(w.victimOwner);
});

const current = async () => (await db.select().from(merchants).where(eq(merchants.id, w.victimMerchant.id)))[0]!;

describe('actions/v3.ts#saveMerchantFeaturedItemsAction: horario y presentación', () => {
  it('con los campos vacíos, la vitrina queda sin horario y sin presentación', async () => {
    const outcome = await run(() => v3Actions.saveMerchantFeaturedItemsAction(idle, fd({ hoursText: '  ', description: '' })));
    expect(outcome.result).toMatchObject({ status: 'ok' });
    const m = await current();
    expect(m.hoursText).toBeNull();
    expect(m.description).toBeNull();
  });

  it('con texto, guarda lo que escribió el tendero', async () => {
    await run(() => v3Actions.saveMerchantFeaturedItemsAction(idle, fd({ hoursText: 'Todos los días 6 a. m. – 9 p. m.', description: 'Almuerzos caseros.' })));
    const m = await current();
    expect(m.hoursText).toBe('Todos los días 6 a. m. – 9 p. m.');
    expect(m.description).toBe('Almuerzos caseros.');
  });

  it('si la pantalla no manda esos campos, no los toca', async () => {
    await run(() => v3Actions.saveMerchantFeaturedItemsAction(idle, fd({ itemName_0: 'Pan de bono', itemPrice_0: '3000' })));
    const m = await current();
    expect(m.hoursText).toBe('Lun a Sáb 7:00 a. m. – 8:00 p. m.');
    expect(m.description).toBe('Pan de la casa.');
  });
});
