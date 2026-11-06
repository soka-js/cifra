import Link from 'next/link';
import { BackButton } from '@/components/ui/back-button';
import { requireUser } from '@/lib/auth/session';
import { loadCifra, loadRankedOffersForUser } from '@/lib/data';
import { shortDate } from '@/lib/engine/dates';
import { cop } from '@/lib/format';
import { loadSmartMapBundle } from '@/lib/v3-data';
import { Ask } from './ask';

export const metadata = { title: '¿Puedo hacer este gasto?' };

export default async function GastoPage() {
  const user = await requireUser();
  const [c, offers, smartMap] = await Promise.all([
    loadCifra(user),
    loadRankedOffersForUser(user, 3),
    loadSmartMapBundle(user),
  ]);
  return (
    <div className="space-y-5">
      <BackButton href="/app" label="Volver a Hoy" className="mb-2" />
      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">¿Puedo hacer este gasto?</h1>
        {c.ready && (
          <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
            Lo cruzamos al instante con tus <span className="tnum font-semibold text-ink">{cop(c.availableMinor)}</span> libres hasta el{' '}
            {shortDate(c.nextIncomeOn)} ({c.daysLeft} {c.daysLeft === 1 ? 'día' : 'días'}), simulamos qué pasa si lo difieres a cuotas y te mostramos alternativas más baratas en tu cuadra.
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
          smartMapBundle={smartMap}
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
