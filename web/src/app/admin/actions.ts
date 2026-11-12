'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionContext, isAdmin, requireAdmin, startDemoView, stopDemoView } from '@/lib/auth/session';
import { randomToken, sha256 } from '@/lib/crypto';
import { db } from '@/lib/db';
import {
  merchantCatalog,
  merchantInvites,
  merchantInvoices,
  merchantPayments,
  merchants,
  offers,
  partnerApiKeys,
  partners,
  redemptions,
  savingsEvents,
} from '@/lib/db/schema';
import { ensureDemoEcosystemSeeded } from '@/lib/demo-seed';
import { parsePesosInput } from '@/lib/format';
import { syncMerchantInvoice } from '@/lib/merchant-data';
import { runDailyRetentionAndOpsJob } from '@/lib/notify/daily-job';
import { getZoneBySlug } from '@/lib/zones';

export type AdminActionResult =
  | { status: 'idle' }
  | {
      status: 'ok';
      message: string;
      inviteUrl?: string;
      whatsappHref?: string;
      apiKeyPlain?: string;
    }
  | { status: 'error'; message: string };

/**
 * Toda acción de este archivo empieza aquí. Exige un admin REAL (correo en ADMIN_EMAILS y verificado),
 * mirando siempre a quien inició sesión y nunca al usuario de demostración que esté viendo.
 * Sin sesión redirige a /entrar; con sesión sin permiso responde 404.
 */
async function assertAdmin() {
  return requireAdmin();
}

function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  );
}

const SPEND_MAP: Record<string, string> = {
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

export async function createStreetMerchant(
  _prev: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  const admin = await assertAdmin();
  const name = String(formData.get('name') ?? '').trim().slice(0, 80);
  const ownerName = String(formData.get('ownerName') ?? '').trim().slice(0, 80);
  const whatsapp = String(formData.get('whatsapp') ?? '').replace(/[^\d+]/g, '').slice(0, 20);
  const businessCategory = String(formData.get('businessCategory') ?? 'panaderia') as
    | 'panaderia'
    | 'tienda'
    | 'cafeteria'
    | 'restaurante'
    | 'fruver'
    | 'papeleria'
    | 'drogueria'
    | 'peluqueria'
    | 'servicios'
    | 'otro';
  const zone = getZoneBySlug(String(formData.get('zoneSlug') ?? 'chapinero'));
  const neighborhood = String(formData.get('neighborhood') ?? '').trim().slice(0, 60) || zone.name;
  const address = String(formData.get('address') ?? '').trim().slice(0, 120);
  const typicalTicketMinor = parsePesosInput(String(formData.get('typicalTicket') ?? '20000')) ?? 2_000_000;
  const acquiredBy = String(formData.get('acquiredBy') ?? 'Promotor de calle').trim().slice(0, 60);

  if (name.length < 2 || ownerName.length < 2 || whatsapp.length < 7 || address.length < 4) {
    return { status: 'error', message: 'Completa negocio, propietario, WhatsApp y dirección.' };
  }

  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
  const [merchant] = await db
    .insert(merchants)
    .values({
      slug,
      name,
      businessCategory,
      targetSpendCategory: SPEND_MAP[businessCategory] ?? 'comida',
      ownerName,
      whatsapp,
      address,
      neighborhood,
      zoneSlug: zone.slug,
      lat: zone.lat,
      lng: zone.lng,
      typicalTicketMinor,
      matchKeywords: [name.toUpperCase().slice(0, 30)],
      stage: 'invitado',
      acquiredBy,
    })
    .returning();

  const rawToken = randomToken(20);
  await db.insert(merchantInvites).values({
    tokenHash: sha256(rawToken),
    merchantId: merchant!.id,
    createdByUserId: admin.id,
    expiresAt: new Date(Date.now() + 14 * 86_400_000),
  });

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const inviteUrl = `${site}/negocio/activar/${rawToken}`;
  const cleanPhone = whatsapp.startsWith('+') ? whatsapp.slice(1) : whatsapp.length === 10 ? `57${whatsapp}` : whatsapp;
  const waText = `Hola ${ownerName.split(' ')[0]}, aquí tienes el enlace oficial de CIFRA para activar *${name}* en 1 toque (sin mensualidad fija, solo 5 % sobre ventas traídas): ${inviteUrl}`;

  revalidatePath('/admin');
  return {
    status: 'ok',
    message: `Negocio ${name} registrado en CRM de calle con enlace de activación listo.`,
    inviteUrl,
    whatsappHref: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}`,
  };
}

export async function generateNewInviteLink(
  _prev: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  const admin = await assertAdmin();
  const merchantId = String(formData.get('merchantId') ?? '').trim();
  const [m] = await db.select().from(merchants).where(eq(merchants.id, merchantId)).limit(1);
  if (!m) return { status: 'error', message: 'Negocio no encontrado.' };

  const rawToken = randomToken(20);
  await db.insert(merchantInvites).values({
    tokenHash: sha256(rawToken),
    merchantId: m.id,
    createdByUserId: admin.id,
    expiresAt: new Date(Date.now() + 14 * 86_400_000),
  });

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const inviteUrl = `${site}/negocio/activar/${rawToken}`;
  const cleanPhone = m.whatsapp.startsWith('+') ? m.whatsapp.slice(1) : m.whatsapp.length === 10 ? `57${m.whatsapp}` : m.whatsapp;
  const waText = `Hola ${m.ownerName.split(' ')[0]}, este es tu enlace directo para entrar y activar *${m.name}* en CIFRA: ${inviteUrl}`;

  revalidatePath('/admin');
  return {
    status: 'ok',
    message: `Nuevo enlace de WhatsApp generado para ${m.name}.`,
    inviteUrl,
    whatsappHref: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}`,
  };
}

export async function adminModerateOffer(formData: FormData): Promise<void> {
  await assertAdmin();
  const offerId = String(formData.get('offerId') ?? '').trim();
  const status = String(formData.get('status') ?? 'pausada') as 'activa' | 'pausada' | 'rechazada';
  if (!offerId) return;
  await db.update(offers).set({ status, updatedAt: new Date() }).where(eq(offers.id, offerId));
  revalidatePath('/admin');
  revalidatePath('/app/ofertas');
}

export async function promoteCatalogRule(formData: FormData): Promise<void> {
  await assertAdmin();
  const merchantKey = String(formData.get('merchantKey') ?? '').trim();
  if (!merchantKey) return;
  await db
    .update(merchantCatalog)
    .set({ verified: true, updatedAt: new Date() })
    .where(eq(merchantCatalog.merchantKey, merchantKey));
  revalidatePath('/admin');
}

export async function closeMonthInvoices(formData: FormData): Promise<void> {
  await assertAdmin();
  const periodMonth = String(formData.get('periodMonth') ?? '').trim();
  if (!periodMonth) return;
  await db
    .update(merchantInvoices)
    .set({ status: 'pendiente_pago', issuedAt: new Date() })
    .where(and(eq(merchantInvoices.periodMonth, periodMonth), eq(merchantInvoices.status, 'abierta')));
  revalidatePath('/admin');
  revalidatePath('/negocio/cuenta');
}

export async function reviewMerchantPayment(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const paymentId = String(formData.get('paymentId') ?? '').trim();
  const decision = formData.get('decision') === 'aprobado' ? 'aprobado' : 'rechazado';
  if (!paymentId) return;

  const [payment] = await db
    .select()
    .from(merchantPayments)
    .where(eq(merchantPayments.id, paymentId))
    .limit(1);
  if (!payment) return;

  const now = new Date();
  await db
    .update(merchantPayments)
    .set({
      status: decision,
      reviewedByUserId: admin.id,
      reviewedAt: now,
    })
    .where(eq(merchantPayments.id, paymentId));

  if (decision === 'aprobado') {
    await db
      .update(merchantInvoices)
      .set({ status: 'pagada', paidAt: now })
      .where(eq(merchantInvoices.id, payment.invoiceId));
  } else {
    await db
      .update(merchantInvoices)
      .set({ status: 'pendiente_pago' })
      .where(eq(merchantInvoices.id, payment.invoiceId));
  }

  revalidatePath('/admin');
  revalidatePath('/negocio/cuenta');
}

export async function resolveRedemptionDispute(formData: FormData): Promise<void> {
  await assertAdmin();
  const redemptionId = String(formData.get('redemptionId') ?? '').trim();
  const resolution = formData.get('resolution') === 'anulada' ? 'anulada' : 'valida';
  if (!redemptionId) return;

  const [r] = await db.select().from(redemptions).where(eq(redemptions.id, redemptionId)).limit(1);
  if (!r) return;

  await db
    .update(redemptions)
    .set({
      status: resolution,
      disputedAt: resolution === 'valida' ? null : r.disputedAt,
    })
    .where(eq(redemptions.id, redemptionId));

  if (resolution === 'anulada') {
    await db
      .delete(savingsEvents)
      .where(and(eq(savingsEvents.kind, 'oferta_redimida'), eq(savingsEvents.referenceKey, r.id)));
  }

  await syncMerchantInvoice(r.merchantId, r.redeemedAt.toISOString().slice(0, 7));
  revalidatePath('/admin');
  revalidatePath('/negocio', 'layout');
  revalidatePath('/app/ofertas');
}

export async function createPartnerWithKey(
  _prev: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  await assertAdmin();
  const name = String(formData.get('name') ?? '').trim().slice(0, 80);
  const contactEmail = String(formData.get('contactEmail') ?? '').trim().slice(0, 120) || null;
  const sharePct = Math.min(41, Math.max(5, Number(formData.get('sharePercent') ?? 30)));
  const revenueShareBps = Math.round(sharePct * 100);

  if (name.length < 2) {
    return { status: 'error', message: 'Escribe el nombre de la cooperativa, caja o billetera aliada.' };
  }

  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 5)}`;
  const [partner] = await db
    .insert(partners)
    .values({
      name,
      slug,
      revenueShareBps,
      contactEmail,
      active: true,
    })
    .returning();

  const rawKey = `cfk_${randomToken(24)}`;
  await db.insert(partnerApiKeys).values({
    partnerId: partner!.id,
    prefix: rawKey.slice(0, 12),
    keyHash: sha256(rawKey),
  });

  revalidatePath('/admin');
  return {
    status: 'ok',
    message: `Aliado B2B2C «${name}» creado con reparto del ${sharePct} %. Copia la llave secreta ahora (solo se muestra una vez).`,
    apiKeyPlain: rawKey,
  };
}

export async function triggerDailyCronFromAdmin(): Promise<void> {
  await assertAdmin();
  await runDailyRetentionAndOpsJob();
  revalidatePath('/admin');
}

// ---------------------------------------------------------------------------
// Demo: solo un admin real la abre, la reinicia o la siembra. Nadie más.
// ---------------------------------------------------------------------------

/** Abre la demo sobre la sesión del admin: ve la app como la persona o como la tendera de ejemplo. */
export async function openDemoAs(formData: FormData): Promise<void> {
  await assertAdmin();
  const asMerchant = formData.get('role') === 'tendero';
  const ids = await ensureDemoEcosystemSeeded(false);
  await startDemoView(asMerchant ? ids.rosaUserId : ids.marianaUserId);
  revalidatePath('/', 'layout');
  redirect(asMerchant ? '/negocio' : '/app');
}

/** Sale de la demo y vuelve a /admin. Quitar el "ver como" de la propia sesión no necesita permiso. */
export async function exitDemo(): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/entrar');
  await stopDemoView();
  revalidatePath('/', 'layout');
  redirect(isAdmin(ctx.realUser) ? '/admin' : '/app');
}

/** Borra todo lo marcado is_demo y lo vuelve a sembrar. No toca ningún dato real. */
export async function resetDemoData(): Promise<void> {
  await assertAdmin();
  await stopDemoView();
  await ensureDemoEcosystemSeeded(true);
  revalidatePath('/', 'layout');
  redirect('/admin?demo=reiniciada');
}
