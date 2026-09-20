// Version 1.0 — lib/solana-tracker-holders.ts
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
