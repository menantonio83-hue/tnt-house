// Version 1.1 — lib/holder-data-guard.ts
//
// One definition of "the holder read failed", for every surface that
// scores a token.
//
// BACKGROUND: getHolderDistributionRobust() and checkHolderDistributionRisk()
// both do the right thing on failure — after exhausting their retries they
// return riskLevel 'ERROR' with zeroed percentages, and their own comments
// say this is deliberate: report "we don't know" rather than the misleading
// "100% concentrated" a genuine zero-holder read would imply.
//
// The problem was that nothing ever read that signal. A repo-wide search for
// comparisons against 'ERROR' found three producers, one type declaration,
// and zero consumers. The zeros flowed straight into scoring, where they are
// worse than useless:
//
//   top10Percent > 90  -> cap 30   0 > 90 is false, cap never fires
//   top10Percent > 80  -> cap 50   0 > 80 is false, cap never fires
//   holderCount < 20   -> cap 60   0 < 20 is true, fires by accident
//
// So a failed read cannot trigger the concentration caps — it disables all
// of them. A token with 95% top-ten concentration whose holder read failed
// scores as if concentration had been checked and found fine. On the browser
// path it was worse still: app/page.js coerced the missing values to 0 and
// re-derived the level with classifyHolderRisk(0, 0), which returns 'LOW' —
// full marks for the holder component.
//
// WHY A SHARED PREDICATE RATHER THAN `=== 'ERROR'` IN FOUR PLACES: this
// codebase has already been bitten twice by copying a rule into several
// call sites and watching the copies drift (see lib/scoring.ts's header —
// one mint scored 0, 30 and ~70 on three surfaces from exactly that). Four
// consumers, one definition.
//
// THE DISCRIMINATOR IS THE LEVEL, NEVER THE COUNT. holder-distribution.ts
// has a legitimate success path that returns an empty holder list with
// ok: true — a real zero exists, and a token that genuinely has no holders
// must stay distinguishable from a token whose holders could not be read.
// Checking holderCount === 0 would collapse those two into one and start
// rejecting real answers.

export interface HolderReadingShape {
  riskLevel?: string | null;
}

export const HOLDER_DATA_UNAVAILABLE_ERROR = 'holder_data_unavailable';

export const HOLDER_DATA_UNAVAILABLE_MESSAGE =
  'Holder distribution could not be read for this token, so no score can be produced. ' +
  'This is an upstream RPC failure on our side, not a verdict about the token — please try again shortly.';

/**
 * True when the holder reading is a reported failure rather than data.
 *
 * Note the null/undefined handling: a reading with no riskLevel at all has
 * not been classified, and treating an unclassified reading as usable is the
 * same mistake as treating 'ERROR' as usable.
 */
export function isHolderReadingUnusable(reading: HolderReadingShape | null | undefined): boolean {
  if (!reading) return true;
  if (typeof reading.riskLevel !== 'string') return true;
  return reading.riskLevel === 'ERROR';
}
