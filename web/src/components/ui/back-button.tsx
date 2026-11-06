'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function BackButton({
  fallbackHref = '/app',
  href,
  label = 'Volver',
  className = '',
}: {
  fallbackHref?: string;
  href?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const target = href ?? fallbackHref;

  function handleClick(e: React.MouseEvent) {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  }

  return (
    <Link
      href={target}
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-white/80 px-3 py-1.5 text-[13px] font-semibold text-ink-muted shadow-sm backdrop-blur transition hover:border-ink hover:text-ink active:scale-95 ${className}`}
    >
      <ArrowLeft size={15} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
