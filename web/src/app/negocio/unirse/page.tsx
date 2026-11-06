import { CheckCircle2, ShieldCheck, Store } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { LogoMark } from '@/components/logo';
import { getCurrentUser, getMerchantAccess } from '@/lib/auth/session';
import { RegisterMerchantForm } from './register-merchant-form';

export const metadata = { title: 'Únete como negocio de barrio · CIFRA' };

export default async function UnirseNegocioPage() {
  const access = await getMerchantAccess();
  if (access) {
    redirect('/negocio');
  }
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-paper px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <BackButton href="/" label="Volver a Inicio" className="mb-2" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="font-display text-[22px] font-bold tracking-[-0.025em] text-ink">cifra</span>
          </Link>
          <div className="flex items-center gap-3 text-[13.5px]">
            <span className="text-ink-muted">¿Ya tienes negocio registrado?</span>
            <Link href="/entrar?next=/negocio" className="font-semibold text-terra-dark underline">
              Entrar a mi negocio
            </Link>
          </div>
        </div>

        <div className="surface-card p-6 sm:p-8">
          <span className="badge-terra">
            <Store size={12} aria-hidden="true" />
            Para comercios independientes de barrio
          </span>
          <h1 className="mt-3 font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink">
            Trae clientes nuevos de tu cuadra y paga solo después de vender
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
            Sin volantes que terminan en la caneca ni anuncios en redes que cobran por clic sin vender. Publica una oferta para vecinos que sí compran en tu categoría y solo pagas 5 % sobre lo cobrado en tu caja.
          </p>

          <ul className="mt-5 grid gap-3 rounded-2xl bg-paper p-4 text-[13.5px] text-ink-soft sm:grid-cols-3">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-ink">$0 fijo al mes:</strong> ni inscripción ni mensualidades.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-ink">Solo clientes nuevos:</strong> protegemos a tu clientela actual.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-ink">Cuentas claras:</strong> informe mensual de 1 sola página.
              </span>
            </li>
          </ul>

          <div className="mt-6 border-t border-line pt-6">
            <RegisterMerchantForm
              isLoggedIn={Boolean(user)}
              defaultOwnerName={user?.name}
              defaultZoneSlug={user?.zoneSlug}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
