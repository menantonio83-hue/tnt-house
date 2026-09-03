// Version 1.14 — app/api/v1/token-risk/route.ts
//
// v1.14: one hardcoded, publicly-announced demo API key — a time-boxed
// growth experiment, NOT a new permanent tier (existing 3/day site
// trial, 15/day personal key, and x402 are all unchanged). Full design
// rationale lives in lib/demo-public-key-limit.ts's header: 300 calls
// total for the key's whole lifetime (never resets — dies permanently
// once spent), a 5-call-per-identity (IP+UA) cap so one caller can't
// claim a big slice of the shared pool, and a global 1-request/3s pace
// lock so a single fast script can't burn the entire budget before
// anyone else gets a chance. Checked FIRST in this route, before
// requireApiKey() — deliberately never touches the api_keys table, so
// it has no path to batch/history/billing/webhooks/admin routes at
// all (those don't check for it; an unrecognized token there just
// fails normal auth). Every response (success and every exhaustion
// reason) carries the same two channels: a human-readable `demo` JSON
// field and X-RiskApi-Demo-* / X-RiskApi-Upgrade-Url / X-RiskApi-X402-Url
// headers for strict-schema bot/agent callers that only read headers.
//
// Version 1.13 — app/api/v1/token-risk/route.ts
//
// v1.13: rewrites the demo-exhausted 401 body. The old copy ("Demo
// limit reached... Get a free API key with a real 15/day quota") read
// like a bouncer kicking someone out, and "real 15/day quota" implied
// the demo response was somehow fake/limited — it isn't: the demo path
// (see v1.12 below) already returns the FULL result object, including
// insider_clusters and honeypot_risk, identical to an authenticated
// call. The only real difference is call volume (3/day vs 15/day) and
// whether the quota is shared with every other anonymous visitor
// (100/day global pool) or exclusively yours. The new body sells that
// actual difference instead of a vague "get a key" — and never claims
// the demo data itself is limited, since it isn't. Two distinct
// messages (per-IP vs. global cap) kept, since the fix in each case is
// different (get a key vs. wait for UTC midnight or get a key anyway).
// No change to limits themselves (still 3/day per IP, 100/day global,
// 15/day with a free key) — copy only.
//
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
import { consumeDemoPublicKey, DEMO_TOTAL_LIMIT } from '@/lib/demo-public-key-limit';

// v1.14: one hardcoded, publicly-announced demo API key — a time-boxed
// growth experiment (Бро + multi-AI consensus, 2026-09-03), NOT a new
// permanent tier. See lib/demo-public-key-limit.ts's header for the
// full design. Read from env so the actual secret value never lives in
// source control — set DEMO_PUBLIC_KEY in Vercel, then that exact
// string is what gets published/announced publicly.
const DEMO_PUBLIC_KEY = process.env.DEMO_PUBLIC_KEY;

// The one real api_keys row created for this experiment (owner_label
// 'PUBLIC_DEMO_EXPERIMENT_2026-09') — exists ONLY so api_request_log
// rows for demo-public-key calls have real FK-valid attribution for
// analytics. Never looked up by hash, never touches requireApiKey() or
// enforceRateLimit() — this key's actual access control is entirely
// lib/demo-public-key-limit.ts's own Redis-backed logic above.
const DEMO_PUBLIC_KEY_ID = '4ac70156-e443-4533-a4db-a14a913b3150';

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

// Folded into the demo-public-key identity bucket alongside IP — see
// lib/demo-public-key-limit.ts header for why (spreads the shared 300
// across many distinct tries instead of one caller claiming a slice).
function extractUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') ?? 'unknown';
}

// v1.14: shared by every demo-public-key response — success AND every
// exhaustion reason all carry the same two channels, per explicit
// product decision: a human reading the JSON body sees `demo.message`,
// a bot/agent that only reads headers (never the ad-hoc JSON field —
// see lib/demo-public-key-limit.ts's design note on why headers matter
// for strict-schema callers) sees the same info in
// X-RiskApi-Demo-Remaining etc. Both present on every single call, not
// just the final exhausted one.
function demoPublicHeaders(remaining: number): Record<string, string> {
  return {
    'X-RiskApi-Demo-Remaining': String(remaining),
    'X-RiskApi-Demo-Total': String(DEMO_TOTAL_LIMIT),
    'X-RiskApi-Upgrade-Url': 'https://tnt-audit.com/api/demo-cta?to=risk-api',
    'X-RiskApi-X402-Url': 'https://tnt-audit.com/api/v1/token-risk/x402',
  };
}

function demoPublicField(remaining: number) {
  return {
    is_demo_key: true,
    calls_remaining: remaining,
    calls_total: DEMO_TOTAL_LIMIT,
    message: `Public demo key — ${remaining}/${DEMO_TOTAL_LIMIT} left, shared by everyone. Like it? Get your own free key (15/day, no card): https://tnt-audit.com/api/demo-cta?to=risk-api`,
    get_your_own_key: 'https://tnt-audit.com/api/demo-cta?to=risk-api',
    x402: { endpoint: '/api/v1/token-risk/x402', price_usd: 0.02, docs: 'https://tnt-audit.com/api/demo-cta?to=x402-docs' },
  };
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
    // v1.14: demo-public-key check FIRST, before requireApiKey() even
    // runs — this key deliberately never touches the api_keys table at
    // all, so there is zero risk of it accidentally working against
    // batch/history/billing/webhooks/admin routes (those never import
    // or check for it — an unrecognized Bearer token there just fails
    // their normal requireApiKey() call like any other invalid key,
    // which is the desired lockout). Only wired into this one
    // single-mint endpoint, on purpose.
    const rawAuthHeader = request.headers.get('authorization') || '';
    const bearerMatch = rawAuthHeader.match(/^Bearer\s+(.+)$/i);
    const rawBearerToken = bearerMatch ? bearerMatch[1].trim() : null;

    if (DEMO_PUBLIC_KEY && rawBearerToken === DEMO_PUBLIC_KEY) {
      // v1.14 analytics: tag every logged row in this branch (success
      // AND every rejection reason — paced/exhausted/error alike) with
      // the one real api_keys row created for this experiment
      // (owner_label 'PUBLIC_DEMO_EXPERIMENT_2026-09'). Never used for
      // auth or rate-limiting (this branch never calls requireApiKey()
      // or enforceRateLimit() — see lib/demo-public-key-limit.ts for
      // the actual enforcement), purely so the existing
      // api_request_log table gives a complete, zero-new-schema
      // post-mortem: total attempts, success/paced/exhausted counts,
      // every mint tried, timestamps, response times — just
      // `select * from api_request_log where key_id = '<this id>'`.
      keyId = DEMO_PUBLIC_KEY_ID;

      const { searchParams: demoParams } = new URL(request.url);
      mint = demoParams.get('mint') || demoParams.get('ca');

      if (!mint) {
        return respond(
          NextResponse.json(
            {
              error: 'Missing required parameter: mint (or ca)',
              example: 'GET /api/v1/token-risk?mint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            },
            { status: 400, headers: CORS_HEADERS },
          ),
          { error: 'missing_mint' },
        );
      }

      const decision = await consumeDemoPublicKey(extractClientIp(request), extractUserAgent(request));

      if (!decision.allowed) {
        if (decision.reason === 'paced') {
          return respond(
            NextResponse.json(
              {
                error: 'Public demo key is busy right now (max 1 request every 3s, shared by everyone) — wait a moment and retry.',
              },
              { status: 429, headers: { ...CORS_HEADERS, ...demoPublicHeaders(decision.globalRemaining) } },
            ),
            { error: 'demo_public_paced' },
          );
        }
        if (decision.reason === 'identity_exhausted') {
          return respond(
            NextResponse.json(
              {
                error:
                  "You've used your 5 free demo calls from this browser/IP. The public demo key is shared — get your own free key for a guaranteed 15/day quota, or use x402 pay-per-call (no key needed).",
                demo: demoPublicField(decision.globalRemaining),
              },
              { status: 402, headers: { ...CORS_HEADERS, ...demoPublicHeaders(decision.globalRemaining) } },
            ),
            { error: 'demo_public_identity_exhausted' },
          );
        }
        if (decision.reason === 'global_exhausted') {
          return respond(
            NextResponse.json(
              {
                error: `💀 Public demo is dead — all ${DEMO_TOTAL_LIMIT} calls used. It's not coming back. Get your own free key (15/day, no card): https://tnt-audit.com/risk-api`,
                demo: demoPublicField(0),
              },
              { status: 402, headers: { ...CORS_HEADERS, ...demoPublicHeaders(0) } },
            ),
            { error: 'demo_public_global_exhausted' },
          );
        }
        // infra_error — fail closed, same reasoning as the limiter's own file header.
        return respond(
          NextResponse.json(
            { error: 'Demo key temporarily unavailable, try again shortly.' },
            { status: 503, headers: CORS_HEADERS },
          ),
          { error: 'demo_public_infra_error' },
        );
      }

      const demoResult = await fetchTokenRisk(mint);
      const demoHeaders = { ...CORS_HEADERS, ...demoPublicHeaders(decision.globalRemaining) };

      if (!demoResult.ok) {
        return respond(
          NextResponse.json(
            { error: demoResult.error ?? 'Unknown error', ...(demoResult.details ? { details: demoResult.details } : {}) },
            { status: demoResult.status ?? 502, headers: demoHeaders },
          ),
          { error: demoResult.error ?? 'unknown_error' },
        );
      }

      return respond(
        NextResponse.json(
          {
            mint: demoResult.mint,
            safety_score: demoResult.safety_score,
            maturity_capped: demoResult.maturity_capped,
            market_health_capped: demoResult.market_health_capped,
            contract_risk_capped: demoResult.contract_risk_capped,
            rugged_capped: demoResult.rugged_capped,
            caps_triggered: demoResult.caps_triggered,
            dominant_cap: demoResult.dominant_cap,
            cluster_analysis: demoResult.cluster_analysis,
            insider_clusters: demoResult.insider_clusters,
            insider_holder_count: demoResult.insider_holder_count,
            mint_authority: demoResult.mint_authority,
            freeze_authority: demoResult.freeze_authority,
            contract_renounced: demoResult.contract_renounced,
            honeypot_risk: demoResult.honeypot_risk,
            lp_locked: demoResult.lp_locked,
            rugged: demoResult.rugged,
            jup_verified: demoResult.jup_verified,
            deployer_address: demoResult.deployer_address,
            hidden_owner: demoResult.hidden_owner,
            permanent_delegate: demoResult.permanent_delegate,
            buy_tax_percent: demoResult.buy_tax_percent,
            sell_tax_percent: demoResult.sell_tax_percent,
            dev_wallet_percent: demoResult.dev_wallet_percent,
            token_program: demoResult.token_program,
            vesting_locks: demoResult.vesting_locks,
            holder_distribution: demoResult.holder_distribution,
            market: demoResult.market,
            note: demoResult.note,
            checked_at: demoResult.checked_at,
            demo: demoPublicField(decision.globalRemaining),
          },
          { headers: demoHeaders },
        ),
        { safetyScore: demoResult.safety_score, clusterAnalysis: demoResult.cluster_analysis },
      );
    }

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
        // v1.13: honest, value-forward copy — see version note above.
        // Sells volume + a guaranteed (non-shared) quota, since that's
        // the actual difference a free key buys. Never implies the demo
        // JSON itself was incomplete (it wasn't).
        const body =
          demo.reason === 'global'
            ? {
                error: `Anonymous demo calls hit today's site-wide cap (${demo.limit}/day across all visitors) 🫡`,
                next: "Try again after UTC midnight — or grab a free key now for a quota that's yours alone, not shared with every other visitor.",
                url: 'https://tnt-audit.com/risk-api',
                agents_note: 'Building a bot? x402 pay-per-call skips the key entirely — $0.02/call, no signup.',
              }
            : {
                error: `You've burned through your ${demo.limit} free checks today 🫡`,
                next: 'Free key = 5x more (15/day), and it\'s your own guaranteed quota — not shared with other visitors.',
                url: 'https://tnt-audit.com/risk-api',
                agents_note: 'Building a bot? x402 pay-per-call skips the key entirely — $0.02/call, no signup.',
              };
        return respond(
          NextResponse.json(body, { status: 401, headers: CORS_HEADERS }),
          { error: 'demo_limit_exceeded' },
        );
      }
    }

    const { searchParams } = new URL(request.url);
    mint = searchParams.get('mint') || searchParams.get('ca');

    if (!mint) {
      return respond(
        NextResponse.json(
          {
            error: 'Missing required parameter: mint (or ca)',
            example: 'GET /api/v1/token-risk?mint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          },
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
