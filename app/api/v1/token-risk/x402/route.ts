// Version 1.2 — app/api/v1/token-risk/x402/route.ts
//
// x402 pay-per-call variant of /api/v1/token-risk, for autonomous AI
// agents that don't want to register for an API key up front. Runs
// fully parallel to the existing key-based route.ts — same underlying
// scoring logic (lib/token-risk-core.ts fetchTokenRisk), completely
// separate auth path. Does not touch route.ts or any existing billing
// logic in any way.
//
// GET /api/v1/token-risk/x402?mint=<mint_address>   (or ?ca=<mint_address>)
//
// v1.2: fixed a billing-fairness bug from v1.1 — settlement (the actual
// on-chain charge) now happens AFTER a successful fetchTokenRisk result,
// not before. v1.1 settled the payment first, so an agent could be
// charged for a request that then failed (bad mint, upstream error).
// Verification (checking the payment is well-formed and funded, which
// does NOT move money) still happens first, before any scoring work —
// that part was already correct and stays as the up-front gate.
//
// Price: $0.07/call, matching the existing pay-per-call overage rate
// documented on tnt-audit.com/risk-api (Limits & pricing section) —
// intentionally the same number, not a separate price invented for
// this channel.
//
// Flow:
// 1. No X-PAYMENT header -> respond 402 with PaymentRequirements JSON
//    (price, receiving wallet, USDC mint, resource path).
// 2. X-PAYMENT header present -> verify with the x402 facilitator
//    (signature + funds check, no money moved yet) -> run the real
//    scoring logic -> only on success, settle the payment on-chain ->
//    return the data.
// 3. Verify failure or scoring failure both return without ever
//    settling — the agent is not charged for a request it didn't get
//    a usable answer for.

import { NextRequest, NextResponse } from 'next/server';
import { fetchTokenRisk } from '@/lib/token-risk-core';
import { buildPaymentRequirements, verifyPayment, settlePayment } from '@/lib/x402/verify';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-PAYMENT',
  'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE',
};

// $0.07 per call in USDC atomic units (USDC has 6 decimals: 0.07 * 1_000_000)
// — matches the existing pay-per-call overage_rate_usd on the pricing page.
const PRICE_USDC_ATOMIC = '70000';
const RESOURCE_PATH = '/api/v1/token-risk/x402';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get('mint') || searchParams.get('ca');

  if (!mint) {
    return NextResponse.json(
      { error: 'Missing required parameter: mint (or ca)' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const requirements = buildPaymentRequirements(
    RESOURCE_PATH,
    PRICE_USDC_ATOMIC,
    'TNT House Risk-Data API — single token risk score lookup',
  );

  const paymentHeader = request.headers.get('X-PAYMENT');

  // No payment attached yet -> tell the agent what it costs and where to pay.
  if (!paymentHeader) {
    return NextResponse.json(
      {
        error: 'Payment required',
        x402Version: 1,
        accepts: [requirements],
      },
      { status: 402, headers: CORS_HEADERS },
    );
  }

  // Verify only checks the payment is well-formed and funded — no money
  // moves yet. Cheap gate before we spend any RPC/scoring work.
  const verification = await verifyPayment(paymentHeader, requirements);
  if (!verification.isValid) {
    return NextResponse.json(
      {
        error: 'Payment verification failed',
        reason: verification.errorReason ?? 'unknown',
        x402Version: 1,
        accepts: [requirements],
      },
      { status: 402, headers: CORS_HEADERS },
    );
  }

  // Run the actual scoring BEFORE settling — if this fails, the agent
  // is never charged.
  let result;
  try {
    result = await fetchTokenRisk(mint);
  } catch (error: any) {
    console.error('[token-risk/x402] scoring error before settlement:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  if (!result.ok) {
    // Bad mint / upstream failure — no settlement, agent isn't charged.
    return NextResponse.json(
      { error: result.error ?? 'Unknown error', ...(result.details ? { details: result.details } : {}) },
      { status: result.status ?? 502, headers: CORS_HEADERS },
    );
  }

  // Only now, with a real usable result in hand, actually settle the
  // payment on-chain.
  const settlement = await settlePayment(paymentHeader, requirements);
  if (!settlement.success) {
    return NextResponse.json(
      {
        error: 'Payment settlement failed',
        reason: settlement.errorReason ?? 'unknown',
        x402Version: 1,
        accepts: [requirements],
      },
      { status: 402, headers: CORS_HEADERS },
    );
  }

  const responseHeaders: Record<string, string> = { ...CORS_HEADERS };
  if (settlement.transactionHash) {
    responseHeaders['X-PAYMENT-RESPONSE'] = JSON.stringify({
      success: true,
      transaction: settlement.transactionHash,
    });
  }

  return NextResponse.json(
    {
      mint: result.mint,
      safety_score: result.safety_score,
      cluster_analysis: result.cluster_analysis,
      insider_clusters: result.insider_clusters,
      mint_authority: result.mint_authority,
      freeze_authority: result.freeze_authority,
      honeypot_risk: result.honeypot_risk,
      lp_locked: result.lp_locked,
      holder_distribution: result.holder_distribution,
      market: result.market,
      note: result.note,
      checked_at: result.checked_at,
    },
    { headers: responseHeaders },
  );
}
