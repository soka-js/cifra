import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, dataSources } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/session';
import { ImportWizard, type PresetAccount } from './wizard';

export const metadata = { title: 'Subir extracto' };

export default async function ImportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  let preset: PresetAccount | undefined;
  if (sp.cuenta && /^[0-9a-f-]{36}$/.test(sp.cuenta)) {
    const [row] = await db
      .select({ account: accounts, entityName: dataSources.entityName, kind: dataSources.kind })
      .from(accounts)
      .innerJoin(dataSources, eq(dataSources.id, accounts.sourceId))
      .where(and(eq(accounts.id, sp.cuenta), eq(accounts.userId, user.id)))
      .limit(1);
    if (row && row.kind === 'extracto') {
      preset = { accountId: row.account.id, entityName: row.entityName, kind: row.account.kind, name: row.account.name, mask: row.account.mask };
    }
  }
  return <ImportWizard preset={preset} first={sp.primera === '1'} />;
}
