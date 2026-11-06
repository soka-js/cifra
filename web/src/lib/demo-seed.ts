import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { hashPassword } from './auth/password';
import { randomToken, sha256 } from './crypto';
import { db } from './db';
import {
  accessLog,
  accounts,
  commitments,
  cycleSnapshots,
  dataSources,
  merchantInvoices,
  merchantMembers,
  merchantPayments,
  merchants,
  notifications,
  offerCodes,
  offers,
  partners,
  recurringMarks,
  redemptions,
  savingsEvents,
  transactions,
  users,
} from './db/schema';
import { computeRedemptionSplit } from './engine/attribution';
import { addDays, todayInBogota } from './engine/dates';
import { CONSENT_VERSION } from './format';
import { syncMerchantInvoice } from './merchant-data';

export const DEMO_PERSONA_EMAIL = 'mariana.demo@cifra.co';
export const DEMO_ROSA_EMAIL = 'rosa.demo@cifra.co';
export const DEMO_ALLY_MEMBER_EMAIL = 'andres.demo@cifra.co';
export const DEMO_PRIMARY_MERCHANT_SLUG = 'demo-panaderia-la-espiga';

export interface DemoIds {
  marianaUserId: string;
  rosaUserId: string;
  espigaMerchantId: string;
  samplePendingCode: string;
}

/**
 * Siembra de manera idempotente el ecosistema piloto de demostración en Bogotá
 * (Chapinero / Teusaquillo / Las Aguas) completamente marcado con is_demo = true.
 */
export async function ensureDemoEcosystemSeeded(forceReset = false): Promise<DemoIds> {
  if (forceReset) {
    const demoUsers = await db.select({ id: users.id }).from(users).where(eq(users.isDemo, true));
    if (demoUsers.length > 0) {
      await db.delete(users).where(
        inArray(
          users.id,
          demoUsers.map((u) => u.id),
        ),
      );
    }
    await db.delete(merchants).where(eq(merchants.isDemo, true));
    await db.delete(partners).where(eq(partners.isDemo, true));
  }

  const [existingMariana] = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_PERSONA_EMAIL))
    .limit(1);
  const [existingRosa] = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_ROSA_EMAIL))
    .limit(1);
  const [existingEspiga] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.slug, DEMO_PRIMARY_MERCHANT_SLUG))
    .limit(1);

  if (existingMariana && existingRosa && existingEspiga) {
    const [existingCamila] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'camila.demo@cifra.co'))
      .limit(1);
    // Asegurar que exista siempre un código fresco listo para probar en Caja durante el pitch
    const samplePendingCode = await ensureFreshDemoPosCode(
      existingEspiga.id,
      existingCamila?.id ?? existingMariana.id,
    );
    return {
      marianaUserId: existingMariana.id,
      rosaUserId: existingRosa.id,
      espigaMerchantId: existingEspiga.id,
      samplePendingCode,
    };
  }

  const today = todayInBogota();
  const now = new Date();
  const demoPassHash = await hashPassword('CifraDemo2026!');

  // 1. Aliado B2B2C: Cooperativa Coopfuturo (reparto 30 %)
  const [coopfuturo] = await db
    .insert(partners)
    .values({
      name: 'Cooperativa Coopfuturo',
      slug: 'demo-coopfuturo',
      revenueShareBps: 3000,
      contactEmail: 'innovacion@coopfuturo.coop',
      active: true,
      isDemo: true,
    })
    .onConflictDoUpdate({
      target: partners.slug,
      set: { active: true, isDemo: true },
    })
    .returning();

  // 2. Usuarios Demo (con tiempos de primera cifra < 5 min y actividad realista)
  const created195dAgo = new Date(now.getTime() - 195 * 86_400_000);
  const firstCifraFast = new Date(created195dAgo.getTime() + 118 * 1000); // 1 min 58 s (< 5 min!)

  const [mariana] = await db
    .insert(users)
    .values({
      email: DEMO_PERSONA_EMAIL,
      passwordHash: demoPassHash,
      name: 'Mariana Rojas',
      isDemo: true,
      incomeFrequency: 'quincenal',
      incomeDays: [15, 30],
      bufferMinor: 80_000_00,
      zoneSlug: 'chapinero',
      lat: 4.6432,
      lng: -74.0631,
      consentVersion: CONSENT_VERSION,
      consentAt: created195dAgo,
      onboardedAt: created195dAgo,
      firstCifraAt: firstCifraFast,
      lastActiveAt: now,
      createdAt: created195dAgo,
    })
    .returning();

  const [rosa] = await db
    .insert(users)
    .values({
      email: DEMO_ROSA_EMAIL,
      passwordHash: demoPassHash,
      name: 'Rosa Martínez',
      isDemo: true,
      zoneSlug: 'chapinero',
      lat: 4.6448,
      lng: -74.0622,
      consentVersion: CONSENT_VERSION,
      consentAt: created195dAgo,
      onboardedAt: created195dAgo,
      firstCifraAt: new Date(created195dAgo.getTime() + 145 * 1000),
      lastActiveAt: now,
      createdAt: created195dAgo,
    })
    .returning();

  const [andres] = await db
    .insert(users)
    .values({
      email: DEMO_ALLY_MEMBER_EMAIL,
      passwordHash: demoPassHash,
      name: 'Andrés Gómez',
      isDemo: true,
      partnerId: coopfuturo!.id,
      partnerMemberId: 'CF-88412',
      incomeFrequency: 'mensual',
      incomeDays: [30],
      zoneSlug: 'las-aguas',
      lat: 4.6035,
      lng: -74.0668,
      consentVersion: CONSENT_VERSION,
      consentAt: created195dAgo,
      onboardedAt: created195dAgo,
      firstCifraAt: new Date(created195dAgo.getTime() + 92 * 1000),
      lastActiveAt: now,
      createdAt: created195dAgo,
    })
    .returning();

  const [camila] = await db
    .insert(users)
    .values({
      email: 'camila.demo@cifra.co',
      passwordHash: demoPassHash,
      name: 'Camila Pardo',
      isDemo: true,
      incomeFrequency: 'mensual',
      incomeDays: [30],
      zoneSlug: 'teusaquillo',
      lat: 4.6312,
      lng: -74.0742,
      consentVersion: CONSENT_VERSION,
      consentAt: created195dAgo,
      onboardedAt: created195dAgo,
      firstCifraAt: new Date(created195dAgo.getTime() + 165 * 1000),
      lastActiveAt: now,
      createdAt: created195dAgo,
    })
    .returning();

  // 3. Extracto realista de 75 días para Mariana (Bancolombia Ahorros + Nequi)
  const [bancolombiaSrc] = await db
    .insert(dataSources)
    .values({
      userId: mariana!.id,
      kind: 'extracto',
      entityName: 'Bancolombia',
      scopes: ['saldos', 'movimientos'],
      status: 'activa',
      coverageFrom: addDays(today, -75),
      coverageTo: today,
      lastSyncAt: now,
    })
    .returning();

  const [savingsAcct] = await db
    .insert(accounts)
    .values({
      userId: mariana!.id,
      sourceId: bancolombiaSrc!.id,
      kind: 'ahorros',
      name: 'Ahorros Nómina Bancolombia',
      mask: '4821',
      balanceMinor: 1_960_000_00,
      balanceAt: now,
      includeInCifra: true,
    })
    .returning();

  const txSeeds: Array<{ daysAgo: number; desc: string; minor: number }> = [
    // Ingresos quincenales
    { daysAgo: 62, desc: 'ABONO PAGO NOMINA ESTUDIO CREATIVO SAS', minor: 2_650_000_00 },
    { daysAgo: 47, desc: 'ABONO PAGO NOMINA ESTUDIO CREATIVO SAS', minor: 2_650_000_00 },
    { daysAgo: 32, desc: 'ABONO PAGO NOMINA ESTUDIO CREATIVO SAS', minor: 2_650_000_00 },
    { daysAgo: 17, desc: 'ABONO PAGO NOMINA ESTUDIO CREATIVO SAS', minor: 2_650_000_00 },
    { daysAgo: 3, desc: 'ABONO PAGO NOMINA ESTUDIO CREATIVO SAS', minor: 2_650_000_00 },

    // Cobros fijos y recurrentes (para que detectRecurring encuentre series claras con histórico)
    { daysAgo: 61, desc: 'TRANSFERENCIA ARRIENDO APTO CHAPINERO', minor: -1_350_000_00 },
    { daysAgo: 31, desc: 'TRANSFERENCIA ARRIENDO APTO CHAPINERO', minor: -1_350_000_00 },
    { daysAgo: 1, desc: 'TRANSFERENCIA ARRIENDO APTO CHAPINERO', minor: -1_350_000_00 },

    { daysAgo: 68, desc: 'COMPRA INTL NETFLIX.COM', minor: -26_900_00 },
    { daysAgo: 38, desc: 'COMPRA INTL NETFLIX.COM', minor: -26_900_00 },
    { daysAgo: 8, desc: 'COMPRA INTL NETFLIX.COM', minor: -26_900_00 },

    { daysAgo: 66, desc: 'SPOTIFY COLOMBIA', minor: -16_900_00 },
    { daysAgo: 36, desc: 'SPOTIFY COLOMBIA', minor: -16_900_00 },
    { daysAgo: 6, desc: 'SPOTIFY COLOMBIA', minor: -16_900_00 },

    { daysAgo: 64, desc: 'DEBITO AUTOMATICO SMART FIT COLOMBIA', minor: -89_900_00 },
    { daysAgo: 34, desc: 'DEBITO AUTOMATICO SMART FIT COLOMBIA', minor: -89_900_00 },
    { daysAgo: 4, desc: 'DEBITO AUTOMATICO SMART FIT COLOMBIA', minor: -89_900_00 },

    { daysAgo: 65, desc: 'SUSCRIPCION DISNEY PLUS', minor: -34_900_00 },
    { daysAgo: 35, desc: 'SUSCRIPCION DISNEY PLUS', minor: -34_900_00 },

    { daysAgo: 55, desc: 'PSE FACTURA ENEL CODENSA', minor: -94_500_00 },
    { daysAgo: 25, desc: 'PSE FACTURA ENEL CODENSA', minor: -98_200_00 },

    { daysAgo: 52, desc: 'FACTURA CLARO SOLUCIONES MOVILES', minor: -49_900_00 },
    { daysAgo: 22, desc: 'FACTURA CLARO SOLUCIONES MOVILES', minor: -49_900_00 },

    // Día a día realista + gastos hormiga (Juan Valdez / Rappi / Uber)
    { daysAgo: 28, desc: 'COMPRA TIENDAS D1 CHAPINERO', minor: -78_400_00 },
    { daysAgo: 24, desc: 'COMPRA EN JUAN VALDEZ CAFE CALLE 57', minor: -14_800_00 },
    { daysAgo: 21, desc: 'COMPRA RAPPI RESTAURANTES', minor: -24_500_00 },
    { daysAgo: 19, desc: 'COMPRA TIENDAS ARA CALLE 63', minor: -64_200_00 },
    { daysAgo: 18, desc: 'COMPRA EN JUAN VALDEZ CAFE CALLE 57', minor: -15_900_00 },
    { daysAgo: 15, desc: 'RECARGA TULLAVE TRANSMILENIO', minor: -30_000_00 },
    { daysAgo: 14, desc: 'COMPRA RAPPI RESTAURANTES', minor: -22_900_00 },
    { daysAgo: 12, desc: 'COMPRA EN JUAN VALDEZ CAFE CALLE 57', minor: -16_200_00 },
    { daysAgo: 11, desc: 'UBER TRIP BOGOTA', minor: -18_400_00 },
    { daysAgo: 9, desc: 'COMPRA TIENDAS D1 CHAPINERO', minor: -82_100_00 },
    { daysAgo: 7, desc: 'COMPRA RAPPI RESTAURANTES', minor: -26_800_00 },
    { daysAgo: 5, desc: 'COMPRA EN JUAN VALDEZ CAFE CALLE 57', minor: -14_500_00 },
    { daysAgo: 4, desc: 'CRUZ VERDE CHAPINERO', minor: -32_000_00 },
    { daysAgo: 2, desc: 'UBER TRIP BOGOTA', minor: -19_600_00 },
  ];

  await db.insert(transactions).values(
    txSeeds.map((t, idx) => ({
      userId: mariana!.id,
      accountId: savingsAcct!.id,
      postedOn: addDays(today, -t.daysAgo),
      description: t.desc,
      amountMinor: t.minor,
      dedupeKey: `demo-mariana-${idx}`,
    })),
  );

  // Extracto de Andrés (para evidenciar retorno orgánico sin descuento a Panadería La Espiga!)
  const [andresSrc] = await db
    .insert(dataSources)
    .values({
      userId: andres!.id,
      kind: 'entidad_aliada',
      entityName: 'Cooperativa Coopfuturo',
      partnerId: coopfuturo!.id,
      scopes: ['saldos', 'movimientos'],
      status: 'activa',
      lastSyncAt: now,
    })
    .returning();

  const [andresAcct] = await db
    .insert(accounts)
    .values({
      userId: andres!.id,
      sourceId: andresSrc!.id,
      kind: 'ahorros',
      name: 'Ahorro Social Coopfuturo',
      mask: '9912',
      balanceMinor: 1_450_000_00,
      balanceAt: now,
      includeInCifra: true,
    })
    .returning();

  const monthStartStr = `${today.slice(0, 7)}-01`;
  const clampToMonth = (daysAgo: number): string => {
    const d = addDays(today, -daysAgo);
    return d < monthStartStr ? monthStartStr : d;
  };

  // Andrés conoció Panadería La Espiga con oferta a inicios de mes y volvió a precio normal después
  await db.insert(transactions).values([
    {
      userId: andres!.id,
      accountId: andresAcct!.id,
      postedOn: clampToMonth(2),
      description: 'COMPRA BOLD PANADERIA LA ESPIGA',
      amountMinor: -24_000_00,
      dedupeKey: 'demo-andres-org-1',
    },
    {
      userId: andres!.id,
      accountId: andresAcct!.id,
      postedOn: today,
      description: 'COMPRA BOLD PANADERIA LA ESPIGA',
      amountMinor: -19_500_00,
      dedupeKey: 'demo-andres-org-2',
    },
    {
      userId: camila!.id,
      accountId: andresAcct!.id,
      postedOn: clampToMonth(1),
      description: 'COMPRA BOLD PANADERIA LA ESPIGA',
      amountMinor: -22_000_00,
      dedupeKey: 'demo-camila-org-1',
    },
  ]);

  // Marca de cobro cancelado en Mariana (Disney+) + ahorro verificado + cierre de ciclo previo
  await db.insert(recurringMarks).values({
    userId: mariana!.id,
    merchantKey: 'disney_plus',
    mark: 'no_lo_uso',
    cancelledAt: new Date(`${clampToMonth(3)}T14:00:00-05:00`),
    savedMonthlyMinor: 34_900_00,
  });

  await db.insert(savingsEvents).values({
    userId: mariana!.id,
    kind: 'cobro_cancelado',
    amountMinor: 34_900_00,
    referenceKey: 'disney_plus',
    label: 'Suscripción cancelada: Disney+',
    occurredOn: clampToMonth(3),
  });

  await db.insert(commitments).values({
    userId: mariana!.id,
    name: 'Cuota curso de inglés',
    amountMinor: 140_000_00,
    dayOfMonth: 22,
  });

  await db.insert(cycleSnapshots).values({
    userId: mariana!.id,
    cycleStart: addDays(today, -33),
    cycleEnd: addDays(today, -18),
    incomeMinor: 2_650_000_00,
    fixedMinor: 1_533_600_00,
    variableMinor: 612_000_00,
    savedMinor: 34_900_00,
    closingAvailableMinor: 504_400_00,
    topCategories: [
      { category: 'servicios_hogar', amountMinor: 1_492_700_00 },
      { category: 'mercado', amountMinor: 224_700_00 },
      { category: 'comida', amountMinor: 162_500_00 },
    ],
    committedAction: 'Bajar de 4 a 2 pedidos de domicilio por quincena y aprovechar cafés del barrio.',
  });

  await db.insert(accessLog).values({
    userId: mariana!.id,
    actor: 'Mariana Rojas',
    action: 'Importó extracto Bancolombia (38 movimientos leídos en el dispositivo)',
    detail: { entidad: 'Bancolombia' },
  });

  // 4. Cinco micronegocios independientes de barrio en Bogotá
  const [laEspiga, cafeAguas, fruverParque, papeleriaSeptima, drogueriaPalermo] = await db
    .insert(merchants)
    .values([
      {
        slug: DEMO_PRIMARY_MERCHANT_SLUG,
        name: 'Panadería La Espiga',
        businessCategory: 'panaderia',
        targetSpendCategory: 'comida',
        description: 'Pan de masa madre horneado cada mañana, almojábanas calientes y café de origen huilense.',
        ownerName: 'Rosa Martínez',
        whatsapp: '3105550192',
        email: DEMO_ROSA_EMAIL,
        address: 'Cra 9 # 58-14',
        neighborhood: 'Chapinero Central',
        zoneSlug: 'chapinero',
        lat: 4.6448,
        lng: -74.0622,
        hoursText: 'Lun a Sáb 6:30 a. m. – 8:00 p. m.',
        typicalTicketMinor: 20_000_00,
        commissionBps: 500,
        matchKeywords: ['PANADERIA LA ESPIGA', 'BOLD LA ESPIGA'],
        brebKey: '@laespiga58',
        nequiNumber: '3105550192',
        stage: 'con_oferta',
        acquiredBy: 'Promotor calle Chapinero',
        activatedAt: created195dAgo,
        isDemo: true,
      },
      {
        slug: 'demo-cafe-las-aguas',
        name: 'Café Tostión Las Aguas',
        businessCategory: 'cafeteria',
        targetSpendCategory: 'comida',
        description: 'Café filtrado, tortas caseras y mesas tranquilas a dos cuadras del eje universitario.',
        ownerName: 'Don Hernando Ruiz',
        whatsapp: '3155550148',
        address: 'Calle 19 # 3-28',
        neighborhood: 'Las Aguas',
        zoneSlug: 'las-aguas',
        lat: 4.6031,
        lng: -74.0669,
        hoursText: 'Lun a Vie 7:00 a. m. – 7:00 p. m.',
        typicalTicketMinor: 16_000_00,
        commissionBps: 500,
        matchKeywords: ['CAFE TOSTION LAS AGUAS'],
        brebKey: '@tostionaguas',
        stage: 'con_oferta',
        acquiredBy: 'Promotor calle Centro',
        activatedAt: created195dAgo,
        isDemo: true,
      },
      {
        slug: 'demo-fruver-el-parque',
        name: 'Fruver El Parque',
        businessCategory: 'fruver',
        targetSpendCategory: 'mercado',
        description: 'Fruta fresca de Corabastos todas las mañanas, aguacate Hass y verdura limpia.',
        ownerName: 'Luz Dary Gómez',
        whatsapp: '3125550174',
        address: 'Cra 24 # 39B-18',
        neighborhood: 'Parkway · La Soledad',
        zoneSlug: 'teusaquillo',
        lat: 4.6309,
        lng: -74.0745,
        hoursText: 'Todos los días 7:00 a. m. – 8:30 p. m.',
        typicalTicketMinor: 32_000_00,
        commissionBps: 500,
        matchKeywords: ['FRUVER EL PARQUE'],
        brebKey: '@fruverparque',
        stage: 'con_oferta',
        acquiredBy: 'Promotor calle Parkway',
        activatedAt: created195dAgo,
        isDemo: true,
      },
      {
        slug: 'demo-papeleria-septima',
        name: 'Papelería y Arte Séptima',
        businessCategory: 'papeleria',
        targetSpendCategory: 'educacion',
        description: 'Impresión láser, bitácoras cosidas e insumos de diseño y oficina.',
        ownerName: 'Jorge Enrique Mora',
        whatsapp: '3185550111',
        address: 'Cra 7 # 54-32',
        neighborhood: 'Chapinero',
        zoneSlug: 'chapinero',
        lat: 4.6411,
        lng: -74.0618,
        hoursText: 'Lun a Sáb 8:00 a. m. – 7:30 p. m.',
        typicalTicketMinor: 18_000_00,
        commissionBps: 500,
        matchKeywords: ['PAPELERIA SEPTIMA'],
        stage: 'con_oferta',
        acquiredBy: 'Autoregistro web',
        activatedAt: created195dAgo,
        isDemo: true,
      },
      {
        slug: 'demo-drogueria-palermo',
        name: 'Droguería Independiente Palermo',
        businessCategory: 'drogueria',
        targetSpendCategory: 'salud',
        description: 'Atención farmacéutica de confianza, dermocosmética y domicilio en el barrio.',
        ownerName: 'Patricia Bernal',
        whatsapp: '3145550163',
        address: 'Calle 45 # 19-10',
        neighborhood: 'Palermo',
        zoneSlug: 'teusaquillo',
        lat: 4.6348,
        lng: -74.0702,
        hoursText: 'Lun a Dom 7:30 a. m. – 9:30 p. m.',
        typicalTicketMinor: 28_000_00,
        commissionBps: 500,
        matchKeywords: ['DROGUERIA PALERMO'],
        stage: 'con_oferta',
        acquiredBy: 'Promotor calle Palermo',
        activatedAt: created195dAgo,
        isDemo: true,
      },
    ])
    .returning();

  await db.insert(merchantMembers).values({
    merchantId: laEspiga!.id,
    userId: rosa!.id,
    role: 'owner',
  });

  // 5. Campañas previas y renovadas (para evidenciar renovación > 50 % en Data Room!)
  const [prevEspigaOffer, prevFruverOffer, prevCafeOffer] = await db
    .insert(offers)
    .values([
      {
        merchantId: laEspiga!.id,
        title: '10 % de bienvenida en pan de masa madre y cafés',
        description: 'Muestra tu código en caja en tu primera visita.',
        targetCategory: 'comida',
        discountKind: 'percent',
        discountPercent: 10,
        minPurchaseMinor: 10_000_00,
        newCustomersOnly: true,
        validFrom: addDays(today, -45),
        validUntil: addDays(today, -15),
        status: 'vencida',
      },
      {
        merchantId: fruverParque!.id,
        title: '$4.000 de descuento en mercado de fruta y verdura',
        description: 'Aplica en compras desde $25.000 para vecinos nuevos.',
        targetCategory: 'mercado',
        discountKind: 'fixed',
        discountFixedMinor: 4_000_00,
        minPurchaseMinor: 25_000_00,
        newCustomersOnly: true,
        validFrom: addDays(today, -45),
        validUntil: addDays(today, -15),
        status: 'vencida',
      },
      {
        merchantId: cafeAguas!.id,
        title: '15 % en tardes de café filtrado y torta artesanal',
        description: 'De lunes a viernes entre 2:00 p. m. y 6:00 p. m.',
        targetCategory: 'comida',
        discountKind: 'percent',
        discountPercent: 15,
        minPurchaseMinor: 12_000_00,
        newCustomersOnly: true,
        validFrom: addDays(today, -40),
        validUntil: addDays(today, -10),
        status: 'vencida',
      },
    ])
    .returning();

  const [activeEspigaOffer, activeCafeOffer, activeFruverOffer] = await db
    .insert(offers)
    .values([
      {
        merchantId: laEspiga!.id,
        title: '10 % de descuento en panadería de masa madre y café',
        description: 'Recién salido del horno en Chapinero Central. Solo muestra las 6 letras en caja.',
        targetCategory: 'comida',
        discountKind: 'percent',
        discountPercent: 10,
        minPurchaseMinor: 10_000_00,
        newCustomersOnly: true,
        monthlyCapRedemptions: 60,
        validFrom: addDays(today, -14),
        validUntil: addDays(today, 25),
        status: 'activa',
        renewedFromOfferId: prevEspigaOffer!.id,
      },
      {
        merchantId: cafeAguas!.id,
        title: '15 % en tardes de café de origen y pastelería',
        description: 'Ideal para trabajar o estudiar tranquilo en Las Aguas.',
        targetCategory: 'comida',
        discountKind: 'percent',
        discountPercent: 15,
        minPurchaseMinor: 12_000_00,
        newCustomersOnly: true,
        monthlyCapRedemptions: 50,
        validFrom: addDays(today, -9),
        validUntil: addDays(today, 25),
        activeHoursText: '2:00 p. m. – 6:00 p. m.',
        status: 'activa',
        renewedFromOfferId: prevCafeOffer!.id,
      },
      {
        merchantId: fruverParque!.id,
        title: '$4.000 de descuento en canasta fresca desde $25.000',
        description: 'Fruta seleccionada del día en el Parkway.',
        targetCategory: 'mercado',
        discountKind: 'fixed',
        discountFixedMinor: 4_000_00,
        minPurchaseMinor: 25_000_00,
        newCustomersOnly: true,
        monthlyCapRedemptions: 80,
        validFrom: addDays(today, -14),
        validUntil: addDays(today, 25),
        status: 'activa',
        renewedFromOfferId: prevFruverOffer!.id,
      },
      {
        merchantId: papeleriaSeptima!.id,
        title: '12 % de descuento en bitácoras, arte e impresión',
        description: 'Para estudiantes y estudios creativos de Chapinero.',
        targetCategory: 'educacion',
        discountKind: 'percent',
        discountPercent: 12,
        minPurchaseMinor: 15_000_00,
        newCustomersOnly: true,
        validFrom: addDays(today, -7),
        validUntil: addDays(today, 25),
        status: 'activa',
      },
      {
        merchantId: drogueriaPalermo!.id,
        title: '10 % en cuidado personal y bienestar',
        description: 'Atención independiente en el corazón de Palermo.',
        targetCategory: 'salud',
        discountKind: 'percent',
        discountPercent: 10,
        minPurchaseMinor: 20_000_00,
        newCustomersOnly: true,
        validFrom: addDays(today, -7),
        validUntil: addDays(today, 25),
        status: 'activa',
      },
    ])
    .returning();

  // 6. Redenciones atribuidas reales en el mes (incluyendo canal propio y canal aliado B2B2C Coopfuturo)
  const historicSales: Array<{
    userId: string;
    merchantId: string;
    offerId: string;
    grossMinor: number;
    pct: number | null;
    fixedMinor: number | null;
    channel: 'propio' | 'aliado';
    partnerId: string | null;
    daysAgo: number;
    confirmed: boolean;
  }> = [
    // Andrés (vía Coopfuturo) conoció Panadería La Espiga este mes ($20.000 exacto como en G.10!)
    {
      userId: andres!.id,
      merchantId: laEspiga!.id,
      offerId: activeEspigaOffer!.id,
      grossMinor: 20_000_00,
      pct: 10,
      fixedMinor: null,
      channel: 'aliado',
      partnerId: coopfuturo!.id,
      daysAgo: 4,
      confirmed: true,
    },
    // Camila conoció Panadería La Espiga este mes
    {
      userId: camila!.id,
      merchantId: laEspiga!.id,
      offerId: activeEspigaOffer!.id,
      grossMinor: 28_000_00,
      pct: 10,
      fixedMinor: null,
      channel: 'propio',
      partnerId: null,
      daysAgo: 3,
      confirmed: true,
    },
    // Mariana redimió en Fruver El Parque este mes (para que Panadería La Espiga siga 100 % elegible como 1ra visita para Mariana!)
    {
      userId: mariana!.id,
      merchantId: fruverParque!.id,
      offerId: activeFruverOffer!.id,
      grossMinor: 34_000_00,
      pct: null,
      fixedMinor: 4_000_00,
      channel: 'propio',
      partnerId: null,
      daysAgo: 2,
      confirmed: false,
    },
    // Andrés también redimió en Café Las Aguas
    {
      userId: andres!.id,
      merchantId: cafeAguas!.id,
      offerId: activeCafeOffer!.id,
      grossMinor: 18_000_00,
      pct: 15,
      fixedMinor: null,
      channel: 'aliado',
      partnerId: coopfuturo!.id,
      daysAgo: 1,
      confirmed: true,
    },
  ];

  for (let i = 0; i < historicSales.length; i++) {
    const s = historicSales[i]!;
    const occurredOn = clampToMonth(s.daysAgo);
    const candidateRedeemedTs = new Date(`${occurredOn}T11:30:00-05:00`).getTime();
    const redeemedAt = new Date(Math.min(candidateRedeemedTs, now.getTime() - 1_800_000));
    const split = computeRedemptionSplit({
      grossAmountMinor: s.grossMinor,
      discountKind: s.pct ? 'percent' : 'fixed',
      discountPercent: s.pct,
      discountFixedMinor: s.fixedMinor,
      commissionBps: 500,
      channel: s.channel,
      partnerShareBps: s.channel === 'aliado' ? 3000 : 0,
    });

    const [codeRow] = await db
      .insert(offerCodes)
      .values({
        offerId: s.offerId,
        merchantId: s.merchantId,
        userId: s.userId,
        code: `DM${240 + i}K`,
        qrToken: randomToken(16),
        wasNewCustomer: true,
        channel: s.channel,
        partnerId: s.partnerId,
        status: 'redimido',
        expiresAt: redeemedAt,
        redeemedAt,
      })
      .returning();

    const [red] = await db
      .insert(redemptions)
      .values({
        offerCodeId: codeRow!.id,
        offerId: s.offerId,
        merchantId: s.merchantId,
        userId: s.userId,
        validatedByUserId: rosa!.id,
        channel: s.channel,
        partnerId: s.partnerId,
        grossAmountMinor: split.grossAmountMinor,
        discountMinor: split.discountMinor,
        netPaidByUserMinor: split.netPaidByUserMinor,
        commissionBps: 500,
        cifraCommissionMinor: split.cifraCommissionMinor,
        partnerShareMinor: split.partnerShareMinor,
        cifraNetRevenueMinor: split.cifraNetRevenueMinor,
        merchantNetKeepMinor: split.merchantNetKeepMinor,
        isNewCustomer: true,
        userConfirmedAt: s.confirmed ? redeemedAt : null,
        status: 'valida',
        redeemedAt,
      })
      .returning();

    await db
      .insert(savingsEvents)
      .values({
        userId: s.userId,
        kind: 'oferta_redimida',
        amountMinor: split.discountMinor,
        referenceKey: red!.id,
        label: s.merchantId === fruverParque!.id ? 'Descuento en Fruver El Parque' : 'Descuento en comercio de barrio',
        occurredOn,
      })
      .onConflictDoNothing();
  }

  // Sincronizar estados de cuenta de los comercios demo
  await syncMerchantInvoice(laEspiga!.id);
  await syncMerchantInvoice(fruverParque!.id);
  await syncMerchantInvoice(cafeAguas!.id);

  // Avisos útiles en el buzón de Mariana
  await db.insert(notifications).values([
    {
      userId: mariana!.id,
      kind: 'redencion_confirmada',
      title: 'Ahorraste $4.000 en Fruver El Parque',
      body: 'Pagaste $30.000 en vez de $34.000. Puedes confirmar en Ofertas que recibiste el beneficio.',
      actionUrl: '/app/ofertas#recientes',
      dedupeKey: 'demo-notif-redeem',
    },
    {
      userId: mariana!.id,
      kind: 'cobro_recurrente',
      title: 'Disney+ marcado como «No lo uso» ($34.900/mes)',
      body: 'Ya sumamos este ahorro mensual verificado a tu contador de pesos ahorrados con CIFRA.',
      actionUrl: '/app/cobros',
      dedupeKey: 'demo-notif-cancel',
      readAt: now,
    },
  ]);

  const samplePendingCode = await ensureFreshDemoPosCode(laEspiga!.id, camila!.id);

  return {
    marianaUserId: mariana!.id,
    rosaUserId: rosa!.id,
    espigaMerchantId: laEspiga!.id,
    samplePendingCode,
  };
}

async function ensureFreshDemoPosCode(merchantId: string, customerUserId: string): Promise<string> {
  const DEMO_POS_CODE = 'ESPIGA';
  const [activeOffer] = await db
    .select()
    .from(offers)
    .where(and(eq(offers.merchantId, merchantId), eq(offers.status, 'activa')))
    .limit(1);

  if (!activeOffer) return DEMO_POS_CODE;

  const [existing] = await db
    .select()
    .from(offerCodes)
    .where(and(eq(offerCodes.merchantId, merchantId), eq(offerCodes.code, DEMO_POS_CODE)))
    .limit(1);

  const expiresIn24h = new Date(Date.now() + 24 * 3600_000);
  if (!existing) {
    await db.insert(offerCodes).values({
      offerId: activeOffer.id,
      merchantId,
      userId: customerUserId,
      code: DEMO_POS_CODE,
      qrToken: sha256(`demo-pos-${Date.now()}`).slice(0, 24),
      wasNewCustomer: true,
      channel: 'propio',
      status: 'pendiente',
      expiresAt: expiresIn24h,
    });
  } else if (existing.status !== 'pendiente' || existing.expiresAt <= new Date()) {
    // Si ya se redimió en un ensayo previo, crea un código nuevo con sufijo limpio o reactiva si no tiene redención
    const [hasRedemption] = await db
      .select({ id: redemptions.id })
      .from(redemptions)
      .where(eq(redemptions.offerCodeId, existing.id))
      .limit(1);

    if (!hasRedemption) {
      await db
        .update(offerCodes)
        .set({ status: 'pendiente', expiresAt: expiresIn24h })
        .where(eq(offerCodes.id, existing.id));
    } else {
      const freshCode = 'PAN10K';
      const [second] = await db
        .select()
        .from(offerCodes)
        .where(and(eq(offerCodes.merchantId, merchantId), eq(offerCodes.code, freshCode), eq(offerCodes.status, 'pendiente')))
        .limit(1);
      if (!second) {
        await db.insert(offerCodes).values({
          offerId: activeOffer.id,
          merchantId,
          userId: customerUserId,
          code: freshCode,
          qrToken: randomToken(16),
          wasNewCustomer: true,
          channel: 'propio',
          status: 'pendiente',
          expiresAt: expiresIn24h,
        });
      }
      return freshCode;
    }
  }
  return DEMO_POS_CODE;
}
