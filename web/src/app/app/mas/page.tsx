import { Bell, CalendarCheck2, Repeat, Shield, ShieldCheck, Store, Upload } from 'lucide-react';
import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import { MenuGroup, MenuRow } from '@/components/app/menu-list';
import { InstallCard } from '@/components/install';
import { getMerchantAccess, getSessionContext, isAdmin, requireUser } from '@/lib/auth/session';
import { loadUnreadNotificationsCount } from '@/lib/data';

export const metadata = { title: 'Más' };

/**
 * "Más": lo que la persona no usa todos los días, cada cosa en un renglón que dice para qué sirve.
 * Aquí no hay ningún número de plata: solo a dónde ir.
 */
export default async function MasPage() {
  const user = await requireUser();
  // Misma sesión ya leída (getSessionContext va en cache()): solo para saber si quien entró es admin real.
  const ctx = await getSessionContext();
  const [unread, merchantAccess] = await Promise.all([loadUnreadNotificationsCount(user.id), getMerchantAccess()]);
  const initial = (user.name ?? user.email ?? 'C').trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Más</h1>

      <div className="flex items-center gap-3.5 px-1 pt-1">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-[19px] font-bold text-white" aria-hidden="true">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">{user.name ?? 'Tu cuenta'}</p>
          {user.email && <p className="truncate text-[13.5px] text-ink-muted">{user.email}</p>}
        </div>
      </div>

      <MenuGroup title="Tu plata">
        <MenuRow href="/app/cobros" icon={Repeat} label="Cobros fijos" hint="Arriendo, servicios, suscripciones y cuotas" />
        <MenuRow href="/app/ajustes" icon={CalendarCheck2} label="Tu ingreso y tu día a día" hint="Cuándo te pagan y cuánto gastas al día" />
        <MenuRow href="/app/datos/importar" icon={Upload} label="Subir un extracto" hint="Afina tu cifra con los movimientos de tu banco" />
      </MenuGroup>

      <MenuGroup title="Tu cuenta">
        <MenuRow href="/app/avisos" icon={Bell} label="Avisos" hint="El día de pago, cobros que vienen y ahorros" badge={unread} />
        <MenuRow href="/app/datos" icon={ShieldCheck} label="Tus datos y privacidad" hint="Qué guardamos, cómo descargarlo y cómo borrarlo" />
        {merchantAccess ? (
          <MenuRow href="/negocio" icon={Store} label="Mi negocio" hint={merchantAccess.merchant.name} tone="terra" />
        ) : (
          <MenuRow href="/negocio/unirse" icon={Store} label="Tengo un negocio" hint="Publica una oferta y cobra con un código" tone="terra" />
        )}
        {isAdmin(ctx?.realUser) && <MenuRow href="/admin" icon={Shield} label="Administración" tone="neutral" />}
      </MenuGroup>

      <InstallCard />

      <form action={logout}>
        <button id="btn-cerrar-sesion" type="submit" className="btn-ghost w-full">
          Cerrar sesión
        </button>
      </form>

      <p className="pb-2 text-center text-[12.5px] text-ink-faint">
        <Link href="/terminos" className="underline-offset-2 hover:underline">
          Términos
        </Link>
        {' · '}
        <Link href="/privacidad" className="underline-offset-2 hover:underline">
          Tratamiento de datos
        </Link>
      </p>
    </div>
  );
}
