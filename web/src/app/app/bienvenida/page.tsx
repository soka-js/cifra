import { requireUser } from '@/lib/auth/session';
import { IncomeFields } from '@/components/app/income-fields';
import { GaOnce } from '@/components/app/ga-once';
import { saveOnboarding } from '../actions';
import { QuickStart } from './quick-start';

export const metadata = { title: 'Bienvenida' };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const { nuevo } = await searchParams;
  const firstName = user.name ? user.name.split(' ')[0]! : null;

  // Quien llega desde su entidad ya tiene saldos y movimientos: solo falta saber cuándo le pagan.
  if (user.partnerId) {
    return (
      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">
          {firstName ? `${firstName}, ` : ''}¿cada cuánto te pagan?
        </h1>
        <p className="mt-2 text-[15.5px] leading-relaxed text-ink-muted">
          Tu cifra va desde hoy hasta tu próximo ingreso: salario, mesada u honorarios. Si lo dejas en blanco, intentamos encontrarlo en tus movimientos.
        </p>
        <form action={saveOnboarding} className="mt-7 space-y-6">
          <IncomeFields frequency={user.incomeFrequency ?? null} days={user.incomeDays ?? null} />
          <button type="submit" className="btn-primary w-full">Seguir</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      {nuevo === '1' && <GaOnce name="sign_up" />}
      <QuickStart firstName={firstName} frequency={user.incomeFrequency ?? null} days={user.incomeDays ?? null} />
    </div>
  );
}
