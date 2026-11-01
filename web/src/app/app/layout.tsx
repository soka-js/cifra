import { Settings } from 'lucide-react';
import Link from 'next/link';
import { BottomNav } from '@/components/app/nav';
import { LogoMark } from '@/components/logo';
import { requireUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tu cifra', robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh pb-24">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-5">
        <Link href="/app" className="inline-flex items-center gap-2 rounded-lg" aria-label="Inicio de CIFRA">
          <LogoMark size={26} />
          <span className="font-display text-[20px] font-bold tracking-[-0.02em]">cifra</span>
        </Link>
        <div className="flex items-center gap-1">
          <span className="mr-1 hidden text-[14px] text-ink-muted min-[380px]:inline">{user.name ? `Hola, ${user.name.split(' ')[0]}` : ''}</span>
          <Link href="/app/ajustes" className="grid h-10 w-10 place-items-center rounded-full text-ink-muted hover:bg-white hover:text-ink" aria-label="Ajustes">
            <Settings size={21} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
