import { desc, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Logo } from '@/components/logo';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { getCurrentUser, isAdmin } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Métricas', robots: { index: false } };

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)} %` : 'sin datos');

/** Prueba z de dos proporciones (dos colas). Con poco tráfico el valor p será alto: se reporta tal cual. */
function twoProportionP(x1: number, n1: number, x2: number, n2: number): number | null {
  if (n1 < 1 || n2 < 1) return null;
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return null;
  const z = Math.abs(x1 / n1 - x2 / n2) / se;
  // Aproximación de la normal estándar (Abramowitz y Stegun 7.1.26).
  const t = 1 / (1 + 0.3275911 * (z / Math.SQRT2));
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-(z * z) / 2);
  return 1 - erf;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) notFound();
  const sp = await searchParams;
  const days = sp.dias === '7' ? 7 : sp.dias === 'todo' ? 3650 : 30;
  const since = sql`now() - make_interval(days => ${days})`;

  const funnel = (await db.execute(sql`
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
      count(*) filter (where a.imported) as imported,
      count(*) filter (where a.lead) as leads,
      count(*) filter (where not coalesce(a.interacted, false) and coalesce(a.seconds, 0) < 10) as bounced,
      percentile_cont(0.5) within group (order by a.seconds) as median_seconds,
      count(*) filter (where a.depth >= 50) as depth50,
      count(*) filter (where a.depth >= 100) as depth100
    from landing l left join acts a using (visitor_id)
    group by 1 order by 1`)) as unknown as Row[];

  const sources = (await db.execute(sql`
    with landing as (
      select visitor_id, min(coalesce(utm->>'utm_source', referrer, 'directo')) as source from events
      where name = 'page_view' and path = '/' and at >= ${since} group by visitor_id
    )
    select l.source, count(*) as visitors,
      count(*) filter (where exists (select 1 from events e where e.visitor_id = l.visitor_id and e.name = 'sign_up')) as signups
    from landing l group by 1 order by 2 desc limit 12`)) as unknown as Row[];

  const ctaPlaces = (await db.execute(sql`
    select props->>'location' as location, count(distinct visitor_id) as visitors from events
    where name = 'click_cta' and at >= ${since} group by 1 order by 2 desc`)) as unknown as Row[];

  const totals = ((await db.execute(sql`
    select (select count(*) from users where partner_id is null) as users,
      (select count(distinct user_id) from accounts) as with_data,
      (select count(*) from users where partner_id is not null) as partner_members,
      (select count(*) from leads) as leads`)) as unknown as Row[])[0] ?? {};

  const recentLeads = await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(20);

  const a = funnel.find((r) => r.variant === 'A');
  const b = funnel.find((r) => r.variant === 'B');
  const p = a && b ? twoProportionP(num(a.sign_up), num(a.visitors), num(b.sign_up), num(b.visitors)) : null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <nav className="flex gap-2 text-[14px]">
          {[['7', '7 días'], ['30', '30 días'], ['todo', 'Todo']].map(([v, l]) => (
            <a key={v} href={`/admin?dias=${v}`} className={`rounded-full border px-3 py-1.5 ${String(days === 7 ? '7' : days === 30 ? '30' : 'todo') === v ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>
              {l}
            </a>
          ))}
        </nav>
      </div>
      <h1 className="mt-8 font-display text-[32px] font-bold tracking-[-0.02em]">Métricas de la landing y el embudo</h1>
      <p className="mt-1 text-[14px] text-ink-muted">
        Datos propios, sin bots. Visitante = navegador con cookie cf_vid que vio la página principal.
      </p>

      <section className="mt-8 grid gap-3 sm:grid-cols-4">
        {[
          ['Cuentas creadas', totals.users],
          ['Con datos cargados', totals.with_data],
          ['Asociados vía entidad', totals.partner_members],
          ['Entidades que pidieron demo', totals.leads],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-2xl border border-line bg-white px-4 py-3">
            <p className="text-[13px] text-ink-muted">{String(l)}</p>
            <p className="tnum font-display text-[28px] font-bold">{num(v)}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="tnum w-full text-left text-[14px]">
          <thead className="border-b border-line text-ink-muted">
            <tr>
              {['Variante', 'Visitantes', 'Clic en CTA', 'Inició registro', 'Se registró (principal)', 'Subió extracto', 'Rebote', 'Tiempo mediano', 'Scroll 50 %', 'Demo'].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funnel.map((r) => {
              const v = num(r.visitors);
              return (
                <tr key={String(r.variant)} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-semibold">{String(r.variant)}</td>
                  <td className="px-4 py-3">{v}</td>
                  <td className="px-4 py-3">{num(r.cta)} ({pct(num(r.cta), v)})</td>
                  <td className="px-4 py-3">{num(r.begin_signup)} ({pct(num(r.begin_signup), v)})</td>
                  <td className="px-4 py-3 font-semibold">{num(r.sign_up)} ({pct(num(r.sign_up), v)})</td>
                  <td className="px-4 py-3">{num(r.imported)} ({pct(num(r.imported), v)})</td>
                  <td className="px-4 py-3">{pct(num(r.bounced), v)}</td>
                  <td className="px-4 py-3">{r.median_seconds == null ? 'sin datos' : `${Math.round(num(r.median_seconds))} s`}</td>
                  <td className="px-4 py-3">{pct(num(r.depth50), v)}</td>
                  <td className="px-4 py-3">{num(r.leads)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="mt-3 text-[14px] text-ink-muted">
        Prueba A/B del titular (A: &quot;Sabe cuánto puedes gastar antes de gastarlo.&quot;, B: &quot;¿Te alcanza hasta el próximo pago?...&quot;).
        {p === null ? ' Aún no hay datos de ambas variantes.' : ` Valor p de la diferencia en registros: ${p.toFixed(3)}${p < 0.05 ? ' (significativa al 5 %).' : ' (todavía no es significativa).'}`}
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-display text-[20px] font-bold">Fuentes</h2>
          <table className="tnum mt-3 w-full text-[14px]">
            <tbody>
              {sources.map((s) => (
                <tr key={String(s.source)} className="border-b border-line last:border-0">
                  <td className="py-2">{String(s.source)}</td>
                  <td className="py-2 text-right">{num(s.visitors)} visitantes</td>
                  <td className="py-2 text-right">{num(s.signups)} registros</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-display text-[20px] font-bold">Qué botón usan</h2>
          <table className="tnum mt-3 w-full text-[14px]">
            <tbody>
              {ctaPlaces.map((s) => (
                <tr key={String(s.location)} className="border-b border-line last:border-0">
                  <td className="py-2">{String(s.location)}</td>
                  <td className="py-2 text-right">{num(s.visitors)} visitantes</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-[20px] font-bold">Entidades que pidieron demo</h2>
        {recentLeads.length === 0 ? (
          <p className="mt-2 text-[14px] text-ink-muted">Todavía ninguna.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-[14px]">
            {recentLeads.map((l) => (
              <li key={l.id} className="py-2.5">
                <span className="font-semibold">{l.organization}</span>: {l.name} ({l.role ?? 'sin cargo'}), {l.email}
                {l.phone ? `, ${l.phone}` : ''}. {l.members ? `${l.members} asociados.` : ''} {l.message ? `"${l.message}"` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
