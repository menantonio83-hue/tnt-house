// Version 1.11 — app/api/v1/token-risk/x402/route.ts
//
// v1.11: replay protection. The 402 challenge is unchanged. A known
// payment is looked up before verify: other mint -> 409, in progress ->
// 409, already settled for this mint -> fresh result, settle timeout ->
// fresh result and one more settle. A new payment is claimed after
// verify and before scoring; scoring failure releases it. Redis down:
// the v1.10 flow runs unchanged, with a warning.
//
// Version 1.10 — app/api/v1/token-risk/x402/route.ts
//
// v1.10: pending-grace fix (see lib/x402/pending-grace.ts's header for
// the full story) — a mint stuck in cluster_analysis: 'pending' no
// longer charges again on repeat polls within a short window after
// the first paid call. mint is now parsed BEFORE the payment
// challenge (used to happen after) so the grace check can run before
// deciding whether to demand payment at all.
//
// Version 1.9 — app/api/v1/token-risk/x402/route.ts
//
// v1.9: per-stage latency instrumentation (Бро, 2026-09-02). A vendor
// review question ("what's your settle-to-response latency after
// proof?") exposed that we had no real measurement of verify/score/
// settle timing — only a guess. This adds timestamps around each of
// the three sequential network-bound steps (verify -> score -> settle,
// none parallelized — settle only fires after a valid score exists, so
// we never charge for a call we couldn't answer) and:
//   1. logs a structured breakdown to console (visible in Vercel logs)
//   2. echoes the same breakdown in a Server-Timing response header on
//      successful (200) responses only, so a real caller can read their
//      own latency without digging through logs
// Logging only — no change to the payment/verification logic itself,
// so this does not touch settlement correctness or funds flow.
//
// Version 1.8 — app/api/v1/token-risk/x402/route.ts
//
// x402 pay-per-call variant of /api/v1/token-risk
// Updated to work with async buildPaymentRequiredBody (feePayer discovery)

import { NextRequest, NextResponse } from 'next/server';
import { fetchTokenRisk, toPublicTokenRisk } from '@/lib/token-risk-core';
import { consumePendingGrace, grantPendingGrace } from '@/lib/x402/pending-grace';
import { waitUntil } from '@vercel/functions';
import {
  buildPaymentRequiredBody,
  verifyPayment,
  settlePayment,
  claimX402Receipt,
  isAlreadySettled,
  lookupX402Receipt,
  releaseX402Receipt,
  saveX402Receipt,
  x402ReceiptId,
  type PaymentRequiredBody,
  type X402Receipt,
} from '@/lib/x402/verify';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-PAYMENT, PAYMENT-SIGNATURE',
  'Access-Control-Expose-Headers':
    'X-PAYMENT-RESPONSE, PAYMENT-RESPONSE, PAYMENT-REQUIRED',
};

// v1.9 price cut (2026-08-13): $0.07 -> $0.02/call.
// v8.6 (2026-08-29): human-facing PAYG rate (lib/billing-pricing.ts's
// OVERAGE_RATE_FREE_USD) was lowered from $0.04 to match this same
// $0.02/call — the two channels are now priced identically. x402's
// remaining differentiator is "no account/key needed", not price; see
// i18n's x402HowToNote for the current framing.
// Matches the closest direct x402 competitor (token-rugcheck, $0.02/call).
const PRICE_USDC_ATOMIC = '20000';
const RESOURCE_PATH = '/api/v1/token-risk/x402';
const DESCRIPTION = 'TNT House Risk-Data API — single token risk score lookup';

function respond402(body: PaymentRequiredBody): NextResponse {
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64');
  return NextResponse.json(body, {
    status: 402,
    headers: { ...CORS_HEADERS, 'PAYMENT-REQUIRED': encoded },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const t0 = Date.now(); // v1.9: request start, before anything else

  // v1.10: mint parsed FIRST — needed before the payment challenge so
  // the pending-grace check can run before we decide whether to
  // demand payment at all.
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get('mint') || searchParams.get('ca');

  if (!mint) {
    return NextResponse.json(
      { error: 'Missing required parameter: mint (or ca)' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // v1.10: free re-poll while this mint's cluster analysis is still
  // computing from an earlier PAID call — see
  // lib/x402/pending-grace.ts for the full reasoning. Skips the
  // payment challenge entirely; no X-PAYMENT header required.
  // v1.11 (M-4): each free re-poll consumes the mint's and the day's
  // grace budgets (5 per mint, 200/day globally) — exhausted budgets
  // fall through to the normal 402 challenge.
  if (await consumePendingGrace(mint)) {
    const graceResult = await fetchTokenRisk(mint);
    if (!graceResult.ok) {
      return NextResponse.json(
        { error: graceResult.error ?? 'Unknown error', ...(graceResult.details ? { details: graceResult.details } : {}) },
        { status: graceResult.status ?? 502, headers: CORS_HEADERS },
      );
    }
    return NextResponse.json(
      {
        ...toPublicTokenRisk(graceResult),
        pending_grace: true,
      },
      { headers: CORS_HEADERS },
    );
  }

  const paymentHeader =
    request.headers.get('X-PAYMENT') || request.headers.get('PAYMENT-SIGNATURE');

  let challenge: PaymentRequiredBody;
  try {
    challenge = await buildPaymentRequiredBody(
      RESOURCE_PATH,
      PRICE_USDC_ATOMIC,
      DESCRIPTION,
      paymentHeader ? undefined : 'Payment required',
    );
  } catch (error) {
    console.error('[token-risk/x402] failed to build payment challenge:', error);
    return NextResponse.json(
      { error: 'Payment facilitator temporarily unavailable' },
      { status: 503, headers: CORS_HEADERS },
    );
  }

  if (!paymentHeader) {
    return respond402(challenge);
  }

  const requirement = challenge.accepts[0];
  const receiptId = x402ReceiptId(paymentHeader);
  let claimToken: string | null = null;

  try {
    // v1.11: a payment we already know about is handled before verify —
    // the facilitator would reject a payment that already settled.
    if (receiptId) {
      const known = await lookupX402Receipt(receiptId);
      if (known.kind === 'unavailable') {
        console.warn('[x402] receipt store unavailable — running without replay protection');
      } else if (known.kind === 'found') {
        return await handleKnownReceipt(known.receipt, receiptId, mint, paymentHeader, requirement, challenge, t0);
      }
    }

    const tVerifyStart = Date.now();
    const verification = await verifyPayment(
      paymentHeader,
      requirement,
      `https://www.tnt-audit.com${RESOURCE_PATH}`,
    );
    const verifyMs = Date.now() - tVerifyStart;
    if (!verification.isValid) {
      console.log('[x402][latency] verify_failed', { verifyMs });
      return respond402({
        ...challenge,
        error: verification.errorReason ?? 'Payment verification failed',
      });
    }

    if (receiptId) {
      const claim = await claimX402Receipt(receiptId, mint);
      if (claim.kind === 'claimed') {
        claimToken = claim.token;
      } else if (claim.kind === 'taken') {
        return claim.receipt && claim.receipt.mint !== mint ? mintMismatch() : inProgress();
      } else {
        console.warn('[x402] receipt claim unavailable — running without replay protection');
      }
    }

    let result;
    const tScoreStart = Date.now();
    try {
      result = await fetchTokenRisk(mint);
    } catch (error) {
      console.error('[token-risk/x402] scoring error before settlement:', error);
      if (receiptId && claimToken) await releaseX402Receipt(receiptId, claimToken);
      claimToken = null;
      return NextResponse.json(
        { error: 'Internal error' },
        { status: 500, headers: CORS_HEADERS },
      );
    }
    const scoreMs = Date.now() - tScoreStart;

    if (!result.ok) {
      if (receiptId && claimToken) await releaseX402Receipt(receiptId, claimToken);
      claimToken = null;
      return NextResponse.json(
        { error: result.error ?? 'Unknown error', ...(result.details ? { details: result.details } : {}) },
        { status: result.status ?? 502, headers: CORS_HEADERS },
      );
    }

    const tSettleStart = Date.now();
    const settlement = await settlePayment(paymentHeader, requirement);
    const settleMs = Date.now() - tSettleStart;
    if (!settlement.success) {
      console.log('[x402][latency] settle_failed', { verifyMs, scoreMs, settleMs });
      if (receiptId && claimToken) {
        if (settlement.timedOut) {
          // Verified, but settle did not answer. Keep the claim so a retry
          // of this same payment settles again instead of paying twice.
          await saveX402Receipt(receiptId, { state: 'settle_timeout', mint });
        } else {
          await releaseX402Receipt(receiptId, claimToken);
        }
      }
      claimToken = null;
      return respond402({
        ...challenge,
        error: settlement.errorReason ?? 'Payment settlement failed',
      });
    }
    if (receiptId && claimToken) {
      await saveX402Receipt(receiptId, { state: 'settled', mint, transactionHash: settlement.transactionHash });
    }
    claimToken = null;

    // v1.10: this call just paid to kick off (or check) this mint's
    // analysis — if it's still 'pending', open a short free-repoll
    // window so a poll-until-complete loop doesn't 402 again. See
    // lib/x402/pending-grace.ts.
    if (result.cluster_analysis === 'pending') {
      waitUntil(grantPendingGrace(mint));
    }

    const totalMs = Date.now() - t0;
    // v1.9: structured breakdown for real observability — answers "what's
    // your settle-to-response latency" with a measured number, not a guess.
    console.log('[x402][latency] success', { verifyMs, scoreMs, settleMs, totalMs, mint });

    const responseHeaders: Record<string, string> = { ...CORS_HEADERS };
    // Server-Timing lets a caller read the same breakdown themselves
    // (visible in browser devtools / any HTTP client that surfaces
    // response headers) without needing access to our Vercel logs.
    responseHeaders['Server-Timing'] =
      `verify;dur=${verifyMs}, score;dur=${scoreMs}, settle;dur=${settleMs}, total;dur=${totalMs}`;
    if (settlement.transactionHash) {
      Object.assign(responseHeaders, paymentResponseHeaders(settlement.transactionHash, requirement.network));
    }

    return NextResponse.json(
      {
        ...toPublicTokenRisk(result),
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    console.error('[token-risk/x402] unhandled error:', error);
    if (receiptId && claimToken) await releaseX402Receipt(receiptId, claimToken);
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: CORS_HEADERS });
  }
}

function mintMismatch(): NextResponse {
  return NextResponse.json(
    { error: 'This payment was already used for a different mint', error_code: 'receipt_mint_mismatch' },
    { status: 409, headers: CORS_HEADERS },
  );
}

function inProgress(): NextResponse {
  return NextResponse.json(
    { error: 'This payment is already being processed. Retry in a moment.', error_code: 'receipt_in_progress' },
    { status: 409, headers: CORS_HEADERS },
  );
}

// x402 settle response header: base64 of the JSON SettleResponse, as
// @x402/core's decodePaymentResponseHeader expects (v2 reads
// PAYMENT-RESPONSE first, then X-PAYMENT-RESPONSE; v1 also used base64).
// Plain JSON made the official client throw "Invalid payment response header".
function paymentResponseHeaders(transactionHash: string, network: string): Record<string, string> {
  const encoded = Buffer.from(
    JSON.stringify({ success: true, transaction: transactionHash, network }),
    'utf8',
  ).toString('base64');
  return { 'PAYMENT-RESPONSE': encoded, 'X-PAYMENT-RESPONSE': encoded };
}

function paidResponse(
  result: Parameters<typeof toPublicTokenRisk>[0],
  transactionHash: string | undefined,
  network: string,
): NextResponse {
  const headers: Record<string, string> = { ...CORS_HEADERS };
  if (transactionHash) {
    Object.assign(headers, paymentResponseHeaders(transactionHash, network));
  }
  return NextResponse.json({ ...toPublicTokenRisk(result) }, { headers });
}

// v1.11: a retry of a payment we have seen. Only payments that passed
// verify are ever stored, so this never runs for an unverified payment.
async function handleKnownReceipt(
  receipt: X402Receipt,
  receiptId: string,
  mint: string,
  paymentHeader: string,
  requirement: PaymentRequiredBody['accepts'][number],
  challenge: PaymentRequiredBody,
  t0: number,
): Promise<NextResponse> {
  if (receipt.mint !== mint) return mintMismatch();
  if (receipt.state === 'held') return inProgress();

  const result = await fetchTokenRisk(mint);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? 'Unknown error', ...(result.details ? { details: result.details } : {}) },
      { status: result.status ?? 502, headers: CORS_HEADERS },
    );
  }

  if (receipt.state === 'settled') {
    console.log('[x402] repeat of a settled payment, fresh result', { mint, totalMs: Date.now() - t0 });
    return paidResponse(result, receipt.transactionHash, requirement.network);
  }

  // settle_timeout: try settle once more.
  const settlement = await settlePayment(paymentHeader, requirement);
  if (settlement.success || isAlreadySettled(settlement.errorReason)) {
    await saveX402Receipt(receiptId, { state: 'settled', mint, transactionHash: settlement.transactionHash });
    if (result.cluster_analysis === 'pending') waitUntil(grantPendingGrace(mint));
    console.log('[x402] settle retry ok', { mint, totalMs: Date.now() - t0 });
    return paidResponse(result, settlement.transactionHash, requirement.network);
  }
  if (settlement.timedOut) {
    return respond402({ ...challenge, error: settlement.errorReason ?? 'Payment settlement failed' });
  }
  await releaseX402Receipt(receiptId, null);
  return respond402({ ...challenge, error: settlement.errorReason ?? 'Payment settlement failed' });
}
