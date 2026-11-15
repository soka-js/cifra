import { ChevronRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

/**
 * Listas de opciones como las de cualquier aplicación del celular: un renglón por destino, con su
 * ícono, una línea que dice para qué sirve y la flecha. Las usan "Más" (persona) y "Mi negocio".
 */

export function MenuGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section>
      {title && <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">{title}</h2>}
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">{children}</div>
    </section>
  );
}

export function MenuRow({
  href,
  icon: Icon,
  label,
  hint,
  badge,
  tone = 'primary',
  id,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
  /** Un contador corto a la derecha (por ejemplo, avisos sin leer). */
  badge?: string | number | null;
  tone?: 'primary' | 'terra' | 'neutral';
  id?: string;
}) {
  const chip =
    tone === 'terra' ? 'bg-terra-light text-terra-dark' : tone === 'neutral' ? 'bg-paper-warm text-ink-muted' : 'bg-primary-light text-primary-dark';
  return (
    <Link id={id} href={href} className="flex min-h-[60px] items-center gap-3.5 px-4 py-3 transition-colors active:bg-paper-warm hover:bg-paper/60">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${chip}`}>
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">{label}</span>
        {hint && <span className="block truncate text-[13px] text-ink-muted">{hint}</span>}
      </span>
      {badge !== null && badge !== undefined && badge !== 0 && (
        <span className="tnum inline-flex min-w-5 items-center justify-center rounded-full bg-terra px-1.5 py-0.5 text-[11.5px] font-bold text-white">
          {badge}
        </span>
      )}
      <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden="true" />
    </Link>
  );
}
