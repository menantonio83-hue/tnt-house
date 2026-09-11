// Version 1.3 — lib/scoring.ts
//
// v1.3 (2026-09-12, agreed with product owner): four new caps plus
// cap-relief, all through the existing cap chain — the base weights are
// deliberately UNCHANGED (this formula is reused by token-risk-core.ts,
// helius-client.js and app/page.js, and rebalancing the base risks
// silently shifting scores in one of them).
//
// New caps (all confirmed-fact based, same philosophy as rugged):
//   honeypot_confirmed     -> 5   (RugCheck honeypot risk, same severity
//                                  tier as their confirmed-rugged flag)
//   mint_authority_active  -> 20  (COMBO: active mint AND effectively
//                                  unlocked LP — locked < 50% with
//                                  liquidity > $10k. Stables keep their
//                                  mint by design and RugCheck has no
//                                  market data for them, so this cannot
//                                  fire on them; "active mint + unlocked
//                                  real liquidity" is the print-and-dump
//                                  configuration this cap targets.)
//   freeze_authority_active-> 30  (active freeze = funds can be frozen;
//                                  standalone on purpose — freeze cannot
//                                  mint new supply, so it is less severe
//                                  than mint and safe to keep as its own
//                                  cap even for honest stables)
//   lp_unlocked_thin       -> 40  (liquidity > $10k but < 50% of LP
//                                  locked: exit-liquidity exposure)
//
// Cap-relief (provable on-chain mitigations loosen specific floors,
// never the base):
//   LP burned 100%  -> low_liquidity floor 25 -> 45
//   LP locked >=80% -> holders_lt_20 floor 60 -> 75
//   (the 6-month lock-duration requirement from the proposal is deferred:
//    RugCheck's API exposes locked % but not lock duration — documented,
//    not silently dropped.)
//
// Threshold change: dev_wallet_percent > 5 floor 75 -> 80 (a 6% team
// wallet is common practice, not a death sentence).
//
// Version 1.2 — lib/scoring.ts
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
  largestHolderPercent: number | null,
  top10Percent: number | null,
): HolderRiskLevel {
  // A missing largest-holder figure USED TO arrive here already coerced to 0
  // by the caller, which silently made the two most severe levels
  // unreachable: CRITICAL keys off > 20 and HIGH off > 15, and zero clears
  // neither. A token whose single top wallet held 75% came out as MEDIUM at
  // worst, or LOW if top10 also happened to be missing.
  //
  // Absent input is now reported as ERROR — "we could not classify this" —
  // rather than being answered with the most favourable level. Every caller
  // already refuses to score an ERROR reading (lib/holder-data-guard.ts).
  //
  // Note that 0 remains a valid MEASUREMENT and is handled normally: passing
  // null is how a caller says it has no reading at all. scripts/rescore-v2.ts
  // deliberately passes a literal 0 because the column it rescores from never
  // stored the largest-holder figure, and its own comment explains why that
  // can only under-state concentration; that behaviour is unchanged.
  if (!Number.isFinite(largestHolderPercent as number)) return 'ERROR';
  if (!Number.isFinite(top10Percent as number)) return 'ERROR';

  if ((largestHolderPercent as number) > 20) return 'CRITICAL';
  if ((largestHolderPercent as number) > 15) return 'HIGH';
  if ((top10Percent as number) > 50) return 'MEDIUM';
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

  // CRITICAL and ERROR used to share one unwritten `else` and both came out
  // as 0. They are not the same thing, and collapsing them is what let a
  // failed read pass for a verdict:
  //
  //   CRITICAL - we looked, and concentration is dangerous. 0 is the score.
  //   ERROR    - we could not look. There is no score to give.
  //
  // A number cannot express "unknown", so ERROR must not reach this function
  // at all. Every surface refuses first (lib/holder-data-guard.ts), which
  // makes reaching this line a broken invariant rather than a bad token —
  // hence a throw. It is deliberately loud: the whole class of bug being
  // fixed here came from unknowns quietly taking on a numeric value.
  if (holderRisk.riskLevel === 'ERROR') {
    throw new Error(
      'computeSafetyScoreBase received a holder reading of ERROR. An unreadable ' +
        'holder distribution has no score; the caller must refuse before scoring. ' +
        'See lib/holder-data-guard.ts.',
    );
  }

  let holderScore = 0;
  if (holderRisk.riskLevel === 'LOW') holderScore = 20;
  else if (holderRisk.riskLevel === 'MEDIUM') holderScore = 10;
  else if (holderRisk.riskLevel === 'HIGH') holderScore = 3;
  // CRITICAL -> 0, deliberately: a measured verdict of maximum concentration.

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
  retroCapped: boolean;
  // v1.3 — new cap tiers, same "did this tier actually pull the score
  // down" semantics as the flags above.
  lpRiskCapped: boolean;
  mintAuthorityCapped: boolean;
  freezeAuthorityCapped: boolean;
  honeypotCapped: boolean;
  // v1.3 — cap-relief diagnostics: which mitigation loosened which
  // floor, so a caller can see WHY a floor was raised, not just that
  // the score is higher than the raw thresholds would allow.
  reliefsTriggered: Array<{ reason: string; from: number; to: number }>;
  capsTriggered: Array<{ reason: string; cap: number }>;
  dominantCap: string | null;
}

// v1.2: ceiling for scores produced without the two deepest checks —
// insider-cluster tracing and RugCheck's confirmed-rugged flag. Both are
// absent in the retroactive rescore (scripts/rescore-v2.ts), which works
// from stored facts only. That matters asymmetrically: 'pending' cluster
// analysis contributes +12 to the base, and a null rugged flag means the
// rugged_confirmed cap (5) can never fire — so a row can land in the green
// >=75 band on the strength of checks that were never run. Users download a
// green badge from that number. Retroactively LOWERING a score is merely
// unpleasant; retroactively promoting an unverified token to green is
// harmful, so the two are not symmetric and the ceiling only applies here.
// 74 = top of the amber band. Clears itself on the next live audit.
const RETRO_UNVERIFIED_CAP = 74;

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
    // v1.3 — new cap inputs. All optional and null-means-unchecked,
    // same honesty rule as everything else: a caller without RugCheck
    // data (Quick Check, rescore) simply passes null and the cap
    // cannot fire.
    honeypotRisk?: boolean | null;
    mintAuthorityActive?: boolean | null;
    freezeAuthorityActive?: boolean | null;
    lpLockedPct?: number | null;
    lpBurned?: boolean | null;
  },
  options?: { retroUnverified?: boolean },
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

  // v1.3: cap-relief inputs. LP burned (LP mint authority revoked) and
  // LP locked >= 80% are provable on-chain mitigations that loosen two
  // specific floors — see the v1.3 header note.
  const lpBurnedRelief = contractSignals.lpBurned === true;
  const lpLockedPct = contractSignals.lpLockedPct;
  const lpLockedRelief = lpLockedPct !== null && lpLockedPct !== undefined && lpLockedPct >= 80;
  const LOW_LIQUIDITY_CAP = lpBurnedRelief ? 45 : 25;
  const THIN_HOLDERS_CAP = lpLockedRelief ? 75 : 60;

  let marketHealthCap = 100;
  if (dexData.liquidity !== null && dexData.liquidity < 500) {
    marketHealthCap = LOW_LIQUIDITY_CAP;
  } else if (holderRisk.top10Percent > 90) {
    marketHealthCap = Math.min(marketHealthCap, 30);
  } else if (devWalletPercent !== null && devWalletPercent > 30) {
    marketHealthCap = Math.min(marketHealthCap, 30);
  } else if (holderRisk.top10Percent > 80) {
    marketHealthCap = Math.min(marketHealthCap, 50);
  } else if (devWalletPercent !== null && devWalletPercent > 15) {
    marketHealthCap = Math.min(marketHealthCap, 50);
  } else if (holderRisk.holderCount < 20) {
    marketHealthCap = Math.min(marketHealthCap, THIN_HOLDERS_CAP);
  } else if (devWalletPercent !== null && devWalletPercent > 5) {
    // v1.3: 75 -> 80 (6% team wallet is normal practice).
    marketHealthCap = Math.min(marketHealthCap, 80);
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

  // v1.3: LP unlock exposure — real liquidity (>$10k) but less than
  // 50% of it locked. The pure liquidity tier rewards size; this cap
  // catches the exit-liquidity risk behind it.
  const LP_UNLOCKED_CAP = 40;
  const LP_UNLOCKED_LIQUIDITY_MIN = 10000;
  let lpRiskCap = 100;
  if (
    lpLockedPct !== null &&
    lpLockedPct !== undefined &&
    lpLockedPct < 50 &&
    dexData.liquidity !== null &&
    dexData.liquidity > LP_UNLOCKED_LIQUIDITY_MIN
  ) {
    lpRiskCap = Math.min(lpRiskCap, LP_UNLOCKED_CAP);
  }
  const lpRiskCapped = lpRiskCap < 100 && afterContractRisk > lpRiskCap;
  const afterLpRisk = Math.min(afterContractRisk, lpRiskCap);

  // v1.3: authority caps. Mint is a COMBO condition — an active mint
  // authority caps only when the LP is also effectively unlocked
  // (lpLockedPct < 50 with liquidity > $10k). Stables keep their mint
  // active by design and RugCheck reports no market data for them, so
  // this never fires on them; "active mint + unlocked real liquidity"
  // is the actual print-and-dump configuration. Freeze stays a
  // standalone cap below: it cannot mint supply, only freeze it, so it
  // is less severe and safe even for honest stables.
  const MINT_ACTIVE_CAP = 20;
  const mintActiveAndLpUnlocked =
    contractSignals.mintAuthorityActive === true &&
    lpLockedPct !== null &&
    lpLockedPct !== undefined &&
    lpLockedPct < 50 &&
    dexData.liquidity !== null &&
    dexData.liquidity > LP_UNLOCKED_LIQUIDITY_MIN;
  let mintAuthorityCap = 100;
  if (mintActiveAndLpUnlocked) {
    mintAuthorityCap = Math.min(mintAuthorityCap, MINT_ACTIVE_CAP);
  }
  const mintAuthorityCapped = mintAuthorityCap < 100 && afterLpRisk > mintAuthorityCap;
  const afterMintAuthority = Math.min(afterLpRisk, mintAuthorityCap);

  const FREEZE_ACTIVE_CAP = 30;
  let freezeAuthorityCap = 100;
  if (contractSignals.freezeAuthorityActive === true) {
    freezeAuthorityCap = Math.min(freezeAuthorityCap, FREEZE_ACTIVE_CAP);
  }
  const freezeAuthorityCapped = freezeAuthorityCap < 100 && afterMintAuthority > freezeAuthorityCap;
  const afterFreezeAuthority = Math.min(afterMintAuthority, freezeAuthorityCap);

  // v1.3: honeypot confirmed — same severity tier as confirmed-rugged:
  // both are RugCheck's tracked ground truth, not our heuristic.
  const HONEYPOT_CAP = 5;
  let honeypotCap = 100;
  if (contractSignals.honeypotRisk === true) {
    honeypotCap = Math.min(honeypotCap, HONEYPOT_CAP);
  }
  const honeypotCapped = honeypotCap < 100 && afterFreezeAuthority > honeypotCap;
  const afterHoneypot = Math.min(afterFreezeAuthority, honeypotCap);

  // RugCheck's OWN confirmed-rugged flag — their tracked ground truth, not
  // a heuristic of ours. No clean combination should override it.
  const RUGGED_CAP = 5;
  const ruggedCapped = rugged === true && afterHoneypot > RUGGED_CAP;
  const afterRugged =
    rugged === true ? Math.min(afterHoneypot, RUGGED_CAP) : afterHoneypot;

  // Opt-in, off by default: live scoring paths are unaffected.
  const retroUnverified = options?.retroUnverified === true;
  const retroCapped = retroUnverified && afterRugged > RETRO_UNVERIFIED_CAP;
  const finalScore = retroUnverified
    ? Math.min(afterRugged, RETRO_UNVERIFIED_CAP)
    : afterRugged;

  // Diagnostics: every condition that fired, plus the tightest one — so a
  // caller can see WHY a score is low without reverse-engineering tiers.
  const capsTriggered: Array<{ reason: string; cap: number }> = [];
  if (rugged === true) capsTriggered.push({ reason: 'rugged_confirmed', cap: RUGGED_CAP });
  if (retroUnverified)
    capsTriggered.push({ reason: 'retro_unverified', cap: RETRO_UNVERIFIED_CAP });
  if (permanentDelegate === true) capsTriggered.push({ reason: 'permanent_delegate', cap: 10 });
  if (hiddenOwner === true) capsTriggered.push({ reason: 'hidden_owner', cap: 30 });
  if (taxPercent !== null && taxPercent > 10) capsTriggered.push({ reason: 'high_tax', cap: 30 });
  // v1.3: new tiers, same diagnostics convention.
  if (contractSignals.honeypotRisk === true)
    capsTriggered.push({ reason: 'honeypot_confirmed', cap: HONEYPOT_CAP });
  if (mintActiveAndLpUnlocked)
    capsTriggered.push({ reason: 'mint_authority_active', cap: MINT_ACTIVE_CAP });
  if (contractSignals.freezeAuthorityActive === true)
    capsTriggered.push({ reason: 'freeze_authority_active', cap: FREEZE_ACTIVE_CAP });
  if (
    lpLockedPct !== null &&
    lpLockedPct !== undefined &&
    lpLockedPct < 50 &&
    dexData.liquidity !== null &&
    dexData.liquidity > LP_UNLOCKED_LIQUIDITY_MIN
  )
    capsTriggered.push({ reason: 'lp_unlocked_thin', cap: LP_UNLOCKED_CAP });
  if (dexData.liquidity !== null && dexData.liquidity < 500)
    capsTriggered.push({ reason: 'low_liquidity', cap: LOW_LIQUIDITY_CAP });
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
  if (holderRisk.holderCount < 20) capsTriggered.push({ reason: 'holders_lt_20', cap: THIN_HOLDERS_CAP });
  if (devWalletPercent !== null && devWalletPercent > 5)
    capsTriggered.push({ reason: 'dev_wallet_gt_5', cap: 80 });
  if (dexData.ageDays !== null && dexData.ageDays < 1)
    capsTriggered.push({ reason: 'age_lt_1d', cap: 55 });
  else if (dexData.ageDays !== null && dexData.ageDays < 7 && holderRisk.holderCount < 50)
    capsTriggered.push({ reason: 'age_lt_7d_thin_holders', cap: 65 });
  else if (dexData.ageDays !== null && dexData.ageDays < 7)
    capsTriggered.push({ reason: 'age_lt_7d', cap: 75 });

  // v1.3: relief diagnostics — only recorded when the mitigation
  // actually loosened a floor that fired (mirrors the else-if chain
  // above, so a relief never shows for a branch that didn't bind).
  const reliefsTriggered: Array<{ reason: string; from: number; to: number }> = [];
  if (lpBurnedRelief && dexData.liquidity !== null && dexData.liquidity < 500) {
    reliefsTriggered.push({ reason: 'lp_burned_relief', from: 25, to: 45 });
  }
  if (
    lpLockedRelief &&
    holderRisk.holderCount < 20 &&
    !(dexData.liquidity !== null && dexData.liquidity < 500)
  ) {
    reliefsTriggered.push({ reason: 'lp_locked_relief', from: 60, to: 75 });
  }

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
    retroCapped,
    lpRiskCapped,
    mintAuthorityCapped,
    freezeAuthorityCapped,
    honeypotCapped,
    reliefsTriggered,
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
      // v1.3 — new cap inputs (optional, null-means-unchecked).
      honeypotRisk?: boolean | null;
      mintAuthorityActive?: boolean | null;
      freezeAuthorityActive?: boolean | null;
      lpLockedPct?: number | null;
      lpBurned?: boolean | null;
    };
    retroUnverified?: boolean;
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
    { retroUnverified: inputs.retroUnverified === true },
  );
}
