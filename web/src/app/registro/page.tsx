import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/shell';
import { getCurrentUser } from '@/lib/auth/session';
import { SignupForm } from './form';

export const metadata = { title: 'Crear cuenta' };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect('/app');
  return (
    <AuthShell
      title="Crea tu cuenta"
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link href="/entrar" className="font-semibold text-primary-dark underline-offset-2 hover:underline">
            Entra aquí
          </Link>
        </>
      }
    >
      <p className="-mt-4 mb-7 text-[16px] leading-relaxed text-ink-muted">
        Después te pedimos el extracto de tu banco en CSV o Excel. Tenlo a la mano.
      </p>
      <SignupForm />
    </AuthShell>
  );
}
