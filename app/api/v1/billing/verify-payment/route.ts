// Version 7.11 — app/api/v1/billing/verify-payment/route.ts
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
// Body: { payment_id: "<uuid from create-invoice>" }
//
// Polled repeatedly by the client after opening the wallet — same
// polling pattern as app/page.js's startPaymentVerification, just
// against this feature's own invoice + confirm_payment RPC instead of
// the site's /api/verify-payment. Idempotent: polling after the payment
// was already confirmed (by an earlier poll) just returns the same
// success result again, never double-credits.

import { NextRequest, NextResponse } from 'next/server';
import { getPaymentById, confirmPayment } from '@/lib/billing-store';
import { findMatchingPayment } from '@/lib/billing-verify';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const paymentId = typeof body.payment_id === 'string' ? body.payment_id : '';

    if (!paymentId) {
      return NextResponse.json({ verified: false, reason: 'Missing payment_id' }, { status: 400 });
    }

    const payment = await getPaymentById(paymentId);
    if (!payment) {
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
