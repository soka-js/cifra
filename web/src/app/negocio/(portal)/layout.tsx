import { AppTopBar } from '@/components/app/app-top-bar';
import { StickyHeader } from '@/components/app/sticky-header';
import { DemoBar } from '@/components/demo/demo-bar';
import { MerchantBottomNav, MerchantSidebar } from '@/components/merchant/nav';
import { getSessionContext, isAdmin, requireMerchantAccess } from '@/lib/auth/session';

export default async function MerchantPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireMerchantAccess();
  const ctx = await getSessionContext();

  return (
    <div className="min-h-screen bg-paper">
      <MerchantSidebar
        merchantId={access.merchant.id}
        merchantName={access.merchant.name}
        neighborhood={access.merchant.neighborhood}
        allMerchants={access.allMerchants}
        isAdmin={isAdmin(ctx?.realUser)}
      />

      <div className="lg:pl-64 print:pl-0">
        <StickyHeader>
          {ctx?.demoView && <DemoBar viewing="tendero" />}
          <AppTopBar merchantName={access.merchant.name} merchantSlug={access.merchant.slug} role="negocio" />
        </StickyHeader>

        <main className="mx-auto max-w-3xl px-4 pb-28 pt-4 sm:px-6 lg:pb-14 lg:pt-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>

      <MerchantBottomNav />
    </div>
  );
}
