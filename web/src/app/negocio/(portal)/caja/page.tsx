import { requireMerchantAccess } from '@/lib/auth/session';
import { PosTerminal } from './pos-terminal';

export const metadata = { title: 'Caja · Cobrar código CIFRA' };

export default async function MerchantPosPage() {
  const access = await requireMerchantAccess();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink">
          Cobrar un código
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          Pídele al cliente las 6 letras de su celular (o escanea su QR). Aquí mismo te decimos cuánto cobrarle exactamente.
        </p>
      </div>

      <PosTerminal
        defaultTicketMinor={access.merchant.typicalTicketMinor}
        commissionBps={access.merchant.commissionBps}
      />
    </div>
  );
}
