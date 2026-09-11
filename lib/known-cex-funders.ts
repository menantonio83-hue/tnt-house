// Version 1.1 — lib/known-cex-funders.ts
//
// A small, manually-curated whitelist of Solana wallet addresses known to
// belong to centralized exchanges or bridges, used by
// app/api/cluster-check/route.js to avoid flagging "multiple top holders
// funded by the same exchange deposit wallet" as an insider cluster.
//
// WHY THIS FILE IS EMPTY BY DEFAULT: no free, verifiable API for Solana
// CEX wallet labels exists as of this writing (checked: Helius Wallet
// Identity API requires a paid plan and returns 403 on a free key; Vybe
// Network's labeled-accounts endpoint is gated behind its paid tier too,
// despite Vybe having a free plan for other endpoints). Hardcoding
// addresses without a way to verify them would mean guessing — exactly
// the thing this project's own working rule forbids ("say 'I don't know'
// rather than substitute a plausible value").
//
// So this list starts empty and is meant to be grown BY HAND, one
// verified address at a time:
//   1. cluster-check flags a funder address as shared across 2+ holders.
//   2. Look the funder address up on a free public explorer — e.g.
//      https://solscan.io/account/<address> or https://solana.fm — and
//      check whether it carries an exchange/bridge label there.
//   3. If confirmed, add it below with the exchange name and the date
//      you checked it (labels can be re-used or retired, so a dated
//      entry is easier to eventually re-verify than an undated one).
//
// Most exchange HOT wallets should no longer need to be listed here at
// all: v1.9 of cluster-check/route.js already excludes any holder whose
// true first transaction couldn't be confirmed within the RPC page
// budget (3000 signatures back), which is true of essentially every
// established CEX hot wallet. What this list is actually for is the
// remaining gap — newer or lower-traffic exchange DEPOSIT addresses,
// which can have short enough histories to pass that check and still
// not be a real insider link.
export const KNOWN_CEX_FUNDERS: ReadonlySet<string> = new Set([
  // Example (do not uncomment without verifying the address yourself):
  // '4xLpwxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Binance deposit — verified 2026-09-11 via solscan.io
]);
