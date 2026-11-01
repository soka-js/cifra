import Link from 'next/link';

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="12.5" cy="16" r="7.5" fill="#0E6E63" fillOpacity="0.92" />
      <circle cx="19.5" cy="16" r="7.5" fill="#6FB8AE" fillOpacity="0.85" />
    </svg>
  );
}

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-lg" aria-label="CIFRA, inicio">
      <LogoMark />
      <span className="font-display text-[22px] font-bold tracking-[-0.02em]">cifra</span>
    </Link>
  );
}
