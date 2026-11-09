import { and, desc, eq, ne } from 'drizzle-orm';
import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import { FreemiumPlanCard } from '@/components/app/freemium-plan-card';
import { BackButton } from '@/components/ui/back-button';
import { db } from '@/lib/db';
import { commitments, merchants, redemptions } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/session';
import { cop } from '@/lib/format';
import { removeCommitment } from '../actions';
import { loadCifra } from '@/lib/data';
import { BufferForm, CommitmentForm, DailySpendForm, DeleteAccountForm, IncomeForm, ZoneForm } from './forms';

export const metadata = { title: 'Ajustes' };

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="surface-card scroll-mt-6 px-5 py-5 sm:px-6">
      <h2 className="font-display text-[20px] font-bold text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AjustesPage() {
  const user = await requireUser();
  const [comms, cifra, userRedemptions] = await Promise.all([
    db.select().from(commitments).where(eq(commitments.userId, user.id)),
    loadCifra(user),
    db
      .select({ merchantName: merchants.name })
      .from(redemptions)
      .innerJoin(merchants, eq(merchants.id, redemptions.merchantId))
      .where(and(eq(redemptions.userId, user.id), ne(redemptions.status, 'anulada')))
      .orderBy(desc(redemptions.redeemedAt))
      .limit(10),
  ]);
  const matched = new Set(cifra.matchedCommitments);
  return (
    <div className="space-y-5">
      <BackButton href="/app" label="Volver a Hoy" className="mb-2" />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">Ajustes</h1>
        <Link href="/app/datos" className="text-[14px] font-semibold text-primary-dark underline underline-offset-2">
          Ir a Tus datos (Ley 1581) →
        </Link>
      </div>

      <FreemiumPlanCard
        initialPlanTier={user.appPreferences?.planTier ?? 'esencial'}
        monthlyRedemptionsUsed={userRedemptions.length}
        recentMerchantNames={Array.from(new Set(userRedemptions.map((r) => r.merchantName)))}
      />

      <Section id="ingreso" title="Tu ingreso">
        <IncomeForm frequency={user.incomeFrequency ?? null} days={user.incomeDays ?? null} />
      </Section>

      <Section id="zona" title="Tu zona para ofertas cercanas">
        <ZoneForm currentZone={user.zoneSlug ?? null} />
      </Section>

      <Section id="dia-a-dia" title="Tu gasto del día a día">
        <DailySpendForm
          current={user.dailySpendMinor == null ? '' : String(Math.round(user.dailySpendMinor / 100))}
          fromMovements={cifra.dailySource === 'movimientos'}
        />
      </Section>

      <Section title="Colchón de seguridad">
        <BufferForm current={String(Math.round(user.bufferMinor / 100))} />
      </Section>

      <Section id="cobros-fijos" title="Cobros fijos que escribiste">
        <p className="-mt-1 mb-4 text-[14px] text-ink-muted">
          Arriendo, servicios, cuotas. Si uno de estos ya aparece en tus movimientos, lo contamos una sola vez.
        </p>
        {comms.length > 0 && (
          <ul className="mb-5 divide-y divide-line rounded-xl border border-line">
            {comms.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[14.5px]">
                <span>
                  <span className="font-semibold">{c.name}</span>{' '}
                  <span className="text-ink-muted">el {c.dayOfMonth} de cada mes</span>
                  {matched.has(c.id) && <span className="block text-[12.5px] text-ink-faint">Ya aparece en tus movimientos</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tnum font-semibold">{cop(c.amountMinor)}</span>
                  <form action={removeCommitment}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="text-[13px] font-semibold text-neg">
                      Quitar
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
        <CommitmentForm />
      </Section>

      <Section title="Tu sesión y comercio">
        <p className="text-[14.5px] text-ink-muted">{user.email ?? 'Cuenta creada a través de entidad aliada'}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={logout}>
            <button type="submit" className="btn-ghost">
              Cerrar sesión
            </button>
          </form>
          <Link href="/negocio" className="btn-subtle">
            Tengo un negocio de barrio →
          </Link>
        </div>
      </Section>

      <Section title="Borrar mi cuenta y revocar autorización">
        <DeleteAccountForm />
      </Section>
    </div>
  );
}
