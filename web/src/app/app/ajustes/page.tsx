import { eq } from 'drizzle-orm';
import { logout } from '@/app/actions/auth';
import { db } from '@/lib/db';
import { commitments } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/session';
import { cop } from '@/lib/format';
import { removeCommitment } from '../actions';
import { loadCifra } from '@/lib/data';
import { BufferForm, CommitmentForm, DailySpendForm, DeleteAccountForm, IncomeForm } from './forms';

export const metadata = { title: 'Ajustes' };

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-2xl border border-line bg-white px-5 py-5">
      <h2 className="font-display text-[20px] font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AjustesPage() {
  const user = await requireUser();
  const [comms, cifra] = await Promise.all([db.select().from(commitments).where(eq(commitments.userId, user.id)), loadCifra(user)]);
  const matched = new Set(cifra.matchedCommitments);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Ajustes</h1>

      <Section id="ingreso" title="Tu ingreso">
        <IncomeForm frequency={user.incomeFrequency ?? null} days={user.incomeDays ?? null} />
      </Section>

      <Section id="dia-a-dia" title="Tu gasto del día a día">
        <DailySpendForm
          current={user.dailySpendMinor == null ? '' : String(Math.round(user.dailySpendMinor / 100))}
          fromMovements={cifra.dailySource === 'movimientos'}
        />
      </Section>

      <Section title="Colchón">
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
                  <span className="font-semibold">{c.name}</span> <span className="text-ink-muted">el {c.dayOfMonth} de cada mes</span>
                  {matched.has(c.id) && <span className="block text-[12.5px] text-ink-faint">Ya aparece en tus movimientos</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tnum font-semibold">{cop(c.amountMinor)}</span>
                  <form action={removeCommitment}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="text-[13px] font-semibold text-neg">Quitar</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
        <CommitmentForm />
      </Section>

      <Section title="Tu cuenta">
        <p className="text-[14.5px] text-ink-muted">{user.email ?? 'Cuenta creada por tu entidad'}</p>
        <form action={logout} className="mt-4">
          <button type="submit" className="btn-ghost">Cerrar sesión</button>
        </form>
      </Section>

      <Section title="Borrar mi cuenta">
        <DeleteAccountForm />
      </Section>
    </div>
  );
}
