import Link from 'next/link';
import { Logo } from '@/components/logo';

export function AuthShell({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-md px-5 pt-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-12 pt-10">
        <h1 className="font-display text-[34px] font-bold leading-tight tracking-[-0.025em]">{title}</h1>
        <div className="mt-8">{children}</div>
        <div className="mt-8 text-[15px] text-ink-muted">{footer}</div>
      </main>
      <footer className="mx-auto w-full max-w-md px-5 pb-8 text-[13px] text-ink-faint">
        <Link href="/privacidad" className="underline-offset-2 hover:underline">Tratamiento de datos</Link>
        <span className="mx-2">|</span>
        <Link href="/terminos" className="underline-offset-2 hover:underline">Términos</Link>
      </footer>
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-neg">
      {message}
    </p>
  );
}
