import { ArrowLeft, Store } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogoMark } from '@/components/logo';
import { getMerchantAccess, requireUser } from '@/lib/auth/session';
import { DEFAULT_COMMISSION_LABEL } from '@/lib/commission';
import { RegisterMerchantForm } from '../unirse/register-merchant-form';

export const metadata = { title: 'Registrar mi negocio · CIFRA' };

export default async function RegistroNegocioAutenticadoPage() {
  const user = await requireUser();
  const existing = await getMerchantAccess();
  if (existing) redirect('/negocio');

  return (
    <div className="min-h-screen bg-paper px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/app" className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-ink-muted hover:text-ink">
            <ArrowLeft size={16} aria-hidden="true" />
            Volver a mi cifra personal
          </Link>
          <LogoMark size={26} />
        </div>

        <div className="surface-card p-6 sm:p-8">
          <span className="badge-terra">
            <Store size={12} aria-hidden="true" />
            Activar vitrina de comercio
          </span>
          <h1 className="mt-3 font-display text-[28px] font-bold leading-tight text-ink">
            Registra tu negocio de barrio en CIFRA
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-muted">
            Tu negocio quedará asociado a tu cuenta ({user.email}). No tiene costo fijo: solo pagas el {DEFAULT_COMMISSION_LABEL} cuando cobras en caja una venta traída por CIFRA.
          </p>

          <div className="mt-6 border-t border-line pt-6">
            <RegisterMerchantForm
              isLoggedIn
              defaultOwnerName={user.name}
              defaultZoneSlug={user.zoneSlug}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
