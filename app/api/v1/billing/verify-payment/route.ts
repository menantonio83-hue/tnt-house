// Version 7.16 — app/api/v1/billing/verify-payment/route.ts
//
// v7.16: two hardening fixes from external security review:
// 1. Now requires `api_key` alongside `payment_id`, and rejects the
//    request unless that key owns the payment. Previously `payment_id`
//    (a UUID) was the ONLY thing checked — anyone who obtained/guessed a
//    payment_id could poll it, which cost a Helius call + a Supabase
//    round trip per attempt with zero proof of ownership. Enumerating
//    UUIDs isn't practical (122 bits of entropy), but this closes the
//    DoS/enumeration surface properly instead of relying on that alone,
//    and matches how create-invoice already requires the key.
// 2. Lazy TTL expiry: a 'pending' payment older than
//    PENDING_INVOICE_TTL_MINUTES (lib/billing-pricing.ts) is flipped to
//    'expired' on first read here instead of being polled forever — see
//    lib/billing-store.ts's expireStalePendingPayment.
//
// v7.11: a failed claim (result.claimed === false) now distinguishes
// "someone else already confirmed this exact payment_id" (fine,
// idempotent) from "the tx_signature was already used for a DIFFERENT
// payment" (a genuine collision the DB constraint caught — see
// lib/billing-pricing.ts's version note) — the latter is surfaced as an
// honest failure so the user knows to retry with a fresh invoice,
// rather than being told their payment succeeded when it didn't.
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

    if (payment.status === 'pending') {
      const justExpired = await expireStalePendingPayment(payment.id, PENDING_INVOICE_TTL_MINUTES);
      if (justExpired) {
        return NextResponse.json({
          verified: false,
          expired: true,
          reason: 'This invoice expired before payment was detected. Please create a new one.',
        });
      }
    } else if (payment.status === 'expired') {
      return NextResponse.json({
        verified: false,
        expired: true,
        reason: 'This invoice has expired. Please create a new one.',
      });
    }

    const match = await findMatchingPayment(
      payment.pay_amount,
      payment.currency,
      new Date(payment.created_at).getTime(),
    );

    if (!match.found || !match.signature) {
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
      // No reason means someone (this same payment_id) already claimed
      // it a moment earlier — that's fine, idempotent success.
      return NextResponse.json({ verified: true, already: true, kind: payment.kind });
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
