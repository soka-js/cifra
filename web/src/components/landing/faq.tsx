'use client';

import { track } from '@/lib/analytics/client';

export function Faq({ items }: { items: Array<{ q: string; a: React.ReactNode }> }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((it, i) => (
        <details
          key={it.q}
          className="group py-5"
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open) track('faq_open', { question: i + 1 });
          }}
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
            {it.q}
            <span
              aria-hidden="true"
              className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-ink-muted transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="mt-3 max-w-prose text-[15.5px] leading-relaxed text-ink-muted">{it.a}</div>
        </details>
      ))}
    </div>
  );
}
