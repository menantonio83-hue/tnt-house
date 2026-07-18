// Version 6.11 — lib/sanitize-market-data.ts
//
// Bug reported live on BONK: price_change_24h_percent came back as
// 456420 — obviously not a real 24h price move for a massive, highly
// liquid token. getDexScreenerData() (lib/helius-client.js, NOT
// modified) passes DexScreener's priceChange.h24 straight through with
// no validation; this is a defensive layer specific to our own API's
// output, not a fix to the upstream library.
//
// Root cause is most likely on DexScreener's side — either a genuine
// data anomaly on a specific pair, or picking a low-liquidity/mislabeled
// pair in edge cases. Rather than guessing at DexScreener's internals,
// this just refuses to relay numbers far outside anything a real 24h
// price move could plausibly be, nulling them out instead of guessing
// at a "corrected" value.

export interface DexMarketData {
  price: number | null;
  liquidity: number | null;
  volume24h: number | null;
  priceChange24h: number | null;
  ageDays: number | null;
}

// Deliberately generous — even an extreme brand-new pump.fun pump rarely
// exceeds a few thousand percent in 24h. Anything beyond this is treated
// as a data anomaly rather than a real market move.
const MAX_PLAUSIBLE_PRICE_CHANGE_PERCENT = 50000;

export function sanitizeDexMarketData(data: DexMarketData): DexMarketData {
  const priceChange24h =
    data.priceChange24h !== null &&
    Number.isFinite(data.priceChange24h) &&
    Math.abs(data.priceChange24h) <= MAX_PLAUSIBLE_PRICE_CHANGE_PERCENT
      ? data.priceChange24h
      : null;

  // Light defensive checks on the rest — a negative price/liquidity/
  // volume is never valid and indicates the same class of upstream issue.
  const price = data.price !== null && data.price >= 0 ? data.price : null;
  const liquidity = data.liquidity !== null && data.liquidity >= 0 ? data.liquidity : null;
  const volume24h = data.volume24h !== null && data.volume24h >= 0 ? data.volume24h : null;

  return { price, liquidity, volume24h, priceChange24h, ageDays: data.ageDays };
}
