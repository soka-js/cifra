'use client';

import { Check, Tag, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { CATEGORY_LABEL, EDITABLE_CATEGORIES, type Category } from '@/lib/engine/merchant';
import { reclassifyMerchant } from '../actions';

export function ReclassifyChip({
  merchantKey,
  merchantName,
  currentCategory,
  isUserRule,
}: {
  merchantKey: string;
  merchantName: string;
  currentCategory: Category;
  isUserRule: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function selectCategory(nextCat: Category) {
    const fd = new FormData();
    fd.set('merchantKey', merchantKey);
    fd.set('merchantName', merchantName);
    fd.set('category', nextCat);
    startTransition(async () => {
      await reclassifyMerchant(fd);
      setOpen(false);
    });
  }

  return (
    <div className="inline-block">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors ${
          isUserRule
            ? 'border-primary/30 bg-primary-pale text-primary-dark'
            : 'border-line bg-paper text-ink-muted hover:border-line-strong hover:text-ink'
        }`}
        title="Cambiar categoría para todos los movimientos de este comercio"
      >
        <Tag size={11} aria-hidden="true" />
        <span>{pending ? 'Guardando...' : CATEGORY_LABEL[currentCategory]}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-2xl border border-line bg-paper p-3 shadow-card">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-ink">
              Clasificar siempre «{merchantName}» como:
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar selector de categoría"
              className="rounded-lg p-1 text-ink-faint hover:bg-white hover:text-ink"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EDITABLE_CATEGORIES.map((cat) => {
              const active = cat === currentCategory;
              return (
                <button
                  key={cat}
                  type="button"
                  disabled={pending}
                  onClick={() => selectCategory(cat)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                    active
                      ? 'border-primary bg-primary text-white'
                      : 'border-line bg-white text-ink-soft hover:border-primary hover:text-primary-dark'
                  }`}
                >
                  {active && <Check size={12} aria-hidden="true" />}
                  <span>{CATEGORY_LABEL[cat]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
