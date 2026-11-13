import { and, desc, eq, sql } from 'drizzle-orm';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  LineChart,
  Lock,
  Play,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { requireAdmin } from '@/lib/auth/session';
import { loadFairFunnel } from '@/lib/analytics/fair-funnel';
import { bogotaDate } from '@/lib/data';
import { db } from '@/lib/db';
import {
  leads,
  merchantCatalog,
  merchantInvoices,
  merchantPayments,
  merchants,
  offers,
  partnerApiKeys,
  partners,
  redemptions,
  users,
} from '@/lib/db/schema';
import { cop, shortDate } from '@/lib/format';
import { currentPeriodMonth, formatPeriodMonth } from '@/lib/merchant-data';
import {
  adminModerateOffer,
  closeMonthInvoices,
  openDemoAs,
  promoteCatalogRule,
  resetDemoData,
  resolveRedemptionDispute,
  reviewMerchantPayment,
  triggerDailyCronFromAdmin,
} from './actions';
import { CreatePartnerForm, ReissueInviteButton, StreetMerchantCrmForm } from './admin-forms';
import { FairFunnelSection } from './fair-funnel-section';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Data Room y Operación · CIFRA', robots: { index: false } };

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1).replace('.', ',')} %` : 'sin datos');

function twoProportionP(x1: number, n1: number, x2: number, n2: number): number | null {
  if (n1 < 1 || n2 < 1) return null;
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return null;
  const z = Math.abs(x1 / n1 - x2 / n2) / se;
  const t = 1 / (1 + 0.3275911 * (z / Math.SQRT2));
  const erf =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) *
      Math.exp(-(z * z) / 2);
  return 1 - erf;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // Solo un admin real (correo en ADMIN_EMAILS, verificado). Sin sesión redirige; sin permiso, 404.
  await requireAdmin();
  const realAdmin = true;
  const sp = await searchParams;

  const tab = ['dataroom', 'negocios', 'conciliacion', 'aliados'].includes(sp.tab ?? '')
    ? (sp.tab as 'dataroom' | 'negocios' | 'conciliacion' | 'aliados')
    : 'dataroom';

  // Por defecto, solo datos reales: una cifra de la demo nunca debe pasar por real.
  const scope: 'reales' | 'demo' | 'todo' =
    sp.alcance === 'demo' ? 'demo' : sp.alcance === 'todo' ? 'todo' : 'reales';

  const days = sp.dias === '7' ? 7 : sp.dias === 'todo' ? 3650 : 30;
  const since = sql`now() - make_interval(days => ${days})`;

  const userScopeSql =
    scope === 'reales'
      ? sql`is_demo = false`
      : scope === 'demo'
        ? sql`is_demo = true`
        : sql`true`;

  const merchantScopeSql =
    scope === 'reales'
      ? sql`m.is_demo = false`
      : scope === 'demo'
        ? sql`m.is_demo = true`
        : sql`true`;

  // 1. Indicadores falsables (Secciones H.1.1, J.3, J.4 y K del documento PMC)
  const [kpiRow] = (await db.execute(sql`
    with scoped_users as (
      select * from users where ${userScopeSql}
    ),
    ttfc as (
      select
        count(*) filter (where first_cifra_at is not null) as with_cifra,
        count(*) filter (where first_cifra_at is not null and extract(epoch from (first_cifra_at - created_at)) <= 300) as under_5min,
        percentile_cont(0.5) within group (order by greatest(1, extract(epoch from (first_cifra_at - created_at))))
          filter (where first_cifra_at is not null) as median_sec
      from scoped_users
    ),
    ret as (
      select
        count(*) filter (where onboarded_at is not null) as onboarded_total,
        count(*) filter (where onboarded_at is not null and last_active_at >= now() - interval '30 days') as active_30d,
        count(*) filter (where onboarded_at <= now() - interval '180 days') as cohort_6m_total,
        count(*) filter (where onboarded_at <= now() - interval '180 days' and last_active_at >= now() - interval '30 days') as cohort_6m_retained
      from scoped_users
    ),
    merch_ren as (
      select
        count(distinct m.id) as merchants_total,
        count(distinct m.id) filter (where m.stage in ('activo', 'con_oferta')) as merchants_active,
        count(distinct o_prev.merchant_id) as eligible_renewal_merchants,
        count(distinct o_ren.merchant_id) as renewed_merchants
      from merchants m
      left join offers o_prev on o_prev.merchant_id = m.id
      left join offers o_ren on o_ren.merchant_id = m.id and o_ren.renewed_from_offer_id is not null
      where ${merchantScopeSql}
    ),
    econ as (
      select
        count(r.id) as redemptions_count,
        coalesce(sum(r.gross_amount_minor), 0) as gmv_minor,
        coalesce(sum(r.net_paid_by_user_minor), 0) as net_sales_minor,
        coalesce(sum(r.discount_minor), 0) as discounts_minor,
        coalesce(sum(r.cifra_commission_minor), 0) as gross_commission_minor,
        coalesce(sum(r.partner_share_minor), 0) as partner_share_minor,
        coalesce(sum(r.cifra_net_revenue_minor), 0) as cifra_net_minor,
        count(r.id) filter (where r.is_new_customer = true) as new_customer_redemptions
      from redemptions r
      inner join merchants m on m.id = r.merchant_id
      where r.status <> 'anulada' and ${merchantScopeSql}
    ),
    sav as (
      select coalesce(sum(s.amount_minor), 0) as total_saved_minor
      from savings_events s
      inner join users u on u.id = s.user_id
      where ${scope === 'reales' ? sql`u.is_demo = false` : scope === 'demo' ? sql`u.is_demo = true` : sql`true`}
    )
    select
      (select count(*) from scoped_users where partner_id is null) as direct_users,
      (select count(*) from scoped_users where partner_id is not null) as partner_users,
      ttfc.with_cifra, ttfc.under_5min, ttfc.median_sec,
      ret.onboarded_total, ret.active_30d, ret.cohort_6m_total, ret.cohort_6m_retained,
      merch_ren.merchants_total, merch_ren.merchants_active, merch_ren.eligible_renewal_merchants, merch_ren.renewed_merchants,
      econ.redemptions_count, econ.gmv_minor, econ.net_sales_minor, econ.discounts_minor,
      econ.gross_commission_minor, econ.partner_share_minor, econ.cifra_net_minor, econ.new_customer_redemptions,
      sav.total_saved_minor
    from ttfc, ret, merch_ren, econ, sav
  `)) as unknown as Row[];

  const kpi = kpiRow ?? {};

  // Embudo de la feria: de la página pública a la cifra guardada, por día de Bogotá.
  const fairDays = await loadFairFunnel(7);

  // Embudo propio y A/B test
  const funnel = realAdmin
    ? ((await db.execute(sql`
        with landing as (
          select visitor_id, min(variant) as variant from events
          where name = 'page_view' and path = '/' and at >= ${since} group by visitor_id
        ),
        acts as (
          select visitor_id,
            bool_or(name = 'click_cta') as cta,
            bool_or(name = 'begin_signup') as begin_signup,
            bool_or(name = 'sign_up') as sign_up,
            bool_or(name = 'import_statement') as imported,
            bool_or(name = 'quick_start') as quick,
            bool_or(name = 'generate_lead') as lead,
            bool_or(name in ('click_cta','scroll_depth','faq_open','ask_spend','begin_lead')) as interacted,
            max(case when name = 'engaged_time' and path = '/' then (props->>'seconds')::int end) as seconds,
            max(case when name = 'scroll_depth' then (props->>'percent')::int end) as depth
          from events where at >= ${since} group by visitor_id
        )
        select coalesce(l.variant, '?') as variant,
          count(*) as visitors,
          count(*) filter (where a.cta) as cta,
          count(*) filter (where a.begin_signup) as begin_signup,
          count(*) filter (where a.sign_up) as sign_up,
          count(*) filter (where a.imported or a.quick) as activated,
          count(*) filter (where a.quick) as quick,
          count(*) filter (where a.imported) as imported,
          count(*) filter (where a.lead) as leads,
          count(*) filter (where not coalesce(a.interacted, false) and coalesce(a.seconds, 0) < 10) as bounced,
          percentile_cont(0.5) within group (order by a.seconds) as median_seconds,
          count(*) filter (where a.depth >= 50) as depth50
        from landing l left join acts a using (visitor_id)
        group by 1 order by 1`)) as unknown as Row[])
    : [];

  const aVar = funnel.find((r) => r.variant === 'A');
  const bVar = funnel.find((r) => r.variant === 'B');
  const abPValue =
    aVar && bVar
      ? twoProportionP(num(aVar.sign_up), num(aVar.visitors), num(bVar.sign_up), num(bVar.visitors))
      : null;

  // Datos por pestaña
  const merchantFilter =
    scope === 'reales'
      ? eq(merchants.isDemo, false)
      : scope === 'demo'
        ? eq(merchants.isDemo, true)
        : undefined;

  const [
    allMerchants,
    allOffers,
    catalogRules,
    pendingPayments,
    disputedRedemptions,
    allInvoices,
    partnerLedger,
    recentLeads,
  ] = await Promise.all([
    db
      .select()
      .from(merchants)
      .where(merchantFilter)
      .orderBy(desc(merchants.createdAt))
      .limit(60),
    db
      .select({ offer: offers, merchantName: merchants.name, isDemo: merchants.isDemo })
      .from(offers)
      .innerJoin(merchants, eq(merchants.id, offers.merchantId))
      .where(merchantFilter)
      .orderBy(desc(offers.createdAt))
      .limit(50),
    db.select().from(merchantCatalog).orderBy(desc(merchantCatalog.votesCount)).limit(30),
    db
      .select({
        payment: merchantPayments,
        merchantName: merchants.name,
        periodMonth: merchantInvoices.periodMonth,
      })
      .from(merchantPayments)
      .innerJoin(merchants, eq(merchants.id, merchantPayments.merchantId))
      .innerJoin(merchantInvoices, eq(merchantInvoices.id, merchantPayments.invoiceId))
      .where(merchantFilter)
      .orderBy(desc(merchantPayments.createdAt))
      .limit(30),
    db
      .select({
        redemption: redemptions,
        merchantName: merchants.name,
        offerTitle: offers.title,
        userName: users.name,
      })
      .from(redemptions)
      .innerJoin(merchants, eq(merchants.id, redemptions.merchantId))
      .innerJoin(offers, eq(offers.id, redemptions.offerId))
      .innerJoin(users, eq(users.id, redemptions.userId))
      .where(
        merchantFilter
          ? and(eq(redemptions.status, 'en_revision'), merchantFilter)
          : eq(redemptions.status, 'en_revision'),
      )
      .orderBy(desc(redemptions.redeemedAt)),
    db
      .select({ invoice: merchantInvoices, merchantName: merchants.name })
      .from(merchantInvoices)
      .innerJoin(merchants, eq(merchants.id, merchantInvoices.merchantId))
      .where(merchantFilter)
      .orderBy(desc(merchantInvoices.periodMonth))
      .limit(40),
    db.execute(sql`
      select
        p.id, p.name, p.slug, p.revenue_share_bps, p.contact_email, p.is_demo,
        (select count(*) from users u where u.partner_id = p.id) as members_count,
        (select count(*) from partner_api_keys k where k.partner_id = p.id and k.revoked_at is null) as active_keys,
        coalesce(sum(r.cifra_commission_minor) filter (where r.status <> 'anulada'), 0) as gross_comm_minor,
        coalesce(sum(r.partner_share_minor) filter (where r.status <> 'anulada'), 0) as partner_share_minor,
        coalesce(sum(r.cifra_net_revenue_minor) filter (where r.status <> 'anulada'), 0) as cifra_net_minor
      from partners p
      left join redemptions r on r.partner_id = p.id
      where ${scope === 'reales' ? sql`p.is_demo = false` : scope === 'demo' ? sql`p.is_demo = true` : sql`true`}
      group by p.id
      order by p.created_at desc
    `) as unknown as Promise<Row[]>,
    realAdmin ? db.select().from(leads).orderBy(desc(leads.createdAt)).limit(25) : Promise.resolve([]),
  ]);

  const retentionRate =
    num(kpi.cohort_6m_total) > 0
      ? (num(kpi.cohort_6m_retained) / num(kpi.cohort_6m_total)) * 100
      : num(kpi.onboarded_total) > 0
        ? (num(kpi.active_30d) / num(kpi.onboarded_total)) * 100
        : 0;

  const renewalRate =
    num(kpi.eligible_renewal_merchants) > 0
      ? (num(kpi.renewed_merchants) / num(kpi.eligible_renewal_merchants)) * 100
      : 0;

  const under5MinPct =
    num(kpi.with_cifra) > 0 ? (num(kpi.under_5min) / num(kpi.with_cifra)) * 100 : 0;

  const partnerShareEffectivePct =
    num(kpi.gross_commission_minor) > 0
      ? (num(kpi.partner_share_minor) / num(kpi.gross_commission_minor)) * 100
      : 0;

  const queryBase = (nextTab: string, nextScope = scope) =>
    `/admin?tab=${nextTab}&alcance=${nextScope}&dias=${days === 7 ? '7' : days === 3650 ? 'todo' : '30'}`;

  return (
    <div className="min-h-screen bg-paper pb-16">
      {/* Demo: se abre solo desde aquí, sobre la sesión del admin. */}
      <div className="border-b border-line bg-white px-4 py-3 text-[13px]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-ink">Demo con datos de ejemplo</p>
            <p className="text-ink-muted">
              Se abre sobre tu sesión y solo tú la ves. Sales con el botón «Salir» de la franja negra.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form action={openDemoAs}>
              <input type="hidden" name="role" value="persona" />
              <button id="btn-demo-persona" type="submit" className="btn-sm btn-primary">
                Ver como persona
              </button>
            </form>
            <form action={openDemoAs}>
              <input type="hidden" name="role" value="tendero" />
              <button id="btn-demo-tendero" type="submit" className="btn-sm btn-terra">
                Ver como tendero
              </button>
            </form>
            <form action={resetDemoData}>
              <button
                id="btn-demo-reset"
                type="submit"
                className="btn-sm border border-line bg-white text-ink-muted hover:border-ink/30 hover:text-ink"
                title="Borra y vuelve a crear solo los datos de ejemplo"
              >
                <RotateCcw size={14} aria-hidden="true" />
                Reiniciar demo
              </button>
            </form>
          </div>
        </div>
        {sp.demo === 'reiniciada' && (
          <p
            role="status"
            className="mx-auto mt-2.5 flex max-w-6xl items-center gap-2 rounded-xl bg-primary-pale px-3.5 py-2 font-medium text-primary-dark"
          >
            <CheckCircle2 size={15} aria-hidden="true" />
            Datos de ejemplo reiniciados.
          </p>
        )}
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-7 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="badge-primary">Operación y Data Room</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {realAdmin && (
              <div className="inline-flex rounded-xl border border-line bg-white p-1 text-[12.5px]">
                {(
                  [
                    ['reales', 'Solo reales'],
                    ['demo', 'Solo demo'],
                    ['todo', 'Todos'],
                  ] as const
                ).map(([val, label]) => (
                  <Link
                    key={val}
                    href={queryBase(tab, val)}
                    className={`rounded-lg px-2.5 py-1 font-semibold ${
                      scope === val ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}

            {realAdmin && (
              <form action={triggerDailyCronFromAdmin}>
                <button type="submit" className="btn-sm bg-ink text-white" title="Ejecutar evaluación diaria de avisos y vencimientos">
                  <Play size={13} aria-hidden="true" />
                  Correr job diario
                </button>
              </form>
            )}
          </div>
        </header>

        {/* Pestañas principales */}
        <nav className="mt-6 flex flex-wrap gap-2 border-b border-line pb-3">
          {[
            { id: 'dataroom', label: 'Data Room e Hipótesis (PMC)', icon: LineChart },
            { id: 'negocios', label: `CRM Negocios (${allMerchants.length})`, icon: Store },
            {
              id: 'conciliacion',
              label: `Conciliación y Disputas (${pendingPayments.filter((p) => p.payment.status === 'reportado').length + disputedRedemptions.length})`,
              icon: Receipt,
            },
            { id: 'aliados', label: `Aliados B2B2C (${partnerLedger.length})`, icon: Building2 },
          ].map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={queryBase(id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold transition ${
                tab === id
                  ? 'bg-primary text-white shadow-sm'
                  : 'border border-line bg-white text-ink-muted hover:text-ink'
              }`}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>

        {/* TAB 1: DATA ROOM DE INVERSIÓN Y FALSACIÓN */}
        {tab === 'dataroom' && (
          <div className="mt-6 space-y-7">
            <FairFunnelSection days={fairDays} />

            <section className="space-y-3">
              <div>
                <h1 className="font-display text-[28px] font-bold tracking-[-0.025em] text-ink">
                  Tablero de Hipótesis Falsables y Economía Unitaria
                </h1>
                <p className="text-[14.5px] text-ink-muted">
                  Métricas auditables en vivo frente a los umbrales de validación del documento PMC (Secciones H, J y K).
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="surface-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">
                      Hipótesis K · Retención Personas
                    </span>
                    <span className={retentionRate >= 40 ? 'badge-primary' : 'badge-warn'}>
                      Meta ≥ 40 %
                    </span>
                  </div>
                  <p className="tnum mt-2 font-display text-[32px] font-bold text-ink">
                    {retentionRate.toFixed(1).replace('.', ',')} %
                  </p>
                  <p className="mt-1 text-[12.5px] text-ink-muted">
                    {num(kpi.cohort_6m_total) > 0
                      ? `Cohorte ≥ 6 meses: ${num(kpi.cohort_6m_retained)}/${num(kpi.cohort_6m_total)} activas.`
                      : `Actividad 30d actual: ${num(kpi.active_30d)}/${num(kpi.onboarded_total)} personas con cifra.`}
                  </p>
                </div>

                <div className="surface-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">
                      Hipótesis K · Renovación Negocios
                    </span>
                    <span className={renewalRate >= 50 ? 'badge-primary' : 'badge-warn'}>
                      Meta ≥ 50 %
                    </span>
                  </div>
                  <p className="tnum mt-2 font-display text-[32px] font-bold text-ink">
                    {renewalRate.toFixed(1).replace('.', ',')} %
                  </p>
                  <p className="mt-1 text-[12.5px] text-ink-muted">
                    {num(kpi.renewed_merchants)} de {num(kpi.eligible_renewal_merchants)} comercios con campaña han renovado por un nuevo periodo.
                  </p>
                </div>

                <div className="surface-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">
                      H.1.1 · Primera cifra &lt; 5 min
                    </span>
                    <span className={under5MinPct >= 75 ? 'badge-primary' : 'badge-neutral'}>
                      Tiempo al valor
                    </span>
                  </div>
                  <p className="tnum mt-2 font-display text-[32px] font-bold text-primary-dark">
                    {under5MinPct.toFixed(0)} %
                  </p>
                  <p className="mt-1 text-[12.5px] text-ink-muted">
                    Mediana:{' '}
                    <strong className="tnum text-ink">
                      {kpi.median_sec != null ? `${Math.round(num(kpi.median_sec))} s` : '—'}
                    </strong>{' '}
                    desde el registro hasta ver su disponible seguro.
                  </p>
                </div>

                <div className="surface-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">
                      Impacto directo al bolsillo
                    </span>
                    <span className="badge-primary">Verificable</span>
                  </div>
                  <p className="tnum mt-2 font-display text-[32px] font-bold text-primary-dark">
                    {cop(num(kpi.total_saved_minor))}
                  </p>
                  <p className="mt-1 text-[12.5px] text-ink-muted">
                    Ahorro sumado entre cobros recurrentes cancelados y ofertas de barrio redimidas.
                  </p>
                </div>
              </div>
            </section>

            {/* Economía de dos lados */}
            <section className="surface-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-[20px] font-bold text-ink">
                    Economía Unitaria y Flujo de Comisiones (G.10 · J.3 · J.4)
                  </h2>
                  <p className="text-[13.5px] text-ink-muted">
                    Comisión del 5 % sobre ventas netas cobradas en caja · Reparto B2B2C del 30 % (techo sostenible documentado: 41,1 %).
                  </p>
                </div>
                <span className="badge-terra tnum">
                  {num(kpi.redemptions_count)} redenciones válidas ({num(kpi.new_customer_redemptions)} clientes nuevos)
                </span>
              </div>

              <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-2xl bg-paper p-4">
                  <p className="text-[12px] text-ink-muted">Venta bruta atribuida (GMV)</p>
                  <p className="tnum mt-1 font-display text-[22px] font-bold text-ink">
                    {cop(num(kpi.gmv_minor))}
                  </p>
                </div>
                <div className="rounded-2xl bg-paper p-4">
                  <p className="text-[12px] text-ink-muted">Cobrado en caja por negocios</p>
                  <p className="tnum mt-1 font-display text-[22px] font-bold text-ink">
                    {cop(num(kpi.net_sales_minor))}
                  </p>
                </div>
                <div className="rounded-2xl bg-paper p-4">
                  <p className="text-[12px] text-ink-muted">Comisión bruta CIFRA (5 %)</p>
                  <p className="tnum mt-1 font-display text-[22px] font-bold text-ink">
                    {cop(num(kpi.gross_commission_minor))}
                  </p>
                </div>
                <div className="rounded-2xl bg-paper p-4">
                  <p className="text-[12px] text-ink-muted">Reparto a aliados B2B2C</p>
                  <p className="tnum mt-1 font-display text-[22px] font-bold text-terra-dark">
                    {cop(num(kpi.partner_share_minor))}
                  </p>
                  <p className="tnum text-[11px] text-ink-faint">
                    {partnerShareEffectivePct.toFixed(1).replace('.', ',')} % del total (techo 41,1 %)
                  </p>
                </div>
                <div className="rounded-2xl bg-primary-pale p-4">
                  <p className="text-[12px] font-semibold text-primary-dark">Ingreso neto CIFRA</p>
                  <p className="tnum mt-1 font-display text-[22px] font-bold text-primary-dark">
                    {cop(num(kpi.cifra_net_minor))}
                  </p>
                  <p className="text-[11px] text-ink-soft">
                    {num(kpi.direct_users)} personas directas · {num(kpi.partner_users)} vía aliado
                  </p>
                </div>
              </div>
            </section>

            {/* Embudo de landing y A/B test (solo admin real) */}
            {realAdmin && (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-[20px] font-bold text-ink">
                    Embudo propio de Landing y Prueba A/B ({days === 3650 ? 'histórico' : `${days} días`})
                  </h2>
                  <div className="flex gap-1.5 text-[12.5px]">
                    {[
                      ['7', '7 días'],
                      ['30', '30 días'],
                      ['todo', 'Todo'],
                    ].map(([d, label]) => (
                      <Link
                        key={d}
                        href={`/admin?tab=dataroom&alcance=${scope}&dias=${d}`}
                        className={`rounded-lg border px-2.5 py-1 font-semibold ${
                          (days === 7 && d === '7') || (days === 30 && d === '30') || (days === 3650 && d === 'todo')
                            ? 'border-ink bg-ink text-white'
                            : 'border-line bg-white text-ink-muted'
                        }`}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
                  <table className="tnum w-full text-left text-[13.5px]">
                    <thead className="border-b border-line bg-paper text-ink-muted">
                      <tr>
                        {[
                          'Variante',
                          'Visitantes',
                          'Clic CTA',
                          'Inició registro',
                          'Registrados',
                          'Activados (cifra)',
                          'Rebote',
                          'Tiempo mediano',
                          'Leads',
                        ].map((h) => (
                          <th key={h} className="px-4 py-3 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {funnel.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-5 text-center text-ink-muted">
                            Sin visitas registradas aún en este periodo.
                          </td>
                        </tr>
                      ) : (
                        funnel.map((r) => {
                          const v = num(r.visitors);
                          return (
                            <tr key={String(r.variant)} className="border-b border-line last:border-0">
                              <td className="px-4 py-3 font-bold">{String(r.variant)}</td>
                              <td className="px-4 py-3">{v}</td>
                              <td className="px-4 py-3">
                                {num(r.cta)} ({pct(num(r.cta), v)})
                              </td>
                              <td className="px-4 py-3">{num(r.begin_signup)}</td>
                              <td className="px-4 py-3 font-semibold text-primary-dark">
                                {num(r.sign_up)} ({pct(num(r.sign_up), v)})
                              </td>
                              <td className="px-4 py-3">
                                {num(r.activated)} ({pct(num(r.activated), v)})
                              </td>
                              <td className="px-4 py-3">{pct(num(r.bounced), v)}</td>
                              <td className="px-4 py-3">
                                {r.median_seconds == null ? '—' : `${Math.round(num(r.median_seconds))} s`}
                              </td>
                              <td className="px-4 py-3">{num(r.leads)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="text-[13px] text-ink-muted">
                  Prueba z de dos proporciones entre variantes A y B:{' '}
                  {abPValue === null
                    ? 'esperando tráfico en ambas variantes.'
                    : `p = ${abPValue.toFixed(3)} ${abPValue < 0.05 ? '(diferencia estadísticamente significativa al 5 %)' : '(en recolección de muestra)'}.`}
                </p>

                {recentLeads.length > 0 && (
                  <div className="surface-card p-5">
                    <h3 className="font-display text-[18px] font-bold text-ink">
                      Solicitudes comerciales recibidas (Entidades y Negocios)
                    </h3>
                    <ul className="mt-3 divide-y divide-line text-[13.5px]">
                      {recentLeads.map((l) => (
                        <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <div>
                            <span className={l.kind === 'entidad' ? 'badge-primary mr-2' : 'badge-terra mr-2'}>
                              {l.kind}
                            </span>
                            <strong>{l.organization}</strong> · {l.name} ({l.email}
                            {l.phone ? ` · ${l.phone}` : ''})
                            {l.message ? ` — "${l.message}"` : ''}
                          </div>
                          <span className="text-[12px] text-ink-faint">
                            {shortDate(bogotaDate(l.createdAt))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* TAB 2: CRM NEGOCIOS DE BARRIO + DICCIONARIO H.5 */}
        {tab === 'negocios' && (
          <div className="mt-6 space-y-7">
            {realAdmin && <StreetMerchantCrmForm />}

            <section className="space-y-3">
              <h2 className="font-display text-[22px] font-bold text-ink">
                Comercios independientes afiliados
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
                <table className="w-full text-left text-[13.5px]">
                  <thead className="border-b border-line bg-paper text-ink-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Comercio</th>
                      <th className="px-4 py-3 font-semibold">Barrio / Zona</th>
                      <th className="px-4 py-3 font-semibold">Contacto</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMerchants.map((m) => (
                      <tr key={m.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink">{m.name}</p>
                          <p className="text-[12px] text-ink-muted">
                            {m.businessCategory} · Ticket {cop(m.typicalTicketMinor)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-ink">{m.neighborhood}</p>
                          <p className="text-[12px] text-ink-faint">{m.address}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-ink">{m.ownerName}</p>
                          <p className="font-mono text-[12px] text-ink-muted">{m.whatsapp}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={m.stage === 'con_oferta' || m.stage === 'activo' ? 'badge-primary' : 'badge-terra'}>
                            {m.stage}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {realAdmin && (
                            <div className="inline-flex items-center gap-2">
                              <ReissueInviteButton merchantId={m.id} />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-[20px] font-bold text-ink">Moderación de ofertas publicadas</h2>
              <ul className="space-y-2.5">
                {allOffers.map(({ offer: o, merchantName }) => (
                  <li key={o.id} className="surface-card flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-[13.5px]">
                    <div>
                      <span className="font-semibold text-ink">{merchantName}</span> · {o.title}{' '}
                      <span className="ml-1.5 badge-neutral">{o.status}</span>
                    </div>
                    {realAdmin && (
                      <div className="flex gap-2">
                        {o.status !== 'activa' && (
                          <form action={adminModerateOffer}>
                            <input type="hidden" name="offerId" value={o.id} />
                            <input type="hidden" name="status" value="activa" />
                            <button type="submit" className="btn-sm bg-primary text-[12px] text-white">
                              Activar
                            </button>
                          </form>
                        )}
                        {o.status === 'activa' && (
                          <form action={adminModerateOffer}>
                            <input type="hidden" name="offerId" value={o.id} />
                            <input type="hidden" name="status" value="pausada" />
                            <button type="submit" className="btn-sm border border-line bg-white text-[12px] text-ink">
                              Pausar
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {/* Diccionario colaborativo de comercios colombianos (Ventaja Injusta H.5) */}
            <section className="space-y-3">
              <div>
                <h2 className="font-display text-[20px] font-bold text-ink">
                  Diccionario Aprendido de Extractos Colombianos (H.5)
                </h2>
                <p className="text-[13.5px] text-ink-muted">
                  Reglas aprendidas cuando las personas corrigen una categoría en 1 toque. Verificar las promueve al catálogo oficial.
                </p>
              </div>
              {catalogRules.length === 0 ? (
                <p className="surface-card p-5 text-[13.5px] text-ink-muted">
                  Aún no hay correcciones nuevas pendientes de verificar.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                  <table className="w-full text-left text-[13.5px]">
                    <thead className="border-b border-line bg-paper text-ink-muted">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Llave normalizada</th>
                        <th className="px-4 py-2.5 font-semibold">Nombre legible</th>
                        <th className="px-4 py-2.5 font-semibold">Categoría</th>
                        <th className="px-4 py-2.5 font-semibold">Votos</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalogRules.map((c) => (
                        <tr key={c.merchantKey} className="border-b border-line last:border-0">
                          <td className="px-4 py-2.5 font-mono text-[12px]">{c.merchantKey}</td>
                          <td className="px-4 py-2.5 font-semibold">{c.displayName}</td>
                          <td className="px-4 py-2.5">{c.category}</td>
                          <td className="px-4 py-2.5 tnum">{c.votesCount}</td>
                          <td className="px-4 py-2.5 text-right">
                            {c.verified ? (
                              <span className="badge-primary">
                                <ShieldCheck size={12} /> Oficial
                              </span>
                            ) : realAdmin ? (
                              <form action={promoteCatalogRule}>
                                <input type="hidden" name="merchantKey" value={c.merchantKey} />
                                <button type="submit" className="btn-sm bg-primary text-[12px] text-white">
                                  Promover a oficial
                                </button>
                              </form>
                            ) : (
                              <span className="badge-neutral">En aprendizaje</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 3: CONCILIACIÓN DE COMISIONES Y DISPUTAS */}
        {tab === 'conciliacion' && (
          <div className="mt-6 space-y-7">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-[22px] font-bold text-ink">
                    Comprobantes Bre-B / Nequi pendientes de conciliación
                  </h2>
                  <p className="text-[13.5px] text-ink-muted">
                    Verifica la transferencia recibida en la llave oficial de CIFRA y aprueba con un clic.
                  </p>
                </div>
                {realAdmin && (
                  <form action={closeMonthInvoices}>
                    <input type="hidden" name="periodMonth" value={currentPeriodMonth()} />
                    <button type="submit" className="btn-sm border border-line bg-white text-ink">
                      Emitir corte de {formatPeriodMonth(currentPeriodMonth())}
                    </button>
                  </form>
                )}
              </div>

              {pendingPayments.length === 0 ? (
                <p className="surface-card p-5 text-[14px] text-ink-muted">
                  No hay comprobantes reportados todavía.
                </p>
              ) : (
                <ul className="space-y-3">
                  {pendingPayments.map(({ payment: p, merchantName, periodMonth }) => (
                    <li key={p.id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink">{merchantName}</span>
                          <span className="badge-neutral capitalize">{formatPeriodMonth(periodMonth)}</span>
                          <span className="badge-terra uppercase">{p.method}</span>
                        </div>
                        <p className="mt-1 text-[13.5px] text-ink-soft">
                          Monto: <strong className="tnum text-ink">{cop(p.amountMinor)}</strong> · Referencia:{' '}
                          <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-[12.5px]">{p.reference}</code>
                          {p.note ? ` · "${p.note}"` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {p.status === 'reportado' && realAdmin ? (
                          <>
                            <form action={reviewMerchantPayment}>
                              <input type="hidden" name="paymentId" value={p.id} />
                              <input type="hidden" name="decision" value="aprobado" />
                              <button type="submit" className="btn-sm bg-primary text-white">
                                <CheckCircle2 size={14} /> Aprobar pago
                              </button>
                            </form>
                            <form action={reviewMerchantPayment}>
                              <input type="hidden" name="paymentId" value={p.id} />
                              <input type="hidden" name="decision" value="rechazado" />
                              <button type="submit" className="btn-sm border border-line bg-white text-neg">
                                Rechazar
                              </button>
                            </form>
                          </>
                        ) : (
                          <span className={p.status === 'aprobado' ? 'badge-primary' : p.status === 'rechazado' ? 'badge-neg' : 'badge-warn'}>
                            {p.status === 'reportado' && <Clock size={12} />}
                            {p.status}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Disputas bilaterales */}
            <section className="space-y-3">
              <h2 className="font-display text-[20px] font-bold text-ink">
                Redenciones en revisión bilateral ({disputedRedemptions.length})
              </h2>
              {disputedRedemptions.length === 0 ? (
                <p className="surface-card p-5 text-[14px] text-ink-muted">
                  Cero diferencias reportadas entre clientes y comercios.
                </p>
              ) : (
                <ul className="space-y-3">
                  {disputedRedemptions.map(({ redemption: r, merchantName, offerTitle, userName }) => (
                    <li key={r.id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-5">
                      <div>
                        <p className="flex items-center gap-1.5 font-bold text-ink">
                          <AlertTriangle size={15} className="text-warn" />
                          {merchantName} · {offerTitle}
                        </p>
                        <p className="mt-1 text-[13.5px] text-ink-soft">
                          Cliente: {userName ?? 'Usuario'} · Cobro reportado: {cop(r.netPaidByUserMinor)} · Motivo:{' '}
                          <strong className="text-ink">&ldquo;{r.disputeReason}&rdquo;</strong>
                        </p>
                      </div>
                      {realAdmin && (
                        <div className="flex gap-2">
                          <form action={resolveRedemptionDispute}>
                            <input type="hidden" name="redemptionId" value={r.id} />
                            <input type="hidden" name="resolution" value="valida" />
                            <button type="submit" className="btn-sm bg-primary text-white">
                              Mantener válida
                            </button>
                          </form>
                          <form action={resolveRedemptionDispute}>
                            <input type="hidden" name="redemptionId" value={r.id} />
                            <input type="hidden" name="resolution" value="anulada" />
                            <button type="submit" className="btn-sm bg-neg text-white">
                              Anular cobro
                            </button>
                          </form>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Estados de cuenta emitidos */}
            <section className="space-y-3">
              <h2 className="font-display text-[20px] font-bold text-ink">Estados de cuenta mensuales</h2>
              <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                <table className="tnum w-full text-left text-[13.5px]">
                  <thead className="border-b border-line bg-paper text-ink-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Comercio</th>
                      <th className="px-4 py-3 font-semibold">Periodo</th>
                      <th className="px-4 py-3 font-semibold">Ventas</th>
                      <th className="px-4 py-3 font-semibold">Cobrado en caja</th>
                      <th className="px-4 py-3 font-semibold">Comisión 5 %</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allInvoices.map(({ invoice: inv, merchantName }) => (
                      <tr key={inv.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 font-semibold">{merchantName}</td>
                        <td className="px-4 py-3 capitalize">{formatPeriodMonth(inv.periodMonth)}</td>
                        <td className="px-4 py-3">{inv.redemptionsCount}</td>
                        <td className="px-4 py-3">{cop(inv.netSalesMinor)}</td>
                        <td className="px-4 py-3 font-bold text-ink">{cop(inv.commissionTotalMinor)}</td>
                        <td className="px-4 py-3">
                          <span className={inv.status === 'pagada' ? 'badge-primary' : 'badge-terra'}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 4: ALIADOS B2B2C */}
        {tab === 'aliados' && (
          <div className="mt-6 space-y-7">
            {realAdmin && <CreatePartnerForm />}

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-[22px] font-bold text-ink">
                    Libro Mayor de Reparto B2B2C (Cooperativas, Cajas y Billeteras)
                  </h2>
                  <p className="text-[13.5px] text-ink-muted">
                    Participación sobre comisiones de ofertas generadas por asociados activos de cada entidad.
                  </p>
                </div>
                <Link href="/desarrolladores" className="btn-sm border border-line bg-white text-ink">
                  Documentación y Sandbox API →
                </Link>
              </div>

              {partnerLedger.length === 0 ? (
                <p className="surface-card p-5 text-[14px] text-ink-muted">
                  Aún no hay aliados B2B2C registrados en este filtro.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
                  <table className="tnum w-full text-left text-[13.5px]">
                    <thead className="border-b border-line bg-paper text-ink-muted">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Entidad aliada</th>
                        <th className="px-4 py-3 font-semibold">Asociados</th>
                        <th className="px-4 py-3 font-semibold">% Reparto</th>
                        <th className="px-4 py-3 font-semibold">Comisión 5 % generada</th>
                        <th className="px-4 py-3 font-semibold">Pago al aliado (30 %)</th>
                        <th className="px-4 py-3 font-semibold">Neto CIFRA (70 %)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partnerLedger.map((p) => (
                        <tr key={String(p.id)} className="border-b border-line last:border-0">
                          <td className="px-4 py-3">
                            <p className="font-bold text-ink">{String(p.name)}</p>
                            <p className="font-mono text-[11.5px] text-ink-faint">
                              slug: {String(p.slug)} · {num(p.active_keys)} llave(s) activa(s)
                            </p>
                          </td>
                          <td className="px-4 py-3 font-semibold">{num(p.members_count)}</td>
                          <td className="px-4 py-3">
                            {(num(p.revenue_share_bps) / 100).toFixed(0)} %
                          </td>
                          <td className="px-4 py-3">{cop(num(p.gross_comm_minor))}</td>
                          <td className="px-4 py-3 font-semibold text-terra-dark">
                            {cop(num(p.partner_share_minor))}
                          </td>
                          <td className="px-4 py-3 font-bold text-primary-dark">
                            {cop(num(p.cifra_net_minor))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
