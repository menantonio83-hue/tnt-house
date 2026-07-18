// Version 1.8 — app/api/v1/token-risk/route.ts
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
import { PublicKey } from '@solana/web3.js';
import { waitUntil } from '@vercel/functions';
import { getMintInfo, getDexScreenerData } from '@/lib/helius-client';
import { getHolderDistributionRobust } from '@/lib/holder-distribution';
import { sanitizeDexMarketData } from '@/lib/sanitize-market-data';
import { detectInsiderClusters, type InsiderCluster } from '@/lib/insider-cluster-detector';
import {
  getClusterCache,
  markClusterPending,
  saveClusterResult,
  markClusterFailed,
} from '@/lib/risk-api-cache';
import { requireApiKey } from '@/lib/api-auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { logApiRequest } from '@/lib/request-logger';
import { withTimeout } from '@/lib/with-timeout';

// Background job itself can take up to 60s (same budget as the existing
// cluster-check feature) — waitUntil() keeps the function alive for it.
export const maxDuration = 60;

// Reads the Authorization header and query params on every call — always
// dynamic. Declaring it explicitly (same pattern as app/page.js) avoids
// Next.js's build-time static-generation probe throwing its internal
// "dynamic server usage" signal into this route's own try/catch, which
// would otherwise get logged as if it were a real application error.
export const dynamic = 'force-dynamic';

// Generous but bounded — well under the 60s function budget, plenty of
// headroom for a genuinely slow (not hung) public-RPC response.
// HOLDER_RISK gets the largest budget: checkHolderDistributionRisk does
// two sequential RPC round trips internally, and getHolderDistributionRobust
// can now retry that up to 3 times on an ambiguous zero-holder result.
const MINT_INFO_TIMEOUT_MS = 12000;
const HOLDER_RISK_TIMEOUT_MS = 25000;
const DEX_TIMEOUT_MS = 8000;

const HOLDER_RISK_FALLBACK = {
  riskLevel: 'ERROR',
  largestHolderPercent: 0,
  top10Percent: 0,
  holderCount: 0,
};

const DEX_DATA_FALLBACK = {
  price: null as number | null,
  liquidity: null as number | null,
  volume24h: null as number | null,
  priceChange24h: null as number | null,
  ageDays: null as number | null,
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Runs after the response has already been sent to the caller.
async function runBackgroundClusterDetection(mint: string): Promise<void> {
  try {
    const result = await detectInsiderClusters(mint);
    await saveClusterResult(mint, result.clusters, result.checkedHolders);
  } catch (e: any) {
    await markClusterFailed(mint, e.message || 'Unknown error during cluster detection');
  }
}

// API-specific safety score. Weights sum to 100:
// foundation 25 + holders 20 + liquidity 15 + volume 15 + insider 25
function computeApiSafetyScore(
  mintAuthorityRevoked: boolean,
  freezeAuthorityRevoked: boolean,
  holderRisk: { riskLevel: string },
  dexData: { liquidity: number | null; volume24h: number | null },
  clusters: InsiderCluster[],
  clusterAnalysis: 'complete' | 'pending',
): number {
  let foundation = 0;
  if (mintAuthorityRevoked) foundation += 15;
  if (freezeAuthorityRevoked) foundation += 10;

  let holderScore = 0;
  if (holderRisk.riskLevel === 'LOW') holderScore = 20;
  else if (holderRisk.riskLevel === 'MEDIUM') holderScore = 10;
  else if (holderRisk.riskLevel === 'HIGH') holderScore = 3;
  // CRITICAL / ERROR -> 0

  const liquidityScore =
    dexData.liquidity && dexData.liquidity > 10000 ? 15 : dexData.liquidity && dexData.liquidity > 1000 ? 8 : 0;

  const volumeScore =
    dexData.volume24h && dexData.volume24h > 5000 ? 15 : dexData.volume24h && dexData.volume24h > 500 ? 8 : 0;

  // Real insider penalty — the whole point of this API. Unlike the public
  // site (constant +10 regardless of clusters), this reflects what was
  // actually found on-chain.
  let insiderScore: number;
  if (clusterAnalysis === 'pending') {
    // Analysis not finished yet — neutral provisional value, not an
    // assumption of "clean". Caller should re-check once complete.
    insiderScore = 12;
  } else {
    const clusteredWallets = clusters.reduce((sum, c) => sum + c.wallets.length, 0);
    const penalty = clusters.length * 8 + clusteredWallets * 3;
    insiderScore = Math.max(0, 25 - penalty);
  }

  const total = foundation + holderScore + liquidityScore + volumeScore + insiderScore;
  return Math.min(100, Math.max(0, Math.round(total)));
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

    try {
      // eslint-disable-next-line no-new
      new PublicKey(mint);
    } catch {
      return respond(
        NextResponse.json({ error: `Invalid mint address: ${mint}` }, { status: 400, headers: rateLimitHeaders }),
        { error: 'invalid_mint' },
      );
    }

    // 1. Cheap, live data — fetched fresh on every call. Each call is
    // individually timeout-capped so a slow upstream (common for a
    // less-popular real token on the free public RPC) degrades this
    // response instead of hanging it — see lib/with-timeout.ts.
    // Holder distribution goes through a retry wrapper (see
    // lib/holder-distribution.ts) so a transient RPC failure doesn't
    // masquerade as "this token has zero holders".
    const [mintInfo, holderRisk, rawDexData] = await Promise.all([
      withTimeout(getMintInfo(mint), MINT_INFO_TIMEOUT_MS, null),
      withTimeout(getHolderDistributionRobust(mint), HOLDER_RISK_TIMEOUT_MS, HOLDER_RISK_FALLBACK),
      withTimeout(getDexScreenerData(mint), DEX_TIMEOUT_MS, DEX_DATA_FALLBACK),
    ]);

    // Defensive layer on our own output — nulls out implausible values
    // (e.g. a 456420% 24h price change) instead of relaying them as-is.
    const dexData = sanitizeDexMarketData(rawDexData);

    if (!mintInfo) {
      return respond(
        NextResponse.json(
          {
            error: 'Could not fetch mint account data',
            details:
              'Either this address is not a valid Solana mint, or the Solana RPC did not respond in time. Try again in a moment.',
          },
          { status: 502, headers: rateLimitHeaders },
        ),
        { error: 'mint_fetch_failed' },
      );
    }

    const mintAuthorityRevoked = mintInfo.info.mintAuthority === null;
    const freezeAuthorityRevoked = mintInfo.info.freezeAuthority === null;

    // 2. Cluster data — cache-first, background-refresh-on-miss.
    const { row, isFresh } = await getClusterCache(mint);

    let insiderClusters: InsiderCluster[] = [];
    let clusterAnalysis: 'complete' | 'pending' = 'pending';

    if (row && row.status === 'complete') {
      insiderClusters = row.clusters;
      clusterAnalysis = 'complete';
    }

    if (!row || !isFresh) {
      await markClusterPending(mint);
      waitUntil(runBackgroundClusterDetection(mint));
    }

    // 3. API-specific safety score.
    const safetyScore = computeApiSafetyScore(
      mintAuthorityRevoked,
      freezeAuthorityRevoked,
      holderRisk,
      dexData,
      insiderClusters,
      clusterAnalysis,
    );

    return respond(
      NextResponse.json(
        {
          mint,
          safety_score: safetyScore,
          cluster_analysis: clusterAnalysis,
          insider_clusters: insiderClusters,
          mint_authority: {
            revoked: mintAuthorityRevoked,
            address: mintAuthorityRevoked ? null : mintInfo.info.mintAuthority,
          },
          freeze_authority: {
            revoked: freezeAuthorityRevoked,
            address: freezeAuthorityRevoked ? null : mintInfo.info.freezeAuthority,
          },
          honeypot_risk: null,
          lp_locked: null,
          holder_distribution: {
            risk_level: holderRisk.riskLevel,
            largest_holder_percent: holderRisk.largestHolderPercent,
            top10_percent: holderRisk.top10Percent,
            holder_count: holderRisk.holderCount,
          },
          market: {
            price_usd: dexData.price,
            liquidity_usd: dexData.liquidity,
            volume_24h_usd: dexData.volume24h,
            price_change_24h_percent: dexData.priceChange24h,
            age_days: dexData.ageDays,
          },
          note:
            'honeypot_risk and lp_locked detection are on the roadmap and not yet implemented — both fields will remain null until shipped.',
          checked_at: new Date().toISOString(),
        },
        { headers: rateLimitHeaders },
      ),
      { safetyScore, clusterAnalysis },
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
