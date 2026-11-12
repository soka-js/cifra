import { canISpend, computeCifra, type CifraResult, type SpendAnswer } from './cifra';
import type { IncomeFrequency } from './types';

/**
 * La cifra con los cuatro datos que una persona se sabe de memoria, sin movimientos ni cuenta.
 * Es una función pura: corre igual en el servidor y en el navegador. La prueba pública (sin cuenta)
 * la ejecuta en el celular de la persona, así que ningún monto sale del teléfono hasta que decida guardar.
 */
export interface QuickAnswers {
  /** Hoy en Bogotá (AAAA-MM-DD). */
  today: string;
  frequency: IncomeFrequency;
  /** Mensual/quincenal: días del mes. Semanal: día de la semana 1-7. Irregular: vacío. */
  days: number[];
  /** Lo que tiene hoy, en centavos. Puede ser 0 o negativo (sobregiro). */
  balanceMinor: number;
  /** Cobros fijos que la persona escribió. */
  fixed: Array<{ name: string; amountMinor: number; dayOfMonth: number }>;
  /** Gasto del día a día, en centavos por día. */
  dailyMinor: number;
}

export function computeQuickCifra(a: QuickAnswers): CifraResult {
  return computeCifra({
    today: a.today,
    accounts: [
      {
        accountId: 'saldo-escrito',
        name: 'Saldo escrito a mano',
        balanceMinor: a.balanceMinor,
        balanceOn: a.today,
        includeInCifra: true,
        editable: true,
      },
    ],
    transactions: [],
    income: { frequency: a.frequency, days: a.days },
    bufferMinor: 0,
    commitments: a.fixed.map((f, i) => ({ id: `fijo-${i}`, name: f.name, amountMinor: f.amountMinor, dayOfMonth: f.dayOfMonth })),
    marks: {},
    declaredDailyMinor: a.dailyMinor,
  });
}

/** Cómo quedó lo que la persona creía frente a su cifra. */
export interface GuessGap {
  guessMinor: number;
  cifraMinor: number;
  /** Positivo: creía poder gastar más de lo que puede. */
  overMinor: number;
  direction: 'mas' | 'menos' | 'igual';
}

/**
 * Compara lo que la persona creía que podía gastar con su cifra. Se considera "igual" si la
 * diferencia es menor al 5 % de la cifra (o a $5.000 cuando la cifra es muy pequeña o negativa).
 */
export function compareGuess(guessMinor: number, cifraMinor: number): GuessGap {
  const overMinor = guessMinor - cifraMinor;
  const tolerance = Math.max(5_000_00, Math.round(Math.abs(cifraMinor) * 0.05));
  const direction = Math.abs(overMinor) <= tolerance ? 'igual' : overMinor > 0 ? 'mas' : 'menos';
  return { guessMinor, cifraMinor, overMinor, direction };
}

export { canISpend, type CifraResult, type SpendAnswer };
