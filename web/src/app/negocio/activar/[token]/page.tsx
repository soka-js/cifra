import { and, eq, gt, isNull } from 'drizzle-orm';
import { MapPin, ShieldCheck, Store } from 'lucide-react';
import Link from 'next/link';
import { LogoMark } from '@/components/logo';
import { getCurrentUser } from '@/lib/auth/session';
import { sha256 } from '@/lib/crypto';
import { db } from '@/lib/db';
import { merchantInvites, merchants } from '@/lib/db/schema';
import { ActivateMerchantForm } from './activate-form';

export const metadata = { title: 'Activar mi negocio en CIFRA' };

export default async function ActivateMerchantPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const hash = sha256(token);
  const currentUser = await getCurrentUser();

  const [inv] = await db
    .select({ invite: merchantInvites, merchant: merchants })
    .from(merchantInvites)
    .innerJoin(merchants, eq(merchants.id, merchantInvites.merchantId))
    .where(
      and(
        eq(merchantInvites.tokenHash, hash),
        isNull(merchantInvites.usedAt),
        gt(merchantInvites.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return (
    <div className="min-h-screen bg-paper px-4 py-10">
      <div className="mx-auto max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="font-display text-[22px] font-bold tracking-[-0.025em] text-ink">cifra</span>
          </Link>
          <span className="badge-terra">Negocios de barrio</span>
        </div>

        {!inv ? (
          <div className="surface-card space-y-4 p-6">
            <h1 className="font-display text-[24px] font-bold text-ink">
              Este enlace ya fue usado o venció
            </h1>
            <p className="text-[14.5px] leading-relaxed text-ink-muted">
              Si ya activaste tu negocio antes, puedes entrar directamente con tu correo y clave. Si aún no lo has registrado, hazlo gratis en 2 minutos.
            </p>
            <div className="flex flex-col gap-2.5 pt-1">
              <Link href="/entrar?next=/negocio" className="btn-primary w-full">
                Entrar a mi negocio
              </Link>
              <Link href="/negocio/unirse" className="btn-ghost w-full">
                Registrar mi negocio nuevo
              </Link>
            </div>
          </div>
        ) : (
          <div className="ticket-surface space-y-5 p-6 sm:p-7">
            <div>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-terra-light text-terra-dark">
                <Store size={22} aria-hidden="true" />
              </div>
              <h1 className="mt-3 font-display text-[26px] font-bold leading-tight text-ink">
                Hola, {inv.merchant.ownerName.split(' ')[0]} · Activa {inv.merchant.name}
              </h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-[13.5px] text-ink-muted">
                <MapPin size={14} className="text-terra" aria-hidden="true" />
                {inv.merchant.neighborhood} · {inv.merchant.address}
              </p>
            </div>

            <div className="rounded-2xl bg-paper p-4 text-[13.5px] leading-relaxed text-ink-soft">
              <p className="flex items-center gap-1.5 font-semibold text-ink">
                <ShieldCheck size={16} className="text-primary-dark" aria-hidden="true" />
                Regla clara de CIFRA:
              </p>
              <p className="mt-1">
                No pagas inscripción ni mensualidad fija. Solo pagas una comisión del <strong>5 %</strong> sobre las ventas reales cobradas en tu caja que provengan de un código o QR de CIFRA.
              </p>
            </div>

            <ActivateMerchantForm
              token={token}
              defaultOwnerName={inv.merchant.ownerName}
              defaultEmail={inv.merchant.email}
              isLoggedIn={Boolean(currentUser)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
