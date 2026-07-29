// Version 1.8 — app/api/v1/token-risk/x402/route.ts
//
// x402 pay-per-call variant of /api/v1/token-risk
// Updated to work with async buildPaymentRequiredBody (feePayer discovery)

import { NextRequest, NextResponse } from 'next/server';
import { fetchTokenRisk } from '@/lib/token-risk-core';
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

const PRICE_USDC_ATOMIC = '70000';
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
    const verification = await verifyPayment(
      paymentHeader,
      requirement,
      `https://www.tnt-audit.com${RESOURCE_PATH}`,
    );
    if (!verification.isValid) {
      return respond402({
        ...challenge,
        error: verification.errorReason ?? 'Payment verification failed',
      });
    }

    const { searchParams } = new URL(request.url);
    const mint = searchParams.get('mint') || searchParams.get('ca');

    if (!mint) {
      return NextResponse.json(
        { error: 'Missing required parameter: mint (or ca)' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    let result;
    try {
      result = await fetchTokenRisk(mint);
    } catch (error) {
      console.error('[token-risk/x402] scoring error before settlement:', error);
      return NextResponse.json(
        { error: 'Internal error' },
        { status: 500, headers: CORS_HEADERS },
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? 'Unknown error', ...(result.details ? { details: result.details } : {}) },
        { status: result.status ?? 502, headers: CORS_HEADERS },
      );
    }

    const settlement = await settlePayment(paymentHeader, requirement);
    if (!settlement.success) {
      return respond402({
        ...challenge,
        error: settlement.errorReason ?? 'Payment settlement failed',
      });
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
  } catch (error) {
    console.error('[token-risk/x402] unhandled error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: CORS_HEADERS });
  }
}
