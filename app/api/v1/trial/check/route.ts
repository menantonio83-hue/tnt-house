// Version 1.0 — app/api/v1/trial/check/route.ts
//
// POST /api/v1/trial/check
// Body: { "fingerprint": "<sha256 hex>", "mint": "<mint_address>" }
//
// Anonymous, no-signup entry point for the Risk-Data API landing page's
// "try it now" widget (app/risk-api/TryItWidget.tsx). Front door of the
// funnel: 3 free calls gated by a client-generated browser fingerprint
// (no email) -> once exhausted, this route returns a 403 upsell payload
// pointing at the existing /api/v1/signup (email -> real key, 15/day).
//
// Deliberately NOT the same code path as the real, authenticated
// /api/v1/token-risk (that one requires requireApiKey + enforceRateLimit
// against a real key) — this route has no API key at all, only a
// fingerprint hash. Both ultimately call the same fetchTokenRisk() core
// so the two surfaces can never silently diverge on scoring logic.
//
// Fingerprint is NOT a security boundary (trivially spoofable from
// devtools) — it's a friction-reduction device, same spirit as
// lib/demo-limit.ts's per-IP anon cap. Abuse ceiling is intentionally
// small (3 calls) and this route never issues credentials or touches
// billing, so the worst case is a few extra upstream Helius/DexScreener
// calls, not a security hole.

import { NextRequest, NextResponse } from 'next/server';
import { incrementAnonTrial, ANON_TRIAL_LIMIT } from '@/lib/anon-trial-store';
import { fetchTokenRisk } from '@/lib/token-risk-core';

// Same background-cluster-job budget as the real token-risk route —
// fetchTokenRisk() itself decides whether to wait or kick off a
// background job via waitUntil().
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Client sends a SHA-256 hex digest (64 chars) — see TryItWidget.tsx's
// getFingerprint(). A loose length range (32-128) tolerates a future
// switch to a different hash algorithm without an immediate backend
// change, while still rejecting obviously-malformed/empty input.
const FINGERPRINT_REGEX = /^[a-f0-9]{32,128}$/i;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint.trim() : '';
    const mint = typeof body.mint === 'string' ? body.mint.trim() : '';

    if (!fingerprint || !FINGERPRINT_REGEX.test(fingerprint)) {
      return NextResponse.json(
        { error: 'Missing or malformed fingerprint' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (!mint) {
      return NextResponse.json(
        { error: 'Missing required field: mint' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Increment BEFORE doing any upstream work — same "counters move
    // regardless of what happens after" convention as lib/rate-limit.ts,
    // so a caller can't dodge the cap by racing parallel requests for
    // different mints against the same fingerprint.
    const used = await incrementAnonTrial(fingerprint);

    if (used === null) {
      // Fail closed — see file header. An infra hiccup on an
      // unauthenticated surface is the wrong place to fail open.
      return NextResponse.json(
        { error: 'Trial service temporarily unavailable, try again shortly' },
        { status: 503, headers: CORS_HEADERS },
      );
    }

    if (used > ANON_TRIAL_LIMIT) {
      return NextResponse.json(
        {
          error: `Free trial limit reached (${ANON_TRIAL_LIMIT} checks, no email)`,
          trial_calls_used: ANON_TRIAL_LIMIT,
          trial_calls_remaining: 0,
          upgrade_url: 'https://tnt-audit.com/risk-api#get-key',
          note: `Get a free API key for ${15} checks/day — no card required, just an email.`,
        },
        { status: 403, headers: CORS_HEADERS },
      );
    }

    const result = await fetchTokenRisk(mint);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error ?? 'Unknown error',
          ...(result.details ? { details: result.details } : {}),
          trial_calls_used: used,
          trial_calls_remaining: Math.max(0, ANON_TRIAL_LIMIT - used),
        },
        { status: result.status ?? 502, headers: CORS_HEADERS },
      );
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
        checked_at: result.checked_at,
        trial_calls_used: used,
        trial_calls_remaining: Math.max(0, ANON_TRIAL_LIMIT - used),
      },
      { headers: CORS_HEADERS },
    );
  } catch (error: any) {
    console.error('[trial/check] error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
