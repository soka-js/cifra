import { and, desc, eq, gte, ilike, sql } from 'drizzle-orm';
import { Search } from 'lucide-react';
import { db } from '@/lib/db';
import { accounts, dataSources, transactions } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/session';
import { addDays, shortDate, todayInBogota } from '@/lib/engine/dates';
import { CATEGORY_LABEL, categoryOf, identifyMerchant, type Category } from '@/lib/engine/merchant';
import { splitInternalTransfers } from '@/lib/engine/transfers';
import { cop } from '@/lib/format';
import { toggleExcluded } from '../actions';

export const metadata = { title: 'Movimientos' };

export default async function MovimientosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 60);
  const today = todayInBogota();
  const since = addDays(today, -90);
  const rows = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      postedOn: transactions.postedOn,
      description: transactions.description,
      amountMinor: transactions.amountMinor,
      excluded: transactions.excluded,
      accountName: accounts.name,
      entity: dataSources.entityName,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .innerJoin(dataSources, eq(dataSources.id, accounts.sourceId))
    .where(
      and(
        eq(transactions.userId, user.id),
        gte(transactions.postedOn, since),
        q ? ilike(transactions.description, `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`) : sql`true`,
      ),
    )
    .orderBy(desc(transactions.postedOn), desc(transactions.createdAt))
    .limit(400);

  const internal = new Set(splitInternalTransfers(rows).internal.map((t) => (t as (typeof rows)[number]).id));

  // En qué se fue la plata en los últimos 30 días (sin transferencias entre tus cuentas ni excluidos).
  const from30 = addDays(today, -30);
  const byCategory = new Map<Category, number>();
  for (const r of rows) {
    if (r.amountMinor >= 0 || r.excluded || internal.has(r.id) || r.postedOn < from30) continue;
    const c = categoryOf(r.description, r.amountMinor);
    byCategory.set(c, (byCategory.get(c) ?? 0) + -r.amountMinor);
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const total30 = categories.reduce((s, [, v]) => s + v, 0);

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = groups.get(r.postedOn) ?? [];
    list.push(r);
    groups.set(r.postedOn, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Movimientos</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          Los últimos 90 días. Si un gasto fue único y no se repetirá, quítalo de la cifra para que no infle tu día a día.
        </p>
      </div>

      {!q && categories.length > 0 && (
        <section className="rounded-2xl border border-line bg-white px-5 py-4">
          <h2 className="text-[14px] font-semibold text-ink-muted">En qué se fue la plata en los últimos 30 días</h2>
          <p className="tnum mt-1 font-display text-[30px] font-extrabold tracking-[-0.03em]">{cop(total30)}</p>
          <ul className="tnum mt-3 space-y-2 text-[14.5px]">
            {categories.slice(0, 7).map(([c, v]) => (
              <li key={c}>
                <div className="flex justify-between gap-3">
                  <span>{CATEGORY_LABEL[c]}</span>
                  <span className="font-semibold">{cop(v)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-paper-deep" aria-hidden="true">
                  <div className="h-1.5 rounded-full bg-primary-soft" style={{ width: `${Math.max(2, (v / total30) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="relative" role="search">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
        <label htmlFor="q" className="sr-only">Buscar movimientos</label>
        <input id="q" name="q" defaultValue={q} placeholder="Buscar: Rappi, Netflix, arriendo" className="field pl-11" />
      </form>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-5 text-[15px] text-ink-muted">{q ? `Nada con "${q}" en los últimos 90 días.` : 'Todavía no hay movimientos.'}</p>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([date, list]) => (
            <section key={date}>
              <h2 className="mb-1.5 text-[13px] font-semibold text-ink-faint">{shortDate(date)}</h2>
              <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
                {list.map((r) => {
                  const isInternal = internal.has(r.id);
                  const merchant = identifyMerchant(r.description);
                  return (
                    <li key={r.id} className={`px-4 py-3 ${r.excluded ? 'opacity-55' : ''}`}>
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold">{merchant.name}</p>
                          <p className="truncate text-[12.5px] text-ink-faint">
                            {isInternal ? 'Entre tus cuentas' : CATEGORY_LABEL[categoryOf(r.description, r.amountMinor)]}, {r.entity}
                          </p>
                        </div>
                        <p className={`tnum shrink-0 font-semibold ${r.amountMinor > 0 ? 'text-primary-dark' : ''} ${r.excluded ? 'line-through' : ''}`}>
                          {cop(r.amountMinor, { sign: true })}
                        </p>
                      </div>
                      {!isInternal && (
                        <form action={toggleExcluded} className="mt-1">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="exclude" value={r.excluded ? 'no' : 'si'} />
                          <button type="submit" className="text-[12.5px] font-semibold text-ink-muted underline-offset-2 hover:underline">
                            {r.excluded ? 'Volver a contarlo' : 'No contarlo en la cifra'}
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
