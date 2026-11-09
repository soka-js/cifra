'use client';

import {
  CheckCircle2,
  Code2,
  Coffee,
  Layers,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { cop } from '@/lib/format';

type PartnerSkin = 'coffee_wallet' | 'neobank' | 'cooperativa';

interface SkinConfig {
  id: PartnerSkin;
  tabLabel: string;
  brandName: string;
  brandSubtitle: string;
  headerBg: string;
  badgeBg: string;
  availableMinor: number;
  afterActionAvailableMinor: number;
  dailyMinor: number;
  walletBalanceLabel: string;
  walletBalanceBeforeMinor: number;
  walletBalanceAfterMinor: number;
  nbaTitle: string;
  nbaDescription: string;
  nbaCta: string;
  executedBanner: string;
  executedDetail: string;
  webhookJson: string;
  partnerRevenueModel: string;
}

const SKINS: Record<PartnerSkin, SkinConfig> = {
  coffee_wallet: {
    id: 'coffee_wallet',
    tabLabel: '☕ Wallet Retail / Café (Ej. Starbucks)',
    brandName: 'Starbucks Rewards · Bolsillo Inteligente',
    brandSubtitle: 'Powered by CIFRA White-Label Engine',
    headerBg: 'bg-[#1E3932] text-white',
    badgeBg: 'bg-[#D4E9E2] text-[#1E3932]',
    availableMinor: 245_000_00,
    afterActionAvailableMinor: 200_000_00,
    dailyMinor: 27_200_00,
    walletBalanceLabel: 'Saldo Wallet Café',
    walletBalanceBeforeMinor: 18_500_00,
    walletBalanceAfterMinor: 63_500_00,
    nbaTitle: 'Recarga óptima sugerida hoy: $45,000',
    nbaDescription:
      'Según tu disponible seguro de quincena ($1,476,225 libres después de arriendo), puedes recargar tu Wallet para tus 9 cafés de la semana sin afectar tus pagos fijos y sumas +45 Estrellas.',
    nbaCta: 'Recargar $45,000 sin descuadrar mi quincena',
    executedBanner: '¡Recarga inteligente aplicada! +45 Estrellas acreditadas',
    executedDetail:
      'Tu Wallet subió a $63,500 y tu disponible libre quedó en $200,000 con todos tus cobros fijos protegidos.',
    webhookJson: `{ "event": "wallet.topup.safe", "amount_minor": 4500000, "safe_remaining_minor": 20000000, "loyalty_points": 45 }`,
    partnerRevenueModel:
      'Incrementa la frecuencia de recarga preautorizada en +34 % asegurando que el cliente recargue dentro de su disponible real.',
  },
  neobank: {
    id: 'neobank',
    tabLabel: '📱 Billetera Digital (Ej. Nequi / Lulo)',
    brandName: 'Bolsillo Disponible Seguro',
    brandSubtitle: 'Módulo embebido vía SDK CIFRA',
    headerBg: 'bg-[#200020] text-white',
    badgeBg: 'bg-[#FCE7F3] text-[#9D174D]',
    availableMinor: 1_476_225_00,
    afterActionAvailableMinor: 1_459_225_00,
    dailyMinor: 164_025_00,
    walletBalanceLabel: 'Ahorro acumulado en bolsillo',
    walletBalanceBeforeMinor: 40_900_00,
    walletBalanceAfterMinor: 44_400_00,
    nbaTitle: 'Beneficio a 3 cuadras: 15 % menos en tu almuerzo',
    nbaDescription:
      'Detectamos 8 pagos de almuerzo este mes. Paga hoy con tu billetera en Corrientazo Gourmet de tu cuadra y recibe $3,500 de ahorro directo.',
    nbaCta: 'Activar código QR en mi billetera',
    executedBanner: 'Código QR #CIF-NQ-8492 activado para pago en caja',
    executedDetail:
      'Ahorraste $3,500 en tu almuerzo y tu billetera recibió el 30 % de la comisión comercial B2B2C.',
    webhookJson: `{ "event": "offer.redeemed.b2b2c", "code": "CIF-NQ-8492", "user_saved_minor": 350000, "partner_revshare_30pct_minor": 30000 }`,
    partnerRevenueModel:
      'La billetera retiene el 30 % de cada comisión comercial generada y multiplica el uso cotidiano del saldo en comercios.',
  },
  cooperativa: {
    id: 'cooperativa',
    tabLabel: '🤝 Cooperativa / Caja (Ej. Coopfuturo)',
    brandName: 'Bienestar Financiero del Asociado',
    brandSubtitle: 'Marca blanca B2B2C con reparto del 30 %',
    headerBg: 'bg-[#0E6E63] text-white',
    badgeBg: 'bg-[#E1F3F0] text-[#0E6E63]',
    availableMinor: 1_120_000_00,
    afterActionAvailableMinor: 1_120_000_00,
    dailyMinor: 124_400_00,
    walletBalanceLabel: 'Cuota protegida del mes',
    walletBalanceBeforeMinor: 320_000_00,
    walletBalanceAfterMinor: 320_000_00,
    nbaTitle: 'Tu cuota de aporte y crédito ($320,000) ya está protegida',
    nbaDescription:
      'Separamos automáticamente tu cuota del 15 nov para que uses tu disponible con tranquilidad y aproveches descuentos en comercios aliados.',
    nbaCta: 'Blindar cuota y activar pase de descuentos',
    executedBanner: 'Cuota del 15 nov blindada + Pase de Barrio activado',
    executedDetail:
      'Cero riesgo de mora para la cooperativa y acceso activo a 12 comercios aliados alrededor del asociado.',
    webhookJson: `{ "event": "commitment.protected", "installment_minor": 32000000, "due_on": "2026-11-15", "status": "locked_safe" }`,
    partnerRevenueModel:
      'Reduce la mora de cartera de la cooperativa y genera ingresos no financieros por el 30 % del fee comercial.',
  },
};

export function WhiteLabelWalletShowcase() {
  const [activeSkin, setActiveSkin] = useState<PartnerSkin>('coffee_wallet');
  const [executedSkins, setExecutedSkins] = useState<Record<PartnerSkin, boolean>>({
    coffee_wallet: false,
    neobank: false,
    cooperativa: false,
  });

  const skin = SKINS[activeSkin];
  const isExecuted = executedSkins[activeSkin];

  function toggleExecute() {
    setExecutedSkins((prev) => ({
      ...prev,
      [activeSkin]: !prev[activeSkin],
    }));
  }

  return (
    <section
      id="marca-blanca"
      className="my-8 not-prose rounded-3xl border border-line bg-white p-5 shadow-card sm:p-7"
      aria-label="Demostración de Marca Blanca y Wallet Embebida"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="badge-primary">
            <Layers size={12} aria-hidden="true" /> Licencia White-Label / Embedded Finance SDK
          </span>
          <h2 className="mt-2 font-display text-[24px] font-bold tracking-[-0.02em] text-ink">
            CIFRA como Marca Blanca dentro de Wallets de Terceros
          </h2>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">
            Además de nuestra app directa, el motor de CIFRA (disponible seguro + <em>Next Best Action</em> geolocalizado) se integra como componente nativo dentro de wallets de retail (tipo Starbucks), billeteras digitales o cooperativas.
          </p>
        </div>
      </div>

      {/* Selector de Skin */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.values(SKINS) as SkinConfig[]).map((item) => {
          const active = item.id === activeSkin;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSkin(item.id)}
              className={`rounded-xl border px-3.5 py-2 text-[13px] font-bold transition ${
                active
                  ? 'border-ink bg-ink text-white shadow-xs'
                  : 'border-line bg-paper text-ink-muted hover:text-ink'
              }`}
            >
              {item.tabLabel}
            </button>
          );
        })}
      </div>

      {/* Simulador visual del Widget Embebido */}
      <div className="mt-5 grid items-start gap-6 lg:grid-cols-12">
        <div className="overflow-hidden rounded-3xl border border-line bg-paper shadow-md lg:col-span-7">
          <div className={`px-5 py-4 ${skin.headerBg}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-[16px] font-bold">{skin.brandName}</span>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
                Widget Embebido
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] opacity-80">{skin.brandSubtitle}</p>
          </div>

          <div className="space-y-4 p-5">
            {/* fila de saldos del widget */}
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-faint">
                  Disponible libre (fijos ya apartados)
                </p>
                <p className="tnum mt-1 font-display text-[34px] font-extrabold leading-none text-ink transition-all">
                  {cop(isExecuted ? skin.afterActionAvailableMinor : skin.availableMinor)}
                </p>
              </div>
              <div className="text-right">
                <span className={`tnum inline-block rounded-full px-3 py-1 text-[12px] font-bold ${skin.badgeBg}`}>
                  {cop(skin.dailyMinor)}/día libre
                </span>
                <p className="tnum mt-1 text-[12px] font-semibold text-ink-muted">
                  <Wallet size={12} className="mr-1 inline" aria-hidden="true" />
                  {skin.walletBalanceLabel}:{' '}
                  <strong className="text-ink">
                    {cop(isExecuted ? skin.walletBalanceAfterMinor : skin.walletBalanceBeforeMinor)}
                  </strong>
                </p>
              </div>
            </div>

            {/* Tarjeta de Next Best Action Embebida */}
            <div className="rounded-2xl border border-line bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wider text-primary-dark">
                  <Sparkles size={13} aria-hidden="true" />
                  <span>Next Best Action Contextual</span>
                </div>
                {isExecuted && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-900">
                    <CheckCircle2 size={11} aria-hidden="true" /> Ejecutado
                  </span>
                )}
              </div>

              {!isExecuted ? (
                <>
                  <p className="mt-1.5 font-display text-[15px] font-bold text-ink">
                    {skin.nbaTitle}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                    {skin.nbaDescription}
                  </p>
                  <button
                    id="btn-execute-whitelabel-nba"
                    type="button"
                    onClick={toggleExecute}
                    className="mt-3.5 w-full rounded-xl bg-ink px-4 py-2.5 text-[13px] font-bold text-white transition hover:opacity-95"
                  >
                    {skin.nbaCta}
                  </button>
                </>
              ) : (
                <div className="mt-2 space-y-2.5">
                  <div className="rounded-xl bg-primary-pale/70 p-3 text-[12.5px] text-ink-soft">
                    <p className="font-display text-[14px] font-bold text-primary-dark">
                      {skin.executedBanner}
                    </p>
                    <p className="mt-0.5">{skin.executedDetail}</p>
                  </div>

                  <div className="rounded-xl bg-ink p-2.5 font-mono text-[11px] text-emerald-300">
                    <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/60">
                      <Code2 size={11} aria-hidden="true" /> Webhook emitido al aliado B2B2C
                    </div>
                    <div className="overflow-x-auto whitespace-nowrap">{skin.webhookJson}</div>
                  </div>

                  <button
                    type="button"
                    onClick={toggleExecute}
                    className="inline-flex items-center gap-1 text-[12px] font-bold text-ink-muted underline hover:text-ink"
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    <span>Probar de nuevo</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Explicación comercial para el aliado B2B2C */}
        <div className="space-y-3.5 lg:col-span-5">
          <div className="rounded-2xl border border-line bg-paper/70 p-4">
            <div className="flex items-center gap-2 text-primary-dark">
              <Coffee size={17} aria-hidden="true" />
              <h3 className="font-display text-[15px] font-bold text-ink">
                ¿Por qué las Wallets integran CIFRA?
              </h3>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
              {skin.partnerRevenueModel}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-paper/70 p-4">
            <div className="flex items-center gap-2 text-primary-dark">
              <ShieldCheck size={17} aria-hidden="true" />
              <h3 className="font-display text-[15px] font-bold text-ink">
                Despliegue en 1 tarde (Headless API o WebView)
              </h3>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
              La entidad envía los saldos y movimientos por el endpoint idempotente <code>/api/v1/members</code> y recibe el JSON de la cifra calculada o el enlace firmado <code>/e/[token]</code> con los colores de su propia marca.
            </p>
          </div>

          <div className="rounded-2xl border border-primary/25 bg-primary-pale/55 p-4 text-[13px]">
            <div className="flex items-center gap-2 font-bold text-primary-dark">
              <Users size={16} aria-hidden="true" />
              <span>Reparto automático 70 / 30 en el libro mayor</span>
            </div>
            <p className="mt-1 text-ink-soft">
              Por cada compra atribuida en la red de comercios, el aliado B2B2C recibe el <strong>30 % de la comisión</strong> liquidado automáticamente al cierre de quincena.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
