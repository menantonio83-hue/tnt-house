// Version 1.12 — app/api/v1/token-risk/route.ts
//
// v1.12: adds a zero-key anonymous demo path, mirroring app/api/mcp/
// route.ts v1.2/v1.3 exactly. Context: Supabase logs showed a steady
// trickle of GET requests to this endpoint with NO Authorization
// header at all (status 401, error "unauthorized") — people finding
// the API via RapidAPI/Postman/raw curl (not through an MCP client)
// hit a hard wall on their very first try and never came back, while
// the MCP endpoint's check_token_risk tool already had a working
// no-key demo allowance. This closes that gap for the REST path too.
//
// Fix: if requireApiKey() fails for ANY reason (missing header,
// malformed key, invalid/revoked key), don't return 401 immediately —
// fall through to checkDemoLimit() (lib/demo-limit.ts, same Redis
// counters the MCP demo path already uses: 3/day per IP, 100/day
// global across BOTH channels combined). If the demo allowance is
// available, serve the real result with keyId: null, same as an
// authenticated call minus the X-RateLimit-* / X-Credit-Balance-Usd
// headers (those only make sense for a real key's quota). If the demo
// allowance is exhausted, return the same explanatory upsell message
// the MCP path uses instead of a bare "Unauthorized".
//
// Deliberately reuses the SAME Redis counters as the MCP demo path
// (not a separate REST-only pool) — the global 100/day cap exists to
// bound total unauthenticated upstream cost (Helius/DexScreener calls
// via fetchTokenRisk) for the whole service, and that cost is the same
// regardless of which channel the anonymous caller came in through.
//
// This is NOT the same as the website's fingerprint-based free trial
// (anon_trials table, app/page.js) — that's a separate mechanism for
// tnt-audit.com's own UI. This is the demo tier for people calling the
// API directly. Also NOT the same as the real 15/day free tier that
// comes with a signed-up API key (lib/rate-limit.ts FREE_DAILY_LIMIT)
// — every demo response upsells getting a real key for that.
//
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
// Header: Authorization: Bearer <api_key>   (optional — see v1.12 above;
// omitting it, or sending an invalid one, now gets a limited demo
// response instead of a bare 401)
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
// - A real API key gets the full authenticated behavior (see
//   lib/api-auth.ts). Keys are minted via app/api/v1/admin/keys
//   (temporary, until Stage 5's public signup form). No key at all, or
//   an invalid one, gets the v1.12 limited demo path instead of a flat
//   rejection.
// - free tier (with a real key): 15 requests / calendar day, shared
//   100/day pool across all free keys. paid tier: unlimited (tier is
//   set by hand for now — see lib/rate-limit.ts). The counter increments
//   on every authenticated call, even ones that fail validation
//   afterward (bad mint, upstream error).
// - demo tier (no key, v1.12): 3 requests/day per IP, 100/day global —
//   see lib/demo-limit.ts. Shared Redis counters with the MCP demo path.
// - Every response (2xx/4xx/5xx) is logged via lib/request-logger.ts —
//   fire-and-forget, never blocks or fails the actual API response.
//   Demo responses log with keyId: null, same as before.
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
import { checkDemoLimit } from '@/lib/demo-limit';

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

// Best-effort client IP for the anonymous demo limiter ONLY — never used
// for auth or billing of a real key. Identical to the helper in
// app/api/mcp/route.ts; kept as a literal duplicate rather than a shared
// lib import, same reasoning as that file's MAX_BATCH_SIZE note — this
// is a two-line, route-local concern, not worth a shared module.
function extractClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}

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

    // Response headers built up differently depending on which path we
    // end up on below — real key gets rate-limit/credit headers, demo
    // gets none (there's no quota to report), so this starts as just
    // CORS and gets extended only in the authenticated branch.
    let responseHeaders: Record<string, string> = { ...CORS_HEADERS };
    let isDemoCall = false;

    if (auth.ok && auth.key) {
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

      responseHeaders = { ...CORS_HEADERS, 'X-RateLimit-Reset': rateLimit.resetAt };
      if (rateLimit.limit !== null) {
        responseHeaders['X-RateLimit-Limit'] = String(rateLimit.limit);
        responseHeaders['X-RateLimit-Remaining'] = String(rateLimit.remaining ?? 0);
      }
      if (rateLimit.creditBalanceUsd !== null) {
        responseHeaders['X-Credit-Balance-Usd'] = rateLimit.creditBalanceUsd.toFixed(4);
      }
    } else {
      // v1.12: no valid key — try the small anonymous demo allowance
      // instead of an immediate Unauthorized, mirroring app/api/mcp/
      // route.ts's check_token_risk demo carve-out exactly.
      isDemoCall = true;
      const clientIp = extractClientIp(request);
      const demo = await checkDemoLimit(clientIp);
      if (!demo.allowed) {
        const message =
          demo.reason === 'global'
            ? `Anonymous demo calls are at today's site-wide cap (${demo.limit}/day across all visitors) — try again after UTC midnight, or get a free API key for guaranteed access at https://tnt-audit.com/risk-api`
            : `Demo limit reached (${demo.limit} free calls/day without a key). Get a free API key with a real 15/day quota at https://tnt-audit.com/risk-api`;
        return respond(
          NextResponse.json({ error: message }, { status: 401, headers: CORS_HEADERS }),
          { error: 'demo_limit_exceeded' },
        );
      }
    }

    const { searchParams } = new URL(request.url);
    mint = searchParams.get('mint') || searchParams.get('ca');

    if (!mint) {
      return respond(
        NextResponse.json(
          { error: 'Missing required parameter: mint (or ca)' },
          { status: 400, headers: responseHeaders },
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
          { status: result.status ?? 502, headers: responseHeaders },
        ),
        { error: result.error ?? 'unknown_error' },
      );
    }

    return respond(
      NextResponse.json(
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
          ...(isDemoCall
            ? {
                _demo: {
                  note: 'This is a free anonymous demo response (limited per day). Get a free API key with a full 15/day quota at https://tnt-audit.com/risk-api',
                },
              }
            : {}),
        },
        { headers: responseHeaders },
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
