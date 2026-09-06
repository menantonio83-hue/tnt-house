// Version 1.1 — lib/scoring.ts
//
// SINGLE SOURCE OF TRUTH for the TNT House safety score.
//
// Why this file exists: the same class of bug has now been caught twice.
// lib/token-risk-core.ts v1.3 found a token scoring 58 via the Risk-Data
// API that the site would have capped at 30, and fixed it by porting the
// caps "verbatim" into a second copy. That copy drifted, and in Sept 2026
// mint 5erj4fz4... scored 0 on the site, 30 via the API and ~70 via Quick
// Check — three engines, three numbers, one mint.
//
// Copying a formula does not keep it in sync. So the formula now lives in
// exactly one place and every surface imports it:
//   - lib/token-risk-core.ts  (Risk-Data API, B2B)
//   - lib/helius-client.js    (Quick Check)
//   - app/page.js             (site listing audit)
//
// The canonical formula is the API's, unchanged: it is cap-based rather
// than additive, which is the only correct shape for a risk score. An
// additive model lets green checkmarks offset a fatal red flag — that is
// how Quick Check gave 70/100 to a token whose top 10 holders held 95.2%.
// Caps cannot be out-scored: one critical factor bounds the ceiling no
// matter how clean everything else looks.
//
// This module is deliberately dependency-free (pure arithmetic, no fetch,
// no Supabase, no RPC) so app/page.js can import it client-side without
// pulling token-risk-core's server graph into the browser bundle.
//
// RULE, so we do not re-introduce double counting: a factor lives EITHER
// in the additive base OR in the caps, never both.
//   base  -> mint/freeze authority, holder risk level, liquidity, volume,
//            insider clusters
//   caps  -> concentration, age, wash trading, contract-level red flags,
//            confirmed rug

// ─── Holder risk classification ───
// Moved here from lib/helius-client.js unchanged. It lived there only for
// historical reasons; the site needs it too, because app/page.js has raw
// top10Percent / holderCount from RugCheck but no riskLevel of its own.
export type HolderRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'ERROR';

export function classifyHolderRisk(
  largestHolderPercent: number,
  top10Percent: number,
): HolderRiskLevel {
  if (largestHolderPercent > 20) return 'CRITICAL';
  if (largestHolderPercent > 15) return 'HIGH';
  if (top10Percent > 50) return 'MEDIUM';
  return 'LOW';
}

// Structural type only — we read nothing but the wallet count, so this
// module does not need to import lib/insider-cluster-detector.
export interface ScoringCluster {
  wallets: unknown[];
}

// ─── Additive base (max 100, before caps) ───
// Unchanged from token-risk-core.ts's computeApiSafetyScore.
export function computeSafetyScoreBase(
  mintAuthorityRevoked: boolean,
  freezeAuthorityRevoked: boolean,
  holderRisk: { riskLevel: string },
  dexData: { liquidity: number | null; volume24h: number | null },
  clusters: ScoringCluster[],
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
    dexData.liquidity && dexData.liquidity > 10000
      ? 15
      : dexData.liquidity && dexData.liquidity > 1000
        ? 8
        : 0;

  const volumeScore =
    dexData.volume24h && dexData.volume24h > 5000
      ? 15
      : dexData.volume24h && dexData.volume24h > 500
        ? 8
        : 0;

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

// ─── Wash-trading thresholds (v1.1, new) ───
// Volume far above liquidity is a manipulation signal, but a noisy one in
// isolation: thin Solana pools genuinely spin high turnover on real hype.
// So the ordinary 20x case only caps when it co-occurs with the other two
// markers of a fresh manufactured pump. An extreme ratio caps on its own.
//
// Previously this lived only as auditResult.washTradingRisk — a boolean
// driving a UI banner, affecting no score anywhere. That is exactly wrong
// for a product whose main consumer is a trading bot: a bot reads the
// number, not the banner.
const WASH_RATIO_COMBINED = 20;
const WASH_RATIO_EXTREME = 50;
const WASH_COMBINED_HOLDERS_LT = 100;
const WASH_COMBINED_AGE_DAYS_LT = 1;
const WASH_COMBINED_CAP = 30;
const WASH_EXTREME_CAP = 40;

function washRatio(liquidity: number | null, volume24h: number | null): number | null {
  if (liquidity === null || volume24h === null || liquidity <= 0) return null;
  return volume24h / liquidity;
}

export interface ScoreCapResult {
  score: number;
  maturityCapped: boolean;
  marketHealthCapped: boolean;
  ruggedCapped: boolean;
  contractRiskCapped: boolean;
  washTradingCapped: boolean;
  capsTriggered: Array<{ reason: string; cap: number }>;
  dominantCap: string | null;
}

export function applyScoreCaps(
  baseScore: number,
  dexData: { liquidity: number | null; ageDays: number | null; volume24h?: number | null },
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

  // dev_wallet_percent is a distinct concentration axis from top10Percent.
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

  // v1.1: wash-trading tier.
  const ratio = washRatio(dexData.liquidity, dexData.volume24h ?? null);
  const washCombined =
    ratio !== null &&
    ratio > WASH_RATIO_COMBINED &&
    holderRisk.holderCount < WASH_COMBINED_HOLDERS_LT &&
    dexData.ageDays !== null &&
    dexData.ageDays < WASH_COMBINED_AGE_DAYS_LT;
  const washExtreme = ratio !== null && ratio > WASH_RATIO_EXTREME;

  let washCap = 100;
  if (washCombined) washCap = Math.min(washCap, WASH_COMBINED_CAP);
  if (washExtreme) washCap = Math.min(washCap, WASH_EXTREME_CAP);
  const washTradingCapped = washCap < 100 && afterMarketHealth > washCap;
  const afterWash = Math.min(afterMarketHealth, washCap);

  // Structural / contract-level red flags, one severity notch below
  // confirmed-rugged.
  const { hiddenOwner, permanentDelegate, tokenProgram, buyTaxPercent, sellTaxPercent } =
    contractSignals;
  const taxPercent =
    buyTaxPercent !== null && sellTaxPercent !== null
      ? Math.max(buyTaxPercent, sellTaxPercent)
      : (buyTaxPercent ?? sellTaxPercent);

  let contractRiskCap = 100;
  if (permanentDelegate === true) contractRiskCap = Math.min(contractRiskCap, 10);
  if (hiddenOwner === true) contractRiskCap = Math.min(contractRiskCap, 30);
  if (taxPercent !== null && taxPercent > 10) contractRiskCap = Math.min(contractRiskCap, 30);
  if (tokenProgram === 'nonstandard') contractRiskCap = Math.min(contractRiskCap, 50);
  if (taxPercent !== null && taxPercent > 3) contractRiskCap = Math.min(contractRiskCap, 65);
  const contractRiskCapped = contractRiskCap < 100 && afterWash > contractRiskCap;
  const afterContractRisk = Math.min(afterWash, contractRiskCap);

  // RugCheck's OWN confirmed-rugged flag — their tracked ground truth, not
  // a heuristic of ours. No clean combination should override it.
  const RUGGED_CAP = 5;
  const ruggedCapped = rugged === true && afterContractRisk > RUGGED_CAP;
  const finalScore = rugged === true ? Math.min(afterContractRisk, RUGGED_CAP) : afterContractRisk;

  // Diagnostics: every condition that fired, plus the tightest one — so a
  // caller can see WHY a score is low without reverse-engineering tiers.
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
  if (washCombined)
    capsTriggered.push({ reason: 'wash_volume_gt_liq', cap: WASH_COMBINED_CAP });
  if (washExtreme)
    capsTriggered.push({ reason: 'wash_volume_extreme', cap: WASH_EXTREME_CAP });
  if (tokenProgram === 'nonstandard')
    capsTriggered.push({ reason: 'nonstandard_token_program', cap: 50 });
  if (holderRisk.top10Percent > 80) capsTriggered.push({ reason: 'top10_gt_80', cap: 50 });
  if (devWalletPercent !== null && devWalletPercent > 15)
    capsTriggered.push({ reason: 'dev_wallet_gt_15', cap: 50 });
  if (taxPercent !== null && taxPercent > 3) capsTriggered.push({ reason: 'moderate_tax', cap: 65 });
  if (holderRisk.holderCount < 20) capsTriggered.push({ reason: 'holders_lt_20', cap: 60 });
  if (devWalletPercent !== null && devWalletPercent > 5)
    capsTriggered.push({ reason: 'dev_wallet_gt_5', cap: 75 });
  if (dexData.ageDays !== null && dexData.ageDays < 1)
    capsTriggered.push({ reason: 'age_lt_1d', cap: 55 });
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
    washTradingCapped,
    capsTriggered,
    dominantCap,
  };
}

// Convenience wrapper: base + caps in one call, for callers that have all
// the inputs and just want the final number.
export function computeFullScore(
  inputs: {
    mintAuthorityRevoked: boolean;
    freezeAuthorityRevoked: boolean;
    holderRisk: { riskLevel: string; top10Percent: number; holderCount: number };
    dexData: { liquidity: number | null; volume24h: number | null; ageDays: number | null };
    clusters: ScoringCluster[];
    clusterAnalysis: 'complete' | 'pending';
    rugged: boolean | null;
    contractSignals: {
      hiddenOwner: boolean | null;
      permanentDelegate: boolean | null;
      tokenProgram: 'standard' | 'nonstandard' | null;
      buyTaxPercent: number | null;
      sellTaxPercent: number | null;
      devWalletPercent: number | null;
    };
  },
): ScoreCapResult {
  const base = computeSafetyScoreBase(
    inputs.mintAuthorityRevoked,
    inputs.freezeAuthorityRevoked,
    inputs.holderRisk,
    inputs.dexData,
    inputs.clusters,
    inputs.clusterAnalysis,
  );
  return applyScoreCaps(
    base,
    inputs.dexData,
    inputs.holderRisk,
    inputs.rugged,
    inputs.contractSignals,
  );
}
