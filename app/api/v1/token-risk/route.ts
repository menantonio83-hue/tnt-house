// Version 1.11 — app/api/v1/token-risk/route.ts
//
// v1.11: pure refactor, no behavior change. Per-mint fetch/scoring logic
// moved to lib/token-risk-core.ts (fetchTokenRisk + computeApiSafetyScore)
// so the new batch endpoint (app/api/v1/token-risk/batch/route.ts) can
// reuse the exact same logic instead of a second, divergence-prone copy.
// This file now only owns: auth, rate limiting, the mint/ca query-param
// alias, response-shape assembly, and request logging — all unchanged
// from v1.10. Re-verified byte-identical output on a real mint
// (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v) before/after.
//
// v1.10: adds X-Credit-Balance-Usd header (pay-per-call billing, see
// lib/rate-limit.ts v3.4 / lib/billing-pricing.ts) to successful
// responses, so callers can see their remaining balance without a
// separate request.
//
// v1.9: lib/holder-distribution.ts was rewritten from scratch (v6.12) —
// the v6.10 retry wrapper didn't actually fix the reported bug (holder_
// count: 0 still reproduced on BONK). The new version distinguishes a
// genuine RPC failure/rate-limit from a real empty holder list instead
// of guessing, with real backoff and real per-attempt logging. Bumped
// HOLDER_RISK_TIMEOUT_MS (25s -> 40s) to give the longer retry/backoff
// schedule room within the 60s function budget.
//
// Risk-Data API — two more bugs reported live on real tokens (BONK,
// USDC) after the Stage 6 timeout fix, both fixed without touching
// lib/helius-client.js:
//
// 1. holder_distribution came back as { holder_count: 0,
//    largest_holder_percent: 100 } on massively-held tokens. Root cause:
//    checkHolderDistributionRisk() returns exactly that shape whenever
//    the underlying getTokenLargestAccounts + getTokenSupply RPC pair
//    fails for ANY reason (including a rate-limited response from the
//    free public RPC) — the failure is swallowed deep inside
//    getTopHolders() and silently converted into an empty array,
//    indistinguishable from "this token genuinely has zero holders".
//    Fixed via lib/holder-distribution.ts, which retries that specific
//    ambiguous result a few times before trusting it.
//
// 2. price_change_24h_percent came back as 456420 — not a real 24h move
//    for a huge, liquid token. getDexScreenerData() passes DexScreener's
//    number straight through with no validation. Fixed via
//    lib/sanitize-market-data.ts, a defensive layer on our own output
//    that nulls out implausible values instead of relaying them.
//
// Also carries the Stage 6 502 fix: real (non-major) tokens could
// return a raw platform 502 instead of a clean JSON response, because
// the public Solana RPC + DexScreener have no guaranteed response time
// and Node's fetch() has no default timeout — getMintInfo /
// checkHolderDistributionRisk / getDexScreenerData are each capped with
// their own timeout + safe fallback (lib/with-timeout.ts), so a slow
// upstream degrades the response instead of hanging it.
//
// GET /api/v1/token-risk?mint=<mint_address>   (or ?ca=<mint_address>)
// Header: Authorization: Bearer <api_key>
//
// Design decisions locked in so far:
// - Accepts `mint` or `ca` as aliases for the same parameter.
// - safety_score uses a NEW, stricter API-specific formula — separate
//   from the public site's performFullAudit() score. insiderScore here
//   is REAL (based on detected clusters), not a constant.
// - Insider-cluster detection (slow, up to 60s) is never awaited inline.
//   First request for a mint: fast response, cluster_analysis: "pending",
//   background job kicks off via Vercel's waitUntil() and writes the
//   result to Supabase (risk_cluster_cache). A request for the same mint
//   a minute or two later gets cluster_analysis: "complete" with real data.
// - honeypot_risk / lp_locked: not implemented in the engine yet, stay
//   null with an explanatory `note` field — schema won't change later.
// - Every request requires a valid API key (see lib/api-auth.ts). Keys
//   are minted via app/api/v1/admin/keys (temporary, until Stage 5's
//   public signup form).
// - free tier: 100 requests / calendar day (UTC). paid tier: unlimited
//   (tier is set by hand for now — see lib/rate-limit.ts). The counter
//   increments on every authenticated call, even ones that fail
//   validation afterward (bad mint, upstream error).
// - Every response (2xx/4xx/5xx) is logged via lib/request-logger.ts —
//   fire-and-forget, never blocks or fails the actual API response.
//
// Requires: `npm install @vercel/functions` (provides waitUntil() so the
// background cluster job and the request log write both keep running
// after the response is sent).

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { requireApiKey } from '@/lib/api-auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { logApiRequest } from '@/lib/request-logger';
import { fetchTokenRisk } from '@/lib/token-risk-core';

// Background job itself can take up to 60s (same budget as the existing
// cluster-check feature) — waitUntil() (inside lib/token-risk-core.ts)
// keeps the function alive for it.
export const maxDuration = 60;

// Reads the Authorization header and query params on every call — always
// dynamic. Declaring it explicitly (same pattern as app/page.js) avoids
// Next.js's build-time static-generation probe throwing its internal
// "dynamic server usage" signal into this route's own try/catch, which
// would otherwise get logged as if it were a real application error.
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  // Filled in as they become known — logged whatever we have, even on
  // the earliest failure paths (mint stays null if we never got that far).
  let mint: string | null = null;
  let keyId: string | null = null;

  // Fire-and-forget request logging, called at every return point below
  // instead of returning NextResponse.json(...) directly.
  function respond(
    response: NextResponse,
    extra: { safetyScore?: number | null; clusterAnalysis?: string | null; error?: string | null } = {},
  ): NextResponse {
    waitUntil(
      logApiRequest({
        keyId,
        mint,
        statusCode: response.status,
        safetyScore: extra.safetyScore ?? null,
        clusterAnalysis: extra.clusterAnalysis ?? null,
        responseTimeMs: Date.now() - startedAt,
        error: extra.error ?? null,
      }),
    );
    return response;
  }

  try {
    // 0. Auth first — before spending a single RPC call on an unpaid request.
    const auth = await requireApiKey(request, CORS_HEADERS);
    if (!auth.ok) {
      return respond(
        auth.response ??
          NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS }),
        { error: 'unauthorized' },
      );
    }
    if (!auth.key) {
      // Defensive — should be unreachable when auth.ok is true, but keeps
      // this branch type-safe without relying on cross-field narrowing.
      return respond(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS }),
        { error: 'unauthorized' },
      );
    }
    keyId = auth.key.id;

    // 0.5. Rate limit — counts against the key's daily quota before any
    // RPC work happens, whether or not the request turns out valid.
    const rateLimit = await enforceRateLimit(auth.key, CORS_HEADERS);
    if (!rateLimit.allowed) {
      return respond(
        rateLimit.response ??
          NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: CORS_HEADERS }),
        { error: 'rate_limited' },
      );
    }

    const rateLimitHeaders: Record<string, string> = { ...CORS_HEADERS, 'X-RateLimit-Reset': rateLimit.resetAt };
    if (rateLimit.limit !== null) {
      rateLimitHeaders['X-RateLimit-Limit'] = String(rateLimit.limit);
      rateLimitHeaders['X-RateLimit-Remaining'] = String(rateLimit.remaining ?? 0);
    }
    if (rateLimit.creditBalanceUsd !== null) {
      rateLimitHeaders['X-Credit-Balance-Usd'] = rateLimit.creditBalanceUsd.toFixed(4);
    }

    const { searchParams } = new URL(request.url);
    mint = searchParams.get('mint') || searchParams.get('ca');

    if (!mint) {
      return respond(
        NextResponse.json(
          { error: 'Missing required parameter: mint (or ca)' },
          { status: 400, headers: rateLimitHeaders },
        ),
        { error: 'missing_mint' },
      );
    }

    // 1-3. Validate the mint, fetch live data, run the API-specific
    // safety score — all delegated to lib/token-risk-core.ts so the
    // batch endpoint shares this exact logic.
    const result = await fetchTokenRisk(mint);

    if (!result.ok) {
      return respond(
        NextResponse.json(
          { error: result.error ?? 'Unknown error', ...(result.details ? { details: result.details } : {}) },
          { status: result.status ?? 502, headers: rateLimitHeaders },
        ),
        { error: result.error ?? 'unknown_error' },
      );
    }

    return respond(
      NextResponse.json(
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
        { headers: rateLimitHeaders },
      ),
      { safetyScore: result.safety_score, clusterAnalysis: result.cluster_analysis },
    );
  } catch (error: any) {
    console.error('[token-risk] API error:', error);
    return respond(
      NextResponse.json(
        { error: 'Internal error', details: error.message },
        { status: 500, headers: CORS_HEADERS },
      ),
      { error: error.message },
    );
  }
}
