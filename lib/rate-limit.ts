// Version 3.6 — lib/rate-limit.ts
//
// v3.6: added enforceRateLimitBatch() for the batch endpoint — same
// free/subscription/paid logic as enforceRateLimit(), generalized to
// charge N calls (one per mint in the batch) instead of 1, per the
// explicitly-decided batch billing model (N mints = N calls, no bulk
// discount). All-or-nothing: the whole batch is blocked with one 402
// if it can't be fully covered, never partially processed/billed. See
// that function's own comment for the subscription-tier approximation
// note. Uses new incrementDailyUsageBy() / incrementSubscriptionUsageBy()
// (lib/rate-limit-store.ts v6.5 / lib/billing-store.ts v7.15) — NOT the
// existing single-increment functions, which enforceRateLimit() (used by
// the single-mint route) keeps using unchanged.
//
// Version 3.5 — lib/rate-limit.ts
//
// v3.5: incrementSubscriptionUsage() now takes the quota so its RPC can
// cap subscription_cycle_calls_used growth at quota+1 once a subscriber
// is definitively in overage — see lib/billing-store.ts's version note.
//
// v3.4: full billing model implemented (see lib/billing-pricing.ts):
// - free tier: 15 requests / calendar day (UTC) — lowered from 100 as
//   part of the finalized pricing (free/pay-per-call/subscription)
// - over the free daily cap: draws down credit_balance_usd at
//   OVERAGE_RATE_FREE_USD ($0.07/call) instead of hard-blocking, if the
//   key has a balance (topped up via the billing panel on /risk-api)
// - 'subscription' tier (self-serve, $49/30 days via Solana Pay — see
//   app/api/v1/billing/*): 1000 calls per 30-day cycle from the payment
//   date, then draws down credit_balance_usd at
//   OVERAGE_RATE_SUBSCRIBED_USD ($0.03/call) instead of the free rate.
//   An expired subscription (subscription_expires_at in the past) falls
//   straight back to free-tier rules.
// - 'paid' tier: unchanged — a manually-issued, truly unlimited admin
//   override (app/api/v1/admin/keys), separate from 'subscription'.
//
// NOTE: same flat-interface pattern as lib/api-auth.ts, not a
// discriminated union — this repo's tsconfig.json has "strict": false,
// under which TS's narrowing on boolean-literal discriminants is
// unreliable (confirmed in Stage 2). A flat interface with nullable
// fields avoids the issue.
//
// Design choice: counters increment on every authenticated call,
// including ones that later fail validation (bad mint address, upstream
// error). This matches how most commercial APIs meter usage — simpler
// to reason about than trying to only charge "successful" calls.

import { NextResponse } from 'next/server';
import type { ApiKeyRecord } from '@/lib/api-key-store';
import { incrementDailyUsage, incrementDailyUsageBy, todayUtcDateString, nextUtcMidnightIso } from '@/lib/rate-limit-store';
import { incrementSubscriptionUsage, incrementSubscriptionUsageBy, decrementCreditIfSufficient } from '@/lib/billing-store';
import {
  FREE_DAILY_LIMIT,
  SUBSCRIPTION_MONTHLY_QUOTA,
  OVERAGE_RATE_FREE_USD,
  OVERAGE_RATE_SUBSCRIBED_USD,
} from '@/lib/billing-pricing';

export interface RateLimitResult {
  allowed: boolean;
  limit: number | null; // null = unlimited (paid tier)
  used: number;
  remaining: number | null; // null = not applicable (unlimited)
  resetAt: string; // ISO — next UTC midnight (free) or subscription cycle end
  creditBalanceUsd: number | null; // key's balance after this call, if known
  usedOverageCredit: boolean;
  response: NextResponse | null; // 402 response when blocked, else null
}

function buildLimitReachedResponse(
  message: string,
  limit: number,
  used: number,
  resetAt: string,
  overageRate: number,
  extraHeaders: HeadersInit,
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      limit,
      used,
      reset_at: resetAt,
      overage_rate_usd: overageRate,
      upgrade_url: 'https://tnt-audit.com/risk-api#billing',
      note: `Top up call credits or subscribe on the upgrade_url page — overage is billed at $${overageRate}/call once you have a balance.`,
    },
    { status: 402, headers: extraHeaders },
  );
}

export async function enforceRateLimit(
  key: ApiKeyRecord,
  extraHeaders: HeadersInit = {},
): Promise<RateLimitResult> {
  // 'paid' — manually-issued unlimited override, unchanged from Stage 3.
  if (key.tier === 'paid') {
    return {
      allowed: true,
      limit: null,
      used: 0,
      remaining: null,
      resetAt: nextUtcMidnightIso(),
      creditBalanceUsd: key.credit_balance_usd,
      usedOverageCredit: false,
      response: null,
    };
  }

  const subscriptionActive =
    key.tier === 'subscription' &&
    !!key.subscription_expires_at &&
    new Date(key.subscription_expires_at).getTime() > Date.now();

  if (subscriptionActive) {
    const used = await incrementSubscriptionUsage(key.id, SUBSCRIPTION_MONTHLY_QUOTA);

    if (used === null) {
      // Fail open on an infra hiccup — never block a paying subscriber
      // over a counter error. Logged loudly in incrementSubscriptionUsage().
      return {
        allowed: true,
        limit: SUBSCRIPTION_MONTHLY_QUOTA,
        used: 0,
        remaining: null,
        resetAt: key.subscription_expires_at as string,
        creditBalanceUsd: key.credit_balance_usd,
        usedOverageCredit: false,
        response: null,
      };
    }

    if (used <= SUBSCRIPTION_MONTHLY_QUOTA) {
      return {
        allowed: true,
        limit: SUBSCRIPTION_MONTHLY_QUOTA,
        used,
        remaining: Math.max(0, SUBSCRIPTION_MONTHLY_QUOTA - used),
        resetAt: key.subscription_expires_at as string,
        creditBalanceUsd: key.credit_balance_usd,
        usedOverageCredit: false,
        response: null,
      };
    }

    // Over the monthly quota — draw from the credit balance at the
    // cheaper subscribed overage rate.
    const newBalance = await decrementCreditIfSufficient(key.id, OVERAGE_RATE_SUBSCRIBED_USD);
    if (newBalance !== null) {
      return {
        allowed: true,
        limit: SUBSCRIPTION_MONTHLY_QUOTA,
        used,
        remaining: 0,
        resetAt: key.subscription_expires_at as string,
        creditBalanceUsd: newBalance,
        usedOverageCredit: true,
        response: null,
      };
    }

    return {
      allowed: false,
      limit: SUBSCRIPTION_MONTHLY_QUOTA,
      used,
      remaining: 0,
      resetAt: key.subscription_expires_at as string,
      creditBalanceUsd: key.credit_balance_usd,
      usedOverageCredit: false,
      response: buildLimitReachedResponse(
        'Monthly subscription quota reached and call-credit balance is empty',
        SUBSCRIPTION_MONTHLY_QUOTA,
        used,
        key.subscription_expires_at as string,
        OVERAGE_RATE_SUBSCRIBED_USD,
        extraHeaders,
      ),
    };
  }

  // Free tier (including an expired subscription, which falls back here).
  const usageDate = todayUtcDateString();
  const resetAt = nextUtcMidnightIso();
  const used = await incrementDailyUsage(key.id, usageDate);

  if (used === null) {
    return {
      allowed: true,
      limit: null,
      used: 0,
      remaining: null,
      resetAt,
      creditBalanceUsd: key.credit_balance_usd,
      usedOverageCredit: false,
      response: null,
    };
  }

  if (used <= FREE_DAILY_LIMIT) {
    return {
      allowed: true,
      limit: FREE_DAILY_LIMIT,
      used,
      remaining: Math.max(0, FREE_DAILY_LIMIT - used),
      resetAt,
      creditBalanceUsd: key.credit_balance_usd,
      usedOverageCredit: false,
      response: null,
    };
  }

  const newBalance = await decrementCreditIfSufficient(key.id, OVERAGE_RATE_FREE_USD);
  if (newBalance !== null) {
    return {
      allowed: true,
      limit: FREE_DAILY_LIMIT,
      used,
      remaining: 0,
      resetAt,
      creditBalanceUsd: newBalance,
      usedOverageCredit: true,
      response: null,
    };
  }

  return {
    allowed: false,
    limit: FREE_DAILY_LIMIT,
    used,
    remaining: 0,
    resetAt,
    creditBalanceUsd: key.credit_balance_usd,
    usedOverageCredit: false,
    response: buildLimitReachedResponse(
      'Daily free-tier limit reached and call-credit balance is empty',
      FREE_DAILY_LIMIT,
      used,
      resetAt,
      OVERAGE_RATE_FREE_USD,
      extraHeaders,
    ),
  };
}

// Batch variant of enforceRateLimit() — used by the batch endpoint
// (app/api/v1/token-risk/batch/route.ts) for N mints in one HTTP call.
// Billing model (explicitly decided, not a technical default): N mints
// = N calls counted, no bulk discount. All-or-nothing — if the batch
// can't be fully covered by remaining free quota + credit balance, the
// WHOLE batch is blocked with a single 402 rather than partially
// processed, so a caller never gets billed for some mints and silently
// dropped others.
//
// Known approximation for the subscription-tier "how many of these N
// calls are already-covered vs overage" split: uses key.
// subscription_cycle_calls_used as the "before" count, which was read
// at the start of this request (via requireApiKey) — under high
// concurrency from the SAME key, a parallel request could shift that
// baseline before this one's increment lands, causing at most a minor
// misattribution of which calls counted as free vs overage. The TOTAL
// counted usage (and therefore the cap itself) stays exactly correct
// regardless, since the underlying increment RPC is atomic — only the
// free/overage split for THIS response's credit charge could be
// slightly off in that race window. Acceptable for a first version;
// revisit if batch traffic at meaningful concurrency from a single key
// becomes real.
export async function enforceRateLimitBatch(
  key: ApiKeyRecord,
  count: number,
  extraHeaders: HeadersInit = {},
): Promise<RateLimitResult> {
  if (key.tier === 'paid') {
    return {
      allowed: true,
      limit: null,
      used: 0,
      remaining: null,
      resetAt: nextUtcMidnightIso(),
      creditBalanceUsd: key.credit_balance_usd,
      usedOverageCredit: false,
      response: null,
    };
  }

  const subscriptionActive =
    key.tier === 'subscription' &&
    !!key.subscription_expires_at &&
    new Date(key.subscription_expires_at).getTime() > Date.now();

  if (subscriptionActive) {
    const usedBefore = key.subscription_cycle_calls_used;
    const usedAfter = await incrementSubscriptionUsageBy(key.id, SUBSCRIPTION_MONTHLY_QUOTA, count);

    if (usedAfter === null) {
      // Fail open on an infra hiccup — never block a paying subscriber's
      // whole batch over a counter error.
      return {
        allowed: true,
        limit: SUBSCRIPTION_MONTHLY_QUOTA,
        used: 0,
        remaining: null,
        resetAt: key.subscription_expires_at as string,
        creditBalanceUsd: key.credit_balance_usd,
        usedOverageCredit: false,
        response: null,
      };
    }

    const withinQuotaCount = Math.max(0, Math.min(count, SUBSCRIPTION_MONTHLY_QUOTA - usedBefore));
    const overCount = count - withinQuotaCount;

    if (overCount === 0) {
      return {
        allowed: true,
        limit: SUBSCRIPTION_MONTHLY_QUOTA,
        used: usedAfter,
        remaining: Math.max(0, SUBSCRIPTION_MONTHLY_QUOTA - usedAfter),
        resetAt: key.subscription_expires_at as string,
        creditBalanceUsd: key.credit_balance_usd,
        usedOverageCredit: false,
        response: null,
      };
    }

    const newBalance = await decrementCreditIfSufficient(key.id, overCount * OVERAGE_RATE_SUBSCRIBED_USD);
    if (newBalance !== null) {
      return {
        allowed: true,
        limit: SUBSCRIPTION_MONTHLY_QUOTA,
        used: usedAfter,
        remaining: 0,
        resetAt: key.subscription_expires_at as string,
        creditBalanceUsd: newBalance,
        usedOverageCredit: true,
        response: null,
      };
    }

    return {
      allowed: false,
      limit: SUBSCRIPTION_MONTHLY_QUOTA,
      used: usedAfter,
      remaining: 0,
      resetAt: key.subscription_expires_at as string,
      creditBalanceUsd: key.credit_balance_usd,
      usedOverageCredit: false,
      response: buildLimitReachedResponse(
        `Batch of ${count} needs ${overCount} overage call(s) past the monthly subscription quota, and the call-credit balance is insufficient to cover them`,
        SUBSCRIPTION_MONTHLY_QUOTA,
        usedAfter,
        key.subscription_expires_at as string,
        OVERAGE_RATE_SUBSCRIBED_USD,
        extraHeaders,
      ),
    };
  }

  // Free tier (including an expired subscription, which falls back here).
  const usageDate = todayUtcDateString();
  const resetAt = nextUtcMidnightIso();
  const usedAfter = await incrementDailyUsageBy(key.id, usageDate, count);

  if (usedAfter === null) {
    return {
      allowed: true,
      limit: null,
      used: 0,
      remaining: null,
      resetAt,
      creditBalanceUsd: key.credit_balance_usd,
      usedOverageCredit: false,
      response: null,
    };
  }

  // Exact, not an approximation — increment_daily_usage_by() is an
  // uncapped +N, so usedBefore = usedAfter - count always holds.
  const usedBefore = usedAfter - count;
  const withinFreeCount = Math.max(0, Math.min(count, FREE_DAILY_LIMIT - usedBefore));
  const overCount = count - withinFreeCount;

  if (overCount === 0) {
    return {
      allowed: true,
      limit: FREE_DAILY_LIMIT,
      used: usedAfter,
      remaining: Math.max(0, FREE_DAILY_LIMIT - usedAfter),
      resetAt,
      creditBalanceUsd: key.credit_balance_usd,
      usedOverageCredit: false,
      response: null,
    };
  }

  const newBalance = await decrementCreditIfSufficient(key.id, overCount * OVERAGE_RATE_FREE_USD);
  if (newBalance !== null) {
    return {
      allowed: true,
      limit: FREE_DAILY_LIMIT,
      used: usedAfter,
      remaining: 0,
      resetAt,
      creditBalanceUsd: newBalance,
      usedOverageCredit: true,
      response: null,
    };
  }

  return {
    allowed: false,
    limit: FREE_DAILY_LIMIT,
    used: usedAfter,
    remaining: 0,
    resetAt,
    creditBalanceUsd: key.credit_balance_usd,
    usedOverageCredit: false,
    response: buildLimitReachedResponse(
      `Batch of ${count} needs ${overCount} overage call(s) past the daily free-tier limit, and the call-credit balance is insufficient to cover them`,
      FREE_DAILY_LIMIT,
      usedAfter,
      resetAt,
      OVERAGE_RATE_FREE_USD,
      extraHeaders,
    ),
  };
}
