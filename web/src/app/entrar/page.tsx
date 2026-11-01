import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/shell';
import { getCurrentUser } from '@/lib/auth/session';
import { LoginForm } from './form';

export const metadata = { title: 'Entrar' };

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/app');
  return (
    <AuthShell
      title="Entra a tu cifra"
      footer={
        <div className="space-y-2">
          <p>
            ¿No tienes cuenta?{' '}
            <Link href="/registro" className="font-semibold text-primary-dark underline-offset-2 hover:underline">
              Créala gratis
            </Link>
          </p>
          {contact && (
            <p className="text-[14px]">
              ¿Olvidaste tu contraseña? Escríbenos a{' '}
              <a href={`mailto:${contact}`} className="underline">{contact}</a> desde el correo de tu cuenta.
            </p>
          )}
        </div>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
