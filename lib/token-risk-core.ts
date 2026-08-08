// Version 1.5 — lib/token-risk-core.ts
//
// v1.5: extends applyScoreCaps with a new contractRiskCap tier and
// folds three more site-only signals (dev wallet %, tax, token
// program) into the caps that already exist — following the exact
// cap-architecture consensus reached across three independent model
// reviews (Kimi, DeepSeek, Gemini) of the proposed thresholds. Every
// number below reflects the majority/strongest-argument pick where the
// three disagreed:
//
// New contractRiskCap tier (mirrors ruggedCap's "structural risk
// overrides everything" reasoning, one step less severe):
//   permanent_delegate === true  -> cap 10  (near-rug: can move/burn
//     ANY holder's tokens without permission — Token-2022 extension)
//   hidden_owner === true        -> cap 30  (2-of-3 models: control-
//     level risk, same severity tier as top10>90%)
//   token_program === 'nonstandard' -> cap 50 (unaudited code path)
//   tax(buy/sell) > 10%          -> cap 30  (2-of-3: honeypot-tier,
//     not just "friction" — legitimate Token-2022 fee tokens are
//     almost always well under 10%)
//   tax > 3%                     -> cap 65  (moderate friction)
//
// marketHealthCap gains a dev-wallet-% axis, independent of
// top10Percent because a deployer can hold a large stake while sitting
// outside any top-10 cutoff if it's split across wallets this
// codebase's insider-cluster-detector hasn't yet linked back to them:
//   dev_wallet_percent > 30 -> cap 30
//   dev_wallet_percent > 15 -> cap 50
//   dev_wallet_percent > 5  -> cap 75
//
// contract_renounced is NOT scored here — see rugcheck-client.ts v1.3
// header: it's mint_authority.revoked && freeze_authority.revoked,
// already fully counted in computeApiSafetyScore's foundation term.
//
// Response gains contract_risk_capped (new boolean, same "did this
// tier actually bind" semantics as the existing three) plus
// caps_triggered (every fired condition + its cap value) and
// dominant_cap (the single tightest one) so a caller can see WHY a
// score is low, not just that it is — same reasoning all three model
// reviews converged on independently.
//
// Version 1.4 — lib/token-risk-core.ts
//
// v1.4: exposes lib/rugcheck-client.ts v1.2's four new fields
// (deployer_address, rugged, jup_verified, insider_holder_count) — all
// free, from the SAME RugCheck call this file already makes. Also adds
// a third cap tier to applyScoreCaps: ruggedCap. If RugCheck has
// ITSELF already confirmed this mint rugged (data.rugged === true from
// their own tracking, not a heuristic), the score is capped at 5,
// full stop — no combination of clean mint/freeze/liquidity numbers
// should ever make an already-rugged token look investable. Same
// "cap, don't stack" reasoning as the other two caps: applied after
// maturityCap and marketHealthCap, whichever of the three caps is
// lowest wins.
//
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

const RUGCHECK_FALLBACK: RugCheckRiskData = {
  honeypot_risk: null,
  lp_locked: null,
  deployer_address: null,
  rugged: null,
  jup_verified: null,
  insider_holder_count: null,
  hidden_owner: null,
  permanent_delegate: null,
  buy_tax_percent: null,
  sell_tax_percent: null,
  dev_wallet_percent: null,
  token_program: null,
};

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
  // v1.4 — true only when RugCheck's own `rugged` flag (not a
  // heuristic, their tracked confirmation) fired and actually pulled
  // the score down. See applyScoreCaps below.
  rugged_capped?: boolean;
  // v1.5 — see header note above. true only when the new
  // permanent_delegate/hidden_owner/token_program/tax tier actually
  // pulled the score down.
  contract_risk_capped?: boolean;
  // v1.5 — every cap condition that fired this call, and the single
  // tightest one (the actual reason the score is what it is). Empty
  // array / null dominant_cap when no cap fired at all.
  caps_triggered?: Array<{ reason: string; cap: number }>;
  dominant_cap?: string | null;
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
  // v1.4 — from lib/rugcheck-client.ts v1.2, same RugCheck call as
  // honeypot_risk/lp_locked above, zero extra cost. null follows the
  // same "couldn't check" rule as the other two RugCheck-sourced
  // fields — never a false-clean/false-safe default.
  deployer_address?: string | null;
  rugged?: boolean | null;
  jup_verified?: boolean | null;
  insider_holder_count?: number | null;
  // v1.5 — from lib/rugcheck-client.ts v1.3, same RugCheck call, zero
  // extra cost. contract_renounced is purely derived (mint + freeze
  // both revoked) and carries no separate scoring weight — see that
  // file's header.
  hidden_owner?: boolean | null;
  permanent_delegate?: boolean | null;
  buy_tax_percent?: number | null;
  sell_tax_percent?: number | null;
  dev_wallet_percent?: number | null;
  token_program?: 'standard' | 'nonstandard' | null;
  contract_renounced?: boolean;
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
  ruggedCapped: boolean;
  contractRiskCapped: boolean;
  capsTriggered: Array<{ reason: string; cap: number }>;
  dominantCap: string | null;
}

export function applyScoreCaps(
  baseScore: number,
  dexData: { liquidity: number | null; ageDays: number | null },
  holderRisk: { top10Percent: number; holderCount: number },
  rugged: boolean | null,
  contractSignals: {
    hiddenOwner: boolean | null;
    permanentDelegate: boolean | null;
    tokenProgram: 'standard' | 'nonstandard' | null;
    buyTaxPercent: number | null;
    sellTaxPercent: number | null;
    devWalletPercent: number | null;
  },
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

  // v1.5: dev_wallet_percent is a distinct concentration axis from
  // top10Percent — see this file's v1.5 header note.
  const devWalletPercent = contractSignals.devWalletPercent;
  let marketHealthCap = 100;
  if (dexData.liquidity !== null && dexData.liquidity < 500) {
    marketHealthCap = 25;
  } else if (holderRisk.top10Percent > 90) {
    marketHealthCap = Math.min(marketHealthCap, 30);
  } else if (devWalletPercent !== null && devWalletPercent > 30) {
    marketHealthCap = Math.min(marketHealthCap, 30);
  } else if (holderRisk.top10Percent > 80) {
    marketHealthCap = Math.min(marketHealthCap, 50);
  } else if (devWalletPercent !== null && devWalletPercent > 15) {
    marketHealthCap = Math.min(marketHealthCap, 50);
  } else if (holderRisk.holderCount < 20) {
    marketHealthCap = Math.min(marketHealthCap, 60);
  } else if (devWalletPercent !== null && devWalletPercent > 5) {
    marketHealthCap = Math.min(marketHealthCap, 75);
  }
  const marketHealthCapped = marketHealthCap < 100 && afterMaturity > marketHealthCap;
  const afterMarketHealth = Math.min(afterMaturity, marketHealthCap);

  // v1.5: new contractRiskCap tier — structural/contract-level red
  // flags, one severity notch below confirmed-rugged. See this file's
  // v1.5 header for the exact numbers and the 3-model consensus behind
  // them.
  const { hiddenOwner, permanentDelegate, tokenProgram, buyTaxPercent, sellTaxPercent } = contractSignals;
  const taxPercent =
    buyTaxPercent !== null && sellTaxPercent !== null
      ? Math.max(buyTaxPercent, sellTaxPercent)
      : buyTaxPercent ?? sellTaxPercent;

  let contractRiskCap = 100;
  if (permanentDelegate === true) {
    contractRiskCap = Math.min(contractRiskCap, 10);
  }
  if (hiddenOwner === true) {
    contractRiskCap = Math.min(contractRiskCap, 30);
  }
  if (taxPercent !== null && taxPercent > 10) {
    contractRiskCap = Math.min(contractRiskCap, 30);
  }
  if (tokenProgram === 'nonstandard') {
    contractRiskCap = Math.min(contractRiskCap, 50);
  }
  if (taxPercent !== null && taxPercent > 3) {
    contractRiskCap = Math.min(contractRiskCap, 65);
  }
  const contractRiskCapped = contractRiskCap < 100 && afterMarketHealth > contractRiskCap;
  const afterContractRisk = Math.min(afterMarketHealth, contractRiskCap);

  // v1.4: RugCheck's OWN confirmed-rugged flag — not a heuristic on
  // our side, their tracked ground truth. No clean mint/freeze/
  // liquidity combination should override an already-confirmed rug.
  const RUGGED_CAP = 5;
  const ruggedCapped = rugged === true && afterContractRisk > RUGGED_CAP;
  const finalScore = rugged === true ? Math.min(afterContractRisk, RUGGED_CAP) : afterContractRisk;

  // Diagnostics: every condition that actually fired this call, plus
  // the single tightest (lowest-cap) one — lets a caller see WHY a
  // score is low without reverse-engineering the tier math themselves.
  const capsTriggered: Array<{ reason: string; cap: number }> = [];
  if (rugged === true) capsTriggered.push({ reason: 'rugged_confirmed', cap: RUGGED_CAP });
  if (permanentDelegate === true) capsTriggered.push({ reason: 'permanent_delegate', cap: 10 });
  if (hiddenOwner === true) capsTriggered.push({ reason: 'hidden_owner', cap: 30 });
  if (taxPercent !== null && taxPercent > 10) capsTriggered.push({ reason: 'high_tax', cap: 30 });
  if (dexData.liquidity !== null && dexData.liquidity < 500)
    capsTriggered.push({ reason: 'low_liquidity', cap: 25 });
  if (holderRisk.top10Percent > 90) capsTriggered.push({ reason: 'top10_gt_90', cap: 30 });
  if (devWalletPercent !== null && devWalletPercent > 30)
    capsTriggered.push({ reason: 'dev_wallet_gt_30', cap: 30 });
  if (tokenProgram === 'nonstandard') capsTriggered.push({ reason: 'nonstandard_token_program', cap: 50 });
  if (holderRisk.top10Percent > 80) capsTriggered.push({ reason: 'top10_gt_80', cap: 50 });
  if (devWalletPercent !== null && devWalletPercent > 15)
    capsTriggered.push({ reason: 'dev_wallet_gt_15', cap: 50 });
  if (taxPercent !== null && taxPercent > 3) capsTriggered.push({ reason: 'moderate_tax', cap: 65 });
  if (holderRisk.holderCount < 20) capsTriggered.push({ reason: 'holders_lt_20', cap: 60 });
  if (devWalletPercent !== null && devWalletPercent > 5)
    capsTriggered.push({ reason: 'dev_wallet_gt_5', cap: 75 });
  if (dexData.ageDays !== null && dexData.ageDays < 1) capsTriggered.push({ reason: 'age_lt_1d', cap: 55 });
  else if (dexData.ageDays !== null && dexData.ageDays < 7 && holderRisk.holderCount < 50)
    capsTriggered.push({ reason: 'age_lt_7d_thin_holders', cap: 65 });
  else if (dexData.ageDays !== null && dexData.ageDays < 7)
    capsTriggered.push({ reason: 'age_lt_7d', cap: 75 });

  const dominantCap =
    capsTriggered.length > 0
      ? capsTriggered.reduce((tightest, c) => (c.cap < tightest.cap ? c : tightest)).reason
      : null;

  return {
    score: finalScore,
    maturityCapped,
    marketHealthCapped,
    ruggedCapped,
    contractRiskCapped,
    capsTriggered,
    dominantCap,
  };
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

    const {
      score: safetyScore,
      maturityCapped,
      marketHealthCapped,
      ruggedCapped,
      contractRiskCapped,
      capsTriggered,
      dominantCap,
    } = applyScoreCaps(rawSafetyScore, dexData, holderRisk, rugCheckData.rugged, {
      hiddenOwner: rugCheckData.hidden_owner,
      permanentDelegate: rugCheckData.permanent_delegate,
      tokenProgram: rugCheckData.token_program,
      buyTaxPercent: rugCheckData.buy_tax_percent,
      sellTaxPercent: rugCheckData.sell_tax_percent,
      devWalletPercent: rugCheckData.dev_wallet_percent,
    });

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
      rugged_capped: ruggedCapped,
      contract_risk_capped: contractRiskCapped,
      caps_triggered: capsTriggered,
      dominant_cap: dominantCap,
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
      deployer_address: rugCheckData.deployer_address,
      rugged: rugCheckData.rugged,
      jup_verified: rugCheckData.jup_verified,
      insider_holder_count: rugCheckData.insider_holder_count,
      hidden_owner: rugCheckData.hidden_owner,
      permanent_delegate: rugCheckData.permanent_delegate,
      buy_tax_percent: rugCheckData.buy_tax_percent,
      sell_tax_percent: rugCheckData.sell_tax_percent,
      dev_wallet_percent: rugCheckData.dev_wallet_percent,
      token_program: rugCheckData.token_program,
      contract_renounced: mintAuthorityRevoked && freezeAuthorityRevoked,
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
