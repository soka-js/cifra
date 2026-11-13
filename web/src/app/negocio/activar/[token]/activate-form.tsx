'use client';

import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useActionState } from 'react';
import { redeemMerchantInvite, type MerchantActionState } from '@/app/actions/merchant';
import { MerchantConsent } from '@/components/negocio/merchant-consent';

const INITIAL: MerchantActionState = { status: 'idle' };

export function ActivateMerchantForm({
  token,
  defaultOwnerName,
  defaultEmail,
  isLoggedIn,
}: {
  token: string;
  defaultOwnerName: string;
  defaultEmail: string | null;
  isLoggedIn: boolean;
}) {
  const [state, action, pending] = useActionState(redeemMerchantInvite, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.status === 'error' && (
        <div role="alert" className="rounded-xl border border-neg/25 bg-neg-light px-4 py-3 text-[14px] text-neg">
          {state.message}
        </div>
      )}

      {isLoggedIn ? (
        <div className="rounded-xl bg-primary-pale px-4 py-3 text-[14px] text-ink-soft">
          Vas a vincular este negocio a tu sesión actual. Quedarás como propietario y podrás atender la caja desde este celular.
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="ownerName" className="label">
              Tu nombre
            </label>
            <input
              id="ownerName"
              name="ownerName"
              type="text"
              required
              defaultValue={defaultOwnerName}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="email" className="label">
              Correo para recuperar acceso si cambias de celular
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={defaultEmail ?? ''}
              placeholder="ejemplo@correo.com"
              className="field"
            />
          </div>

          <div>
            <label htmlFor="password" className="label">
              Crea una clave fácil de recordar (mínimo 10 caracteres)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={10}
              placeholder="Al menos 10 caracteres"
              className="field"
            />
          </div>

          <MerchantConsent />
        </>
      )}

      <button type="submit" disabled={pending} className="btn-terra w-full text-[16px]">
        <CheckCircle2 size={18} aria-hidden="true" />
        {pending ? 'Activando tu negocio...' : 'Activar mi negocio y entrar'}
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </form>
  );
}
