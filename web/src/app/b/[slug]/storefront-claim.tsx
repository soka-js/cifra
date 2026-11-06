'use client';

import { Copy, QrCode } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { claimOfferCodeInlineAction } from '@/app/actions/v3';

export function StorefrontOfferClaim({
  offerId,
  isLoggedIn,
  merchantSlug,
  initialCode,
}: {
  offerId: string;
  isLoggedIn: boolean;
  merchantSlug: string;
  initialCode?: { code: string; qrDataUrl: string } | null;
}) {
  const [codeData, setCodeData] = useState<{ code: string; qrDataUrl: string } | null>(
    initialCode ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!isLoggedIn) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/entrar?next=${encodeURIComponent(`/b/${merchantSlug}`)}`}
          className="btn-terra text-[14px]"
        >
          <QrCode size={16} aria-hidden="true" />
          Activar descuento gratis en mostrador
        </Link>
        <Link href="/demo" className="btn-ghost text-[13.5px]">
          Probar en modo Demo
        </Link>
      </div>
    );
  }

  if (codeData) {
    return (
      <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-primary-pale/70 p-4 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={codeData.qrDataUrl}
          alt={`QR ${codeData.code}`}
          className="h-24 w-24 shrink-0 rounded-xl border border-line bg-white p-1.5"
        />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-[11.5px] font-bold uppercase tracking-wider text-primary-dark">
            Muéstrale este código en caja
          </p>
          <div className="mt-1 flex items-center justify-center gap-2 sm:justify-start">
            <span className="tnum rounded-xl border border-line bg-white px-3 py-1 font-mono text-[24px] font-extrabold tracking-widest text-ink">
              {codeData.code}
            </span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(codeData.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  // ignore
                }
              }}
              className="btn-sm border border-line bg-white text-ink"
            >
              <Copy size={13} aria-hidden="true" />
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-soft">
            Vigente por 30 minutos · Sin recargos ni intermediarios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await claimOfferCodeInlineAction(offerId);
            if (!res.ok || !res.code || !res.qrDataUrl) {
              setError(res.error ?? 'No pudimos generar el código en este momento.');
              return;
            }
            setCodeData({ code: res.code, qrDataUrl: res.qrDataUrl });
          });
        }}
        className="btn-terra w-full sm:w-auto"
      >
        <QrCode size={16} aria-hidden="true" />
        {isPending ? 'Generando tu QR…' : 'Generar código y QR para mostrador'}
      </button>
      {error && <p className="mt-2 text-[13px] font-medium text-neg">{error}</p>}
    </div>
  );
}
