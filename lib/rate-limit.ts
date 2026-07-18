// Version 3.3 — lib/rate-limit.ts
//
// v3.3: upgrade_url now points at the real /risk-api#pricing section
// (built in Stage 5) instead of a placeholder path.
//
// Rate-limit enforcement for the Risk-Data API.
// - free tier: 100 requests / calendar day (UTC)
// - paid tier: no limit (billing/Stripe wiring is a separate task — for
//   now `tier: 'paid'` is set by hand via app/api/v1/admin/keys)
//
// NOTE: same flat-interface pattern as lib/api-auth.ts, not a
// discriminated union — this repo's tsconfig.json has "strict": false,
// under which TS's narrowing on boolean-literal discriminants is
// unreliable (confirmed in Stage 2). A flat interface with nullable
// fields avoids the issue.
//
// Design choice: the daily counter increments on every authenticated
// call, including ones that later fail validation (bad mint address,
// upstream error). This matches how most commercial APIs meter usage —
// simpler to reason about than trying to only charge "successful" calls.

import { NextResponse } from 'next/server';
import type { ApiKeyRecord } from '@/lib/api-key-store';
import { incrementDailyUsage, todayUtcDateString, nextUtcMidnightIso } from '@/lib/rate-limit-store';

export const FREE_TIER_DAILY_LIMIT = 100;

export interface RateLimitResult {
  allowed: boolean;
  limit: number | null; // null = unlimited (paid tier)
  used: number;
  remaining: number | null; // null = not applicable (unlimited)
  resetAt: string; // ISO timestamp of next UTC midnight
  response: NextResponse | null; // 402 response when blocked, else null
}

export async function enforceRateLimit(
  key: ApiKeyRecord,
  extraHeaders: HeadersInit = {},
): Promise<RateLimitResult> {
  const usageDate = todayUtcDateString();
  const resetAt = nextUtcMidnightIso();
  const used = await incrementDailyUsage(key.id, usageDate);

  if (used === null) {
    // Fail open: an internal counter error shouldn't block legitimate
    // traffic. Logged loudly in incrementDailyUsage() for follow-up.
    return { allowed: true, limit: null, used: 0, remaining: null, resetAt, response: null };
  }

  if (key.tier === 'paid') {
    return { allowed: true, limit: null, used, remaining: null, resetAt, response: null };
  }

  const limit = FREE_TIER_DAILY_LIMIT;

  if (used > limit) {
    return {
      allowed: false,
      limit,
      used,
      remaining: 0,
      resetAt,
      response: NextResponse.json(
        {
          error: 'Daily free-tier limit reached',
          limit,
          used,
          reset_at: resetAt,
          upgrade_url: 'https://tnt-audit.com/risk-api#pricing',
          note: 'Paid tier upgrades are handled manually for now — contact us to get an unlimited key.',
        },
        { status: 402, headers: extraHeaders },
      ),
    };
  }

  return {
    allowed: true,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetAt,
    response: null,
  };
}
