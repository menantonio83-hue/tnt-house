// Version 1.3 — lib/token-risk-core.ts
//
// v1.3: ported maturityCap + marketHealthCap from app/page.js (the
// public TNT House site's scorer, v1.121/v1.124) into
// computeApiSafetyScore's output. Found via a real discrepancy: a
// pump.fun mint with top10Percent=96.4% (one wallet holding 94.9% of
// supply) scored 58 via the Risk-Data API but would have been CAPPED
// at 30 on the site — same token, two different scores depending on
// which product checked it, because this file's additive weighted-sum
// scorer had no cross-metric cap the way the site's does. Ported both
// caps verbatim (same thresholds, same "cap the lesser, don't stack
// penalties" reasoning as page.js's own comments explain) so a mint
// scores identically regardless of which product surface checked it.
// Exposed as maturity_capped / market_health_capped booleans in the
// response, mirroring the site's own auditResult.maturityCapped /
// marketHealthCapped fields, so an API caller can tell a cap fired
// rather than just seeing a lower number with no explanation.
//
// v1.2: honeypot_risk and lp_locked are now real values from RugCheck
// (lib/rugcheck-client.ts) instead of hardcoded null. See that file's
// header for the "why now, and why null still means something"
// reasoning. Response `note` only appears when RugCheck genuinely
// couldn't be checked for this mint, not unconditionally on every call.
//
// v1.1: fire-and-forget write to mint_risk_history (lib/mint-risk-
// history-store.ts) on every successful check, from both callers
// (single-mint and batch routes both go through fetchTokenRisk()).
// Same waitUntil() pattern already used just above for the background
// cluster job — never awaited, never allowed to affect this function's
// return value or either route's response.
//
// Version 1.0 — lib/token-risk-core.ts
//
// Extracted from app/api/v1/token-risk/route.ts (v1.10) so the new batch
// endpoint (app/api/v1/token-risk/batch/route.ts) can reuse the EXACT
// same per-mint logic instead of a second, divergence-prone copy of it.
// This is a pure refactor — no behavior change. The single-mint route
// was re-verified to produce byte-identical output before/after this
// extraction (see the isolated test run noted in the batch endpoint's
// commit message).
//
// Deliberately does NOT handle: auth, rate limiting, request logging, or
// building the final NextResponse — callers (both routes) own that,
// since batch needs different rate-limit/logging shapes (N mints per
// HTTP call instead of 1).

import { PublicKey } from '@solana/web3.js';
import { waitUntil } from '@vercel/functions';
import { getMintInfo, getDexScreenerData } from '@/lib/helius-client';
import { getHolderDistributionRobust } from '@/lib/holder-distribution';
import { sanitizeDexMarketData } from '@/lib/sanitize-market-data';
import { detectInsiderClusters, type InsiderCluster } from '@/lib/insider-cluster-detector';
import { getClusterCache, markClusterPending, saveClusterResult, markClusterFailed } from '@/lib/risk-api-cache';
import { withTimeout } from '@/lib/with-timeout';
import { upsertMintRiskHistory } from '@/lib/mint-risk-history-store';
import { getRugCheckRiskData, type RugCheckRiskData } from '@/lib/rugcheck-client';

// Same budgets as the single-mint route (app/api/v1/token-risk/route.ts) —
// see that file's header comment for the reasoning behind each value.
export const MINT_INFO_TIMEOUT_MS = 12000;
export const HOLDER_RISK_TIMEOUT_MS = 40000;
export const DEX_TIMEOUT_MS = 8000;
export const RUGCHECK_TIMEOUT_MS = 8000;

const RUGCHECK_FALLBACK: RugCheckRiskData = { honeypot_risk: null, lp_locked: null };

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

// Flat interface with nullable fields, NOT a discriminated union — same
// reason as RateLimitResult in lib/rate-limit.ts and ApiKeyRecord in
// lib/api-auth.ts: this repo's tsconfig has "strict": false, under which
// TS's narrowing on a boolean-literal discriminant (ok: true | ok: false
// as separate interfaces) is unreliable. `ok` is checked as a plain
// boolean; every other field is optional/nullable and populated
// depending on which path was taken.
export interface TokenRiskResult {
  ok: boolean;
  mint: string;
  status?: 400 | 502;
  error?: string;
  details?: string;
  safety_score?: number;
  // v1.3: true when a cap (see applyScoreCaps below) actually pulled
  // the score down below what the raw weighted sum would have been —
  // same semantics as app/page.js's auditResult.maturityCapped /
  // marketHealthCapped. false (not omitted) when no cap fired, so a
  // caller can distinguish "checked, no cap" from "field not present".
  maturity_capped?: boolean;
  market_health_capped?: boolean;
  cluster_analysis?: 'complete' | 'pending';
  insider_clusters?: InsiderCluster[];
  mint_authority?: { revoked: boolean; address: string | null };
  freeze_authority?: { revoked: boolean; address: string | null };
  // v1.10: real values from RugCheck (lib/rugcheck-client.ts), not the
  // hardcoded null this API launched with. null still means "couldn't
  // check" (RugCheck timeout/failure, or — for lp_locked only — no
  // market data reported for this mint), never a false-clean default.
  honeypot_risk?: boolean | null;
  lp_locked?: { locked: boolean; percent: number } | null;
  holder_distribution?: {
    risk_level: string;
    largest_holder_percent: number;
    top10_percent: number;
    holder_count: number;
  };
  market?: {
    price_usd: number | null;
    liquidity_usd: number | null;
    volume_24h_usd: number | null;
    price_change_24h_percent: number | null;
    age_days: number | null;
  };
  note?: string;
  checked_at?: string;
}

// Runs after the caller has already responded — same fire-and-forget
// background cluster job as the single-mint route, unchanged.
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
export function computeApiSafetyScore(
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

  let insiderScore: number;
  if (clusterAnalysis === 'pending') {
    insiderScore = 12;
  } else {
    const clusteredWallets = clusters.reduce((sum, c) => sum + c.wallets.length, 0);
    const penalty = clusters.length * 8 + clusteredWallets * 3;
    insiderScore = Math.max(0, 25 - penalty);
  }

  const total = foundation + holderScore + liquidityScore + volumeScore + insiderScore;
  return Math.min(100, Math.max(0, Math.round(total)));
}

// Ported from app/page.js's maturityCap (v1.121) + marketHealthCap
// (v1.124) — see this file's v1.3 header note for why. Deliberately
// the EXACT same thresholds and CAP (not subtract) reasoning as the
// site: a token that's both young AND thin-holder isn't double-
// punished, it just gets whichever single cap is lowest. Applied on
// top of computeApiSafetyScore's output, never inside it, same
// separation the site keeps between its base audit score and these
// caps.
export interface ScoreCapResult {
  score: number;
  maturityCapped: boolean;
  marketHealthCapped: boolean;
}

export function applyScoreCaps(
  baseScore: number,
  dexData: { liquidity: number | null; ageDays: number | null },
  holderRisk: { top10Percent: number; holderCount: number },
): ScoreCapResult {
  let maturityCap = 100;
  if (dexData.ageDays !== null && dexData.ageDays < 1) {
    maturityCap = 55;
  } else if (dexData.ageDays !== null && dexData.ageDays < 7 && holderRisk.holderCount < 50) {
    maturityCap = 65;
  } else if (dexData.ageDays !== null && dexData.ageDays < 7) {
    maturityCap = 75;
  }
  const maturityCapped = maturityCap < 100 && baseScore > maturityCap;
  const afterMaturity = Math.min(baseScore, maturityCap);

  let marketHealthCap = 100;
  if (dexData.liquidity !== null && dexData.liquidity < 500) {
    marketHealthCap = 25;
  } else if (holderRisk.top10Percent > 90) {
    marketHealthCap = Math.min(marketHealthCap, 30);
  } else if (holderRisk.top10Percent > 80) {
    marketHealthCap = Math.min(marketHealthCap, 50);
  } else if (holderRisk.holderCount < 20) {
    marketHealthCap = Math.min(marketHealthCap, 60);
  }
  const marketHealthCapped = marketHealthCap < 100 && afterMaturity > marketHealthCap;
  const finalScore = Math.min(afterMaturity, marketHealthCap);

  return { score: finalScore, maturityCapped, marketHealthCapped };
}

// Validates + fetches + scores a single mint. Never throws — every
// failure path (bad address, upstream fetch failure, unexpected
// exception) resolves to a TokenRiskFailure so a batch of N mints can
// run all N through Promise.allSettled-style handling without one bad
// mint aborting the others.
export async function fetchTokenRisk(mintRaw: string): Promise<TokenRiskResult> {
  const mint = mintRaw;

  try {
    // eslint-disable-next-line no-new
    new PublicKey(mint);
  } catch {
    return { ok: false, mint, status: 400, error: `Invalid mint address: ${mint}` };
  }

  try {
    const [mintInfo, holderRisk, rawDexData, rugCheckData] = await Promise.all([
      withTimeout(getMintInfo(mint), MINT_INFO_TIMEOUT_MS, null),
      withTimeout(getHolderDistributionRobust(mint), HOLDER_RISK_TIMEOUT_MS, HOLDER_RISK_FALLBACK),
      withTimeout(getDexScreenerData(mint), DEX_TIMEOUT_MS, DEX_DATA_FALLBACK),
      withTimeout(getRugCheckRiskData(mint), RUGCHECK_TIMEOUT_MS, RUGCHECK_FALLBACK),
    ]);

    const dexData = sanitizeDexMarketData(rawDexData);

    if (!mintInfo) {
      return {
        ok: false,
        mint,
        status: 502,
        error: 'Could not fetch mint account data',
        details:
          'Either this address is not a valid Solana mint, or the Solana RPC did not respond in time. Try again in a moment.',
      };
    }

    const mintAuthorityRevoked = mintInfo.info.mintAuthority === null;
    const freezeAuthorityRevoked = mintInfo.info.freezeAuthority === null;

    const { row, isFresh } = await getClusterCache(mint);

    let insiderClusters: InsiderCluster[] = [];
    let clusterAnalysis: 'complete' | 'pending' = 'pending';

    if (row && row.status === 'complete') {
      insiderClusters = row.clusters;
      clusterAnalysis = 'complete';
    }

    if (!row || !isFresh) {
      await markClusterPending(mint);
      // waitUntil() reads Vercel's request context via AsyncLocalStorage,
      // not a passed-in argument — safe to call from here directly rather
      // than threading it back out to each caller.
      waitUntil(runBackgroundClusterDetection(mint));
    }

    const rawSafetyScore = computeApiSafetyScore(
      mintAuthorityRevoked,
      freezeAuthorityRevoked,
      holderRisk,
      dexData,
      insiderClusters,
      clusterAnalysis,
    );

    const { score: safetyScore, maturityCapped, marketHealthCapped } = applyScoreCaps(
      rawSafetyScore,
      dexData,
      holderRisk,
    );

    // History write: fire-and-forget, never awaited, never allowed to
    // affect this response. Runs on every successful check regardless
    // of cluster_analysis being "pending" vs "complete" — a pending
    // insiderClusters=[] this call would otherwise record as
    // insider_cluster_count: 0 for this hour, which a later "complete"
    // call in the SAME hour will simply overwrite (last-write-wins,
    // matches the upsert's documented semantics).
    waitUntil(
      upsertMintRiskHistory({
        mint,
        safetyScore,
        insiderClusterCount: insiderClusters.length,
        holderCount: holderRisk.holderCount,
        top10Percent: holderRisk.top10Percent,
        priceUsd: dexData.price,
        liquidityUsd: dexData.liquidity,
        volume24hUsd: dexData.volume24h,
        priceChange24hPercent: dexData.priceChange24h,
      }),
    );

    return {
      ok: true,
      mint,
      safety_score: safetyScore,
      maturity_capped: maturityCapped,
      market_health_capped: marketHealthCapped,
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
      honeypot_risk: rugCheckData.honeypot_risk,
      lp_locked: rugCheckData.lp_locked,
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
        rugCheckData.honeypot_risk === null && rugCheckData.lp_locked === null
          ? 'honeypot_risk and lp_locked could not be checked for this mint (RugCheck timeout, or no market data reported) — both null rather than a false-clean default.'
          : undefined,
      checked_at: new Date().toISOString(),
    };
  } catch (error: any) {
    return { ok: false, mint, status: 502, error: 'Internal error', details: error.message };
  }
}
