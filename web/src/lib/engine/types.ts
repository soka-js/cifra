/** Un movimiento tal como lo usa el motor. Montos en centavos; negativo = sale plata. */
export interface Tx {
  id?: string;
  accountId: string;
  postedOn: string;
  description: string;
  amountMinor: number;
}

export type RawTx = Tx;

export interface AccountBalance {
  accountId: string;
  name: string;
  balanceMinor: number | null;
  /** Fecha (AAAA-MM-DD) a la que corresponde el saldo. */
  balanceOn: string | null;
  includeInCifra: boolean;
  /** La persona puede escribir este saldo (no lo trae una entidad aliada). */
  editable?: boolean;
}

export type IncomeFrequency = 'mensual' | 'quincenal' | 'semanal' | 'irregular';

export interface IncomeSettings {
  frequency: IncomeFrequency | null;
  /** Mensual/quincenal: días del mes. Semanal: día de la semana 1-7. */
  days: number[] | null;
}

export interface Commitment {
  id: string;
  name: string;
  amountMinor: number;
  dayOfMonth: number;
  /** Claves de cobros detectados que la persona dijo que no son este compromiso. */
  notSameAs?: string[];
}
