// Version 1.1 — lib/solana-tracker-holders.ts
//
// v1.1: added fetchHolderBreakdown() — the top-100 ranked holder
// breakdown (wallet + amount + percentage) plus the genuine total from
// the SAME /tokens/{address}/holders endpoint fetchRealHolderCount()
// already uses. Needed by lib/holder-distribution.ts v6.21 as a second
// data source for mega-mints (SOL/USDC scale) whose holder distribution
// the RPC node refuses to compute via getTokenLargestAccounts
// ("Too many accounts requested" — a hard node-side limit, confirmed
// live in Vercel logs). Solana Tracker serves this pre-indexed and
// answers fine for the same mints (verified live 2026-09-20: SOL total
// 8.35M, USDC 8.97M, BONK 1.02M, top-100 accounts with ready-made
// `percentage` per wallet). Same contract as fetchRealHolderCount:
// null (never thrown) on missing key, failure, empty result or timeout.
//
// Shared fetchRealHolderCount(), extracted out of
// app/api/widget/token-risk/route.ts v1.2 so the two call sites that need
// a genuine (non-20-capped) holder headcount read from ONE implementation
// instead of two copies that can silently drift apart:
//
//   1. app/api/widget/token-risk/route.ts — the consumer "Check Token"
//      widget on the homepage.
//   2. lib/token-risk-core.ts — the shared engine behind the paid
//      Risk-Data API AND the server-side /api/listed-tokens/audit route
//      that now writes listed_tokens. This second call site was missing
//      entirely until this version — see token-risk-core.ts v1.9 for the
//      full story of why a listed token could show "Holders: 20 wallets"
//      even after a same-day re-audit run after the widget was fixed.
//
// Returns the genuine deduplicated holder-wallet count from Solana
// Tracker's dedicated /tokens/{address}/holders endpoint, or null (never
// 0, never thrown) whenever the key is missing, the call fails, or it
// times out. A null total must never be displayed as "0 wallets" or
// silently coerced to 0 by a caller — it means "unknown", not "none".

const SOLANA_TRACKER_TIMEOUT_MS = 4000;

export async function fetchRealHolderCount(address: string): Promise<number | null> {
  const apiKey = process.env.SOLANATRACKER_API_KEY;
  if (!apiKey) {
    console.error(
      '[solana-tracker-holders] SOLANATRACKER_API_KEY not configured, skipping realHolderCount.',
    );
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOLANA_TRACKER_TIMEOUT_MS);
  try {
    const res = await fetch(`https://data.solanatracker.io/tokens/${address}/holders`, {
      headers: { 'x-api-key': apiKey },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(
        `[solana-tracker-holders] ${address}: Solana Tracker holders lookup failed (${res.status})`,
      );
      return null;
    }
    const json = await res.json();
    // total is the genuine holder-wallet count; every other field on this
    // response (the top-100 `holders` array) is out of scope here.
    return typeof json.total === 'number' ? json.total : null;
  } catch (e) {
    console.error(
      `[solana-tracker-holders] ${address}: Solana Tracker holders lookup errored — ${(e as Error).message}`,
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface SolanaTrackerHolder {
  address: string;
  amount: number;
  percentage: number;
}

export interface SolanaTrackerHolderBreakdown {
  total: number | null;
  holders: SolanaTrackerHolder[];
}

/**
 * Fetches the ranked top-100 holder breakdown for a mint from Solana
 * Tracker. Returns null (never throws) when the key is missing, the call
 * fails, the result is empty, or it times out — same contract as
 * fetchRealHolderCount(). `percentage` values come straight from Solana
 * Tracker (already normalized against their supply figure), so callers do
 * not need a supply read to compute concentration for this fallback path.
 */
export async function fetchHolderBreakdown(address: string): Promise<SolanaTrackerHolderBreakdown | null> {
  const apiKey = process.env.SOLANATRACKER_API_KEY;
  if (!apiKey) {
    console.error(
      '[solana-tracker-holders] SOLANATRACKER_API_KEY not configured, skipping holder breakdown.',
    );
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOLANA_TRACKER_TIMEOUT_MS);
  try {
    const res = await fetch(`https://data.solanatracker.io/tokens/${address}/holders`, {
      headers: { 'x-api-key': apiKey },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(
        `[solana-tracker-holders] ${address}: holder breakdown lookup failed (${res.status})`,
      );
      return null;
    }
    const json = await res.json();
    const accounts = Array.isArray(json.accounts) ? json.accounts : [];
    const holders: SolanaTrackerHolder[] = accounts
      .filter(
        (h: any) =>
          typeof h === 'object' &&
          h !== null &&
          typeof h.wallet === 'string' &&
          typeof h.percentage === 'number' &&
          Number.isFinite(h.percentage),
      )
      .map((h: any) => ({
        address: h.wallet,
        amount: typeof h.amount === 'number' ? h.amount : Number(h.amount ?? 0),
        percentage: h.percentage,
      }));
    if (holders.length === 0) {
      console.warn(
        `[solana-tracker-holders] ${address}: holder breakdown returned no usable accounts`,
      );
      return null;
    }
    return {
      total: typeof json.total === 'number' ? json.total : null,
      holders,
    };
  } catch (e) {
    console.error(
      `[solana-tracker-holders] ${address}: holder breakdown errored — ${(e as Error).message}`,
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
