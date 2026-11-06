import { QrCode, Settings, Store } from 'lucide-react';
import Link from 'next/link';
import { LogoMark } from '@/components/logo';
import { AppTopBar } from '@/components/app/app-top-bar';
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

        <AppTopBar
          merchantName={access.merchant.name}
          merchantSlug={access.merchant.slug}
          isDemo={access.merchant.isDemo || access.user.isDemo}
          role="negocio"
        />

        <main className="mx-auto max-w-3xl px-4 pb-28 pt-4 sm:px-6 lg:pb-14 lg:pt-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>

      <MerchantBottomNav />
    </div>
  );
}
