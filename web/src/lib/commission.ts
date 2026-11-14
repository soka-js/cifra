import { COMMISSION_POLICY } from '@/lib/engine/commission-cycle';
import { percentFromBps } from '@/lib/format';

/**
 * La comisión que paga un negocio nuevo, en puntos básicos (500 = 5 %). Es la que pone la base por
 * defecto en `merchants.commission_bps`; una prueba comprueba que no se separen.
 *
 * Las páginas públicas (portada, registro) la muestran porque el negocio todavía no existe. Dentro
 * del portal del tendero se muestra siempre la del negocio (`merchant.commissionBps`).
 */
export const DEFAULT_COMMISSION_BPS = Math.round(COMMISSION_POLICY.feePercent * 100);

/** "5 %", listo para mostrar. */
export const DEFAULT_COMMISSION_LABEL = percentFromBps(DEFAULT_COMMISSION_BPS);
