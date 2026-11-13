/**
 * Matriz de permisos: una entrada por cada acción del servidor que exige sesión.
 *
 * Regla del proyecto: "Cada acción del servidor verifica que el recurso es de quien está en
 * sesión, con una prueba por acción". Cada entrada dice cómo llamar la acción apuntando a los
 * recursos de la VÍCTIMA. `permisos-acciones.itest.ts` corre cada entrada sin sesión, como otra
 * persona y como el dueño legítimo.
 *
 * Al agregar una acción nueva a un archivo 'use server' hay que agregarla aquí (o a PROPIAS,
 * si es pública o necesita un caso especial): la metaprueba falla si falta.
 */
import * as merchantActions from '@/app/actions/merchant';
import * as v3Actions from '@/app/actions/v3';
import * as adminActions from '@/app/admin/actions';
import * as appActions from '@/app/app/actions';
import { todayInBogota } from '@/lib/engine/dates';
import { fd, type Outcome } from './fake-next';
import type { World } from './world';

export type Audience = 'persona' | 'negocio' | 'admin';

export interface Spec {
  /** archivo#export, relativo a src/app. */
  id: string;
  audience: Audience;
  /** Llama la acción con los recursos de la víctima (o sin recurso, si solo actúa sobre "lo mío"). */
  call: (w: World) => Promise<unknown>;
  /**
   * Para acciones cuyo efecto no se ve en la foto de la víctima (lecturas, o efectos en otra tabla):
   * dice si la llamada logró lo que buscaba.
   */
  worked?: (o: Outcome) => boolean;
  /**
   * La acción no recibe ningún recurso ajeno: otra persona solo puede ejecutarla sobre lo suyo.
   * Se comprueba que al hacerlo no toca nada de la víctima.
   */
  selfOnly?: boolean;
}

const idle = { status: 'idle' } as const;
const ok = (o: Outcome) => (o.result as { ok?: boolean } | undefined)?.ok === true;
const statusOk = (o: Outcome) => (o.result as { status?: string } | undefined)?.status === 'ok';
const finished = (o: Outcome) => !o.error && !o.notFound && !o.redirect;

const persona = (name: string, call: Spec['call'], extra: Partial<Spec> = {}): Spec => ({
  id: `app/actions.ts#${name}`,
  audience: 'persona',
  call,
  ...extra,
});

export const SPECS: Spec[] = [
  // ------------------------------------------------------------------ app/app/actions.ts (persona)
  persona('saveOnboarding', () => appActions.saveOnboarding(fd({ frequency: 'mensual', day1: 30 })), { selfOnly: true }),
  persona('saveIncome', () => appActions.saveIncome(idle, fd({ frequency: 'mensual', day1: 28 })), { selfOnly: true }),
  persona('saveZonePreference', () => appActions.saveZonePreference(idle, fd({ zoneSlug: 'usaquen' })), { selfOnly: true }),
  persona('saveBuffer', () => appActions.saveBuffer(idle, fd({ buffer: '150000' })), { selfOnly: true }),
  persona('addCommitment', () => appActions.addCommitment(idle, fd({ name: 'Gimnasio', amount: '90000', day: 10 })), {
    selfOnly: true,
  }),
  persona('removeCommitment', (w) => appActions.removeCommitment(fd({ id: w.victimCommitment.id }))),
  persona('keepCommitment', (w) => appActions.keepCommitment(fd({ id: w.victimCommitment.id, key: 'netflix' }))),
  persona('markRecurring', () => appActions.markRecurring(fd({ key: 'netflix', mark: 'lo_uso' })), { selfOnly: true }),
  persona(
    'confirmRecurringCancelled',
    () => appActions.confirmRecurringCancelled(fd({ key: 'netflix', name: 'Netflix', monthlyMinor: 2_690_000 })),
    { selfOnly: true },
  ),
  persona(
    'reclassifyMerchant',
    () => appActions.reclassifyMerchant(fd({ merchantKey: 'tiendas_d1', merchantName: 'D1', category: 'comida' })),
    { selfOnly: true },
  ),
  persona(
    'saveCycleClosure',
    () => appActions.saveCycleClosure(idle, fd({ committedAction: 'Limitar domicilios a dos por semana' })),
    { selfOnly: true },
  ),
  persona('markNotificationRead', (w) => appActions.markNotificationRead(fd({ id: w.victimNotification.id }))),
  persona('markAllNotificationsRead', () => appActions.markAllNotificationsRead(), { selfOnly: true }),
  persona('updateBalance', (w) => appActions.updateBalance(idle, fd({ accountId: w.victimAccount.id, balance: '5000' }))),
  persona('toggleAccount', (w) => appActions.toggleAccount(fd({ accountId: w.victimAccount.id, include: 'no' }))),
  persona('deleteSource', (w) => appActions.deleteSource(fd({ sourceId: w.victimSource.id }))),
  persona('deleteAccount', () => appActions.deleteAccount(idle, fd({ confirm: 'BORRAR' })), { selfOnly: true }),
  persona('toggleExcluded', (w) => appActions.toggleExcluded(fd({ id: w.victimTx.id, exclude: 'si' }))),
  persona(
    'saveQuickStart',
    () =>
      appActions.saveQuickStart(
        idle,
        fd({ frequency: 'quincenal', day1: 15, day2: 30, balance: '1200000', daily: '25000', period: 'dia' }),
      ),
    { selfOnly: true },
  ),
  persona('saveDailySpend', () => appActions.saveDailySpend(idle, fd({ daily: '30000', period: 'dia' })), { selfOnly: true }),
  persona('updateBalances', (w) => appActions.updateBalances(idle, fd({ [`bal:${w.victimAccount.id}`]: '777000' }))),
  persona('addManualAccount', () => appActions.addManualAccount(idle, fd({ entity: 'Efectivo', balance: '50000' })), {
    selfOnly: true,
  }),

  // ------------------------------------------------------------------ app/actions/v3.ts
  {
    id: 'actions/v3.ts#captureQuickMovementsAction',
    audience: 'persona',
    // Pide anotar el gasto en la cuenta de la víctima: debe caer en una cuenta propia, nunca en esa.
    call: (w) =>
      v3Actions.captureQuickMovementsAction(idle, fd({ mode: 'rapido', rawText: 'almuerzo 18k', accountId: w.victimAccount.id })),
    selfOnly: true,
  },
  {
    id: 'actions/v3.ts#toggleCycleChargePaidAction',
    audience: 'persona',
    call: () =>
      v3Actions.toggleCycleChargePaidAction(
        fd({ chargeKey: 'compromiso:prueba', label: 'Arriendo', cycleEnd: todayInBogota(), amountMinor: 65_000_000, markPaid: 'true' }),
      ),
    selfOnly: true,
  },
  {
    id: 'actions/v3.ts#claimOfferCodeInlineAction',
    audience: 'persona',
    call: (w) => v3Actions.claimOfferCodeInlineAction(w.victimOffer2.id),
    worked: ok,
    selfOnly: true,
  },
  {
    id: 'actions/v3.ts#executeEvaluatedSpendAction',
    audience: 'persona',
    call: () => v3Actions.executeEvaluatedSpendAction({ amountMinor: 3_800_000, concept: 'domicilio', mode: 'registrar_gasto' }),
    selfOnly: true,
  },
  {
    id: 'actions/v3.ts#addMerchantLedgerEntryAction',
    audience: 'negocio',
    call: () => v3Actions.addMerchantLedgerEntryAction(idle, fd({ kind: 'venta_mostrador', amount: '30000' })),
    selfOnly: true,
  },
  {
    id: 'actions/v3.ts#deleteMerchantLedgerEntryAction',
    audience: 'negocio',
    call: (w) => v3Actions.deleteMerchantLedgerEntryAction(fd({ entryId: w.victimLedgerEntry.id })),
  },
  {
    id: 'actions/v3.ts#updateMerchantBreakEvenTargetsAction',
    audience: 'negocio',
    call: () => v3Actions.updateMerchantBreakEvenTargetsAction(idle, fd({ dailyBreakEven: '350000' })),
    selfOnly: true,
  },
  {
    id: 'actions/v3.ts#launchQuickFlashOfferAction',
    audience: 'negocio',
    call: () => v3Actions.launchQuickFlashOfferAction(idle, fd({ title: 'Pan de la tarde', discountPercent: 20, stockLimit: 10, unitCost: '7000' })),
    selfOnly: true,
  },
  {
    id: 'actions/v3.ts#saveMerchantFeaturedItemsAction',
    audience: 'negocio',
    call: () => v3Actions.saveMerchantFeaturedItemsAction(idle, fd({ itemName_0: 'Pan de bono', itemPrice_0: '3000' })),
    selfOnly: true,
  },

  // ------------------------------------------------------------------ app/actions/merchant.ts
  {
    id: 'actions/merchant.ts#claimOfferCode',
    audience: 'persona',
    call: (w) => merchantActions.claimOfferCode(fd({ offerId: w.victimOffer2.id })),
    selfOnly: true,
  },
  {
    id: 'actions/merchant.ts#confirmRedemptionByUser',
    audience: 'persona',
    call: (w) => merchantActions.confirmRedemptionByUser(fd({ redemptionId: w.victimRedemption.id })),
  },
  {
    id: 'actions/merchant.ts#disputeRedemptionByUser',
    audience: 'persona',
    call: (w) => merchantActions.disputeRedemptionByUser(fd({ redemptionId: w.victimRedemption.id, reason: 'No fui yo' })),
  },
  {
    id: 'actions/merchant.ts#updateMerchantProfile',
    audience: 'negocio',
    call: () =>
      merchantActions.updateMerchantProfile(idle, fd({ name: 'Nombre cambiado', address: 'Calle 9 # 9-99', whatsapp: '3009998877' })),
    selfOnly: true,
  },
  {
    id: 'actions/merchant.ts#createMerchantOffer',
    audience: 'negocio',
    call: () => merchantActions.createMerchantOffer(idle, fd({ title: '10 % en todo el mostrador' })),
    selfOnly: true,
  },
  {
    id: 'actions/merchant.ts#toggleOfferStatus',
    audience: 'negocio',
    call: (w) => merchantActions.toggleOfferStatus(fd({ offerId: w.victimOffer.id, nextStatus: 'pausada' })),
  },
  {
    id: 'actions/merchant.ts#renewOfferCampaign',
    audience: 'negocio',
    call: (w) => merchantActions.renewOfferCampaign(fd({ offerId: w.victimOffer.id })),
  },
  {
    id: 'actions/merchant.ts#lookupOfferCode',
    audience: 'negocio',
    // Lectura: el código es del negocio de la víctima. Otro negocio no debe poder consultarlo.
    call: (w) => merchantActions.lookupOfferCode(w.victimPendingCode.code),
    worked: ok,
  },
  {
    id: 'actions/merchant.ts#completeRedemption',
    audience: 'negocio',
    call: (w) => merchantActions.completeRedemption(idle, fd({ codeId: w.victimPendingCode.id, grossAmount: '20000' })),
    worked: statusOk,
  },
  {
    id: 'actions/merchant.ts#reportMerchantPayment',
    audience: 'negocio',
    call: (w) =>
      merchantActions.reportMerchantPayment(idle, fd({ invoiceId: w.victimInvoice.id, method: 'breb', reference: 'COMPROBANTE-2' })),
  },

  // ------------------------------------------------------------------ app/admin/actions.ts
  {
    id: 'admin/actions.ts#createStreetMerchant',
    audience: 'admin',
    call: () =>
      adminActions.createStreetMerchant(
        idle,
        fd({ name: 'Tienda nueva', ownerName: 'Doña Luz', whatsapp: '3001112233', address: 'Calle 1 # 2-3' }),
      ),
  },
  {
    id: 'admin/actions.ts#generateNewInviteLink',
    audience: 'admin',
    call: (w) => adminActions.generateNewInviteLink(idle, fd({ merchantId: w.victimMerchant.id })),
  },
  {
    id: 'admin/actions.ts#adminModerateOffer',
    audience: 'admin',
    call: (w) => adminActions.adminModerateOffer(fd({ offerId: w.victimOffer.id, status: 'pausada' })),
  },
  {
    id: 'admin/actions.ts#promoteCatalogRule',
    audience: 'admin',
    call: (w) => adminActions.promoteCatalogRule(fd({ merchantKey: w.catalogKey })),
  },
  {
    id: 'admin/actions.ts#closeMonthInvoices',
    audience: 'admin',
    call: (w) => adminActions.closeMonthInvoices(fd({ periodMonth: w.victimInvoice.periodMonth })),
  },
  {
    id: 'admin/actions.ts#reviewMerchantPayment',
    audience: 'admin',
    call: (w) => adminActions.reviewMerchantPayment(fd({ paymentId: w.victimPayment.id, decision: 'aprobado' })),
  },
  {
    id: 'admin/actions.ts#resolveRedemptionDispute',
    audience: 'admin',
    call: (w) => adminActions.resolveRedemptionDispute(fd({ redemptionId: w.victimRedemption.id, resolution: 'anulada' })),
  },
  {
    id: 'admin/actions.ts#createPartnerWithKey',
    audience: 'admin',
    call: () => adminActions.createPartnerWithKey(idle, fd({ name: 'Cooperativa de prueba' })),
  },
  {
    id: 'admin/actions.ts#triggerDailyCronFromAdmin',
    audience: 'admin',
    call: () => adminActions.triggerDailyCronFromAdmin(),
    worked: finished,
  },
];

/**
 * Acciones con prueba propia en otro archivo: son públicas (no exigen sesión) o su permiso no se
 * expresa como "recurso de la víctima". El valor es el archivo donde está su `describe`.
 */
export const PROPIAS: Record<string, string> = {
  'actions/auth.ts#signup': 'acciones-publicas.itest.ts',
  'actions/auth.ts#login': 'acciones-publicas.itest.ts',
  'actions/auth.ts#requestPasswordReset': 'acciones-publicas.itest.ts',
  'actions/auth.ts#resetPassword': 'acciones-publicas.itest.ts',
  'actions/auth.ts#logout': 'acciones-publicas.itest.ts',
  'actions/leads.ts#submitLead': 'acciones-publicas.itest.ts',
  'actions/merchant.ts#redeemMerchantInvite': 'acciones-publicas.itest.ts',
  'actions/merchant.ts#selfRegisterMerchant': 'acciones-publicas.itest.ts',
  'actions/merchant.ts#switchActiveMerchant': 'acciones-publicas.itest.ts',
  'admin/actions.ts#openDemoAs': 'sesion-admin-demo.itest.ts',
  'admin/actions.ts#exitDemo': 'sesion-admin-demo.itest.ts',
  'admin/actions.ts#resetDemoData': 'sesion-admin-demo.itest.ts',
};
