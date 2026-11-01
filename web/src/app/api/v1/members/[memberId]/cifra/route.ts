import { NextResponse } from 'next/server';
import { apiError, authenticatePartner, findMember } from '@/lib/partner/auth';
import { loadCifra } from '@/lib/data';

type Ctx = { params: Promise<{ memberId: string }> };

/** La cifra del asociado, para mostrarla en la app de la entidad sin abrir CIFRA. */
export async function GET(req: Request, ctx: Ctx) {
  const partner = await authenticatePartner(req);
  if (partner instanceof NextResponse) return partner;
  const { memberId } = await ctx.params;
  const user = await findMember(partner, memberId);
  if (!user) return apiError(404, 'no_existe', 'No hay un asociado con ese id.');
  const c = await loadCifra(user);
  return NextResponse.json({
    ready: c.ready,
    missing: c.missing,
    today: c.today,
    next_income_on: c.nextIncomeOn,
    days_left: c.daysLeft,
    balance_minor: c.balanceMinor,
    balance_on: c.balanceOn,
    pending_minor: c.pendingMinor,
    pending: c.pending.map((p) => ({ name: p.name, date: p.date, amount_minor: p.amountMinor, estimated: p.estimated })),
    daily_variable_minor: c.dailyVariableMinor,
    projected_variable_minor: c.projectedVariableMinor,
    buffer_minor: c.bufferMinor,
    available_minor: c.availableMinor,
    per_day_minor: c.perDayMinor,
    status: c.status,
    warnings: c.warnings,
  });
}
