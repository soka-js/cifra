'use server';

import { and, desc, eq, gt, gte, isNull, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { recordEvent } from '@/lib/analytics/server';
import { hashPassword } from '@/lib/auth/password';
import {
  ACTIVE_MERCHANT_COOKIE,
  createSession,
  getCurrentUser,
  requireMerchantAccess,
  requireUser,
} from '@/lib/auth/session';
import { randomToken, sha256 } from '@/lib/crypto';
import { db } from '@/lib/db';
import {
  accounts,
  dataSources,
  merchantInvites,
  merchantInvoices,
  merchantLedgerEntries,
  merchantMembers,
  merchantPayments,
  merchants,
  notifications,
  offerCodes,
  offers,
  redemptions,
  savingsEvents,
  transactions,
  users,
} from '@/lib/db/schema';
import {
  computeRedemptionSplit,
  evaluateOfferEligibility,
  generateRedemptionCode,
  type CandidateOffer,
} from '@/lib/engine/attribution';
import { computeHonestMerchantMargin } from '@/lib/engine/crossref';
import { evaluateMerchantBillingHealth } from '@/lib/engine/commission-cycle';
import { addDays, todayInBogota } from '@/lib/engine/dates';
import { CONSENT_VERSION, cop, parsePesosInput } from '@/lib/format';
import { getPartnerShareBps, syncMerchantInvoice } from '@/lib/merchant-data';
import { currentBogotaHour } from '@/lib/v3-data';
import { getZoneBySlug } from '@/lib/zones';

export type MerchantActionState =
  | { status: 'idle' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string };

function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'comercio'
  );
}

// ---------------------------------------------------------------------------
// Acciones del lado Persona: generar código/QR y confirmación bilateral
// ---------------------------------------------------------------------------

export async function claimOfferCode(formData: FormData): Promise<void> {
  const user = await requireUser();
  const offerId = String(formData.get('offerId') ?? '').trim();
  if (!offerId) return;

  const now = new Date();
  const [existingCode] = await db
    .select()
    .from(offerCodes)
    .where(
      and(
        eq(offerCodes.userId, user.id),
        eq(offerCodes.offerId, offerId),
        eq(offerCodes.status, 'pendiente'),
        gt(offerCodes.expiresAt, now),
      ),
    )
    .limit(1);

  if (existingCode) {
    revalidatePath('/app/ofertas');
    return;
  }

  const [row] = await db
    .select({ offer: offers, merchant: merchants })
    .from(offers)
    .innerJoin(merchants, eq(merchants.id, offers.merchantId))
    .where(and(eq(offers.id, offerId), eq(offers.status, 'activa')))
    .limit(1);

  if (!row) return;
  // Lo real y la demo no se cruzan: una persona real no reclama ofertas de ejemplo, ni al revés.
  if (row.merchant.isDemo !== user.isDemo) return;
  if (row.offer.stockRemaining !== null && row.offer.stockRemaining <= 0) return;

  const today = todayInBogota();
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00-05:00`);
  const since90 = addDays(today, -90);

  const [[countRow], userTxs, priorRedeems] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(redemptions)
      .where(and(eq(redemptions.offerId, offerId), ne(redemptions.status, 'anulada'), gte(redemptions.redeemedAt, monthStart))),
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

  const recentTxs = userTxs.filter((t) => t.postedOn >= since90);
  const elig = evaluateOfferEligibility({
    today,
    userId: user.id,
    offer: candidate,
    userTransactions: recentTxs,
    priorMerchantRedemptionDates: priorRedeems.map((r) => todayInBogota(r.redeemedAt)),
    bypassHoldoutForDemo: user.isDemo || row.offer.isFlash,
  });

  if (!elig.eligible) return;

  const code = generateRedemptionCode(6);
  const qrToken = randomToken(16);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // Vigencia corta de 30 min para uso real en mostrador

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

  await recordEvent('generate_offer_code', { offerId: row.offer.id, merchant: row.merchant.slug }, user.id);
  revalidatePath('/app/ofertas');
}

export async function confirmRedemptionByUser(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get('redemptionId') ?? '').trim();
  if (!id) return;
  await db
    .update(redemptions)
    .set({ userConfirmedAt: new Date() })
    .where(and(eq(redemptions.id, id), eq(redemptions.userId, user.id)));
  revalidatePath('/app/ofertas');
}

export async function disputeRedemptionByUser(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get('redemptionId') ?? '').trim();
  const reason = String(formData.get('reason') ?? 'Monto o descuento no coincide').trim().slice(0, 200);
  if (!id) return;
  await db
    .update(redemptions)
    .set({ disputedAt: new Date(), disputeReason: reason, status: 'en_revision' })
    .where(and(eq(redemptions.id, id), eq(redemptions.userId, user.id)));
  revalidatePath('/app/ofertas');
}

// ---------------------------------------------------------------------------
// Activación en 1 toque por enlace de WhatsApp y auto-registro de comercio
// ---------------------------------------------------------------------------

export async function redeemMerchantInvite(_prev: MerchantActionState, formData: FormData): Promise<MerchantActionState> {
  const token = String(formData.get('token') ?? '').trim();
  if (!token) return { status: 'error', message: 'Enlace inválido.' };

  const hash = sha256(token);
  const [inv] = await db
    .select({ invite: merchantInvites, merchant: merchants })
    .from(merchantInvites)
    .innerJoin(merchants, eq(merchants.id, merchantInvites.merchantId))
    .where(
      and(
        eq(merchantInvites.tokenHash, hash),
        isNull(merchantInvites.usedAt),
        gt(merchantInvites.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!inv) {
    return { status: 'error', message: 'Este enlace de activación ya fue usado o venció. Pídele uno nuevo a tu promotor CIFRA.' };
  }

  let currentUser = await getCurrentUser();
  // Lo real y la demo no se cruzan: quien mira la demo no puede quedar de dueño de un negocio real.
  if (currentUser && currentUser.isDemo !== inv.merchant.isDemo) {
    return { status: 'error', message: 'Este enlace no se puede usar desde la demo. Sal de la demo y ábrelo de nuevo.' };
  }
  if (!currentUser) {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const password = String(formData.get('password') ?? '');
    const ownerName = String(formData.get('ownerName') ?? inv.merchant.ownerName).trim().slice(0, 80);

    if (!z.string().email().safeParse(email).success) {
      return { status: 'error', message: 'Escribe un correo válido para entrar a tu negocio cuando cambies de celular.' };
    }
    if (password.length < 8) {
      return { status: 'error', message: 'Elige una clave de al menos 8 caracteres.' };
    }

    const [existingByEmail] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    if (existingByEmail) {
      return {
        status: 'error',
        message: 'Ya existe una cuenta con ese correo. Inicia sesión primero y vuelve a abrir este enlace.',
      };
    }

    const [created] = await db
      .insert(users)
      .values({
        name: ownerName || inv.merchant.ownerName,
        email,
        passwordHash: await hashPassword(password),
        zoneSlug: inv.merchant.zoneSlug,
        lat: inv.merchant.lat,
        lng: inv.merchant.lng,
        consentVersion: CONSENT_VERSION,
        consentAt: new Date(),
        onboardedAt: new Date(),
      })
      .returning();
    currentUser = created!;
    await createSession(currentUser.id);
  }

  await db
    .insert(merchantMembers)
    .values({
      merchantId: inv.merchant.id,
      userId: currentUser.id,
      role: 'owner',
    })
    .onConflictDoNothing();

  await db.update(merchantInvites).set({ usedAt: new Date() }).where(eq(merchantInvites.tokenHash, hash));
  if (inv.merchant.stage === 'prospecto' || inv.merchant.stage === 'invitado') {
    await db
      .update(merchants)
      .set({ stage: 'activo', activatedAt: inv.merchant.activatedAt ?? new Date() })
      .where(eq(merchants.id, inv.merchant.id));
  }

  const jar = await cookies();
  jar.set(ACTIVE_MERCHANT_COOKIE, inv.merchant.id, { path: '/', sameSite: 'lax', maxAge: 30 * 86_400 });
  redirect('/negocio?activado=1');
}

const BUSINESS_CATEGORIES = [
  'panaderia',
  'tienda',
  'cafeteria',
  'restaurante',
  'fruver',
  'papeleria',
  'drogueria',
  'peluqueria',
  'servicios',
  'otro',
] as const;

const SPEND_CATEGORY_BY_BUSINESS: Record<(typeof BUSINESS_CATEGORIES)[number], string> = {
  panaderia: 'comida',
  tienda: 'mercado',
  cafeteria: 'comida',
  restaurante: 'comida',
  fruver: 'mercado',
  papeleria: 'educacion',
  drogueria: 'salud',
  peluqueria: 'compras',
  servicios: 'otros',
  otro: 'compras',
};

export async function selfRegisterMerchant(_prev: MerchantActionState, formData: FormData): Promise<MerchantActionState> {
  let user = await getCurrentUser();
  const businessName = String(formData.get('businessName') ?? '').trim().slice(0, 80);
  const ownerName = String(formData.get('ownerName') ?? '').trim().slice(0, 80);
  const whatsapp = String(formData.get('whatsapp') ?? '').replace(/[^\d+]/g, '').slice(0, 20);
  const businessCategoryRaw = String(formData.get('businessCategory') ?? 'tienda') as (typeof BUSINESS_CATEGORIES)[number];
  const businessCategory = BUSINESS_CATEGORIES.includes(businessCategoryRaw) ? businessCategoryRaw : 'tienda';
  const zoneSlug = String(formData.get('zoneSlug') ?? 'chapinero');
  const zone = getZoneBySlug(zoneSlug);
  const neighborhood = String(formData.get('neighborhood') ?? '').trim().slice(0, 60) || zone.name;
  const address = String(formData.get('address') ?? '').trim().slice(0, 120);
  const hoursText = String(formData.get('hoursText') ?? '').trim().slice(0, 80) || 'Lun a Sáb 7:00 a. m. – 8:00 p. m.';
  // La compra promedio la escribe el tendero; sin ella no se calcula ninguna ganancia por venta.
  const typicalTicketMinor = parsePesosInput(String(formData.get('typicalTicket') ?? ''));
  const brebKey = String(formData.get('brebKey') ?? '').trim().slice(0, 80) || null;
  const lat = Number(formData.get('lat') ?? zone.lat) || zone.lat;
  const lng = Number(formData.get('lng') ?? zone.lng) || zone.lng;

  if (businessName.length < 2 || ownerName.length < 2 || whatsapp.length < 7 || address.length < 4) {
    return { status: 'error', message: 'Completa el nombre del negocio, tu nombre, WhatsApp y dirección.' };
  }
  if (typicalTicketMinor === null) {
    return { status: 'error', message: 'Escribe cuánto compra en promedio un cliente en tu negocio.' };
  }

  if (!user) {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const password = String(formData.get('password') ?? '');
    if (!z.string().email().safeParse(email).success) {
      return { status: 'error', message: 'Escribe un correo válido para crear tu acceso.' };
    }
    if (password.length < 10) {
      return { status: 'error', message: 'La contraseña debe tener al menos 10 caracteres.' };
    }
    const [exists] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (exists) {
      return { status: 'error', message: 'Ese correo ya tiene cuenta en CIFRA. Entra primero y registra tu negocio.' };
    }
    const [createdUser] = await db
      .insert(users)
      .values({
        name: ownerName,
        email,
        passwordHash: await hashPassword(password),
        zoneSlug: zone.slug,
        lat,
        lng,
        consentVersion: CONSENT_VERSION,
        consentAt: new Date(),
        onboardedAt: new Date(),
      })
      .returning();
    user = createdUser!;
    await createSession(user.id);
  }

  const baseSlug = slugify(businessName);
  const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  const keywords = [businessName.toUpperCase().slice(0, 30)];

  const [merchant] = await db
    .insert(merchants)
    .values({
      slug: uniqueSlug,
      name: businessName,
      businessCategory,
      targetSpendCategory: SPEND_CATEGORY_BY_BUSINESS[businessCategory],
      ownerName,
      whatsapp,
      email: user.email,
      address,
      neighborhood,
      zoneSlug: zone.slug,
      lat,
      lng,
      hoursText,
      typicalTicketMinor,
      matchKeywords: keywords,
      brebKey,
      stage: 'activo',
      acquiredBy: 'autoregistro_web',
      activatedAt: new Date(),
      isDemo: user.isDemo,
    })
    .returning();

  await db.insert(merchantMembers).values({
    merchantId: merchant!.id,
    userId: user.id,
    role: 'owner',
  });

  const jar = await cookies();
  jar.set(ACTIVE_MERCHANT_COOKIE, merchant!.id, { path: '/', sameSite: 'lax', maxAge: 30 * 86_400 });
  redirect('/negocio/ofertas?bienvenida=1');
}

export async function switchActiveMerchant(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get('merchantId') ?? '').trim();
  if (id) {
    // Solo entre los negocios de los que la persona es miembro.
    const [membership] = await db
      .select({ id: merchantMembers.id })
      .from(merchantMembers)
      .where(and(eq(merchantMembers.userId, user.id), eq(merchantMembers.merchantId, id)))
      .limit(1);
    if (membership) {
      const jar = await cookies();
      jar.set(ACTIVE_MERCHANT_COOKIE, id, { path: '/', sameSite: 'lax', maxAge: 30 * 86_400 });
    }
  }
  revalidatePath('/negocio', 'layout');
  redirect('/negocio');
}

export async function updateMerchantProfile(_prev: MerchantActionState, formData: FormData): Promise<MerchantActionState> {
  const access = await requireMerchantAccess();
  const name = String(formData.get('name') ?? '').trim().slice(0, 80);
  const description = String(formData.get('description') ?? '').trim().slice(0, 240) || null;
  const address = String(formData.get('address') ?? '').trim().slice(0, 120);
  const neighborhood = String(formData.get('neighborhood') ?? '').trim().slice(0, 60);
  const zoneSlug = String(formData.get('zoneSlug') ?? access.merchant.zoneSlug);
  const zone = getZoneBySlug(zoneSlug);
  const hoursText = String(formData.get('hoursText') ?? '').trim().slice(0, 80) || null;
  const whatsapp = String(formData.get('whatsapp') ?? '').replace(/[^\d+]/g, '').slice(0, 20);
  const brebKey = String(formData.get('brebKey') ?? '').trim().slice(0, 80) || null;
  const nequiNumber = String(formData.get('nequiNumber') ?? '').replace(/\D/g, '').slice(0, 15) || null;
  const typicalTicketMinor = parsePesosInput(String(formData.get('typicalTicket') ?? '')) ?? access.merchant.typicalTicketMinor;
  const keywordsRaw = String(formData.get('matchKeywords') ?? '');
  const matchKeywords = keywordsRaw
    .split(',')
    .map((k) => k.trim().toUpperCase())
    .filter((k) => k.length >= 3)
    .slice(0, 8);
  const lat = Number(formData.get('lat')) || access.merchant.lat;
  const lng = Number(formData.get('lng')) || access.merchant.lng;

  if (name.length < 2 || address.length < 4 || whatsapp.length < 7) {
    return { status: 'error', message: 'Revisa el nombre del negocio, dirección y WhatsApp.' };
  }

  await db
    .update(merchants)
    .set({
      name,
      description,
      address,
      neighborhood: neighborhood || zone.name,
      zoneSlug: zone.slug,
      lat,
      lng,
      hoursText,
      whatsapp,
      brebKey,
      nequiNumber,
      typicalTicketMinor,
      matchKeywords: matchKeywords.length > 0 ? matchKeywords : access.merchant.matchKeywords,
    })
    .where(eq(merchants.id, access.merchant.id));

  revalidatePath('/negocio', 'layout');
  revalidatePath('/app/ofertas');
  return { status: 'ok', message: 'Datos del negocio actualizados.' };
}

// ---------------------------------------------------------------------------
// Gestión de campañas de ofertas en 3 pasos + renovación medible
// ---------------------------------------------------------------------------

export async function createMerchantOffer(_prev: MerchantActionState, formData: FormData): Promise<MerchantActionState> {
  const access = await requireMerchantAccess();
  const title = String(formData.get('title') ?? '').trim().slice(0, 90);
  const description = String(formData.get('description') ?? '').trim().slice(0, 200) || null;
  const discountKind = formData.get('discountKind') === 'fixed' ? 'fixed' : 'percent';
  const discountPercent = discountKind === 'percent' ? Math.min(50, Math.max(5, Number(formData.get('discountPercent') ?? 10))) : null;
  const discountFixedMinor =
    discountKind === 'fixed' ? (parsePesosInput(String(formData.get('discountFixed') ?? '')) ?? 300000) : null;
  const minPurchaseMinor = parsePesosInput(String(formData.get('minPurchase') ?? '0')) ?? 0;
  const maxDiscountMinor = parsePesosInput(String(formData.get('maxDiscount') ?? '')) ?? null;
  const isFlash = formData.get('isFlash') === 'on';
  const newCustomersOnly = isFlash ? false : formData.get('newCustomersOnly') === 'on';
  const capRaw = Number(formData.get('monthlyCap') ?? 0);
  const monthlyCapRedemptions = Number.isInteger(capRaw) && capRaw > 0 ? capRaw : null;
  const durationDays = Math.min(90, Math.max(1, Number(formData.get('durationDays') ?? (isFlash ? 14 : 30))));

  const startHourRaw = formData.get('startHour');
  const endHourRaw = formData.get('endHour');
  const startHour =
    isFlash && startHourRaw !== null && String(startHourRaw) !== ''
      ? Math.min(23, Math.max(0, Number(startHourRaw)))
      : null;
  const endHour =
    isFlash && endHourRaw !== null && String(endHourRaw) !== ''
      ? Math.min(23, Math.max(0, Number(endHourRaw)))
      : null;
  const stockRaw = Number(formData.get('stockLimit') ?? 0);
  const stockLimit = isFlash && Number.isInteger(stockRaw) && stockRaw > 0 ? stockRaw : null;
  const unitCostMinor = parsePesosInput(String(formData.get('unitCost') ?? '')) ?? null;
  const activeHoursText = String(formData.get('activeHoursText') ?? '').trim().slice(0, 60) || null;

  if (title.length < 4) {
    return { status: 'error', message: 'Ponle un título claro a tu oferta, por ejemplo: «10 % en panadería artesanal».' };
  }

  // Política de protección mutua recomendada por Karol Benavides:
  // Si hay cortes de comisiones vencidos > 5 días, se bloquea la creación de ofertas hasta liquidar.
  const invoices = await db
    .select()
    .from(merchantInvoices)
    .where(eq(merchantInvoices.merchantId, access.merchant.id));
  const health = evaluateMerchantBillingHealth(invoices, todayInBogota());
  if (!health.canPublishOffers) {
    return {
      status: 'error',
      message:
        health.lockReason ??
        'Tienes un corte de comisiones vencido en mora. Liquida tu saldo en Mi Cuenta para reactivar la emisión de ofertas.',
    };
  }

  if (unitCostMinor && unitCostMinor > 0) {
    const margin = computeHonestMerchantMargin({
      salePriceMinor: Math.max(minPurchaseMinor, access.merchant.typicalTicketMinor),
      unitCostMinor,
      discountKind,
      discountPercent,
      discountFixedMinor,
      commissionBps: access.merchant.commissionBps,
    });
    if (margin.isLosingMoney) {
      return {
        status: 'error',
        message: `Cuidado: con ese descuento y un costo de insumos de ${cop(unitCostMinor)} perderías plata por venta. Ajusta el descuento para proteger tu ganancia.`,
      };
    }
  }

  const today = todayInBogota();
  const validUntil = addDays(today, durationDays);

  await db.insert(offers).values({
    merchantId: access.merchant.id,
    title,
    description,
    targetCategory: access.merchant.targetSpendCategory,
    discountKind,
    discountPercent,
    discountFixedMinor,
    maxDiscountMinor,
    minPurchaseMinor,
    newCustomersOnly,
    exclusivityDays: isFlash ? 30 : 60,
    // Sin grupo de control: para la feria, toda persona ve las ofertas (SOKA, 2026-11-12).
    holdoutPercent: 0,
    monthlyCapRedemptions,
    isFlash,
    startHour,
    endHour,
    stockLimit,
    stockRemaining: stockLimit,
    unitCostMinor,
    validFrom: today,
    validUntil,
    activeHoursText,
    status: 'activa',
  });

  await db
    .update(merchants)
    .set({ stage: 'con_oferta', activatedAt: access.merchant.activatedAt ?? new Date() })
    .where(eq(merchants.id, access.merchant.id));

  revalidatePath('/negocio', 'layout');
  revalidatePath('/app', 'layout');
  revalidatePath(`/b/${access.merchant.slug}`);
  redirect('/negocio?oferta=publicada');
}

export async function toggleOfferStatus(formData: FormData): Promise<void> {
  const access = await requireMerchantAccess();
  const offerId = String(formData.get('offerId') ?? '');
  const nextStatus = formData.get('nextStatus') === 'pausada' ? 'pausada' : 'activa';

  if (nextStatus === 'activa') {
    const invoices = await db
      .select()
      .from(merchantInvoices)
      .where(eq(merchantInvoices.merchantId, access.merchant.id));
    const health = evaluateMerchantBillingHealth(invoices, todayInBogota());
    if (!health.canPublishOffers) {
      return; // Mantiene la oferta pausada por mora
    }
  }

  await db
    .update(offers)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(and(eq(offers.id, offerId), eq(offers.merchantId, access.merchant.id)));
  revalidatePath('/negocio', 'layout');
  revalidatePath('/app/ofertas');
}

export async function renewOfferCampaign(formData: FormData): Promise<void> {
  const access = await requireMerchantAccess();
  const offerId = String(formData.get('offerId') ?? '');
  const [prevOffer] = await db
    .select()
    .from(offers)
    .where(and(eq(offers.id, offerId), eq(offers.merchantId, access.merchant.id)))
    .limit(1);
  if (!prevOffer) return;

  const today = todayInBogota();
  await db.insert(offers).values({
    merchantId: access.merchant.id,
    title: prevOffer.title,
    description: prevOffer.description,
    targetCategory: prevOffer.targetCategory,
    discountKind: prevOffer.discountKind,
    discountPercent: prevOffer.discountPercent,
    discountFixedMinor: prevOffer.discountFixedMinor,
    maxDiscountMinor: prevOffer.maxDiscountMinor,
    minPurchaseMinor: prevOffer.minPurchaseMinor,
    newCustomersOnly: prevOffer.newCustomersOnly,
    exclusivityDays: prevOffer.exclusivityDays,
    holdoutPercent: prevOffer.holdoutPercent,
    monthlyCapRedemptions: prevOffer.monthlyCapRedemptions,
    validFrom: today,
    validUntil: addDays(today, 30),
    activeHoursText: prevOffer.activeHoursText,
    status: 'activa',
    renewedFromOfferId: prevOffer.id,
  });

  if (prevOffer.status === 'activa') {
    await db.update(offers).set({ status: 'vencida', updatedAt: new Date() }).where(eq(offers.id, prevOffer.id));
  }

  revalidatePath('/negocio', 'layout');
  revalidatePath('/app/ofertas');
}

// ---------------------------------------------------------------------------
// Caja / Punto de venta: validación de código/QR y cobro atribuido
// ---------------------------------------------------------------------------

export interface CodeLookupResponse {
  ok: boolean;
  error?: string;
  codeId?: string;
  code?: string;
  customerFirstName?: string;
  wasNewCustomer?: boolean;
  offerTitle?: string;
  discountKind?: 'percent' | 'fixed';
  discountPercent?: number | null;
  discountFixedMinor?: number | null;
  maxDiscountMinor?: number | null;
  minPurchaseMinor?: number;
  commissionBps?: number;
  typicalTicketMinor?: number;
}

function extractCodeFromInput(raw: string): { code: string; qrToken?: string } {
  const trimmed = raw.trim();
  if (trimmed.toUpperCase().startsWith('CIFRA:')) {
    const parts = trimmed.split(':');
    return { code: (parts[1] ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''), qrToken: parts[2] };
  }
  return { code: trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '') };
}

export async function lookupOfferCode(rawInput: string): Promise<CodeLookupResponse> {
  const access = await requireMerchantAccess();
  const { code } = extractCodeFromInput(rawInput);
  if (code.length < 5) {
    return { ok: false, error: 'Escribe las 6 letras/números del código del cliente.' };
  }

  const candidateRows = await db
    .select({
      offerCode: offerCodes,
      offer: offers,
      userName: users.name,
    })
    .from(offerCodes)
    .innerJoin(offers, eq(offers.id, offerCodes.offerId))
    .innerJoin(users, eq(users.id, offerCodes.userId))
    .where(and(eq(offerCodes.code, code), eq(offerCodes.merchantId, access.merchant.id)))
    .orderBy(desc(offerCodes.createdAt));

  const now = new Date();
  const row =
    candidateRows.find((r) => r.offerCode.status === 'pendiente' && r.offerCode.expiresAt > now) ??
    candidateRows[0];

  if (!row) {
    return { ok: false, error: 'No encontramos ese código para tu negocio. Verifica las 6 letras.' };
  }
  if (row.offerCode.status === 'redimido') {
    return { ok: false, error: 'Este código ya fue usado en una compra anterior.' };
  }
  if (row.offerCode.expiresAt <= new Date() || row.offerCode.status !== 'pendiente') {
    return { ok: false, error: 'Este código venció. Pídele al cliente tocar «Generar código» otra vez en su celular.' };
  }

  return {
    ok: true,
    codeId: row.offerCode.id,
    code: row.offerCode.code,
    customerFirstName: row.userName ? row.userName.split(' ')[0]! : 'Cliente CIFRA',
    wasNewCustomer: row.offerCode.wasNewCustomer,
    offerTitle: row.offer.title,
    discountKind: row.offer.discountKind,
    discountPercent: row.offer.discountPercent,
    discountFixedMinor: row.offer.discountFixedMinor,
    maxDiscountMinor: row.offer.maxDiscountMinor,
    minPurchaseMinor: row.offer.minPurchaseMinor,
    commissionBps: access.merchant.commissionBps,
    typicalTicketMinor: access.merchant.typicalTicketMinor,
  };
}

export type PosRedeemState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'ok';
      customerFirstName: string;
      grossMinor: number;
      discountMinor: number;
      netPaidMinor: number;
      commissionMinor: number;
      merchantKeepMinor: number;
    };

export async function completeRedemption(_prev: PosRedeemState, formData: FormData): Promise<PosRedeemState> {
  const access = await requireMerchantAccess();
  const codeId = String(formData.get('codeId') ?? '').trim();
  const grossMinor = parsePesosInput(String(formData.get('grossAmount') ?? ''));

  if (!codeId || !grossMinor || grossMinor <= 0) {
    return { status: 'error', message: 'Escribe el valor total del pedido antes del descuento.' };
  }

  const [row] = await db
    .select({
      offerCode: offerCodes,
      offer: offers,
      userName: users.name,
    })
    .from(offerCodes)
    .innerJoin(offers, eq(offers.id, offerCodes.offerId))
    .innerJoin(users, eq(users.id, offerCodes.userId))
    .where(and(eq(offerCodes.id, codeId), eq(offerCodes.merchantId, access.merchant.id)))
    .limit(1);

  if (!row || row.offerCode.status !== 'pendiente' || row.offerCode.expiresAt <= new Date()) {
    return { status: 'error', message: 'El código ya fue usado o acaba de vencer. Pide uno nuevo al cliente.' };
  }

  const partnerShareBps =
    row.offerCode.channel === 'aliado' ? await getPartnerShareBps(row.offerCode.partnerId) : 0;

  const split = computeRedemptionSplit({
    grossAmountMinor: grossMinor,
    discountKind: row.offer.discountKind,
    discountPercent: row.offer.discountPercent,
    discountFixedMinor: row.offer.discountFixedMinor,
    maxDiscountMinor: row.offer.maxDiscountMinor,
    minPurchaseMinor: row.offer.minPurchaseMinor,
    commissionBps: access.merchant.commissionBps,
    channel: row.offerCode.channel,
    partnerShareBps,
  });

  if (!split.eligibleByAmount) {
    return {
      status: 'error',
      message: `Esta oferta aplica para compras desde ${cop(row.offer.minPurchaseMinor)}.`,
    };
  }

  const now = new Date();
  const today = todayInBogota(now);

  // Marca el código de forma condicional para impedir doble cobro concurrente.
  const updatedCodes = await db
    .update(offerCodes)
    .set({ status: 'redimido', redeemedAt: now })
    .where(and(eq(offerCodes.id, row.offerCode.id), eq(offerCodes.status, 'pendiente')))
    .returning({ id: offerCodes.id });

  if (updatedCodes.length === 0) {
    return { status: 'error', message: 'Este código ya acaba de registrarse.' };
  }

  const [redemption] = await db
    .insert(redemptions)
    .values({
      offerCodeId: row.offerCode.id,
      offerId: row.offer.id,
      merchantId: access.merchant.id,
      userId: row.offerCode.userId,
      validatedByUserId: access.user.id,
      channel: row.offerCode.channel,
      partnerId: row.offerCode.partnerId,
      grossAmountMinor: split.grossAmountMinor,
      discountMinor: split.discountMinor,
      netPaidByUserMinor: split.netPaidByUserMinor,
      commissionBps: split.commissionBps,
      cifraCommissionMinor: split.cifraCommissionMinor,
      partnerShareMinor: split.partnerShareMinor,
      cifraNetRevenueMinor: split.cifraNetRevenueMinor,
      merchantNetKeepMinor: split.merchantNetKeepMinor,
      isNewCustomer: row.offerCode.wasNewCustomer,
      status: 'valida',
      redeemedAt: now,
    })
    .returning({ id: redemptions.id });

  // 1) Descuenta cupo relámpago vivo si la oferta tiene cupos contados
  if (row.offer.stockRemaining !== null) {
    await db
      .update(offers)
      .set({
        stockRemaining: sql`greatest(0, ${offers.stockRemaining} - 1)`,
        updatedAt: now,
      })
      .where(eq(offers.id, row.offer.id));
  }

  // 2) Suma automáticamente la venta al Cuadre Diario del negocio (/negocio/cuadre)
  await db
    .insert(merchantLedgerEntries)
    .values({
      merchantId: access.merchant.id,
      entryOn: today,
      kind: 'venta_cifra',
      categoryLabel: row.offer.title,
      amountMinor: split.netPaidByUserMinor,
      note: `Código ${row.offerCode.code} en caja`,
      refRedemptionId: redemption!.id,
    })
    .onConflictDoNothing();

  // 3) Sincroniza el gasto neto en la CIFRA de la persona sin que tenga que escribir nada
  const customerAccounts = await db
    .select({ account: accounts, status: dataSources.status, sourceKind: dataSources.kind })
    .from(accounts)
    .innerJoin(dataSources, eq(dataSources.id, accounts.sourceId))
    .where(eq(accounts.userId, row.offerCode.userId));
  const primaryLiquid = customerAccounts.find(
    (a) => a.status === 'activa' && a.sourceKind !== 'entidad_aliada' && a.account.kind !== 'tarjeta_credito',
  )?.account;

  if (primaryLiquid) {
    const insertedTx = await db
      .insert(transactions)
      .values({
        userId: row.offerCode.userId,
        accountId: primaryLiquid.id,
        postedOn: today,
        description: `${access.merchant.name} (código CIFRA)`,
        amountMinor: -Math.abs(split.netPaidByUserMinor),
        merchantKey: access.merchant.slug.replace(/-/g, '_'),
        merchantName: access.merchant.name,
        category: row.offer.targetCategory || access.merchant.targetSpendCategory || 'comida',
        categorySource: 'auto',
        spentHour: currentBogotaHour(now),
        captureMethod: 'caja_cifra',
        dedupeKey: sha256(`pos_redeem:${redemption!.id}`),
      })
      .onConflictDoNothing()
      .returning({ id: transactions.id });

    if (insertedTx.length > 0 && primaryLiquid.balanceMinor !== null) {
      await db
        .update(accounts)
        .set({
          balanceMinor: primaryLiquid.balanceMinor - Math.abs(split.netPaidByUserMinor),
          balanceAt: now,
        })
        .where(eq(accounts.id, primaryLiquid.id));
    }
  }

  // 4) Suma inmediata al contador verificable "Pesos ahorrados con CIFRA" de la persona
  await db
    .insert(savingsEvents)
    .values({
      userId: row.offerCode.userId,
      kind: 'oferta_redimida',
      amountMinor: split.discountMinor,
      referenceKey: redemption!.id,
      label: `Descuento en ${access.merchant.name}`,
      occurredOn: today,
    })
    .onConflictDoNothing();

  // Notificación bilateral para que la persona vea el ahorro y pueda confirmar o reportar
  await db.insert(notifications).values({
    userId: row.offerCode.userId,
    kind: 'redencion_confirmada',
    title: `Ahorraste ${cop(split.discountMinor)} en ${access.merchant.name}`,
    body: `Pagaste ${cop(split.netPaidByUserMinor)} en vez de ${cop(split.grossAmountMinor)}. Ya lo restamos de tu cifra.`,
    actionUrl: '/app/ofertas#recientes',
    dedupeKey: `redeem:${redemption!.id}`,
  });

  await syncMerchantInvoice(access.merchant.id);
  await recordEvent(
    'redeem_offer',
    {
      merchant: access.merchant.slug,
      grossMinor: split.grossAmountMinor,
      discountMinor: split.discountMinor,
      commissionMinor: split.cifraCommissionMinor,
    },
    row.offerCode.userId,
  );

  revalidatePath('/negocio', 'layout');
  revalidatePath('/app', 'layout');
  revalidatePath(`/b/${access.merchant.slug}`);

  return {
    status: 'ok',
    customerFirstName: row.userName ? row.userName.split(' ')[0]! : 'Cliente',
    grossMinor: split.grossAmountMinor,
    discountMinor: split.discountMinor,
    netPaidMinor: split.netPaidByUserMinor,
    commissionMinor: split.cifraCommissionMinor,
    merchantKeepMinor: split.merchantNetKeepMinor,
  };
}

// ---------------------------------------------------------------------------
// Estado de cuenta y reporte de pago de comisiones (Bre-B / Nequi / Transferencia)
// ---------------------------------------------------------------------------

export async function reportMerchantPayment(_prev: MerchantActionState, formData: FormData): Promise<MerchantActionState> {
  const access = await requireMerchantAccess();
  const invoiceId = String(formData.get('invoiceId') ?? '').trim();
  const methodRaw = String(formData.get('method') ?? 'breb');
  const method = ['breb', 'nequi', 'transferencia'].includes(methodRaw)
    ? (methodRaw as 'breb' | 'nequi' | 'transferencia')
    : 'breb';
  const reference = String(formData.get('reference') ?? '').trim().slice(0, 80);
  const note = String(formData.get('note') ?? '').trim().slice(0, 200) || null;

  if (!invoiceId || reference.length < 4) {
    return { status: 'error', message: 'Escribe el código o comprobante de la transferencia (mínimo 4 caracteres).' };
  }

  const [inv] = await db
    .select()
    .from(merchantInvoices)
    .where(and(eq(merchantInvoices.id, invoiceId), eq(merchantInvoices.merchantId, access.merchant.id)))
    .limit(1);

  if (!inv || inv.commissionTotalMinor <= 0) {
    return { status: 'error', message: 'No encontramos un saldo pendiente para ese mes.' };
  }

  await db.insert(merchantPayments).values({
    invoiceId: inv.id,
    merchantId: access.merchant.id,
    method,
    amountMinor: inv.commissionTotalMinor,
    reference,
    note,
    status: 'reportado',
  });

  await db
    .update(merchantInvoices)
    .set({ status: 'en_verificacion' })
    .where(eq(merchantInvoices.id, inv.id));

  revalidatePath('/negocio/cuenta');
  revalidatePath('/admin');
  return {
    status: 'ok',
    message: 'Recibimos el comprobante. Nuestro equipo lo concilia y marca tu mes como pagado.',
  };
}
