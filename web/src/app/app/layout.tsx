import { BottomNav, DesktopSidebar } from '@/components/app/nav';
import { AppTopBar } from '@/components/app/app-top-bar';
import { StickyHeader } from '@/components/app/sticky-header';
import { DemoBar } from '@/components/demo/demo-bar';
import { getMerchantAccess, getSessionContext, isAdmin } from '@/lib/auth/session';
import { loadUnreadNotificationsCount } from '@/lib/data';
import { getZoneBySlug } from '@/lib/zones';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tu cifra', robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/entrar');
  const user = ctx.user;
  const [unreadCount, merchantAccess] = await Promise.all([
    loadUnreadNotificationsCount(user.id),
    getMerchantAccess(),
  ]);
  const zoneLabel = user.zoneSlug ? getZoneBySlug(user.zoneSlug).name : null;

  return (
    <div className="min-h-dvh bg-paper pb-24 lg:pb-12 lg:pl-64">
      <DesktopSidebar
        userName={user.name}
        zoneLabel={zoneLabel}
        unreadCount={unreadCount}
        hasMerchant={Boolean(merchantAccess)}
        isAdmin={isAdmin(ctx.realUser)}
      />

      <StickyHeader>
        {ctx.demoView && <DemoBar viewing="persona" />}
        <AppTopBar userName={user.name} unreadCount={unreadCount} role="persona" hasMerchant={Boolean(merchantAccess)} />
      </StickyHeader>

      <main className="mx-auto max-w-2xl px-4 pt-4 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
      <BottomNav />
    </div>
  );
}
