// Version 7.7 — app/api/v1/billing/status/route.ts
//
// GET /api/v1/billing/status
// Header: Authorization: Bearer <api_key>
//
// Read-only account status for the billing panel — tier, subscription
// expiry, credit balance. Uses the same auth check as token-risk
// (lib/api-auth.ts) but deliberately does NOT call enforceRateLimit —
// checking your own billing status shouldn't cost a call or count
// against any quota.

import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-auth';
import { SUBSCRIPTION_MONTHLY_QUOTA, FREE_DAILY_LIMIT } from '@/lib/billing-pricing';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiKey(request, CORS_HEADERS);
    if (!auth.ok || !auth.key) {
      return (
        auth.response ??
        NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
      );
    }

    const key = auth.key;
    const subscriptionActive =
      key.tier === 'subscription' &&
      !!key.subscription_expires_at &&
      new Date(key.subscription_expires_at).getTime() > Date.now();

    return NextResponse.json(
      {
        tier: key.tier,
        key_prefix: key.key_prefix,
        credit_balance_usd: key.credit_balance_usd,
        subscription: subscriptionActive
          ? {
              active: true,
              expires_at: key.subscription_expires_at,
              calls_used_this_cycle: key.subscription_cycle_calls_used,
              monthly_quota: SUBSCRIPTION_MONTHLY_QUOTA,
            }
          : { active: false },
        free_tier_daily_limit: FREE_DAILY_LIMIT,
      },
      { headers: CORS_HEADERS },
    );
  } catch (error: any) {
    console.error('[billing/status] error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
