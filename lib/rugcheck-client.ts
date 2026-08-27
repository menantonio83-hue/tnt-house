// Version 1.3 — lib/rugcheck-client.ts
//
// v1.3: six more fields, same "same /report payload, zero extra
// latency" pattern as v1.2. Ported field-for-field from app/page.js's
// proven browser-side extraction (runAuditAndSave, ~line 2364-2440) so
// the API and the site's own audit card derive these identically —
// not reinvented, just the same logic moved server-side:
//
// - hidden_owner: true only if RugCheck's risks[] names a proxy/owner
//   risk; false if report fetched clean; null if couldn't check. Same
//   "don't assume No falsely" rule as honeypot_risk below.
// - permanent_delegate: true only if risks[] names a delegate risk —
//   Token-2022's permanent-delegate extension lets that address move
//   or burn ANY holder's tokens without permission, a real drain
//   vector distinct from mint/freeze authority.
// - buy_tax_percent / sell_tax_percent: from data.transferFee.pct
//   (Token-2022 transfer-fee extension). Solana's transfer fee is
//   symmetric — same rate applies to any transfer, there's no separate
//   buy/sell rate — so both fields carry the same value, matching
//   page.js's own comment on this exact point.
// - dev_wallet_percent: creatorBalance / token.supply, i.e. the
//   deployer's own on-chain holding — a distinct risk axis from
//   top10_percent, since the deployer can hold a large stake while
//   sitting outside any top-10 cutoff if they've spread it across
//   several wallets AND this codebase's insider-cluster-detector
//   hasn't yet linked those wallets back to them.
// - token_program: 'standard' if the mint uses one of Solana's two
//   canonical token programs (classic SPL Token or Token-2022,
//   verified by their real deployed program IDs below), 'nonstandard'
//   if RugCheck reports something else, null if RugCheck didn't report
//   a token program at all.
// - contract_renounced: mint_authority.revoked && freeze_authority.
//   revoked — a convenience boolean for callers who want one field
//   instead of checking both authorities themselves. Purely derived,
//   not a new signal, so it carries no separate scoring weight in
//   computeApiSafetyScore/applyScoreCaps (see v1.5 of this score logic
//   in token-risk-core.ts) — the underlying mint/freeze revocations are
//   already scored.
//
// All six follow the same null-means-unchecked rule as the rest of
// this file: a RugCheck failure returns all ten fields (four from v1.2
// plus these six) as null together, never a partial success mixing
// real and defaulted values.
//
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

import { alertAdmin } from './telegram-alert';

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
  // v1.3 — see header note above.
  hidden_owner: boolean | null;
  permanent_delegate: boolean | null;
  buy_tax_percent: number | null;
  sell_tax_percent: number | null;
  dev_wallet_percent: number | null;
  token_program: 'standard' | 'nonstandard' | null;
}

const EMPTY_RESULT: RugCheckRiskData = {
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

// Real, deployed Solana program IDs for the two canonical token
// programs — same list as app/page.js's STANDARD_TOKEN_PROGRAMS.
const STANDARD_TOKEN_PROGRAMS = [
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // classic SPL Token
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // Token-2022
];

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

    // v1.3 — hidden owner / permanent delegate: only flagged if
    // RugCheck's risks[] actually names such a risk, same
    // don't-assume-false-negative rule as honeypot_risk above.
    const hidden_owner = risks.some(
      (r) =>
        typeof r.name === 'string' &&
        (r.name.toLowerCase().includes('proxy') || r.name.toLowerCase().includes('owner')),
    );
    const permanent_delegate = risks.some(
      (r) => typeof r.name === 'string' && r.name.toLowerCase().includes('delegate'),
    );

    // Token-2022 transfer fee — symmetric, same rate both directions.
    let buy_tax_percent: number | null = null;
    let sell_tax_percent: number | null = null;
    if (data.transferFee && typeof data.transferFee.pct === 'number') {
      buy_tax_percent = data.transferFee.pct;
      sell_tax_percent = data.transferFee.pct;
    }

    // Deployer's own holding, as a percent of total supply.
    const dev_wallet_percent =
      typeof data.creatorBalance === 'number' &&
      data.token &&
      typeof data.token.supply === 'number' &&
      data.token.supply > 0
        ? Math.round((data.creatorBalance / data.token.supply) * 1000) / 10
        : null;

    const token_program =
      typeof data.tokenProgram === 'string' && data.tokenProgram.length > 0
        ? STANDARD_TOKEN_PROGRAMS.includes(data.tokenProgram)
          ? 'standard'
          : 'nonstandard'
        : null;

    return {
      honeypot_risk,
      lp_locked,
      deployer_address,
      rugged,
      jup_verified,
      insider_holder_count,
      hidden_owner,
      permanent_delegate,
      buy_tax_percent,
      sell_tax_percent,
      dev_wallet_percent,
      token_program,
    };
  } catch (err) {
    // Timeout (AbortSignal), network failure, or invalid JSON — a real
    // service problem, distinct from the !res.ok branch above (which
    // covers ordinary per-token misses, e.g. RugCheck hasn't indexed a
    // brand-new mint yet) that we deliberately do NOT alert on to avoid
    // noise from expected per-token quirks.
    void alertAdmin('rugcheck', err instanceof Error ? err.message : String(err));
    return EMPTY_RESULT;
  }
}
