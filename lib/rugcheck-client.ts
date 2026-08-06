// Version 1.2 — lib/rugcheck-client.ts
//
// v1.2: added four more fields extracted from the SAME RugCheck
// /report response this file already fetches — zero extra latency,
// zero extra RPC/HTTP calls, just parsing more of a payload that was
// previously discarded after honeypot_risk/lp_locked. Verified the
// exact field shapes against a real captured RugCheck response (not
// guessed): deployer_address <- top-level `creator` (string, the
// mint's deployer wallet); rugged <- top-level `rugged` (boolean,
// RugCheck's OWN explicit "this token has already been confirmed
// rugged" flag — previously not read at all); jup_verified <-
// `verification.jup_verified` (boolean, Jupiter's own verification
// status); insider_holder_count <- count of entries in `topHolders`
// where that entry's own `insider` boolean is true (RugCheck runs its
// own insider-graph analysis per top holder — this is a free
// cross-check signal alongside this codebase's own from-scratch
// lib/insider-cluster-detector.ts, not a replacement for it: RugCheck
// flags insiders by its own graph-relationship heuristic, our detector
// flags them by shared-first-funder — different methodologies, both
// useful, deliberately exposed as separate signals rather than merged
// into one number).
//
// All four follow the same "null means couldn't check, never a
// false-clean default" rule already established for honeypot_risk/
// lp_locked below — an absent RugCheck response means all six fields
// come back null together, never a partial success.
//
// Version 1.1 — lib/rugcheck-client.ts
//
// Server-side RugCheck client, added to give the Risk-Data API real
// honeypot_risk and lp_locked values instead of the hardcoded null both
// fields shipped with at launch.
//
// This is a port, not new logic: TNT House's consumer audit flow
// (app/page.js, runAuditAndSave) has been computing both fields from
// RugCheck's full /report endpoint since FIX v1.66/v1.107 there — same
// endpoint, same risks[] honeypot match, same markets[].lp.lpLockedPct
// averaging. That code only ran in the browser for the listing/audit
// card; this brings the identical extraction server-side so the paid
// API can return it too. The two call sites are independent and will
// drift if one changes without the other — that's an accepted tradeoff
// for now, not an oversight.
//
// Deliberately conservative on failure: a RugCheck timeout or non-200
// returns null for both fields, never a false "clean" default. An
// absent signal must not look like a verified-safe one — same rule
// this codebase already applies to lp_locked_percent in
// lib/helius-client.js and buyTaxPercent/sellTaxPercent there.

const RUGCHECK_URL = 'https://api.rugcheck.xyz/v1/tokens';
const RUGCHECK_TIMEOUT_MS = 8000;

export interface RugCheckRiskData {
  // true = RugCheck's risk list names a honeypot-shaped risk; false =
  // report fetched cleanly with no such risk; null = couldn't check.
  honeypot_risk: boolean | null;
  // null = couldn't check (RugCheck failure, or no market/LP data
  // reported for this mint at all — different from "checked, 0% locked").
  lp_locked: { locked: boolean; percent: number } | null;
  // v1.2 — see header note above for exact provenance of each field.
  deployer_address: string | null;
  rugged: boolean | null;
  jup_verified: boolean | null;
  insider_holder_count: number | null;
}

const EMPTY_RESULT: RugCheckRiskData = {
  honeypot_risk: null,
  lp_locked: null,
  deployer_address: null,
  rugged: null,
  jup_verified: null,
  insider_holder_count: null,
};

export async function getRugCheckRiskData(mint: string): Promise<RugCheckRiskData> {
  try {
    const res = await fetch(`${RUGCHECK_URL}/${mint}/report`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(RUGCHECK_TIMEOUT_MS),
    });

    if (!res.ok) return EMPTY_RESULT;

    const data = await res.json();
    const risks: Array<{ name?: unknown }> = Array.isArray(data.risks) ? data.risks : [];

    const honeypot_risk = risks.some(
      (r) => typeof r.name === 'string' && r.name.toLowerCase().includes('honeypot'),
    );

    let lp_locked: RugCheckRiskData['lp_locked'] = null;
    if (Array.isArray(data.markets) && data.markets.length > 0) {
      const lpVals: number[] = data.markets
        .map((m: any) => (m && m.lp && typeof m.lp.lpLockedPct === 'number' ? m.lp.lpLockedPct : null))
        .filter((v: number | null): v is number => v !== null);

      if (lpVals.length > 0) {
        const avg = lpVals.reduce((a, b) => a + b, 0) / lpVals.length;
        const percent = Math.round(avg * 10) / 10;
        lp_locked = { locked: percent > 0, percent };
      }
    }

    const deployer_address = typeof data.creator === 'string' && data.creator.length > 0 ? data.creator : null;
    const rugged = typeof data.rugged === 'boolean' ? data.rugged : null;
    const jup_verified =
      data.verification && typeof data.verification.jup_verified === 'boolean'
        ? data.verification.jup_verified
        : null;
    const insider_holder_count = Array.isArray(data.topHolders)
      ? data.topHolders.filter((h: any) => h && h.insider === true).length
      : null;

    return { honeypot_risk, lp_locked, deployer_address, rugged, jup_verified, insider_holder_count };
  } catch {
    // Timeout (AbortSignal), network failure, or invalid JSON.
    return EMPTY_RESULT;
  }
}
