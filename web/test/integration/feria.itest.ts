import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadFairFunnel } from '@/lib/analytics/fair-funnel';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { addDays, todayInBogota } from '@/lib/engine/dates';
import { truncateAll } from './world';

/** Embudo de la feria en /admin: cuenta visitantes distintos por día de Bogotá, sin montos. */

type Ev = {
  visitor: string;
  name: string;
  path?: string | null;
  props?: Record<string, string | number | boolean | null>;
  /** Hace cuántos minutos pasó. */
  minutesAgo?: number;
};

async function insert(list: Ev[]) {
  for (const e of list) {
    await db.insert(events).values({
      visitorId: e.visitor,
      name: e.name,
      path: e.path ?? null,
      props: e.props ?? {},
      device: 'mobile',
      at: sql`now() - make_interval(mins => ${e.minutesAgo ?? 0})` as unknown as Date,
    });
  }
}

beforeEach(async () => {
  await truncateAll();
});

describe('loadFairFunnel', () => {
  it('sin eventos: un renglón por día, de hoy hacia atrás, todo en cero', async () => {
    const days = await loadFairFunnel(7);
    expect(days).toHaveLength(7);
    expect(days[0]!.day).toBe(todayInBogota());
    expect(days[6]!.day).toBe(addDays(todayInBogota(), -6));
    for (const d of days) {
      expect([d.visitors, d.started, d.done, d.saved, d.signedUp]).toEqual([0, 0, 0, 0, 0]);
      expect(d.medianSeconds).toBeNull();
    }
  });

  it('cuenta visitantes distintos en cada paso y la última respuesta del campo opcional', async () => {
    await insert([
      // A hace todo: abre, empieza, ve su cifra, guarda y crea la cuenta. Calcula dos veces.
      { visitor: 'A', name: 'page_view', path: '/', minutesAgo: 9 },
      { visitor: 'A', name: 'page_view', path: '/', minutesAgo: 8 },
      { visitor: 'A', name: 'try_cifra_start', minutesAgo: 8 },
      { visitor: 'A', name: 'try_cifra_done', props: { guess: 'mas', seconds: 40, status: 'ok', fixed: 1 }, minutesAgo: 7 },
      { visitor: 'A', name: 'try_cifra_done', props: { guess: 'igual', seconds: 15, status: 'ok', fixed: 1 }, minutesAgo: 6 },
      { visitor: 'A', name: 'try_cifra_save', minutesAgo: 5 },
      { visitor: 'A', name: 'sign_up', path: '/registro', minutesAgo: 4 },
      // B ve su cifra y no guarda.
      { visitor: 'B', name: 'page_view', path: '/', minutesAgo: 9 },
      { visitor: 'B', name: 'try_cifra_start', minutesAgo: 9 },
      { visitor: 'B', name: 'try_cifra_done', props: { guess: 'menos', seconds: 60, status: 'ok', fixed: 0 }, minutesAgo: 8 },
      // C solo abre la página.
      { visitor: 'C', name: 'page_view', path: '/', minutesAgo: 3 },
      // D no pasó por la prueba: abre otra página y crea una cuenta. No cuenta en el embudo de la prueba.
      { visitor: 'D', name: 'page_view', path: '/registro', minutesAgo: 3 },
      { visitor: 'D', name: 'sign_up', path: '/registro', minutesAgo: 2 },
      // E ve su cifra sin llenar el campo opcional.
      { visitor: 'E', name: 'page_view', path: '/', minutesAgo: 2 },
      { visitor: 'E', name: 'try_cifra_start', minutesAgo: 2 },
      { visitor: 'E', name: 'try_cifra_done', props: { guess: 'sin', seconds: 35, status: 'ok', fixed: 0 }, minutesAgo: 1 },
      // Eventos de otras cosas no cuentan.
      { visitor: 'A', name: 'ask_spend', minutesAgo: 1 },
    ]);

    const today = (await loadFairFunnel(7))[0]!;
    expect(today.day).toBe(todayInBogota());
    expect(today.visitors).toBe(4); // A, B, C, E
    expect(today.started).toBe(3); // A, B, E
    expect(today.done).toBe(3);
    expect(today.saved).toBe(1); // A
    expect(today.signedUp).toBe(1); // A; D creó cuenta sin pasar por "Guardar"
    // A cuenta con su última respuesta (igual), B creía menos, E no respondió.
    expect([today.guessMore, today.guessLess, today.guessSame]).toEqual([0, 1, 1]);
    // Primera prueba de cada uno: A 40 s, B 60 s, E 35 s. Mediana 40.
    expect(today.medianSeconds).toBe(40);
  });

  it('separa por día de Bogotá y deja por fuera lo anterior al periodo', async () => {
    await insert([
      { visitor: 'hoy', name: 'page_view', path: '/' },
      { visitor: 'ayer', name: 'page_view', path: '/', minutesAgo: 24 * 60 },
      { visitor: 'ayer', name: 'try_cifra_done', props: { guess: 'mas', seconds: 50 }, minutesAgo: 24 * 60 },
      { visitor: 'viejo', name: 'page_view', path: '/', minutesAgo: 10 * 24 * 60 },
    ]);
    const days = await loadFairFunnel(7);
    expect(days[0]!.visitors).toBe(1);
    expect(days[1]!.day).toBe(addDays(todayInBogota(), -1));
    expect(days[1]!.visitors).toBe(1);
    expect(days[1]!.done).toBe(1);
    expect(days[1]!.guessMore).toBe(1);
    expect(days.reduce((s, d) => s + d.visitors, 0)).toBe(2);
  });

  it('el periodo se limita entre 1 y 31 días', async () => {
    expect(await loadFairFunnel(3)).toHaveLength(3);
    expect(await loadFairFunnel(0)).toHaveLength(1);
    expect(await loadFairFunnel(400)).toHaveLength(31);
  });
});
