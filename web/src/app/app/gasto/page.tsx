import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { loadCifra, loadRankedOffersForUser } from '@/lib/data';
import { shortDate } from '@/lib/engine/dates';
import { cop } from '@/lib/format';
import { Ask } from './ask';

export const metadata = { title: '¿Puedo gastar?' };

/** La misma pregunta del Hoy, con más detalle. Se abre desde ahí, con el monto ya escrito. */
export default async function GastoPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const [c, offers, sp] = await Promise.all([loadCifra(user), loadRankedOffersForUser(user, 3), searchParams]);
  const asked = sp.monto && /^\d{1,12}$/.test(sp.monto) ? Number(sp.monto) * 100 : null;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="sr-only">¿Puedo gastar?</h1>
        {c.ready && (
          <p className="text-[16px] leading-relaxed text-ink-muted">
            {c.availableMinor >= 0 ? (
              <>
                Puedes gastar <span className="tnum font-semibold text-ink">{cop(c.availableMinor)}</span> hasta el {shortDate(c.nextIncomeOn)} (
                {c.daysLeft} {c.daysLeft === 1 ? 'día' : 'días'}).
              </>
            ) : (
              <>
                Te faltan <span className="tnum font-semibold text-ink">{cop(Math.abs(c.availableMinor))}</span> para llegar al{' '}
                {shortDate(c.nextIncomeOn)}.
              </>
            )}{' '}
            Escribe cuánto cuesta lo que quieres comprar y te decimos si te alcanza.
          </p>
        )}
      </div>

      {c.ready ? (
        <Ask
          cifra={{
            availableMinor: c.availableMinor,
            perDayMinor: c.perDayMinor,
            dailyVariableMinor: c.dailyVariableMinor,
            daysLeft: c.daysLeft,
            nextIncomeOn: c.nextIncomeOn,
          }}
          nearbyOffers={offers.map((o) => ({
            id: o.offer.id,
            merchantName: o.offer.merchantName,
            title: o.offer.title,
            neighborhood: o.offer.neighborhood,
            estimatedSavingsMinor: o.estimatedSavingsMinor,
          }))}
          initialAmountMinor={asked && asked > 0 ? asked : null}
        />
      ) : (
        <div className="surface-card p-6">
          <p className="text-[16px] text-ink-muted">
            Primero necesitamos {c.missing.includes('saldo') ? 'tu saldo de hoy' : 'tu gasto del día a día'}.{' '}
            <Link
              href={c.missing.includes('saldo') ? '/app' : '/app/bienvenida'}
              className="font-semibold text-primary-dark underline"
            >
              {c.missing.includes('saldo') ? 'Escribir saldo' : 'Calcular mi cifra en un minuto'}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
