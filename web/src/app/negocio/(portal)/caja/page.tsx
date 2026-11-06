import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { requireMerchantAccess } from '@/lib/auth/session';
import { PosTerminal } from './pos-terminal';

export const metadata = { title: 'Caja · Cobrar código CIFRA' };

export default async function MerchantPosPage() {
  const access = await requireMerchantAccess();

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/negocio"
          className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Volver al resumen
        </Link>
        <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink">
          Caja · Cobrar con código CIFRA
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          Pídele al cliente las 6 letras de su celular (o escanea su QR). Aquí mismo te decimos cuánto cobrarle exactamente.
        </p>
      </div>

      <PosTerminal defaultTicketMinor={access.merchant.typicalTicketMinor} />
    </div>
  );
}
