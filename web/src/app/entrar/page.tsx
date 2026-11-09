import { ShieldCheck, Store, UserRound } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/shell';
import { getExplicitSessionUser } from '@/lib/auth/session';
import { LoginForm } from './form';

export const metadata = { title: 'Entrar · CIFRA' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const nextPath = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : undefined;
  if (await getExplicitSessionUser()) redirect(nextPath ?? '/app');

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

      {/* Selector rápido de cuentas activas para entrar en 1 clic */}
      <div className="mt-6 border-t border-line pt-5">
        <p className="text-[12px] font-bold uppercase tracking-wider text-ink-muted">
          Cuentas activas en este dispositivo (1 clic)
        </p>
        <div className="mt-2.5 grid gap-2">
          <a
            href="/api/demo/session?role=persona&redirect=/app"
            className="flex items-center justify-between rounded-xl border border-line bg-paper/60 px-3.5 py-2.5 text-[13px] transition hover:border-primary/40 hover:bg-primary-pale/40"
          >
            <span className="flex items-center gap-2 font-semibold text-ink">
              <UserRound size={15} className="text-primary-dark" />
              <span>Mariana Rojas · App Persona</span>
            </span>
            <span className="text-[12px] font-bold text-primary-dark">Entrar →</span>
          </a>
          <a
            href="/api/demo/session?role=merchant&redirect=/negocio"
            className="flex items-center justify-between rounded-xl border border-line bg-paper/60 px-3.5 py-2.5 text-[13px] transition hover:border-terra/40 hover:bg-terra-pale/40"
          >
            <span className="flex items-center gap-2 font-semibold text-ink">
              <Store size={15} className="text-terra-dark" />
              <span>Panadería La Espiga · Portal Comercio</span>
            </span>
            <span className="text-[12px] font-bold text-terra-dark">Entrar →</span>
          </a>
          <a
            href="/api/demo/session?role=admin&redirect=/admin?tab=dataroom"
            className="flex items-center justify-between rounded-xl border border-line bg-paper/60 px-3.5 py-2.5 text-[13px] transition hover:border-ink/40 hover:bg-white"
          >
            <span className="flex items-center gap-2 font-semibold text-ink">
              <ShieldCheck size={15} className="text-ink-muted" />
              <span>Consola Admin & Data Room</span>
            </span>
            <span className="text-[12px] font-bold text-ink">Abrir →</span>
          </a>
        </div>
      </div>
    </AuthShell>
  );
}
