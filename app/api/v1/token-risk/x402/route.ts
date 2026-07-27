// Version 1.4 — app/api/v1/token-risk/x402/route.ts
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
// v1.4: migrated the 402 response body to the x402 v2 spec shape (see
// lib/x402/verify.ts v1.2 for the field-level changes). Also now
// accepts the incoming payment proof under either X-PAYMENT (v1-style,
// still used by several existing clients) or PAYMENT-SIGNATURE (the v2
// HTTP-transport header name) — checks both so callers on either
// version work. x402scan and similar v2-aware scanners rejected the
// v1.3 response outright with "x402 v1 response detected".
//
// v1.3: 402 response fires before the mint/ca parameter is checked, not
// after — required for directory scanners that probe the bare path
// with no query params.
//
// v1.2: settlement (the actual on-chain charge) happens AFTER a
// successful fetchTokenRisk result, not before — an agent is never
// charged for a request that fails.
//
// Price: $0.07/call, matching the existing pay-per-call overage rate
// documented on tnt-audit.com/risk-api (Limits & pricing section).

import { NextRequest, NextResponse } from 'next/server';
import { fetchTokenRisk } from '@/lib/token-risk-core';
import { buildPaymentRequiredBody, verifyPayment, settlePayment } from '@/lib/x402/verify';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-PAYMENT, PAYMENT-SIGNATURE',
  'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE, PAYMENT-RESPONSE',
};

// $0.07 per call in USDC atomic units (USDC has 6 decimals: 0.07 * 1_000_000)
const PRICE_USDC_ATOMIC = '70000';
const RESOURCE_PATH = '/api/v1/token-risk/x402';
const DESCRIPTION = 'TNT House Risk-Data API — single token risk score lookup';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  // Accept either header name — X-PAYMENT (v1-style, still common) or
  // PAYMENT-SIGNATURE (the v2 HTTP-transport name).
  const paymentHeader =
    request.headers.get('X-PAYMENT') || request.headers.get('PAYMENT-SIGNATURE');

  // No payment attached yet -> tell the caller what it costs and where
  // to pay. Fires on ANY unpaid request, with or without a mint param —
  // this is what directory scanners probe for on the bare path.
  if (!paymentHeader) {
    const body = buildPaymentRequiredBody(
      RESOURCE_PATH,
      PRICE_USDC_ATOMIC,
      DESCRIPTION,
      'Payment required',
    );
    return NextResponse.json(body, { status: 402, headers: CORS_HEADERS });
  }

  const requirement = buildPaymentRequiredBody(RESOURCE_PATH, PRICE_USDC_ATOMIC, DESCRIPTION)
    .accepts[0];

  // Verify only checks the payment is well-formed and funded — no money
  // moves yet. Cheap gate before we spend any RPC/scoring work.
  const verification = await verifyPayment(paymentHeader, requirement);
  if (!verification.isValid) {
    const body = buildPaymentRequiredBody(
      RESOURCE_PATH,
      PRICE_USDC_ATOMIC,
      DESCRIPTION,
      verification.errorReason ?? 'Payment verification failed',
    );
    return NextResponse.json(body, { status: 402, headers: CORS_HEADERS });
  }

  // mint/ca is only checked now, after a verified payment.
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get('mint') || searchParams.get('ca');

  if (!mint) {
    return NextResponse.json(
      { error: 'Missing required parameter: mint (or ca)' },
      { status: 400, headers: CORS_HEADERS },
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
    return NextResponse.json(
      { error: result.error ?? 'Unknown error', ...(result.details ? { details: result.details } : {}) },
      { status: result.status ?? 502, headers: CORS_HEADERS },
    );
  }

  // Only now, with a real usable result in hand, actually settle the
  // payment on-chain.
  const settlement = await settlePayment(paymentHeader, requirement);
  if (!settlement.success) {
    const body = buildPaymentRequiredBody(
      RESOURCE_PATH,
      PRICE_USDC_ATOMIC,
      DESCRIPTION,
      settlement.errorReason ?? 'Payment settlement failed',
    );
    return NextResponse.json(body, { status: 402, headers: CORS_HEADERS });
  }

  const responseHeaders: Record<string, string> = { ...CORS_HEADERS };
  if (settlement.transactionHash) {
    const receiptJson = JSON.stringify({ success: true, transaction: settlement.transactionHash });
    responseHeaders['X-PAYMENT-RESPONSE'] = receiptJson;
    responseHeaders['PAYMENT-RESPONSE'] = receiptJson;
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
