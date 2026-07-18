// Version 3.4 — lib/rate-limit.ts
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
import { incrementDailyUsage, todayUtcDateString, nextUtcMidnightIso } from '@/lib/rate-limit-store';
import { incrementSubscriptionUsage, decrementCreditIfSufficient } from '@/lib/billing-store';
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
    const used = await incrementSubscriptionUsage(key.id);

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
