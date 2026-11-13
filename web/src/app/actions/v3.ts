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
  merchantLedgerEntries,
  merchants,
  offerCodes,
  offers,
  paidCycleCharges,
  redemptions,
  transactions,
  type MerchantFeaturedItem,
} from '@/lib/db/schema';
import {
  evaluateOfferEligibility,
  generateRedemptionCode,
  type CandidateOffer,
} from '@/lib/engine/attribution';
import { computeHonestMerchantMargin } from '@/lib/engine/crossref';
import { addDays, todayInBogota } from '@/lib/engine/dates';
import { parseChatExpenses, parseColombianBankAlert } from '@/lib/engine/quick-capture';
import { cop, parsePesosInput } from '@/lib/format';
import { loadCategoryOverrides } from '@/lib/ingest';
import { ensureEditableLiquidAccount } from '@/lib/manual';
import { currentBogotaHour } from '@/lib/v3-data';

export type V3ActionState =
  | { status: 'idle' }
  | { status: 'ok'; message: string; count?: number }
  | { status: 'error'; message: string };

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
        ? `Listo: anotamos ${parsed[0]!.merchantName} (${cop(Math.abs(parsed[0]!.amountMinor))}) y actualizamos tu cifra.`
        : `Listo: anotamos ${insertedCount} movimientos y actualizamos tu cifra.`,
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

  // Lo real y la demo no se cruzan: una persona real no reclama ofertas de ejemplo, ni al revés.
  if (!row || row.merchant.isDemo !== user.isDemo) {
    return { ok: false, error: 'Esta oferta ya no está activa.' };
  }
  if (row.offer.stockRemaining !== null && row.offer.stockRemaining <= 0) {
    return { ok: false, error: 'Se agotaron los cupos de hoy de esta oferta.' };
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
    return { status: 'error', message: 'Escribe cuánto necesitas vender al día, en pesos (desde $20.000).' };
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
  const unitCostMinor = parsePesosInput(String(formData.get('unitCost') ?? ''));

  if (title.length < 4) {
    return { status: 'error', message: 'Escribe qué vas a ofrecer hoy.' };
  }
  // Sin el costo de insumos que escribe el tendero no se puede revisar que no pierda plata: no se supone uno.
  if (unitCostMinor === null) {
    return { status: 'error', message: 'Escribe cuánto te cuestan los insumos de una venta para revisar que no pierdas plata.' };
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
    description: `Oferta por horas (${stockLimit} cupos en mostrador).`,
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
    message: `Oferta encendida. Ya aparece en el mapa del barrio (${stockLimit} cupos; te quedan ${cop(margin.cifraFirstVisitProfitMinor)} limpios por venta).`,
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
// ¿Puedo?: registrar el gasto evaluado o apartarlo como compromiso del ciclo
// ---------------------------------------------------------------------------

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
