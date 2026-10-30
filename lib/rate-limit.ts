// Version 4.4 — lib/rate-limit.ts
//
// v4.4: a key with call credit is never refused because the shared free
// pool is empty. That call is charged as overage instead. The personal
// daily counter moves only when a call is actually served from the free
// quota — a refusal does not increment it. Paid tier and an active
// subscription already skip this pool; they still do.
//
// Version 4.3 — lib/rate-limit.ts
//
// v4.3: upgrade_url / x402_url / topup_url in refusals use the canonical https://www.tnt-audit.com origin.
//
// Version 4.2 — lib/rate-limit.ts
//
// v4.2: structured, machine-readable refusals — every quota/credit 402 now carries error_code/message/options from lib/refusal-options.ts so an AI agent can continue automatically (top up, x402, or free key).
// Version 4.1 — lib/rate-limit.ts
//
// 4.1: Added x402/topup metadata + Retry-After headers on 402, cap `used`
// at `limit`, and skip incrementing the daily counter when a free key is
// already over quota and has no credit.
//
// Version 4.0 — lib/rate-limit.ts
//
// v4.0 (M-5 fix): the free tier now FAILS CLOSED. The personal daily
// counter and the shared free pool both used to fail open on an infra
// error — a Supabase or Redis blip silently stripped metering from the
// free tier entirely, and two concurrent outages could unmeter it
// twice over. A free, unmetered surface is the wrong place to fail
// open: a counter error now returns a 503 telling the caller the free
// tier is temporarily unavailable (top up/subscribe for guaranteed
// access). Paying tiers are unaffected by either change.
//
// Version 3.9 — lib/rate-limit.ts
//
// v3.9: 402 responses from buildLimitReachedResponse() now include
// subscription_price_usd / subscription_monthly_quota alongside the
// existing overage_rate_usd — Бро caught that the JSON only surfaced
// the pay-per-call option, forcing anyone parsing this response
// programmatically to go scrape the pricing page's HTML just to learn
// the other number, which contradicts this API's own "clean JSON for
// bots, not a dashboard for humans" positioning (see app/risk-api's
// own hero copy). buildGlobalPoolReachedResponse() doesn't get these
// two fields — a full site-wide outage isn't really an "upgrade for
// more calls" moment the same way a personal cap is, subscribing
// doesn't change when the shared pool resets.
//
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
import { getDailyUsage, incrementDailyUsage, incrementDailyUsageBy, todayUtcDateString, nextUtcMidnightIso } from '@/lib/rate-limit-store';
import { incrementSubscriptionUsage, incrementSubscriptionUsageBy, decrementCreditIfSufficient } from '@/lib/billing-store';
import { consumeGlobalFreePool, GLOBAL_FREE_DAILY_LIMIT } from '@/lib/free-tier-global-pool';
import {
  FREE_DAILY_LIMIT,
  SUBSCRIPTION_USD,
  SUBSCRIPTION_MONTHLY_QUOTA,
  OVERAGE_RATE_FREE_USD,
  OVERAGE_RATE_SUBSCRIBED_USD,
  MIN_TOPUP_USD,
  MAX_TOPUP_USD,
} from '@/lib/billing-pricing';
import { buildRefusalBody, topUpOption, x402Option, type RefusalErrorCode } from '@/lib/refusal-options';

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
  errorCode: RefusalErrorCode,
  message: string,
  limit: number,
  used: number,
  resetAt: string,
  overageRate: number,
  extraHeaders: HeadersInit,
): NextResponse {
  const headers = new Headers(extraHeaders);
  const resetTime = new Date(resetAt).getTime();
  if (!Number.isNaN(resetTime)) {
    headers.set('Retry-After', String(Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))));
  }
  headers.set('X-RateLimit-Limit', String(limit));
  headers.set('X-RateLimit-Remaining', '0');
  headers.set('X-RateLimit-Reset', resetAt);

  return NextResponse.json(
    buildRefusalBody(
      errorCode,
      message,
      [topUpOption(overageRate), x402Option()],
      {
        limit,
        used: Math.min(used, limit),
        reset_at: resetAt,
        resets_in: humanizeResetAt(resetAt),
        overage_rate_usd: overageRate,
        subscription_price_usd: SUBSCRIPTION_USD,
        subscription_monthly_quota: SUBSCRIPTION_MONTHLY_QUOTA,
        upgrade_url: 'https://www.tnt-audit.com/risk-api#billing',
        x402_url: 'https://www.tnt-audit.com/api/v1/token-risk/x402',
        x402_price_usd: 0.02,
        topup_url: 'https://www.tnt-audit.com/api/v1/billing/create-invoice',
        min_topup_usd: MIN_TOPUP_USD,
        note: `Three ways to continue: (1) No account? Pay per call via x402 at $0.02/call (USDC on Solana) at x402_url. (2) Top up call credit with this key: POST topup_url with JSON {"api_key":"<your key>","kind":"topup","currency":"SOL" or "USDC","usd_amount":${MIN_TOPUP_USD}-${MAX_TOPUP_USD}}, send the exact pay_amount to the returned wallet_address, then POST /api/v1/billing/verify-payment with {"payment_id","api_key"} — after that each call over the free cap costs $${overageRate}. (3) Subscribe for $${SUBSCRIPTION_USD} = ${SUBSCRIPTION_MONTHLY_QUOTA} calls/30 days at $${OVERAGE_RATE_SUBSCRIBED_USD}/call overage after that. Your free quota resets at ${resetAt}.`,
      },
    ),
    { status: 402, headers },
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
    buildRefusalBody(
      'free_pool_capacity',
      `Free tier is at capacity for today (${GLOBAL_FREE_DAILY_LIMIT}/${GLOBAL_FREE_DAILY_LIMIT} shared calls used across all free keys) — this is not specific to your key, you've only used ${personalUsed}/${personalLimit} of your own quota.`,
      [topUpOption(OVERAGE_RATE_FREE_USD), x402Option()],
      {
        limit: GLOBAL_FREE_DAILY_LIMIT,
        used: GLOBAL_FREE_DAILY_LIMIT,
        reset_at: resetAt,
        resets_in: humanizeResetAt(resetAt),
        upgrade_url: 'https://www.tnt-audit.com/risk-api#billing',
        note: 'Subscribe or top up call credits for guaranteed access that never depends on the shared free pool.',
      },
    ),
    { status: 402, headers: extraHeaders },
  );
}


function canAffordFreeOverage(balance: number | null | undefined, calls: number): boolean {
  if (calls <= 0) return true;
  const cents = Math.round((balance ?? 0) * 100);
  const costCents = calls * Math.round(OVERAGE_RATE_FREE_USD * 100);
  return cents >= costCents;
}

function freeTierUnavailableResponse(message: string, resetAt: string, extraHeaders: HeadersInit): NextResponse {
  return NextResponse.json(
    {
      error: message,
      limit: FREE_DAILY_LIMIT,
      reset_at: resetAt,
      upgrade_url: 'https://www.tnt-audit.com/risk-api#billing',
    },
    { status: 503, headers: extraHeaders },
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
        'paid_balance_exceeded',
        'Monthly subscription quota reached and call-credit balance is empty — top up call credit, or pay per call via x402 ($0.02/call, no account needed).',
        SUBSCRIPTION_MONTHLY_QUOTA,
        used,
        key.subscription_expires_at as string,
        OVERAGE_RATE_SUBSCRIBED_USD,
        extraHeaders,
      ),
    };
  }

  // Free tier (including an expired subscription, which falls back here).
  // Credit is checked before any refusal from the shared free pool, and
  // the daily counter is incremented only after this call is allowed as
  // a free call. See v4.4.
  const usageDate = todayUtcDateString();
  const resetAt = nextUtcMidnightIso();
  const current = await getDailyUsage(key.id, usageDate);

  if (current === null) {
    return {
      allowed: false,
      limit: FREE_DAILY_LIMIT,
      used: 0,
      remaining: null,
      resetAt,
      creditBalanceUsd: key.credit_balance_usd,
      usedOverageCredit: false,
      response: freeTierUnavailableResponse(
        'Free tier temporarily unavailable — the usage counter could not be read. Please try again shortly, or top up/subscribe for guaranteed access.',
        resetAt,
        extraHeaders,
      ),
    };
  }

  if (current >= FREE_DAILY_LIMIT) {
    if (!canAffordFreeOverage(key.credit_balance_usd, 1)) {
      const used = Math.min(current, FREE_DAILY_LIMIT);
      return {
        allowed: false,
        limit: FREE_DAILY_LIMIT,
        used,
        remaining: 0,
        resetAt,
        creditBalanceUsd: key.credit_balance_usd,
        usedOverageCredit: false,
        response: buildLimitReachedResponse(
          'free_daily_limit_reached',
          'Daily free-tier limit reached and call-credit balance is empty',
          FREE_DAILY_LIMIT,
          used,
          resetAt,
          OVERAGE_RATE_FREE_USD,
          extraHeaders,
        ),
      };
    }

    const newBalance = await decrementCreditIfSufficient(key.id, OVERAGE_RATE_FREE_USD);
    if (newBalance === null) {
      const used = Math.min(current, FREE_DAILY_LIMIT);
      return {
        allowed: false,
        limit: FREE_DAILY_LIMIT,
        used,
        remaining: 0,
        resetAt,
        creditBalanceUsd: key.credit_balance_usd,
        usedOverageCredit: false,
        response: buildLimitReachedResponse(
          'free_daily_limit_reached',
          'Daily free-tier limit reached and call-credit balance is empty',
          FREE_DAILY_LIMIT,
          used,
          resetAt,
          OVERAGE_RATE_FREE_USD,
          extraHeaders,
        ),
      };
    }

    return {
      allowed: true,
      limit: FREE_DAILY_LIMIT,
      used: Math.min(current, FREE_DAILY_LIMIT),
      remaining: 0,
      resetAt,
      creditBalanceUsd: newBalance,
      usedOverageCredit: true,
      response: null,
    };
  }

  // Inside this key's own 15/day. The shared pool applies only to a call
  // we are about to give away for free. If the pool cannot, and the key
  // has credit, charge that credit and do not touch the daily counter.
  const isFirstCallToday = current === 0;
  const globalPool = await consumeGlobalFreePool(1);
  const poolGivesFreeCall = globalPool.allowed || isFirstCallToday;

  if (!poolGivesFreeCall) {
    if (canAffordFreeOverage(key.credit_balance_usd, 1)) {
      const newBalance = await decrementCreditIfSufficient(key.id, OVERAGE_RATE_FREE_USD);
      if (newBalance !== null) {
        return {
          allowed: true,
          limit: FREE_DAILY_LIMIT,
          used: current,
          remaining: Math.max(0, FREE_DAILY_LIMIT - current),
          resetAt,
          creditBalanceUsd: newBalance,
          usedOverageCredit: true,
          response: null,
        };
      }
    }

    if (globalPool.reason === 'infra') {
      return {
        allowed: false,
        limit: FREE_DAILY_LIMIT,
        used: current,
        remaining: null,
        resetAt,
        creditBalanceUsd: key.credit_balance_usd,
        usedOverageCredit: false,
        response: freeTierUnavailableResponse(
          'Free tier temporarily unavailable — the shared free pool could not be checked. Please try again shortly, or top up/subscribe for guaranteed access.',
          resetAt,
          extraHeaders,
        ),
      };
    }

    return {
      allowed: false,
      limit: FREE_DAILY_LIMIT,
      used: current,
      remaining: Math.max(0, FREE_DAILY_LIMIT - current),
      resetAt,
      creditBalanceUsd: key.credit_balance_usd,
      usedOverageCredit: false,
      response: buildGlobalPoolReachedResponse(current, FREE_DAILY_LIMIT, resetAt, extraHeaders),
    };
  }

  const used = await incrementDailyUsage(key.id, usageDate);

  if (used === null) {
    return {
      allowed: false,
      limit: FREE_DAILY_LIMIT,
      used: current,
      remaining: null,
      resetAt,
      creditBalanceUsd: key.credit_balance_usd,
      usedOverageCredit: false,
      response: freeTierUnavailableResponse(
        'Free tier temporarily unavailable — the usage counter could not be read. Please try again shortly, or top up/subscribe for guaranteed access.',
        resetAt,
        extraHeaders,
      ),
    };
  }

  if (used > FREE_DAILY_LIMIT) {
    // A parallel call from this same key crossed the personal cap between
    // the read above and this increment. This call is overage, not free.
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
      used: FREE_DAILY_LIMIT,
      remaining: 0,
      resetAt,
      creditBalanceUsd: key.credit_balance_usd,
      usedOverageCredit: false,
      response: buildLimitReachedResponse(
        'free_daily_limit_reached',
        'Daily free-tier limit reached and call-credit balance is empty',
        FREE_DAILY_LIMIT,
        FREE_DAILY_LIMIT,
        resetAt,
        OVERAGE_RATE_FREE_USD,
        extraHeaders,
      ),
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
        'paid_balance_exceeded',
        `Batch of ${count} needs ${overCount} overage call(s) past the monthly subscription quota, and the call-credit balance is insufficient to cover them — top up call credit, or pay per call via x402 ($0.02/call, no account needed).`,
        SUBSCRIPTION_MONTHLY_QUOTA,
        usedAfter,
        key.subscription_expires_at as string,
        OVERAGE_RATE_SUBSCRIBED_USD,
        extraHeaders,
      ),
    };
  }

  // Free tier (including an expired subscription, which falls back here).
  // Same rule as enforceRateLimit (v4.4): the shared pool can only block
  // calls that would have been free. If the key can pay for whatever the
  // pool does not cover, charge that and allow the whole batch. The daily
  // counter grows only by the calls actually given away for free. A
  // refused batch does not increment it. No first-batch grace — unchanged.
  const usageDate = todayUtcDateString();
  const resetAt = nextUtcMidnightIso();
  const current = await getDailyUsage(key.id, usageDate);

  if (current === null) {
    return {
      allowed: false,
      limit: FREE_DAILY_LIMIT,
      used: 0,
      remaining: null,
      resetAt,
      creditBalanceUsd: key.credit_balance_usd,
      usedOverageCredit: false,
      response: freeTierUnavailableResponse(
        'Free tier temporarily unavailable — the usage counter could not be read. Please try again shortly, or top up/subscribe for guaranteed access.',
        resetAt,
        extraHeaders,
      ),
    };
  }

  const freeSlots = Math.max(0, FREE_DAILY_LIMIT - current);
  const wantsFree = Math.min(count, freeSlots);
  const mustPay = count - wantsFree;

  if (mustPay > 0 && !canAffordFreeOverage(key.credit_balance_usd, mustPay)) {
    const used = Math.min(current, FREE_DAILY_LIMIT);
    return {
      allowed: false,
      limit: FREE_DAILY_LIMIT,
      used,
      remaining: 0,
      resetAt,
      creditBalanceUsd: key.credit_balance_usd,
      usedOverageCredit: false,
      response: buildLimitReachedResponse(
        'free_daily_limit_reached',
        `Batch of ${count} needs ${mustPay} overage call(s) past the daily free-tier limit, and the call-credit balance is insufficient to cover them`,
        FREE_DAILY_LIMIT,
        used,
        resetAt,
        OVERAGE_RATE_FREE_USD,
        extraHeaders,
      ),
    };
  }

  let freeGranted = 0;
  if (wantsFree > 0) {
    const globalPool = await consumeGlobalFreePool(wantsFree);
    if (globalPool.allowed) {
      freeGranted = wantsFree;
    } else if (!canAffordFreeOverage(key.credit_balance_usd, count)) {
      if (globalPool.reason === 'infra') {
        return {
          allowed: false,
          limit: FREE_DAILY_LIMIT,
          used: current,
          remaining: null,
          resetAt,
          creditBalanceUsd: key.credit_balance_usd,
          usedOverageCredit: false,
          response: freeTierUnavailableResponse(
            'Free tier temporarily unavailable — the shared free pool could not be checked. Please try again shortly, or top up/subscribe for guaranteed access.',
            resetAt,
            extraHeaders,
          ),
        };
      }
      return {
        allowed: false,
        limit: FREE_DAILY_LIMIT,
        used: current,
        remaining: Math.max(0, FREE_DAILY_LIMIT - current),
        resetAt,
        creditBalanceUsd: key.credit_balance_usd,
        usedOverageCredit: false,
        response: buildGlobalPoolReachedResponse(current, FREE_DAILY_LIMIT, resetAt, extraHeaders),
      };
    }
  }

  const payCount = count - freeGranted;
  let creditBalance = key.credit_balance_usd;
  if (payCount > 0) {
    const charged = await decrementCreditIfSufficient(key.id, payCount * OVERAGE_RATE_FREE_USD);
    if (charged === null) {
      const used = Math.min(current, FREE_DAILY_LIMIT);
      return {
        allowed: false,
        limit: FREE_DAILY_LIMIT,
        used,
        remaining: Math.max(0, FREE_DAILY_LIMIT - used),
        resetAt,
        creditBalanceUsd: key.credit_balance_usd,
        usedOverageCredit: false,
        response: buildLimitReachedResponse(
          'free_daily_limit_reached',
          `Batch of ${count} needs ${payCount} overage call(s) past the daily free-tier limit, and the call-credit balance is insufficient to cover them`,
          FREE_DAILY_LIMIT,
          used,
          resetAt,
          OVERAGE_RATE_FREE_USD,
          extraHeaders,
        ),
      };
    }
    creditBalance = charged;
  }

  let used = current;
  if (freeGranted > 0) {
    const usedAfter = await incrementDailyUsageBy(key.id, usageDate, freeGranted);
    if (usedAfter === null) {
      if (payCount === 0) {
        return {
          allowed: false,
          limit: FREE_DAILY_LIMIT,
          used: current,
          remaining: null,
          resetAt,
          creditBalanceUsd: key.credit_balance_usd,
          usedOverageCredit: false,
          response: freeTierUnavailableResponse(
            'Free tier temporarily unavailable — the usage counter could not be read. Please try again shortly, or top up/subscribe for guaranteed access.',
            resetAt,
            extraHeaders,
          ),
        };
      }
    } else {
      used = usedAfter;
    }
  }

  return {
    allowed: true,
    limit: FREE_DAILY_LIMIT,
    used,
    remaining: Math.max(0, FREE_DAILY_LIMIT - used),
    resetAt,
    creditBalanceUsd: creditBalance,
    usedOverageCredit: payCount > 0,
    response: null,
  };
}
