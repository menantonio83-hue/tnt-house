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
import { fetchTokenRisk } from '@/lib/token-risk-core';
import { hasPendingGrace, grantPendingGrace } from '@/lib/x402/pending-grace';
import { waitUntil } from '@vercel/functions';
import {
  buildPaymentRequiredBody,
  verifyPayment,
  settlePayment,
  type PaymentRequiredBody,
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
  if (await hasPendingGrace(mint)) {
    const graceResult = await fetchTokenRisk(mint);
    if (!graceResult.ok) {
      return NextResponse.json(
        { error: graceResult.error ?? 'Unknown error', ...(graceResult.details ? { details: graceResult.details } : {}) },
        { status: graceResult.status ?? 502, headers: CORS_HEADERS },
      );
    }
    return NextResponse.json(
      {
        mint: graceResult.mint,
        safety_score: graceResult.safety_score,
        maturity_capped: graceResult.maturity_capped,
        market_health_capped: graceResult.market_health_capped,
        contract_risk_capped: graceResult.contract_risk_capped,
        rugged_capped: graceResult.rugged_capped,
        caps_triggered: graceResult.caps_triggered,
        dominant_cap: graceResult.dominant_cap,
        cluster_analysis: graceResult.cluster_analysis,
        insider_clusters: graceResult.insider_clusters,
        insider_holder_count: graceResult.insider_holder_count,
        mint_authority: graceResult.mint_authority,
        freeze_authority: graceResult.freeze_authority,
        contract_renounced: graceResult.contract_renounced,
        honeypot_risk: graceResult.honeypot_risk,
        lp_locked: graceResult.lp_locked,
        rugged: graceResult.rugged,
        jup_verified: graceResult.jup_verified,
        deployer_address: graceResult.deployer_address,
        hidden_owner: graceResult.hidden_owner,
        permanent_delegate: graceResult.permanent_delegate,
        buy_tax_percent: graceResult.buy_tax_percent,
        sell_tax_percent: graceResult.sell_tax_percent,
        dev_wallet_percent: graceResult.dev_wallet_percent,
        token_program: graceResult.token_program,
        vesting_locks: graceResult.vesting_locks,
        holder_distribution: graceResult.holder_distribution,
        market: graceResult.market,
        note: graceResult.note,
        checked_at: graceResult.checked_at,
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

  try {
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

    let result;
    const tScoreStart = Date.now();
    try {
      result = await fetchTokenRisk(mint);
    } catch (error) {
      console.error('[token-risk/x402] scoring error before settlement:', error);
      return NextResponse.json(
        { error: 'Internal error' },
        { status: 500, headers: CORS_HEADERS },
      );
    }
    const scoreMs = Date.now() - tScoreStart;

    if (!result.ok) {
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
      return respond402({
        ...challenge,
        error: settlement.errorReason ?? 'Payment settlement failed',
      });
    }

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
      const receiptJson = JSON.stringify({ success: true, transaction: settlement.transactionHash });
      responseHeaders['X-PAYMENT-RESPONSE'] = receiptJson;
      responseHeaders['PAYMENT-RESPONSE'] = receiptJson;
    }

    return NextResponse.json(
      {
        mint: result.mint,
        safety_score: result.safety_score,
        maturity_capped: result.maturity_capped,
        market_health_capped: result.market_health_capped,
        contract_risk_capped: result.contract_risk_capped,
        rugged_capped: result.rugged_capped,
        caps_triggered: result.caps_triggered,
        dominant_cap: result.dominant_cap,
        cluster_analysis: result.cluster_analysis,
        insider_clusters: result.insider_clusters,
        insider_holder_count: result.insider_holder_count,
        mint_authority: result.mint_authority,
        freeze_authority: result.freeze_authority,
        contract_renounced: result.contract_renounced,
        honeypot_risk: result.honeypot_risk,
        lp_locked: result.lp_locked,
        rugged: result.rugged,
        jup_verified: result.jup_verified,
        deployer_address: result.deployer_address,
        hidden_owner: result.hidden_owner,
        permanent_delegate: result.permanent_delegate,
        buy_tax_percent: result.buy_tax_percent,
        sell_tax_percent: result.sell_tax_percent,
        dev_wallet_percent: result.dev_wallet_percent,
        token_program: result.token_program,
        vesting_locks: result.vesting_locks,
        holder_distribution: result.holder_distribution,
        market: result.market,
        note: result.note,
        checked_at: result.checked_at,
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    console.error('[token-risk/x402] unhandled error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: CORS_HEADERS });
  }
}
