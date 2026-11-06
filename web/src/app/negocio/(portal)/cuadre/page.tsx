import { requireMerchantAccess } from '@/lib/auth/session';
import { currentBogotaHour, loadMerchantBreakEvenData } from '@/lib/v3-data';
import { CuadreClient } from './cuadre-client';

export const metadata = { title: 'Cuadre diario e insumos · Negocio CIFRA' };

export default async function MerchantCuadrePage() {
  const access = await requireMerchantAccess();
  const data = await loadMerchantBreakEvenData(access.merchant);

  return (
    <CuadreClient
      merchantName={access.merchant.name}
      businessCategory={access.merchant.businessCategory}
      typicalTicketMinor={access.merchant.typicalTicketMinor}
      monthlyFixedCostMinor={access.merchant.monthlyFixedCostMinor}
      currentHour={currentBogotaHour()}
      data={data}
    />
  );
}
