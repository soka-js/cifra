import { QrCode, Settings, Store } from 'lucide-react';
import Link from 'next/link';
import { LogoMark } from '@/components/logo';
import { MerchantBottomNav, MerchantSidebar } from '@/components/merchant/nav';
import { isAdmin, requireMerchantAccess } from '@/lib/auth/session';

export default async function MerchantPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireMerchantAccess();
  const admin = isAdmin(access.user);

  return (
    <div className="min-h-screen bg-paper">
      <MerchantSidebar
        merchantId={access.merchant.id}
        merchantName={access.merchant.name}
        neighborhood={access.merchant.neighborhood}
        allMerchants={access.allMerchants}
        isAdmin={admin}
        isDemo={access.merchant.isDemo || access.user.isDemo}
      />

      <div className="lg:pl-64 print:pl-0">
        {(access.merchant.isDemo || access.user.isDemo) && (
          <div className="no-print border-b border-terra/20 bg-terra-pale px-4 py-2 text-center text-[13px] text-terra-dark">
            Estás viendo el negocio de demostración <strong>{access.merchant.name}</strong>.{' '}
            <Link href="/demo" className="font-bold underline">
              Cambiar vista (Persona / Tendero / Data Room)
            </Link>
          </div>
        )}

        <header className="no-print sticky top-0 z-30 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
            <Link href="/negocio" className="flex min-w-0 items-center gap-2">
              <LogoMark size={24} />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold leading-tight text-ink">
                  {access.merchant.name}
                </p>
                <p className="truncate text-[11.5px] text-ink-muted">{access.merchant.neighborhood}</p>
              </div>
            </Link>

            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                href="/negocio/caja"
                className="inline-flex items-center gap-1.5 rounded-lg bg-terra px-3 py-1.5 text-[12.5px] font-semibold text-white"
              >
                <QrCode size={14} aria-hidden="true" />
                Caja
              </Link>
              <Link
                href="/negocio/perfil"
                aria-label="Datos del negocio"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink-muted"
              >
                <Settings size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 pb-28 pt-6 sm:px-6 lg:pb-14 lg:pt-10 print:max-w-none print:p-0">
          {children}
        </main>
      </div>

      <MerchantBottomNav />
    </div>
  );
}
