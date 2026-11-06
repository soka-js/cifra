import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth/session';
import { runDailyRetentionAndOpsJob } from '@/lib/notify/daily-job';

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') ?? '';
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }
  const user = await getCurrentUser();
  return isAdmin(user);
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }
  const summary = await runDailyRetentionAndOpsJob();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
