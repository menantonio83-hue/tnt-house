// Version 1.1 — app/api/v1/trial/check/route.ts
//
// v1.1 (H-2 fix): quota moved OFF the client-supplied fingerprint and
// ONTO the caller's real IP (Vercel-set x-forwarded-for), with a hard
// global daily ceiling on top — see lib/trial-limit.ts for the full
// reasoning. A fingerprint is generated in the browser, so rotating it
// used to mint a fresh 3-call quota per rotation with no ceiling on
// total daily upstream cost; rotating real IPs now hits the global
// backstop instead. The `fingerprint` field is still ACCEPTED (the
// TryItWidget sends it) but no longer grants anything.
//
// Version 1.0 — app/api/v1/trial/check/route.ts
//
// POST /api/v1/trial/check
// Body: { "mint": "<mint_address>" }   (+ optional "fingerprint", ignored for quota)
//
// Anonymous, no-signup entry point for the Risk-Data API landing page's
// "try it now" widget (app/risk-api/TryItWidget.tsx). Front door of the
// funnel: 3 free calls per IP per day -> once exhausted, this route
// returns a 403 upsell payload pointing at the existing /api/v1/signup
// (email -> real key, 15/day).
//
// Deliberately NOT the same code path as the real, authenticated
// /api/v1/token-risk (that one requires requireApiKey + enforceRateLimit
// against a real key) — this route has no API key at all. Both
// ultimately call the same fetchTokenRisk() core so the two surfaces can
// never silently diverge on scoring logic.

import { NextRequest, NextResponse } from 'next/server';
import { checkTrialLimit, ANON_TRIAL_LIMIT } from '@/lib/trial-limit';
import { fetchTokenRisk } from '@/lib/token-risk-core';

// Same background-cluster-job budget as the real token-risk route —
// fetchTokenRisk() itself decides whether to wait or kick off a
// background job via waitUntil().
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// CORS v1.1: this route no longer advertises Access-Control-Allow-Origin.
// It is the IP-gated free trial — only app/risk-api/TryItWidget.tsx calls it, same-origin, and it identifies the
// caller by IP rather than by a key. A wildcard
// let any other website make ITS visitors spend this quota, with the
// cost landing on the visitor's identity instead of the attacker's.
// Kept as one place to add response headers if any are ever needed.
const RESPONSE_HEADERS = {};

// Client sends a SHA-256 hex digest (64 chars) — see TryItWidget.tsx's
// getFingerprint(). A loose length range (32-128) tolerates a future
// switch to a different hash algorithm without an immediate backend
// change, while still rejecting obviously-malformed/empty input.
const FINGERPRINT_REGEX = /^[a-f0-9]{32,128}$/i;

// H-2: best-effort client IP for the trial limiter. Vercel overwrites
// x-forwarded-for with the real client IP, so the first entry is the
// caller. Falls back to a constant bucket when the header is somehow
// missing — every header-less caller then shares one small pool, an
// acceptable degradation for an unauthenticated trial.
function extractClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    // Kept for backward compatibility with the widget, but no longer
    // used for quota: the quota identity is now the caller's real IP
    // (see lib/trial-limit.ts). A provided-but-malformed value is still
    // rejected so callers don't silently ship garbage.
    const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint.trim() : '';
    const mint = typeof body.mint === 'string' ? body.mint.trim() : '';

    if (fingerprint && !FINGERPRINT_REGEX.test(fingerprint)) {
      return NextResponse.json(
        { error: 'Malformed fingerprint' },
        { status: 400, headers: RESPONSE_HEADERS },
      );
    }

    if (!mint) {
      return NextResponse.json(
        { error: 'Missing required field: mint' },
        { status: 400, headers: RESPONSE_HEADERS },
      );
    }

    // H-2: quota is now per real IP plus a hard global daily ceiling —
    // the client-supplied fingerprint no longer mints quota. Rotating
    // fingerprints does nothing; rotating real IPs hits the global
    // backstop. Increment happens BEFORE any upstream work (same
    // "counters move regardless of what happens after" convention as
    // lib/rate-limit.ts), so a caller can't dodge the cap by racing
    // parallel requests for different mints.
    const trial = await checkTrialLimit(extractClientIp(request));

    if (!trial.allowed) {
      if (trial.reason === 'global') {
        return NextResponse.json(
          {
            error: `Free trials are at capacity for today (${trial.used}/${trial.limit} globally)`,
            trial_calls_used: trial.used,
            trial_calls_remaining: 0,
            upgrade_url: 'https://tnt-audit.com/risk-api#get-key',
            note: `Get a free API key for ${15} checks/day — no card required, just an email.`,
          },
          { status: 429, headers: RESPONSE_HEADERS },
        );
      }
      if (trial.reason === 'infra') {
        // Fail closed — an infra hiccup on an unauthenticated surface is
        // the wrong place to fail open.
        return NextResponse.json(
          { error: 'Trial service temporarily unavailable, try again shortly' },
          { status: 503, headers: RESPONSE_HEADERS },
        );
      }
      return NextResponse.json(
        {
          error: `Free trial limit reached (${ANON_TRIAL_LIMIT} checks per IP, no email)`,
          trial_calls_used: trial.used,
          trial_calls_remaining: Math.max(0, ANON_TRIAL_LIMIT - trial.used),
          upgrade_url: 'https://tnt-audit.com/risk-api#get-key',
          note: `Get a free API key for ${15} checks/day — no card required, just an email.`,
        },
        { status: 403, headers: RESPONSE_HEADERS },
      );
    }

    const result = await fetchTokenRisk(mint);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error ?? 'Unknown error',
          ...(result.details ? { details: result.details } : {}),
          trial_calls_used: trial.used,
          trial_calls_remaining: Math.max(0, ANON_TRIAL_LIMIT - trial.used),
        },
        { status: result.status ?? 502, headers: RESPONSE_HEADERS },
      );
    }

    return NextResponse.json(
      {
        mint: result.mint,
        safety_score: result.safety_score,
        dominant_cap: result.dominant_cap,
        cluster_analysis: result.cluster_analysis,
        insider_clusters: result.insider_clusters,
        mint_authority: result.mint_authority,
        freeze_authority: result.freeze_authority,
        contract_renounced: result.contract_renounced,
        honeypot_risk: result.honeypot_risk,
        lp_locked: result.lp_locked,
        rugged: result.rugged,
        jup_verified: result.jup_verified,
        hidden_owner: result.hidden_owner,
        permanent_delegate: result.permanent_delegate,
        buy_tax_percent: result.buy_tax_percent,
        sell_tax_percent: result.sell_tax_percent,
        dev_wallet_percent: result.dev_wallet_percent,
        token_program: result.token_program,
        vesting_locks: result.vesting_locks,
        holder_distribution: result.holder_distribution,
        market: result.market,
        checked_at: result.checked_at,
        trial_calls_used: trial.used,
        trial_calls_remaining: Math.max(0, ANON_TRIAL_LIMIT - trial.used),
      },
      { headers: RESPONSE_HEADERS },
    );
  } catch (error: any) {
    console.error('[trial/check] error:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: RESPONSE_HEADERS },
    );
  }
}
