import { BackButton } from '@/components/ui/back-button';
import { requireMerchantAccess } from '@/lib/auth/session';
import { MerchantProfileForm } from './profile-form';

export const metadata = { title: 'Datos del negocio · CIFRA' };

export default async function MerchantProfilePage() {
  const access = await requireMerchantAccess();

  return (
    <div className="space-y-5">
      <BackButton href="/negocio" label="Volver a Inicio de Negocio" className="mb-2" />
      <div>
        <span className="badge-terra">Vitrina en tu barrio</span>
        <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink">
          Datos de {access.merchant.name}
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          Mantén al día tu dirección, horario y ubicación en el mapa para que los vecinos lleguen fácil a tu mostrador.
        </p>
      </div>

      <MerchantProfileForm merchant={access.merchant} />
    </div>
  );
}
