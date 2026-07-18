// Version 1.6 — app/api/v1/token-risk/route.ts
//
// Risk-Data API — Stage 4 adds per-request logging on top of Stage 1
// (route + scoring), Stage 2 (API-key auth) and Stage 3 (rate limits).
// Every response — success or error — is logged fire-and-forget via
// lib/request-logger.ts, feeding both billing (app/api/v1/admin/usage)
// and analytics (top mints, error rates, latency).
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
import { getMintInfo, checkHolderDistributionRisk, getDexScreenerData } from '@/lib/helius-client';
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

// Background job itself can take up to 60s (same budget as the existing
// cluster-check feature) — waitUntil() keeps the function alive for it.
export const maxDuration = 60;

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

    // 1. Cheap, live data — fetched fresh on every call.
    const [mintInfo, holderRisk, dexData] = await Promise.all([
      getMintInfo(mint),
      checkHolderDistributionRisk(mint),
      getDexScreenerData(mint),
    ]);

    if (!mintInfo) {
      return respond(
        NextResponse.json(
          { error: 'Could not fetch mint account data — check the address or try again' },
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
