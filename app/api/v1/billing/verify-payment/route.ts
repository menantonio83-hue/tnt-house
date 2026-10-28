// Version 7.19 — app/api/v1/billing/verify-payment/route.ts
//
// v7.19: throttled via lib/verify-throttle.ts — 600/hour per IP (before the key lookup), 1 per 5 s per payment_id, and after 30 checks/hour per key 1 per minute per payment_id (before Helius/Supabase); 429 + Retry-After + retry_after; fails open if Redis is down; never counts against call quotas. payment_id capped at 100 chars.
//
// Version 7.18 — app/api/v1/billing/verify-payment/route.ts
//
// v7.18: logic moved to lib/billing-actions.ts, shared with MCP tools; behaviour unchanged
//
// Version 7.17 — app/api/v1/billing/verify-payment/route.ts
//
// v7.17: two race-condition fixes from the second external-review round:
//
// 1. TTL no longer races against an in-flight payment. Previously, a
//    'pending' invoice past PENDING_INVOICE_TTL_MINUTES was expired
//    BEFORE ever calling findMatchingPayment on that poll — so if the
//    real transaction had landed on-chain moments earlier, this exact
//    poll could expire the invoice without ever giving it a chance to
//    match. Now the order is reversed: findMatchingPayment always runs
//    first for a 'pending' invoice; expiry is only attempted (and only
//    takes effect, per expire_stale_pending_payment's own age check)
//    when no match was found.
//
// 2. confirm_payment's ambiguous claimed:false (no `reason`) previously
//    was assumed to always mean "a concurrent poll for this SAME
//    payment_id already confirmed it a moment ago" and reported
//    verified:true. That's one real cause, but NOT the only one — the
//    payment could also have concurrently expired (e.g. TTL fix above
//    running in another request at the same instant), or hit some other
//    state change, and in either of those cases reporting verified:true
//    would tell the caller their payment succeeded when it didn't. Now
//    re-reads the payment's actual current status and answers honestly
//    instead of assuming success.
//
// v7.16 (auth + ownership): requires `api_key` alongside `payment_id`,
// and rejects the request unless that key owns the payment. Previously
// `payment_id` alone (a UUID) was sufficient to trigger a Helius call +
// Supabase round trip with zero proof of ownership.
//
// v7.11: a failed claim with a `reason` (the tx_signature was already
// used by a DIFFERENT payment — the DB-level anti-collision guarantee,
// see lib/billing-pricing.ts) is surfaced as an honest failure, not a
// false success.
//
// POST /api/v1/billing/verify-payment
// Body: { payment_id: "<uuid from create-invoice>", api_key: "tnt_sk_..." }
//
// Polled repeatedly by the client after opening the wallet — same
// polling pattern as app/page.js's startPaymentVerification, just
// against this feature's own invoice + confirm_payment RPC instead of
// the site's /api/verify-payment. Idempotent: polling after the payment
// was already confirmed (by an earlier poll) just returns the same
// success result again, never double-credits.

import { NextRequest, NextResponse } from 'next/server';
import { findApiKeyByRawKey } from '@/lib/api-key-store';
import { verifyPaymentForKey } from '@/lib/billing-actions';
import { checkVerifyIpThrottle, checkVerifyThrottle, throttledBody } from '@/lib/verify-throttle';

function clientIpOf(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
}

function throttled(body: ReturnType<typeof throttledBody>) {
  return NextResponse.json(body, { status: 429, headers: { 'Retry-After': String(body.retry_after) } });
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const paymentId = typeof body.payment_id === 'string' ? body.payment_id : '';
    const rawKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';

    if (!paymentId) {
      return NextResponse.json({ verified: false, reason: 'Missing payment_id' }, { status: 400 });
    }
    if (paymentId.length > 100) {
      return NextResponse.json({ verified: false, reason: 'Invalid payment_id' }, { status: 400 });
    }
    if (!rawKey) {
      return NextResponse.json({ verified: false, reason: 'Missing api_key' }, { status: 400 });
    }

    const ipGate = await checkVerifyIpThrottle(clientIpOf(request));
    if (ipGate.allowed === false) return throttled(throttledBody(ipGate));

    const key = await findApiKeyByRawKey(rawKey);
    if (!key) {
      return NextResponse.json({ verified: false, reason: 'Invalid or revoked API key' }, { status: 401 });
    }

    const gate = await checkVerifyThrottle(key.id, paymentId);
    if (gate.allowed === false) return throttled(throttledBody(gate));

    const result = await verifyPaymentForKey(key, paymentId);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error: any) {
    console.error('[billing/verify-payment] error:', error);
    return NextResponse.json({ verified: false, reason: error.message }, { status: 500 });
  }
}
