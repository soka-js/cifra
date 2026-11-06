import { MapPin, Store, Tag } from 'lucide-react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { loadRankedOffersForUser } from '@/lib/data';
import { cop } from '@/lib/format';

export const metadata = { title: 'Ofertas cerca de ti' };

export default async function OfertasPage() {
  const user = await requireUser();
  const ranked = await loadRankedOffersForUser(user);

  return (
    <div className="space-y-6">
      <div>
        <span className="badge-terra">Comercios independientes de barrio</span>
        <h1 className="mt-2.5 font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">
          Ofertas cerca de ti
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          Beneficios filtrados según tus categorías reales de gasto y tu zona. Nunca compartimos tus extractos con los comercios.
        </p>
      </div>

      {ranked.length === 0 ? (
        <div className="surface-card space-y-3 p-6">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-terra-light text-terra-dark">
            <Store size={20} aria-hidden="true" />
          </div>
          <p className="text-[16px] font-semibold text-ink">Aún no hay campañas activas para tu zona hoy</p>
          <p className="text-[14px] leading-relaxed text-ink-muted">
            Puedes ajustar tu barrio en{' '}
            <Link href="/app/ajustes#zona" className="font-semibold text-primary-dark underline">
              Ajustes de zona
            </Link>{' '}
            o, si tienes una tienda, panadería o café, publicar tu primera campaña en el portal de comercios.
          </p>
        </div>
      ) : (
        <ul className="space-y-3.5">
          {ranked.map((item) => (
            <li key={item.offer.id} className="surface-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge-terra">
                      <Tag size={12} aria-hidden="true" />
                      {item.offer.discountKind === 'percent'
                        ? `${item.offer.discountPercent}% de descuento`
                        : `${cop(item.offer.discountFixedMinor ?? 0)} de descuento`}
                    </span>
                    <span className="text-[13px] font-semibold text-ink-muted">{item.offer.merchantName}</span>
                  </div>
                  <h2 className="mt-1.5 font-display text-[19px] font-bold text-ink">{item.offer.title}</h2>
                  {item.offer.description && (
                    <p className="mt-1 text-[14px] text-ink-soft">{item.offer.description}</p>
                  )}
                  <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-faint">
                    <MapPin size={13} aria-hidden="true" />
                    <span>
                      {item.whyRelevant} · {item.offer.address}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-[14px] font-bold text-primary-dark">
                    Ahorras ~{cop(item.estimatedSavingsMinor)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
