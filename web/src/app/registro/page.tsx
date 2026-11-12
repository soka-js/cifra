import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/shell';
import { getCurrentUser } from '@/lib/auth/session';
import { SignupForm } from './form';

export const metadata = { title: 'Crear cuenta' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const nextPath = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : undefined;
  if (await getCurrentUser()) redirect(nextPath ?? '/app');

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  // Viene de calcular su cifra en la página pública: la cuenta es para guardarla.
  const fromTrial = sp.desde === 'prueba';

  return (
    <AuthShell
      title={fromTrial ? 'Guarda tu cifra' : 'Crea tu cuenta en CIFRA'}
      subtitle={
        fromTrial
          ? 'Crea tu cuenta y queda lista con lo que acabas de escribir. No tienes que repetirlo.'
          : 'Sabrás cuánto puedes gastar hasta tu próximo pago, con tus extractos o escribiendo cuatro números.'
      }
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link
            href={nextPath ? `/entrar?next=${encodeURIComponent(nextPath)}` : '/entrar'}
            className="font-semibold text-primary-dark underline-offset-2 hover:underline"
          >
            Entra aquí
          </Link>
        </>
      }
    >
      <SignupForm nextPath={nextPath} googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
