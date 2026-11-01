import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/shell';
import { getCurrentUser } from '@/lib/auth/session';
import { LoginForm } from './form';

export const metadata = { title: 'Entrar' };

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await getCurrentUser()) redirect('/app');
  const { enlace } = await searchParams;
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
      {enlace && (
        <p role="status" className="mb-6 rounded-xl bg-warn-light px-4 py-3 text-[14px] text-warn">
          {enlace === 'vencido'
            ? 'Ese enlace ya se usó o venció. Vuelve a abrir CIFRA desde la app de tu entidad.'
            : 'Ese enlace no es válido. Vuelve a abrir CIFRA desde la app de tu entidad.'}
        </p>
      )}
      <LoginForm />
    </AuthShell>
  );
}
