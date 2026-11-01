import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { loadCifra } from '@/lib/data';
import { shortDate } from '@/lib/engine/dates';
import { cop } from '@/lib/format';
import { Ask } from './ask';

export const metadata = { title: '¿Puedo hacer este gasto?' };

export default async function GastoPage() {
  const user = await requireUser();
  const c = await loadCifra(user);
  return (
    <div>
      <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">¿Puedo hacer este gasto?</h1>
      {c.ready ? (
        <>
          <p className="mt-2 text-[15px] text-ink-muted">
            Lo comparamos con tu cifra: <span className="tnum font-semibold text-ink">{cop(c.availableMinor)}</span> libres hasta el{' '}
            {shortDate(c.nextIncomeOn)}.
          </p>
          <div className="mt-6">
            <Ask cifra={{ availableMinor: c.availableMinor, dailyVariableMinor: c.dailyVariableMinor, daysLeft: c.daysLeft, nextIncomeOn: c.nextIncomeOn }} />
          </div>
        </>
      ) : (
        <p className="mt-4 text-[16px] text-ink-muted">
          Primero necesitamos {c.missing.includes('movimientos') ? 'tus movimientos' : 'tu saldo'}.{' '}
          <Link href={c.missing.includes('movimientos') ? '/app/datos/importar' : '/app/datos'} className="font-semibold text-primary-dark underline">
            {c.missing.includes('movimientos') ? 'Subir extracto' : 'Escribir saldo'}
          </Link>
        </p>
      )}
    </div>
  );
}
