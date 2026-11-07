import { Bell, Settings, Store } from 'lucide-react';
import Link from 'next/link';
import { BottomNav, DesktopSidebar } from '@/components/app/nav';
import { AppTopBar } from '@/components/app/app-top-bar';
import { DemoTourController } from '@/components/demo/demo-tour-controller';
import { LogoMark } from '@/components/logo';
import { getMerchantAccess, isAdmin, requireUser } from '@/lib/auth/session';
import { loadUnreadNotificationsCount } from '@/lib/data';
import { getZoneBySlug } from '@/lib/zones';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tu cifra', robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
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
        isAdmin={isAdmin(user)}
        isDemo={user.isDemo}
      />

      <AppTopBar
        userName={user.name}
        unreadCount={unreadCount}
        isDemo={false}
        role="persona"
      />

      <main className="mx-auto max-w-2xl px-4 pt-4 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
      <BottomNav />
      <DemoTourController isDemo={user.isDemo} currentRole="persona" />
    </div>
  );
}
