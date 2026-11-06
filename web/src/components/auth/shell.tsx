import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/logo';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6">
        <Logo />
        <Link href="/" className="text-[13.5px] font-semibold text-ink-muted hover:text-ink">
          Inicio
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-12 pt-8">
        <h1 className="font-display text-[32px] font-bold leading-tight tracking-[-0.025em] text-ink">{title}</h1>
        {subtitle && <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-muted">{subtitle}</p>}
        <div className="mt-7">{children}</div>
        <div className="mt-7 text-[14.5px] text-ink-muted">{footer}</div>
      </main>
      <footer className="mx-auto w-full max-w-md px-5 pb-8 text-[13px] text-ink-faint">
        <p className="mb-2.5 flex items-center gap-1.5 text-ink-muted">
          <ShieldCheck size={15} className="text-primary" aria-hidden="true" />
          <span>Nunca te pedimos claves bancarias. Datos protegidos bajo Ley 1581 de 2012.</span>
        </p>
        <Link href="/privacidad" className="underline-offset-2 hover:underline">
          Tratamiento de datos
        </Link>
        <span className="mx-2">|</span>
        <Link href="/terminos" className="underline-offset-2 hover:underline">
          Términos
        </Link>
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
