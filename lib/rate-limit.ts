// Version 3.8 — lib/rate-limit.ts
//
// v3.8: layered lib/free-tier-global-pool.ts's site-wide 100/day cap on
// top of each key's personal FREE_DAILY_LIMIT (15/day) — explicit
// product decision (Бро, 2026-08-07), not a technical default: bounds
// total upstream cost across ALL free keys combined, since a signup
// costs us nothing to issue but every call costs real Helius/
// DexScreener requests. Only gates the WITHIN-personal-quota free path
// — never the overage-credit path (that's a paying call, see that
// file's header) or subscription/paid tiers.
//
// Two DISTINCT error messages now exist (buildLimitReachedResponse for
// "you personally used your 15" vs buildGlobalPoolReachedResponse for
// "the whole free tier is at capacity today, not your fault") — a
// vendor review (Kimi) flagged that a single generic 402 makes a
// blameless "site is at capacity" case read as "you did something
// wrong", which is a real problem for a B2B integrator debugging their
// own code at 2am. Both responses also gained resets_in — a
// human-readable string ("6 hours", "23 minutes") alongside the
// existing raw reset_at ISO timestamp, so a caller doesn't have to do
// their own date math just to show a sensible retry time.
//
// FIRST-CALL GRACE (also from the same review, cheap and worth taking):
// if a key's OWN daily counter is exactly 1 (this is the very first
// call this key has made today) and the global pool is exhausted, this
// one call is let through anyway. Rationale: someone who just signed up
// and made their first-ever call landing on "sorry, everyone else used
// up today's shared pool before you got here" is the single worst
// first impression this API can give — a signup that got literally
// zero value is far more likely to just leave than a signup that used
// 3 of their 15 before hitting a fair, explained cap. Single-call path
// only (enforceRateLimit) — NOT extended to enforceRateLimitBatch,
// where "first call today" doesn't cleanly generalize to "first batch,
// however large" without risking a big grace-covered spike; documented
// simplification, not an oversight.

import { NextResponse } from 'next/server';
import type { ApiKeyRecord } from '@/lib/api-key-store';
import { incrementDailyUsage, incrementDailyUsageBy, todayUtcDateString, nextUtcMidnightIso } from '@/lib/rate-limit-store';
import { incrementSubscriptionUsage, incrementSubscriptionUsageBy, decrementCreditIfSufficient } from '@/lib/billing-store';
import { consumeGlobalFreePool, GLOBAL_FREE_DAILY_LIMIT } from '@/lib/free-tier-global-pool';
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

// "2026-08-08T00:00:00.000Z" -> "6 hours" / "23 minutes" / "under a
// minute". Best-effort, never throws — an unparseable input just
// degrades to omitting the phrase rather than crashing the response.
function humanizeResetAt(resetAtIso: string): string | null {
  const target = new Date(resetAtIso).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  if (diffMs <= 0) return 'under a minute';
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
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
      resets_in: humanizeResetAt(resetAt),
      overage_rate_usd: overageRate,
      upgrade_url: 'https://tnt-audit.com/risk-api#billing',
      note: `Top up call credits or subscribe on the upgrade_url page — overage is billed at $${overageRate}/call once you have a balance.`,
    },
    { status: 402, headers: extraHeaders },
  );
}

// v3.8: the SITE-WIDE cap being full — deliberately worded so it does
// NOT read as "you did something wrong" (see header note). The caller
// still has personal quota left; upgrading buys guaranteed access
// instead of sharing the free pool.
function buildGlobalPoolReachedResponse(
  personalUsed: number,
  personalLimit: number,
  resetAt: string,
  extraHeaders: HeadersInit,
): NextResponse {
  return NextResponse.json(
    {
      error: `Free tier is at capacity for today (${GLOBAL_FREE_DAILY_LIMIT}/${GLOBAL_FREE_DAILY_LIMIT} shared calls used across all free keys) — this is not specific to your key, you've only used ${personalUsed}/${personalLimit} of your own quota.`,
      limit: GLOBAL_FREE_DAILY_LIMIT,
      used: GLOBAL_FREE_DAILY_LIMIT,
      reset_at: resetAt,
      resets_in: humanizeResetAt(resetAt),
      upgrade_url: 'https://tnt-audit.com/risk-api#billing',
      note: 'Subscribe or top up call credits for guaranteed access that never depends on the shared free pool.',
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
    // v3.8: this call is within the KEY's own personal quota — but
    // still gate it against the site-wide pool, since it's genuinely
    // free (no credit drawn). Overage-credit calls below this branch
    // are NOT gated — those are paying calls.
    const isFirstCallToday = used === 1;
    const globalPool = await consumeGlobalFreePool(1);

    if (!globalPool.allowed && !isFirstCallToday) {
      return {
        allowed: false,
        limit: FREE_DAILY_LIMIT,
        used,
        remaining: Math.max(0, FREE_DAILY_LIMIT - used),
        resetAt,
        creditBalanceUsd: key.credit_balance_usd,
        usedOverageCredit: false,
        response: buildGlobalPoolReachedResponse(used, FREE_DAILY_LIMIT, resetAt, extraHeaders),
      };
    }

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
    // v3.7: NOT key.subscription_cycle_calls_used (that's a separate,
    // earlier read from requireApiKey() — using it here was the exact
    // race lib/billing-store.ts v7.16 fixes). incrementSubscriptionUsageBy
    // now returns the pre-increment count from the SAME atomic
    // SELECT...FOR UPDATE that performed the increment, so two
    // concurrent batches on the same key can no longer both compute
    // their free/overage split against the same stale baseline.
    const increment = await incrementSubscriptionUsageBy(key.id, SUBSCRIPTION_MONTHLY_QUOTA, count);

    if (increment === null) {
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

    const { oldCount: usedBefore, newCount: usedAfter } = increment;
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

  // v3.8: gate the genuinely-free portion of this batch against the
  // site-wide pool — same concept as enforceRateLimit() above, but
  // NO first-batch grace here (deliberate simplification: "first call
  // today" doesn't cleanly generalize to "first batch, however large"
  // without risking one grace-covered batch draining a big chunk of
  // the shared pool). Only checked when some of the batch is actually
  // free (withinFreeCount > 0) — a batch that's ENTIRELY overage
  // doesn't touch the free pool at all.
  if (withinFreeCount > 0) {
    const globalPool = await consumeGlobalFreePool(withinFreeCount);
    if (!globalPool.allowed) {
      return {
        allowed: false,
        limit: FREE_DAILY_LIMIT,
        used: usedAfter,
        remaining: Math.max(0, FREE_DAILY_LIMIT - usedAfter),
        resetAt,
        creditBalanceUsd: key.credit_balance_usd,
        usedOverageCredit: false,
        response: buildGlobalPoolReachedResponse(usedAfter, FREE_DAILY_LIMIT, resetAt, extraHeaders),
      };
    }
  }

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
