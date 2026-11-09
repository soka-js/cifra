import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/shell';
import { getExplicitSessionUser } from '@/lib/auth/session';
import { SignupForm } from './form';

export const metadata = { title: 'Crear cuenta' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const nextPath = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : undefined;
  if (await getExplicitSessionUser()) redirect(nextPath ?? '/app');

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <AuthShell
      title="Crea tu cuenta en CIFRA"
      subtitle="En menos de 5 minutos sabrás exactamente cuánto puedes gastar hasta tu próximo pago, con tus extractos o escribiendo cuatro números."
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
