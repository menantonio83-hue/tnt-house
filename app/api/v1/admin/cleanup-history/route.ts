// Version 1.0 — app/api/v1/admin/cleanup-history/route.ts
//
// Daily retention cleanup for mint_risk_history — deletes rows older
// than 90 days. Triggered by Vercel Cron (see vercel.json), which
// automatically sends `Authorization: Bearer $CRON_SECRET` on
// cron-triggered requests (Vercel's documented convention — this is
// NOT the same secret as RISK_API_ADMIN_SECRET used by the other admin
// routes in this folder, on purpose: CRON_SECRET is Vercel's own
// mechanism specifically for verifying a request actually came from
// its cron scheduler, not a general-purpose admin credential).
//
// REQUIRED: set CRON_SECRET in Vercel env vars (any long random
// string) before this cron can run successfully — without it, every
// invocation 401s (see the `!cronSecret` check below, which fails
// closed rather than skipping auth if the env var is simply unset).
//
// Can also be triggered manually for testing:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     https://tnt-audit.com/api/v1/admin/cleanup-history

import { NextRequest, NextResponse } from 'next/server';
import { deleteMintRiskHistoryOlderThan } from '@/lib/mint-risk-history-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const deletedCount = await deleteMintRiskHistoryOlderThan(90);

  if (deletedCount === null) {
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, deleted_rows: deletedCount, retention_days: 90 });
}
