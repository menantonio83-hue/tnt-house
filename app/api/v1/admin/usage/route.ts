// Version 4.3 — app/api/v1/admin/usage/route.ts
//
// Admin-only usage/billing dashboard, JSON only (no UI yet — that's
// Stage 5 territory if needed). Same shared-secret pattern as
// app/api/v1/admin/keys.
//
// GET /api/v1/admin/usage
// Header: X-Admin-Secret: <RISK_API_ADMIN_SECRET>
// Query params (all optional):
//   key_id   - scope to one API key (billing view for one customer)
//   mint     - scope to one mint address
//   from     - ISO timestamp, inclusive lower bound on created_at
//   to       - ISO timestamp, inclusive upper bound on created_at
//
// Example: usage for one customer this month
//   GET /api/v1/admin/usage?key_id=<uuid>&from=2026-07-01T00:00:00Z

import { NextRequest, NextResponse } from 'next/server';
import { getUsageStats } from '@/lib/usage-stats';

export async function GET(request: NextRequest) {
  try {
    const adminSecret = request.headers.get('x-admin-secret');
    const expectedSecret = process.env.RISK_API_ADMIN_SECRET;

    if (!expectedSecret || adminSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('key_id') || undefined;
    const mint = searchParams.get('mint') || undefined;
    const fromIso = searchParams.get('from') || undefined;
    const toIso = searchParams.get('to') || undefined;

    const stats = await getUsageStats({ keyId, mint, fromIso, toIso });

    return NextResponse.json({
      filters: {
        key_id: keyId ?? null,
        mint: mint ?? null,
        from: fromIso ?? null,
        to: toIso ?? null,
      },
      total_requests: stats.totalRequests,
      requests_today_utc: stats.requestsToday,
      top_mints: stats.topMints,
      top_mints_note: `Based on the ${stats.sampleSize} most recent matching requests, not the full history.`,
      recent_requests: stats.recentRequests,
    });
  } catch (error: any) {
    console.error('[admin/usage] error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error.message },
      { status: 500 },
    );
  }
}
