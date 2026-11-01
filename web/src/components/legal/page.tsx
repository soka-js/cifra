import Link from 'next/link';
import { Logo } from '@/components/logo';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Logo />
        <Link href="/" className="text-[15px] font-semibold text-primary-dark">Volver al inicio</Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-6">
        <h1 className="font-display text-[38px] font-bold leading-tight tracking-[-0.025em]">{title}</h1>
        <p className="mt-2 text-[14px] text-ink-faint">Última actualización: {updated}</p>
        <div className="legal mt-10 max-w-prose space-y-5 text-[16px] leading-relaxed text-ink-muted [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink [&_ul]:space-y-2">
          {children}
        </div>
      </main>
    </div>
  );
}
