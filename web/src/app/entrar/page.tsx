import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/shell';
import { getCurrentUser } from '@/lib/auth/session';
import { LoginForm } from './form';

export const metadata = { title: 'Entrar' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const nextPath = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : undefined;
  if (await getCurrentUser()) redirect(nextPath ?? '/app');

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <AuthShell
      title={nextPath?.startsWith('/negocio') ? 'Entra a tu negocio en CIFRA' : 'Entra a tu cifra'}
      subtitle={
        nextPath?.startsWith('/negocio')
          ? 'Valida códigos en caja, revisa tus 4 cifras del mes y gestiona tu oferta activa.'
          : 'Revisa cuánto puedes gastar hasta tu próximo pago sin quedarte corto.'
      }
      footer={
        <div className="space-y-2.5">
          <p>
            ¿No tienes cuenta?{' '}
            <Link
              href={nextPath ? `/registro?next=${encodeURIComponent(nextPath)}` : '/registro'}
              className="font-semibold text-primary-dark underline-offset-2 hover:underline"
            >
              Créala gratis en un minuto
            </Link>
          </p>
          <p className="text-[13.5px]">
            ¿Tienes un negocio de barrio?{' '}
            <Link href="/negocio" className="font-semibold text-terra-dark underline-offset-2 hover:underline">
              Ir al portal de comercios →
            </Link>
          </p>
          <p className="text-[13.5px]">
            ¿Quieres explorar primero sin registrarte?{' '}
            <Link href="/demo" className="font-semibold text-ink underline-offset-2 hover:underline">
              Abrir Demo interactivo en 1 clic →
            </Link>
          </p>
        </div>
      }
    >
      {sp.enlace && (
        <p role="status" className="mb-6 rounded-xl bg-warn-light px-4 py-3 text-[14px] text-warn">
          {sp.enlace === 'vencido'
            ? 'Ese enlace ya se usó o venció. Vuelve a abrir CIFRA desde la app de tu entidad.'
            : 'Ese enlace no es válido. Vuelve a abrir CIFRA desde la app de tu entidad.'}
        </p>
      )}
      {sp.oauth === 'error' && (
        <p role="alert" className="mb-6 rounded-xl bg-neg-light px-4 py-3 text-[14px] text-neg">
          No pudimos completar el ingreso con Google. Intenta de nuevo o entra con tu correo.
        </p>
      )}
      <LoginForm nextPath={nextPath} googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
