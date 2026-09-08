// Version 1.1 — lib/listed-token-projection.ts
//
// Turns a server-computed TokenRiskResult into the exact row shape
// `listed_tokens` stores, using the exact display strings app/page.js has
// been writing from the browser.
//
// WHY THE STRINGS MATTER: several of these columns are TEXT holding
// decorated values like 'Revoked ✓' rather than booleans. The live UI
// renders them verbatim (app/page.js ~5889-5960). If the server wrote
// 'revoked' or true instead, every row it touched would render
// differently from the 65 already stored. Every string below was taken
// from the client's own ternaries (app/page.js 2623-2653) and
// cross-checked against the distinct values actually present in the
// table, so the server and the browser produce byte-identical output:
//
//   mint_authority / freeze_authority : 'Revoked ✓' | 'Active ⚠️' | 'Unknown'
//   is_honeypot                       : 'No ✓'      | 'Yes 🚨'    | 'Unknown'
//   hidden_owner                      : 'No ✓'      | 'Yes ⚠️'    | 'Unknown'
//   permanent_delegate                : 'No ✓'      | 'Yes 🚨'    | 'Unknown'
//
// The score itself is NOT recomputed here. It comes from fetchTokenRisk(),
// which runs lib/scoring.ts — the same module app/page.js imports on line
// 4. Same function, same inputs, same number; only the place it executes
// changes. That is the whole reason this migration does not move any
// published score.

import type { TokenRiskResult } from '@/lib/token-risk-core';

const DEXSCREENER_TOKENS_URL = 'https://api.dexscreener.com/latest/dex/tokens';
const METADATA_TIMEOUT_MS = 8000;

export interface ListingMetadata {
  name: string | null;
  symbol: string | null;
  dex_url: string | null;
  logo_url: string | null;
}

export interface ListedTokenRow {
  ca: string;
  name: string;
  symbol: string;
  score: number;
  price: string | null;
  liquidity: number | null;
  volume24h: number | null;
  price_change_24h: number | null;
  dex_url: string | null;
  chain: 'solana';
  mint_authority: string;
  freeze_authority: string;
  is_honeypot: string;
  top10_percent: number | null;
  lp_locked_percent: number | null;
  holder_count: number | null;
  creator_balance_percent: number | null;
  logo_url: string | null;
  buy_tax_percent: number | null;
  sell_tax_percent: number | null;
  contract_renounced: boolean | null;
  hidden_owner: string;
  age_days: number | null;
  standard_program: boolean | null;
  permanent_delegate: string;
  score_version: string;
}

// null (couldn't check) must never render as the clean value. Same rule
// the rest of this codebase applies to honeypot_risk and lp_locked: an
// absent signal is 'Unknown', not 'No ✓'.
function triState(value: boolean | null | undefined, whenTrue: string, whenFalse: string): string {
  if (value === true) return whenTrue;
  if (value === false) return whenFalse;
  return 'Unknown';
}

/**
 * Name, symbol, chart URL and logo — the four listing fields that are pure
 * DexScreener metadata and carry no risk signal.
 *
 * NOTE ON DUPLICATION: getDexScreenerData() in lib/helius-client.js already
 * fetches this same endpoint and already contains careful base-side pair
 * selection. It does not return these four fields, so they are re-derived
 * here. Folding them into that function would be the better long-term shape
 * and would remove this second copy — it is deliberately not done in this
 * change, because that function is on the paid Risk-Data API's hot path and
 * this migration should not put the API at risk. Tracked, not forgotten.
 */
export async function fetchListingMetadata(mint: string): Promise<ListingMetadata> {
  const empty: ListingMetadata = { name: null, symbol: null, dex_url: null, logo_url: null };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
    const res = await fetch(`${DEXSCREENER_TOKENS_URL}/${mint}`, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return empty;
    const data = await res.json();

    const solanaPairs = (data.pairs || []).filter((p: any) => p.chainId === 'solana');
    if (solanaPairs.length === 0) return empty;

    // Prefer pairs where our mint is the BASE token — on a quote-side pair
    // baseToken carries some other token's name and symbol entirely.
    const baseSide = solanaPairs.filter((p: any) => p.baseToken?.address === mint);
    if (baseSide.length === 0) return empty;

    const best = baseSide.sort(
      (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0),
    )[0];

    return {
      name: best.baseToken?.name ?? null,
      symbol: best.baseToken?.symbol ?? null,
      dex_url: typeof best.url === 'string' ? best.url : null,
      logo_url: typeof best.info?.imageUrl === 'string' ? best.info.imageUrl : null,
    };
  } catch (e) {
    console.error('[listing-metadata] fetch failed:', (e as Error).message);
    return empty;
  }
}

export interface ProjectionOutcome {
  ok: boolean;
  reason: string | null;
  row: ListedTokenRow | null;
}

/**
 * Map a successful TokenRiskResult onto the listed_tokens row shape.
 * Refuses rather than substituting when something essential is missing —
 * a listing with a guessed score is worse than no listing.
 */
export function projectToListedTokenRow(
  risk: TokenRiskResult,
  meta: ListingMetadata,
): ProjectionOutcome {
  if (!risk.ok) {
    return { ok: false, reason: risk.error || 'risk lookup failed', row: null };
  }

  if (typeof risk.safety_score !== 'number') {
    // The client used to fall back to 95 here. That is exactly the class of
    // bug this whole migration exists to remove.
    return { ok: false, reason: 'no safety score was produced', row: null };
  }

  const name = meta.name;
  const symbol = meta.symbol;
  if (!name || !symbol) {
    return {
      ok: false,
      reason: 'DexScreener has no Solana market for this mint yet, so it has no name or symbol',
      row: null,
    };
  }

  const holders = risk.holder_distribution;
  const market = risk.market;

  return {
    ok: true,
    reason: null,
    row: {
      ca: risk.mint,
      name,
      symbol,
      score: risk.safety_score,
      // TEXT column: kept as a string so the exact decimal places the UI
      // shows survive the round trip.
      price: market?.price_usd != null ? String(market.price_usd) : null,
      liquidity: market?.liquidity_usd ?? null,
      volume24h: market?.volume_24h_usd ?? null,
      price_change_24h: market?.price_change_24h_percent ?? null,
      dex_url: meta.dex_url,
      chain: 'solana',
      mint_authority: triState(risk.mint_authority?.revoked, 'Revoked ✓', 'Active ⚠️'),
      freeze_authority: triState(risk.freeze_authority?.revoked, 'Revoked ✓', 'Active ⚠️'),
      is_honeypot: triState(risk.honeypot_risk, 'Yes 🚨', 'No ✓'),
      top10_percent: holders?.top10_percent ?? null,
      lp_locked_percent: risk.lp_locked?.percent ?? null,
      holder_count: holders?.holder_count ?? null,
      creator_balance_percent: risk.dev_wallet_percent ?? null,
      logo_url: meta.logo_url,
      buy_tax_percent: risk.buy_tax_percent ?? null,
      sell_tax_percent: risk.sell_tax_percent ?? null,
      contract_renounced: risk.contract_renounced ?? null,
      hidden_owner: triState(risk.hidden_owner, 'Yes ⚠️', 'No ✓'),
      age_days: market?.age_days ?? null,
      standard_program:
        risk.token_program === 'standard' ? true : risk.token_program === 'nonstandard' ? false : null,
      permanent_delegate: triState(risk.permanent_delegate, 'Yes 🚨', 'No ✓'),
      score_version: 'v2',
    },
  };
}
