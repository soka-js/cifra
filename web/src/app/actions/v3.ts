'use server';

import { and, eq, gt, gte, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import QRCode from 'qrcode';
import { recordEvent } from '@/lib/analytics/server';
import { requireMerchantAccess, requireUser } from '@/lib/auth/session';
import { randomToken, sha256 } from '@/lib/crypto';
import { db } from '@/lib/db';
import {
  accessLog,
  accounts,
  commitments,
  dataSources,
  embedTokens,
  merchantInvoices,
  merchantLedgerEntries,
  merchantPayments,
  merchants,
  offerCodes,
  offers,
  paidCycleCharges,
  partners,
  recurringMarks,
  redemptions,
  savingsEvents,
  transactions,
  users,
  type MerchantFeaturedItem,
  type MerchantMandateConfig,
  type UserAppPreferences,
  type UserConsentMandateConfig,
} from '@/lib/db/schema';
import {
  evaluateOfferEligibility,
  generateRedemptionCode,
  type CandidateOffer,
} from '@/lib/engine/attribution';
import { computeHonestMerchantMargin } from '@/lib/engine/crossref';
import { addDays, todayInBogota } from '@/lib/engine/dates';
import { parseChatExpenses, parseColombianBankAlert } from '@/lib/engine/quick-capture';
import { CONSENT_VERSION, cop, parsePesosInput } from '@/lib/format';
import { loadCategoryOverrides } from '@/lib/ingest';
import { currentPeriodMonth, loadMerchantDashboard } from '@/lib/merchant-data';
import { currentBogotaHour } from '@/lib/v3-data';

export type V3ActionState =
  | { status: 'idle' }
  | { status: 'ok'; message: string; count?: number }
  | { status: 'error'; message: string };

/**
 * Garantiza que la persona tenga al menos una cuenta editable activa donde anotar movimientos rápidos
 * (si aún no subió extracto, crea una fuente manual + "Billetera / Efectivo diario").
 */
export async function ensureEditableLiquidAccount(userId: string, preferredAccountId?: string | null) {
  const rows = await db
    .select({ account: accounts, status: dataSources.status, sourceKind: dataSources.kind })
    .from(accounts)
    .innerJoin(dataSources, eq(dataSources.id, accounts.sourceId))
    .where(eq(accounts.userId, userId));

  const editable = rows.filter(
    (r) => r.status === 'activa' && r.sourceKind !== 'entidad_aliada' && r.account.kind !== 'tarjeta_credito',
  );

  if (preferredAccountId) {
    const chosen = editable.find((e) => e.account.id === preferredAccountId);
    if (chosen) return chosen.account;
  }
  if (editable.length > 0) {
    return editable[0]!.account;
  }

  const now = new Date();
  const today = todayInBogota(now);
  const [src] = await db
    .insert(dataSources)
    .values({
      userId,
      kind: 'manual',
      entityName: 'Registro diario CIFRA',
      scopes: ['saldos', 'movimientos'],
      status: 'activa',
      lastSyncAt: now,
      coverageFrom: today,
      coverageTo: today,
    })
    .returning();

  const [acct] = await db
    .insert(accounts)
    .values({
      userId,
      sourceId: src!.id,
      kind: 'billetera',
      name: 'Billetera / Efectivo diario',
      balanceMinor: 0,
      balanceAt: now,
      includeInCifra: true,
    })
    .returning();

  return acct!;
}

/**
 * Captura en 3 segundos:
 * - 'rapido': frases naturales ("almuerzo 18k, uber 14500")
 * - 'sms_banco': alertas SMS / notificaciones push / correos de bancos colombianos
 * - 'comprobante': texto leído u OCR de tirilla/comprobante Nequi/Bre-B/Bancolombia
 */
export async function captureQuickMovementsAction(
  _prev: V3ActionState,
  formData: FormData,
): Promise<V3ActionState> {
  const user = await requireUser();
  const modeRaw = String(formData.get('mode') ?? 'rapido');
  const mode: 'rapido' | 'sms_banco' | 'comprobante' =
    modeRaw === 'sms_banco' ? 'sms_banco' : modeRaw === 'comprobante' ? 'comprobante' : 'rapido';
  const rawText = String(formData.get('rawText') ?? '').trim();
  const accountIdInput = String(formData.get('accountId') ?? '').trim() || null;
  const adjustBalance = formData.get('adjustBalance') !== 'off';

  if (rawText.length < 3) {
    return {
      status: 'error',
      message: 'Escribe una frase como «almuerzo 18k» o pega el mensaje de tu banco.',
    };
  }

  const today = todayInBogota();
  const hourNow = currentBogotaHour();
  const overrides = await loadCategoryOverrides(user.id);

  const parsed =
    mode === 'rapido'
      ? parseChatExpenses(rawText, today, hourNow, overrides)
      : parseColombianBankAlert(rawText, today, hourNow, mode, overrides);

  if (parsed.length === 0) {
    return {
      status: 'error',
      message: 'No detectamos un monto en pesos. Prueba con «café 6500» o pega el SMS completo con el signo $.',
    };
  }

  const acct = await ensureEditableLiquidAccount(user.id, accountIdInput);
  const now = new Date();
  let netDeltaMinor = 0;
  let insertedCount = 0;

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i]!;
    const dedupe = sha256(
      `quick:${user.id}:${p.postedOn}:${p.amountMinor}:${p.description}:${Math.floor(now.getTime() / 15000)}:${i}`,
    );
    const ins = await db
      .insert(transactions)
      .values({
        userId: user.id,
        accountId: acct.id,
        postedOn: p.postedOn,
        description: p.description,
        amountMinor: p.amountMinor,
        merchantKey: p.merchantKey,
        merchantName: p.merchantName,
        category: p.category,
        categorySource: 'auto',
        spentHour: p.spentHour,
        captureMethod: p.captureMethod,
        dedupeKey: dedupe,
      })
      .onConflictDoNothing()
      .returning({ id: transactions.id });

    if (ins.length > 0) {
      insertedCount += 1;
      netDeltaMinor += p.amountMinor;
    }
  }

  if (insertedCount > 0 && adjustBalance && acct.balanceMinor !== null) {
    await db
      .update(accounts)
      .set({
        balanceMinor: acct.balanceMinor + netDeltaMinor,
        balanceAt: now,
      })
      .where(eq(accounts.id, acct.id));
  }

  await db.insert(accessLog).values({
    userId: user.id,
    actor: 'persona',
    action: `captura_${mode}`,
    detail: { count: insertedCount, account: acct.name, adjustBalance },
  });
  await recordEvent('quick_capture', { mode, count: insertedCount }, user.id);

  revalidatePath('/app', 'layout');
  return {
    status: 'ok',
    count: insertedCount,
    message:
      insertedCount === 1
        ? `Listo: anotamos ${parsed[0]!.merchantName} (${cop(Math.abs(parsed[0]!.amountMinor))}) y actualizamos tu tope de hoy.`
        : `Listo: anotamos ${insertedCount} movimientos y actualizamos tu tope de hoy.`,
  };
}

/**
 * Marca o desmarca un cobro intocable de la quincena como ya pagado en el ciclo actual.
 */
export async function toggleCycleChargePaidAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const chargeKey = String(formData.get('chargeKey') ?? '').trim();
  const label = String(formData.get('label') ?? 'Cobro fijo').trim().slice(0, 80);
  const cycleEnd = String(formData.get('cycleEnd') ?? '').trim();
  const amountMinor = Number(formData.get('amountMinor') ?? 0);
  const markPaid = formData.get('markPaid') === 'true';
  const deductBalance = formData.get('deductBalance') === 'true';

  if (!chargeKey || !cycleEnd || !Number.isFinite(amountMinor) || amountMinor <= 0) return;

  if (markPaid) {
    const ins = await db
      .insert(paidCycleCharges)
      .values({
        userId: user.id,
        chargeKey,
        label,
        cycleEnd,
        amountMinor,
      })
      .onConflictDoNothing()
      .returning({ id: paidCycleCharges.id });

    if (ins.length > 0 && deductBalance) {
      const acct = await ensureEditableLiquidAccount(user.id);
      const now = new Date();
      const today = todayInBogota(now);
      await db
        .insert(transactions)
        .values({
          userId: user.id,
          accountId: acct.id,
          postedOn: today,
          description: `Pago ${label}`,
          amountMinor: -Math.abs(amountMinor),
          merchantKey: chargeKey,
          merchantName: label,
          category: 'servicios_hogar',
          categorySource: 'auto',
          spentHour: currentBogotaHour(now),
          captureMethod: 'rapido',
          dedupeKey: sha256(`paid_charge:${user.id}:${chargeKey}:${cycleEnd}`),
        })
        .onConflictDoNothing();

      if (acct.balanceMinor !== null) {
        await db
          .update(accounts)
          .set({ balanceMinor: acct.balanceMinor - Math.abs(amountMinor), balanceAt: now })
          .where(eq(accounts.id, acct.id));
      }
    }
  } else {
    await db
      .delete(paidCycleCharges)
      .where(
        and(
          eq(paidCycleCharges.userId, user.id),
          eq(paidCycleCharges.chargeKey, chargeKey),
          eq(paidCycleCharges.cycleEnd, cycleEnd),
        ),
      );
  }

  revalidatePath('/app', 'layout');
}

/**
 * Reclamo rápido de código y QR en JSON para el Mapa Inteligente Desplegable y la Vitrina Pública /b/[slug]
 * sin perder el contexto visual del mapa.
 */
export interface ClaimCodeInlineResult {
  ok: boolean;
  error?: string;
  requiresAuth?: boolean;
  code?: string;
  qrDataUrl?: string;
  expiresAtIso?: string;
  offerTitle?: string;
  merchantName?: string;
}

export async function claimOfferCodeInlineAction(offerId: string): Promise<ClaimCodeInlineResult> {
  const user = await requireUser();
  const cleanId = offerId.trim();
  if (!cleanId) return { ok: false, error: 'Oferta inválida.' };

  const now = new Date();
  const [row] = await db
    .select({ offer: offers, merchant: merchants })
    .from(offers)
    .innerJoin(merchants, eq(merchants.id, offers.merchantId))
    .where(and(eq(offers.id, cleanId), eq(offers.status, 'activa')))
    .limit(1);

  if (!row) {
    return { ok: false, error: 'Esta oferta ya no está activa.' };
  }
  if (row.offer.stockRemaining !== null && row.offer.stockRemaining <= 0) {
    return { ok: false, error: 'Se agotaron los cupos relámpago de hoy en este comercio.' };
  }

  const [existing] = await db
    .select()
    .from(offerCodes)
    .where(
      and(
        eq(offerCodes.userId, user.id),
        eq(offerCodes.offerId, cleanId),
        eq(offerCodes.status, 'pendiente'),
        gt(offerCodes.expiresAt, now),
      ),
    )
    .limit(1);

  if (existing) {
    const qrDataUrl = await QRCode.toDataURL(`CIFRA:${existing.code}:${existing.qrToken}`, {
      margin: 1,
      width: 210,
      color: { dark: '#101D1A', light: '#FFFFFF' },
    });
    return {
      ok: true,
      code: existing.code,
      qrDataUrl,
      expiresAtIso: existing.expiresAt.toISOString(),
      offerTitle: row.offer.title,
      merchantName: row.merchant.name,
    };
  }

  const today = todayInBogota(now);
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00-05:00`);
  const since90 = addDays(today, -90);

  const [[countRow], userTxs, priorRedeems] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(redemptions)
      .where(and(eq(redemptions.offerId, cleanId), ne(redemptions.status, 'anulada'), gte(redemptions.redeemedAt, monthStart))),
    db
      .select({
        accountId: transactions.accountId,
        postedOn: transactions.postedOn,
        description: transactions.description,
        amountMinor: transactions.amountMinor,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, user.id), eq(transactions.excluded, false))),
    db
      .select({ redeemedAt: redemptions.redeemedAt })
      .from(redemptions)
      .where(
        and(
          eq(redemptions.userId, user.id),
          eq(redemptions.merchantId, row.merchant.id),
          ne(redemptions.status, 'anulada'),
        ),
      ),
  ]);

  const candidate: CandidateOffer = {
    id: row.offer.id,
    merchantId: row.merchant.id,
    merchantName: row.merchant.name,
    merchantSlug: row.merchant.slug,
    merchantCategory: row.merchant.businessCategory,
    neighborhood: row.merchant.neighborhood,
    zoneSlug: row.merchant.zoneSlug,
    address: row.merchant.address,
    hoursText: row.merchant.hoursText,
    lat: row.merchant.lat,
    lng: row.merchant.lng,
    typicalTicketMinor: row.merchant.typicalTicketMinor,
    commissionBps: row.merchant.commissionBps,
    matchKeywords: row.merchant.matchKeywords,
    title: row.offer.title,
    description: row.offer.description,
    targetCategory: row.offer.targetCategory,
    discountKind: row.offer.discountKind,
    discountPercent: row.offer.discountPercent,
    discountFixedMinor: row.offer.discountFixedMinor,
    maxDiscountMinor: row.offer.maxDiscountMinor,
    minPurchaseMinor: row.offer.minPurchaseMinor,
    newCustomersOnly: row.offer.newCustomersOnly,
    exclusivityDays: row.offer.exclusivityDays,
    holdoutPercent: row.offer.isFlash ? 0 : row.offer.holdoutPercent,
    monthlyCapRedemptions: row.offer.monthlyCapRedemptions,
    monthlyRedemptionsUsed: countRow?.n ?? 0,
    validFrom: row.offer.validFrom,
    validUntil: row.offer.validUntil,
    activeHoursText: row.offer.activeHoursText,
  };

  const elig = evaluateOfferEligibility({
    today,
    userId: user.id,
    offer: candidate,
    userTransactions: userTxs.filter((t) => t.postedOn >= since90),
    priorMerchantRedemptionDates: priorRedeems.map((r) => todayInBogota(r.redeemedAt)),
    bypassHoldoutForDemo: user.isDemo || row.offer.isFlash,
  });

  if (!elig.eligible) {
    return {
      ok: false,
      error: 'Esta campaña es exclusiva para primera visita y detectamos compras recientes tuyas en este local.',
    };
  }

  const code = generateRedemptionCode(6);
  const qrToken = randomToken(16);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await db.insert(offerCodes).values({
    offerId: row.offer.id,
    merchantId: row.merchant.id,
    userId: user.id,
    code,
    qrToken,
    wasNewCustomer: elig.isNewCustomer,
    channel: user.partnerId ? 'aliado' : 'propio',
    partnerId: user.partnerId ?? null,
    status: 'pendiente',
    expiresAt,
  });

  await recordEvent('generate_offer_code', { offerId: row.offer.id, merchant: row.merchant.slug, source: 'smart_map' }, user.id);
  revalidatePath('/app/ofertas');
  revalidatePath(`/b/${row.merchant.slug}`);

  const qrDataUrl = await QRCode.toDataURL(`CIFRA:${code}:${qrToken}`, {
    margin: 1,
    width: 210,
    color: { dark: '#101D1A', light: '#FFFFFF' },
  });

  return {
    ok: true,
    code,
    qrDataUrl,
    expiresAtIso: expiresAt.toISOString(),
    offerTitle: row.offer.title,
    merchantName: row.merchant.name,
  };
}

// ---------------------------------------------------------------------------
// Lado Negocio (Fase 7): Cuadre Diario, Insumos, Ofertas Relámpago y Vitrina
// ---------------------------------------------------------------------------

export async function addMerchantLedgerEntryAction(
  _prev: V3ActionState,
  formData: FormData,
): Promise<V3ActionState> {
  const access = await requireMerchantAccess();
  const kindRaw = String(formData.get('kind') ?? 'venta_mostrador');
  const allowedKinds = new Set(['venta_mostrador', 'insumos', 'servicios_arriendo', 'nomina_otros']);
  const kind = allowedKinds.has(kindRaw) ? kindRaw : 'venta_mostrador';

  const categoryLabel = String(formData.get('categoryLabel') ?? '').trim().slice(0, 60) ||
    (kind === 'venta_mostrador' ? 'Ventas de mostrador' : 'Insumos del día');
  const supplierName = String(formData.get('supplierName') ?? '').trim().slice(0, 60) || null;
  const note = String(formData.get('note') ?? '').trim().slice(0, 140) || null;
  const amountMinor = parsePesosInput(String(formData.get('amount') ?? ''));
  const entryOnRaw = String(formData.get('entryOn') ?? '').trim();
  const today = todayInBogota();
  const entryOn = /^\d{4}-\d{2}-\d{2}$/.test(entryOnRaw) ? entryOnRaw : today;

  if (!amountMinor || amountMinor <= 0) {
    return { status: 'error', message: 'Escribe un valor en pesos mayor a cero.' };
  }

  await db.insert(merchantLedgerEntries).values({
    merchantId: access.merchant.id,
    entryOn,
    kind,
    categoryLabel,
    supplierName,
    amountMinor,
    note,
  });

  await recordEvent('merchant_ledger_add', { kind, categoryLabel, amountMinor }, access.user.id);
  revalidatePath('/negocio', 'layout');
  return {
    status: 'ok',
    message:
      kind === 'venta_mostrador'
        ? `Venta de mostrador por ${cop(amountMinor)} sumada al cuadre de hoy.`
        : `Gasto de ${categoryLabel} (${cop(amountMinor)}) registrado.`,
  };
}

export async function deleteMerchantLedgerEntryAction(formData: FormData): Promise<void> {
  const access = await requireMerchantAccess();
  const id = String(formData.get('entryId') ?? '').trim();
  if (!id) return;
  await db
    .delete(merchantLedgerEntries)
    .where(and(eq(merchantLedgerEntries.id, id), eq(merchantLedgerEntries.merchantId, access.merchant.id)));
  revalidatePath('/negocio', 'layout');
}

export async function updateMerchantBreakEvenTargetsAction(
  _prev: V3ActionState,
  formData: FormData,
): Promise<V3ActionState> {
  const access = await requireMerchantAccess();
  const dailyBreakEvenMinor = parsePesosInput(String(formData.get('dailyBreakEven') ?? ''));
  const monthlyFixedCostMinor = parsePesosInput(String(formData.get('monthlyFixedCost') ?? ''));

  if (!dailyBreakEvenMinor || dailyBreakEvenMinor < 20_000_00) {
    return { status: 'error', message: 'Define una meta diaria realista (por ejemplo $350,000).' };
  }

  await db
    .update(merchants)
    .set({
      dailyBreakEvenMinor,
      monthlyFixedCostMinor: monthlyFixedCostMinor ?? access.merchant.monthlyFixedCostMinor,
    })
    .where(eq(merchants.id, access.merchant.id));

  revalidatePath('/negocio', 'layout');
  return { status: 'ok', message: `Meta diaria actualizada a ${cop(dailyBreakEvenMinor)}.` };
}

/**
 * Enciende en 1 toque una Oferta Relámpago de horas muertas / cero merma cuando al negocio le falta
 * completar la meta del día. Se abre para TODOS los vecinos cercanos (newCustomersOnly: false) con cupos contados.
 */
export async function launchQuickFlashOfferAction(
  _prev: V3ActionState,
  formData: FormData,
): Promise<V3ActionState> {
  const access = await requireMerchantAccess();
  const title = String(formData.get('title') ?? '').trim().slice(0, 90);
  const discountPercent = Math.min(45, Math.max(10, Number(formData.get('discountPercent') ?? 20)));
  const stockLimit = Math.min(80, Math.max(3, Number(formData.get('stockLimit') ?? 10)));
  const startHour = Math.min(23, Math.max(5, Number(formData.get('startHour') ?? currentBogotaHour())));
  const endHour = Math.min(23, Math.max(startHour + 1, Number(formData.get('endHour') ?? Math.min(22, startHour + 3))));
  const unitCostMinor = parsePesosInput(String(formData.get('unitCost') ?? '')) ?? Math.round(access.merchant.typicalTicketMinor * 0.38);

  if (title.length < 4) {
    return { status: 'error', message: 'Escribe qué vas a sacar en promoción relámpago hoy.' };
  }

  const margin = computeHonestMerchantMargin({
    salePriceMinor: access.merchant.typicalTicketMinor,
    unitCostMinor,
    discountKind: 'percent',
    discountPercent,
    commissionBps: access.merchant.commissionBps,
  });

  if (margin.isLosingMoney) {
    return {
      status: 'error',
      message: `Con ${discountPercent} % de descuento y costo de insumos de ${cop(unitCostMinor)} perderías plata por venta. Baja el descuento o revisa el costo.`,
    };
  }

  const today = todayInBogota();
  const fmtH = (h: number) => (h === 12 ? '12 m.' : h < 12 ? `${h}:00 a. m.` : `${h - 12}:00 p. m.`);

  await db.insert(offers).values({
    merchantId: access.merchant.id,
    title,
    description: `Oferta relámpago de hoy (${stockLimit} cupos disponibles en mostrador).`,
    targetCategory: access.merchant.targetSpendCategory,
    discountKind: 'percent',
    discountPercent,
    minPurchaseMinor: 0,
    newCustomersOnly: false,
    exclusivityDays: 30,
    holdoutPercent: 0,
    monthlyCapRedemptions: stockLimit * 15,
    isFlash: true,
    startHour,
    endHour,
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    stockLimit,
    stockRemaining: stockLimit,
    unitCostMinor,
    validFrom: today,
    validUntil: addDays(today, 14),
    activeHoursText: `${fmtH(startHour)} a ${fmtH(endHour)}`,
    status: 'activa',
  });

  await db
    .update(merchants)
    .set({ stage: 'con_oferta', activatedAt: access.merchant.activatedAt ?? new Date() })
    .where(eq(merchants.id, access.merchant.id));

  await recordEvent('launch_flash_offer', { merchant: access.merchant.slug, discountPercent, stockLimit }, access.user.id);
  revalidatePath('/negocio', 'layout');
  revalidatePath('/app', 'layout');
  revalidatePath(`/b/${access.merchant.slug}`);

  return {
    status: 'ok',
    message: `¡Oferta Relámpago encendida! Aparece con pin ⚡ en el mapa del barrio (${stockLimit} cupos, te quedan ${cop(margin.cifraFirstVisitProfitMinor)} limpios por venta).`,
  };
}

export async function saveMerchantFeaturedItemsAction(
  _prev: V3ActionState,
  formData: FormData,
): Promise<V3ActionState> {
  const access = await requireMerchantAccess();
  const items: MerchantFeaturedItem[] = [];

  for (let i = 0; i < 4; i++) {
    const name = String(formData.get(`itemName_${i}`) ?? '').trim().slice(0, 60);
    const priceMinor = parsePesosInput(String(formData.get(`itemPrice_${i}`) ?? ''));
    const tag = String(formData.get(`itemTag_${i}`) ?? '').trim().slice(0, 32) || undefined;
    if (name && priceMinor && priceMinor > 0) {
      items.push({ name, priceMinor, tag });
    }
  }

  const description = String(formData.get('description') ?? '').trim().slice(0, 240) || access.merchant.description;
  const hoursText = String(formData.get('hoursText') ?? '').trim().slice(0, 90) || access.merchant.hoursText;

  await db
    .update(merchants)
    .set({
      featuredItems: items,
      description,
      hoursText,
    })
    .where(eq(merchants.id, access.merchant.id));

  revalidatePath('/negocio/vitrina');
  revalidatePath(`/b/${access.merchant.slug}`);
  return { status: 'ok', message: 'Vitrina pública actualizada y lista para compartir por WhatsApp o Instagram.' };
}

// ---------------------------------------------------------------------------
// Persistencia Real en PostgreSQL: Metas de Ahorro, NBA, Gasto, Plan, Mandato Ley 1581 y Recaudo B2B
// ---------------------------------------------------------------------------

export async function saveUserSavingsGoalAction(input: {
  goalPresetId: string;
  goalTitle: string;
  goalCategoryLabel: string;
  goalTargetMinor: number;
  goalSavedBaseMinor: number;
  goalMonthlyPaceMinor: number;
}): Promise<{ ok: boolean; message: string; preferences: UserAppPreferences }> {
  const user = await requireUser();
  const title = input.goalTitle.trim().slice(0, 80) || 'Mi meta en CIFRA';
  const targetMinor = Math.max(100_000_00, Math.round(input.goalTargetMinor));
  const savedBaseMinor = Math.max(0, Math.round(input.goalSavedBaseMinor));
  const monthlyPaceMinor = Math.max(20_000_00, Math.round(input.goalMonthlyPaceMinor));

  const nextPrefs: UserAppPreferences = {
    ...(user.appPreferences ?? {}),
    goalPresetId: input.goalPresetId,
    goalTitle: title,
    goalCategoryLabel: input.goalCategoryLabel.trim().slice(0, 50) || 'Meta personal',
    goalTargetMinor: targetMinor,
    goalSavedBaseMinor: savedBaseMinor,
    goalMonthlyPaceMinor: monthlyPaceMinor,
  };

  await db.update(users).set({ appPreferences: nextPrefs }).where(eq(users.id, user.id));
  await db.insert(accessLog).values({
    userId: user.id,
    actor: 'persona',
    action: 'guardar_meta_ahorro',
    detail: { title, targetMinor, monthlyPaceMinor },
  });

  revalidatePath('/app', 'layout');
  return {
    ok: true,
    message: `Meta «${title}» (${cop(targetMinor)}) guardada en tu cuenta.`,
    preferences: nextPrefs,
  };
}

export async function addGoalContributionAction(input: {
  amountMinor: number;
  label?: string;
  deductFromBalance?: boolean;
}): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const amountMinor = Math.round(input.amountMinor);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    return { ok: false, message: 'Escribe un monto en pesos mayor a cero.' };
  }

  const now = new Date();
  const today = todayInBogota(now);
  const goalTitle = user.appPreferences?.goalTitle || 'Meta de ahorro';
  const cleanLabel = (input.label?.trim() || `Abono a ${goalTitle}`).slice(0, 90);
  const refKey = `abono_meta:${today}:${now.getTime()}`;

  await db.insert(savingsEvents).values({
    userId: user.id,
    kind: 'comision_evitada',
    amountMinor,
    referenceKey: refKey,
    label: cleanLabel,
    occurredOn: today,
  });

  if (input.deductFromBalance) {
    const acct = await ensureEditableLiquidAccount(user.id);
    await db
      .insert(transactions)
      .values({
        userId: user.id,
        accountId: acct.id,
        postedOn: today,
        description: cleanLabel,
        amountMinor: -Math.abs(amountMinor),
        merchantKey: 'ahorro_meta_cifra',
        merchantName: 'Meta de ahorro CIFRA',
        category: 'ahorro_inversion',
        categorySource: 'user',
        spentHour: currentBogotaHour(now),
        captureMethod: 'rapido',
        dedupeKey: sha256(`goal_contrib:${user.id}:${refKey}`),
      })
      .onConflictDoNothing();

    if (acct.balanceMinor !== null) {
      await db
        .update(accounts)
        .set({ balanceMinor: acct.balanceMinor - Math.abs(amountMinor), balanceAt: now })
        .where(eq(accounts.id, acct.id));
    }
  }

  await db.insert(accessLog).values({
    userId: user.id,
    actor: 'persona',
    action: 'abono_meta_ahorro',
    detail: { amountMinor, label: cleanLabel, deductFromBalance: Boolean(input.deductFromBalance) },
  });

  revalidatePath('/app', 'layout');
  return {
    ok: true,
    message: `Abonaste ${cop(amountMinor)} a tu meta «${goalTitle}». Tu progreso real se actualizó.`,
  };
}

export async function toggleNbaCommitmentAction(input: {
  nbaId: string;
  nbaTitle: string;
  monthlySavingsMinor: number;
  merchantKey?: string;
  recordImmediateWeekSaving?: boolean;
}): Promise<{ ok: boolean; committedIds: string[]; message: string }> {
  const user = await requireUser();
  const current = new Set(user.appPreferences?.committedNbaIds ?? []);
  const wasCommitted = current.has(input.nbaId);

  if (wasCommitted && !input.recordImmediateWeekSaving) {
    current.delete(input.nbaId);
  } else {
    current.add(input.nbaId);
  }

  const committedIds = Array.from(current);
  const nextPrefs: UserAppPreferences = {
    ...(user.appPreferences ?? {}),
    committedNbaIds: committedIds,
  };

  await db.update(users).set({ appPreferences: nextPrefs }).where(eq(users.id, user.id));

  const today = todayInBogota();
  if (!wasCommitted && input.merchantKey) {
    await db
      .insert(recurringMarks)
      .values({
        userId: user.id,
        merchantKey: input.merchantKey,
        mark: 'no_lo_uso',
        cancelledAt: new Date(),
        savedMonthlyMinor: input.monthlySavingsMinor,
      })
      .onConflictDoUpdate({
        target: [recurringMarks.userId, recurringMarks.merchantKey],
        set: {
          mark: 'no_lo_uso',
          cancelledAt: new Date(),
          savedMonthlyMinor: input.monthlySavingsMinor,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(savingsEvents)
      .values({
        userId: user.id,
        kind: 'cobro_cancelado',
        amountMinor: input.monthlySavingsMinor,
        referenceKey: input.merchantKey,
        label: `Suscripción cancelada: ${input.nbaTitle.slice(0, 60)}`,
        occurredOn: today,
      })
      .onConflictDoNothing();
  } else if (input.recordImmediateWeekSaving) {
    const weeklyAmount = Math.max(5_000_00, Math.round(input.monthlySavingsMinor / 4));
    await db
      .insert(savingsEvents)
      .values({
        userId: user.id,
        kind: 'comision_evitada',
        amountMinor: weeklyAmount,
        referenceKey: `nba_week:${input.nbaId}:${today}`,
        label: `Ahorro semanal NBA: ${input.nbaTitle.slice(0, 55)}`,
        occurredOn: today,
      })
      .onConflictDoNothing();
  }

  revalidatePath('/app', 'layout');
  return {
    ok: true,
    committedIds,
    message: wasCommitted && !input.recordImmediateWeekSaving
      ? 'Jugada retirada de tu plan activo.'
      : `Jugada comprometida en tu meta (+${cop(input.monthlySavingsMinor)}/mes).`,
  };
}

export async function activateAllNbaPlanAction(
  nbaIds: string[],
): Promise<{ ok: boolean; committedIds: string[]; message: string }> {
  const user = await requireUser();
  const current = user.appPreferences?.committedNbaIds ?? [];
  const allActive = nbaIds.length > 0 && nbaIds.every((id) => current.includes(id));
  const committedIds = allActive ? [] : Array.from(new Set(nbaIds));

  const nextPrefs: UserAppPreferences = {
    ...(user.appPreferences ?? {}),
    committedNbaIds: committedIds,
  };
  await db.update(users).set({ appPreferences: nextPrefs }).where(eq(users.id, user.id));
  revalidatePath('/app', 'layout');

  return {
    ok: true,
    committedIds,
    message: allActive
      ? 'Plan de jugadas reiniciado.'
      : `Activaste las ${committedIds.length} jugadas en tu plan de ahorro mensual.`,
  };
}

export async function executeEvaluatedSpendAction(input: {
  amountMinor: number;
  concept: string;
  mode: 'registrar_gasto' | 'apartar_ciclo';
}): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const amountMinor = Math.abs(Math.round(input.amountMinor));
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    return { ok: false, message: 'Monto inválido.' };
  }

  const now = new Date();
  const today = todayInBogota(now);
  const label = (input.concept.trim() || 'Gasto evaluado en ¿Puedo?').slice(0, 75);

  if (input.mode === 'registrar_gasto') {
    const acct = await ensureEditableLiquidAccount(user.id);
    const overrides = await loadCategoryOverrides(user.id);
    const parsed = parseChatExpenses(`${label} ${Math.round(amountMinor / 100)}`, today, currentBogotaHour(now), overrides);
    const cat = parsed[0]?.category ?? 'otros';
    const mKey = parsed[0]?.merchantKey ?? 'gasto_evaluado';
    const mName = parsed[0]?.merchantName ?? label;

    await db
      .insert(transactions)
      .values({
        userId: user.id,
        accountId: acct.id,
        postedOn: today,
        description: label,
        amountMinor: -amountMinor,
        merchantKey: mKey,
        merchantName: mName,
        category: cat,
        categorySource: 'auto',
        spentHour: currentBogotaHour(now),
        captureMethod: 'rapido',
        dedupeKey: sha256(`ask_spend:${user.id}:${today}:${amountMinor}:${label}:${Math.floor(now.getTime() / 10000)}`),
      })
      .onConflictDoNothing();

    if (acct.balanceMinor !== null) {
      await db
        .update(accounts)
        .set({ balanceMinor: acct.balanceMinor - amountMinor, balanceAt: now })
        .where(eq(accounts.id, acct.id));
    }

    await db.insert(accessLog).values({
      userId: user.id,
      actor: 'persona',
      action: 'registrar_gasto_evaluado',
      detail: { amountMinor, label, account: acct.name },
    });

    revalidatePath('/app', 'layout');
    return {
      ok: true,
      message: `Gasto «${label}» (${cop(amountMinor)}) registrado en ${acct.name}. Tu cifra disponible ya se actualizó.`,
    };
  }

  const dayOfMonth = Number(today.slice(8, 10)) || 15;
  await db.insert(commitments).values({
    userId: user.id,
    name: label,
    amountMinor,
    dayOfMonth,
  });

  await db.insert(accessLog).values({
    userId: user.id,
    actor: 'persona',
    action: 'apartar_compromiso_ciclo',
    detail: { amountMinor, label, dayOfMonth },
  });

  revalidatePath('/app', 'layout');
  return {
    ok: true,
    message: `Apartamos «${label}» (${cop(amountMinor)}) como compromiso de este ciclo para proteger tu disponible.`,
  };
}

export async function updateUserPlanTierAction(
  planTier: 'esencial' | 'plus',
): Promise<{ ok: boolean; planTier: 'esencial' | 'plus'; message: string }> {
  const user = await requireUser();
  const cleanTier: 'esencial' | 'plus' = planTier === 'plus' ? 'plus' : 'esencial';
  const nextPrefs: UserAppPreferences = {
    ...(user.appPreferences ?? {}),
    planTier: cleanTier,
  };

  await db.update(users).set({ appPreferences: nextPrefs }).where(eq(users.id, user.id));
  await db.insert(accessLog).values({
    userId: user.id,
    actor: 'persona',
    action: 'cambiar_plan_suscripcion',
    detail: { planTier: cleanTier },
  });

  revalidatePath('/app', 'layout');
  return {
    ok: true,
    planTier: cleanTier,
    message:
      cleanTier === 'plus'
        ? 'Plan CIFRA Plus ($9,900/mes) activado en tu cuenta: canjes ilimitados y conciliación multi-banco sin tope.'
        : 'Plan CIFRA Esencial ($0/mes) activo en tu cuenta.',
  };
}

export async function updateConsentMandateAction(input: {
  durationDays: 90 | 180 | 365;
  scopeRecurring: boolean;
  scopeGeoNba: boolean;
  scopeFutureOpenFinanceApi: boolean;
}): Promise<{ ok: boolean; mandate: UserConsentMandateConfig; message: string }> {
  const user = await requireUser();
  const durationDays: 90 | 180 | 365 =
    input.durationDays === 90 ? 90 : input.durationDays === 365 ? 365 : 180;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationDays * 86_400_000);

  const fullHash = sha256(
    `${user.id}:${CONSENT_VERSION}:${durationDays}:${input.scopeRecurring}:${input.scopeGeoNba}:${input.scopeFutureOpenFinanceApi}:${now.toISOString()}`,
  );

  const mandate: UserConsentMandateConfig = {
    durationDays,
    scopeRecurring: Boolean(input.scopeRecurring),
    scopeGeoNba: Boolean(input.scopeGeoNba),
    scopeFutureOpenFinanceApi: Boolean(input.scopeFutureOpenFinanceApi),
    updatedAtIso: now.toISOString(),
    mandateHash: fullHash,
  };

  const nextPrefs: UserAppPreferences = {
    ...(user.appPreferences ?? {}),
    consentMandate: mandate,
  };

  await db
    .update(users)
    .set({
      appPreferences: nextPrefs,
      consentVersion: CONSENT_VERSION,
      consentAt: now,
    })
    .where(eq(users.id, user.id));

  await db
    .update(dataSources)
    .set({ expiresAt })
    .where(and(eq(dataSources.userId, user.id), eq(dataSources.status, 'activa')));

  await db.insert(accessLog).values({
    userId: user.id,
    actor: 'persona',
    action: 'actualizar_mandato_ley1581',
    detail: {
      durationDays,
      scopeRecurring: mandate.scopeRecurring,
      scopeGeoNba: mandate.scopeGeoNba,
      scopeFutureOpenFinanceApi: mandate.scopeFutureOpenFinanceApi,
      hashPrefix: fullHash.slice(0, 16),
    },
  });

  revalidatePath('/app/datos');
  return {
    ok: true,
    mandate,
    message: `Mandato Ley 1581 actualizado (${durationDays} días de vigencia) y registrado en tu bitácora con huella SHA-256.`,
  };
}

export async function saveMerchantMandateConfigAction(
  partial: Partial<MerchantMandateConfig>,
): Promise<{ ok: boolean; config: MerchantMandateConfig; message: string }> {
  const access = await requireMerchantAccess();
  const current: MerchantMandateConfig = {
    collectionMethod: access.merchant.mandateConfig?.collectionMethod ?? 'debito_automatico',
    mandateActive: access.merchant.mandateConfig?.mandateActive ?? true,
    selectedChannel: access.merchant.mandateConfig?.selectedChannel ?? 'breb',
    safetyCapMinor: access.merchant.mandateConfig?.safetyCapMinor ?? 150_000_00,
    prepaidBalanceMinor: access.merchant.mandateConfig?.prepaidBalanceMinor ?? 85_000_00,
    lastAutoSettledAtIso: access.merchant.mandateConfig?.lastAutoSettledAtIso,
    lastAutoSettledRef: access.merchant.mandateConfig?.lastAutoSettledRef,
    lastAutoSettledAmountMinor: access.merchant.mandateConfig?.lastAutoSettledAmountMinor,
  };

  const next: MerchantMandateConfig = {
    ...current,
    ...partial,
  };

  await db
    .update(merchants)
    .set({ mandateConfig: next })
    .where(eq(merchants.id, access.merchant.id));

  revalidatePath('/negocio/cuenta');
  return {
    ok: true,
    config: next,
    message: 'Configuración de recaudo automático guardada en la cuenta de tu comercio.',
  };
}

export async function topUpMerchantPrepaidAction(
  amountMinor: number,
): Promise<{ ok: boolean; config: MerchantMandateConfig; message: string }> {
  const access = await requireMerchantAccess();
  const delta = Math.max(10_000_00, Math.round(amountMinor));
  const currentBalance = access.merchant.mandateConfig?.prepaidBalanceMinor ?? 85_000_00;
  const nextBalance = currentBalance + delta;

  const res = await saveMerchantMandateConfigAction({
    collectionMethod: 'bolsa_prepago',
    prepaidBalanceMinor: nextBalance,
  });

  return {
    ok: true,
    config: res.config,
    message: `Recarga de ${cop(delta)} abonada a tu Bolsa Prepago. Nuevo saldo disponible: ${cop(nextBalance)}.`,
  };
}

export async function executeMerchantAutoDebitCutoffAction(): Promise<{
  ok: boolean;
  message: string;
  reference: string;
  settledAmountMinor: number;
  config: MerchantMandateConfig;
}> {
  const access = await requireMerchantAccess();
  const data = await loadMerchantDashboard(access.merchant);
  const now = new Date();
  const periodMonth = currentPeriodMonth();

  const openInvoice =
    data.invoices.find((inv) => inv.status === 'abierta' || inv.status === 'pendiente_pago') ??
    data.invoices[0];

  const settledAmountMinor = Math.max(
    900_00,
    openInvoice?.commissionTotalMinor || data.cycleSummary.accumulatedCommissionMinor || 4_860_00,
  );

  const channel = access.merchant.mandateConfig?.selectedChannel ?? 'breb';
  const methodDb: 'breb' | 'nequi' | 'transferencia' =
    channel === 'nequi' ? 'nequi' : channel === 'bancolombia_ach' ? 'transferencia' : 'breb';
  const reference = `AUTODEB-${todayInBogota(now).replace(/-/g, '')}-${randomToken(3).toUpperCase()}`;

  let targetInvoiceId = openInvoice?.id;
  if (!targetInvoiceId) {
    const [createdInv] = await db
      .insert(merchantInvoices)
      .values({
        merchantId: access.merchant.id,
        periodMonth,
        redemptionsCount: Math.max(1, data.cycleSummary.salesCount),
        grossSalesMinor: data.cycleSummary.grossSalesMinor,
        discountsGrantedMinor: data.cycleSummary.discountsGrantedMinor,
        netSalesMinor: data.cycleSummary.collectedInCashMinor,
        commissionTotalMinor: settledAmountMinor,
        status: 'pagada',
        issuedAt: now,
        paidAt: now,
      })
      .returning({ id: merchantInvoices.id });
    targetInvoiceId = createdInv!.id;
  } else {
    await db
      .update(merchantInvoices)
      .set({
        status: 'pagada',
        paidAt: now,
        commissionTotalMinor: settledAmountMinor,
      })
      .where(eq(merchantInvoices.id, targetInvoiceId));
  }

  await db.insert(merchantPayments).values({
    invoiceId: targetInvoiceId,
    merchantId: access.merchant.id,
    method: methodDb,
    amountMinor: settledAmountMinor,
    reference,
    note: `Liquidación automática de corte quincenal (${access.merchant.mandateConfig?.collectionMethod === 'bolsa_prepago' ? 'Bolsa Prepago' : `Mandato ${channel.toUpperCase()}`})`,
    status: 'aprobado',
    reviewedByUserId: access.user.id,
    reviewedAt: now,
  });

  const currentPrepaid = access.merchant.mandateConfig?.prepaidBalanceMinor ?? 85_000_00;
  const nextPrepaid =
    access.merchant.mandateConfig?.collectionMethod === 'bolsa_prepago'
      ? Math.max(0, currentPrepaid - settledAmountMinor)
      : currentPrepaid;

  const saved = await saveMerchantMandateConfigAction({
    prepaidBalanceMinor: nextPrepaid,
    lastAutoSettledAtIso: now.toISOString(),
    lastAutoSettledRef: reference,
    lastAutoSettledAmountMinor: settledAmountMinor,
  });

  revalidatePath('/negocio', 'layout');
  return {
    ok: true,
    reference,
    settledAmountMinor,
    config: saved.config,
    message: `Corte quincenal por ${cop(settledAmountMinor)} liquidado y conciliado en PostgreSQL (Ref. ${reference}).`,
  };
}

export async function reopenMerchantCutoffInvoiceAction(): Promise<{
  ok: boolean;
  message: string;
  config: MerchantMandateConfig;
}> {
  const access = await requireMerchantAccess();
  const data = await loadMerchantDashboard(access.merchant);
  const latestInvoice = data.invoices[0];

  if (latestInvoice) {
    await db
      .update(merchantInvoices)
      .set({ status: 'abierta', paidAt: null })
      .where(eq(merchantInvoices.id, latestInvoice.id));
  }

  const saved = await saveMerchantMandateConfigAction({
    lastAutoSettledAtIso: undefined,
    lastAutoSettledRef: undefined,
    lastAutoSettledAmountMinor: undefined,
  });

  revalidatePath('/negocio', 'layout');
  return {
    ok: true,
    config: saved.config,
    message: 'Corte quincenal reabierto para recibir nuevas ventas y liquidaciones.',
  };
}

export async function launchRealEmbeddedPartnerSessionAction(
  brandSlug?: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const user = await requireUser();
  const [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.slug, 'coopfuturo'))
    .limit(1);

  let activePartner = partner;
  if (!activePartner) {
    const [created] = await db
      .insert(partners)
      .values({
        name: 'Cooperativa Coopfuturo',
        slug: 'coopfuturo',
        revenueShareBps: 3000,
        contactEmail: 'alianzas@coopfuturo.co',
        active: true,
        isDemo: true,
      })
      .returning();
    activePartner = created!;
  }

  const [partnerUser] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) in ('andres.demo@cifra.co', 'mariana.demo@cifra.co')`)
    .limit(1);

  const targetUserId = partnerUser?.id ?? user.id;
  const rawToken = randomToken(24);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(embedTokens).values({
    tokenHash: sha256(rawToken),
    userId: targetUserId,
    partnerId: activePartner.id,
    expiresAt,
  });

  await recordEvent('click_cta', { location: 'b2b2c_embed', brandSlug: brandSlug ?? 'coopfuturo' }, targetUserId);
  return {
    ok: true,
    url: `/e/${rawToken}`,
  };
}

