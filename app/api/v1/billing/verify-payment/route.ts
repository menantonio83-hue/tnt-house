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
import { getPaymentById, confirmPayment, expireStalePendingPayment } from '@/lib/billing-store';
import { findMatchingPayment } from '@/lib/billing-verify';
import { PENDING_INVOICE_TTL_MINUTES } from '@/lib/billing-pricing';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const paymentId = typeof body.payment_id === 'string' ? body.payment_id : '';
    const rawKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';

    if (!paymentId) {
      return NextResponse.json({ verified: false, reason: 'Missing payment_id' }, { status: 400 });
    }
    if (!rawKey) {
      return NextResponse.json({ verified: false, reason: 'Missing api_key' }, { status: 400 });
    }

    const key = await findApiKeyByRawKey(rawKey);
    if (!key) {
      return NextResponse.json({ verified: false, reason: 'Invalid or revoked API key' }, { status: 401 });
    }

    const payment = await getPaymentById(paymentId);
    if (!payment) {
      return NextResponse.json({ verified: false, reason: 'Unknown payment_id' }, { status: 404 });
    }

    if (payment.key_id !== key.id) {
      // Deliberately the same generic shape as "unknown payment_id" —
      // don't confirm to a caller that a payment_id exists but belongs
      // to someone else.
      return NextResponse.json({ verified: false, reason: 'Unknown payment_id' }, { status: 404 });
    }

    if (payment.status === 'confirmed') {
      // Already resolved by an earlier poll — idempotent success, not an error.
      return NextResponse.json({
        verified: true,
        already: true,
        kind: payment.kind,
        tx_signature: payment.tx_signature,
      });
    }

    if (payment.status === 'expired') {
      return NextResponse.json({
        verified: false,
        expired: true,
        reason: 'This invoice has expired. Please create a new one.',
      });
    }

    // payment.status === 'pending' from here on. Always search for a
    // match FIRST — only consider expiring if genuinely not found, so a
    // payment that landed on-chain just before the TTL boundary always
    // gets at least one real chance to be matched on this exact poll.
    const match = await findMatchingPayment(
      payment.pay_amount,
      payment.currency,
      new Date(payment.created_at).getTime(),
    );

    if (!match.found || !match.signature) {
      const justExpired = await expireStalePendingPayment(payment.id, PENDING_INVOICE_TTL_MINUTES);
      if (justExpired) {
        return NextResponse.json({
          verified: false,
          expired: true,
          reason: 'This invoice expired before payment was detected. Please create a new one.',
        });
      }
      return NextResponse.json({ verified: false, reason: match.reason || 'Not found yet' });
    }

    const result = await confirmPayment(payment.id, match.signature);

    if (!result.claimed) {
      if (result.reason) {
        // Genuine collision caught by the DB constraint — this specific
        // invoice did NOT get credited. Tell the truth instead of
        // reporting success.
        return NextResponse.json({
          verified: false,
          reason:
            'This payment amount matched a transaction already used for a different invoice. Please start a new top-up/subscription — you were not charged twice.',
        });
      }

      // No reason: ambiguous. Could be "a concurrent poll for this same
      // payment_id already confirmed it" (fine) OR "it expired
      // concurrently" OR some other state change. Never assume success —
      // re-read the real status and answer honestly.
      const recheck = await getPaymentById(payment.id);

      if (recheck?.status === 'confirmed') {
        return NextResponse.json({
          verified: true,
          already: true,
          kind: recheck.kind,
          tx_signature: recheck.tx_signature,
        });
      }
      if (recheck?.status === 'expired') {
        return NextResponse.json({
          verified: false,
          expired: true,
          reason: 'This invoice expired before payment was detected. Please create a new one.',
        });
      }
      return NextResponse.json({
        verified: false,
        reason: 'Could not confirm payment right now — please try again in a moment.',
      });
    }

    return NextResponse.json({
      verified: true,
      kind: result.kind,
      subscription_expires_at: result.subscription_expires_at ?? null,
      credit_balance_usd: result.credit_balance_usd ?? null,
      tx_signature: match.signature,
    });
  } catch (error: any) {
    console.error('[billing/verify-payment] error:', error);
    return NextResponse.json({ verified: false, reason: error.message }, { status: 500 });
  }
}
