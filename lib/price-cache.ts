// Version 8.2 — lib/price-cache.ts
//
// v8.2: both getCachedPrice() and setCachedPrice() now run the value
// through lib/sanitize-market-data.ts's sanitizeDexMarketData() (the
// same sanitizer already protecting the main token-risk API's market
// data from garbage DexScreener values, e.g. the 456420%
// price_change_24h bug fixed earlier). Previously this cache trusted
// whatever getDexScreenerData() returned with zero validation — an
// anomalous price, once cached, would have been trusted for up to 6
// hours with no check at all. Sanitizing on write catches it before
// it's ever stored; sanitizing again on read is defense-in-depth in
// case a bad value ever got in some other way.
//
// Bug that originally motivated this file: a real MRDT invoice was
// priced using FALLBACK_MRDT_PRICE_USD ($0.0000130, a hardcoded
// constant) while the actual live DexScreener price at that exact
// moment was $0.000006808 — the server overcharged by ~1.9x. The live
// fetch had silently fallen through to the fallback with no logged
// reason, and a stale hardcoded constant is inherently dangerous for a
// volatile memecoin like MRDT.
//
// This replaces "hardcoded constant" as the fallback with "last price
// we actually observed live, if it's not too old" — real market data
// instead of a number someone typed in once and forgot about. See
// lib/billing-pricing.ts for the full resolution order (live -> cache
// -> refuse to price in that currency).
//
// Uses the service-role client (lib/supabase-admin.ts) — RLS locked
// down with no anon policies, same as the rest of the Risk-Data API
// tables.

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { sanitizeDexMarketData } from '@/lib/sanitize-market-data';

const TABLE = 'risk_api_price_cache';

export interface CachedPrice {
  priceUsd: number;
  updatedAt: string;
  ageMs: number;
}

// sanitizeDexMarketData() takes the same shape lib/helius-client.js's
// getDexScreenerData() returns; only `price` is meaningful here, the
// rest are passed as null since this cache only ever stores a price.
function sanitizePrice(price: number): number | null {
  return sanitizeDexMarketData({ price, liquidity: null, volume24h: null, priceChange24h: null, ageDays: null }).price;
}

export async function getCachedPrice(mint: string): Promise<CachedPrice | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('price_usd, updated_at')
    .eq('mint', mint)
    .maybeSingle();

  if (error) {
    console.error('[price-cache] getCachedPrice error:', error.message);
    return null;
  }
  if (!data) return null;

  const sanitized = sanitizePrice(Number(data.price_usd));
  if (sanitized === null) {
    console.error(`[price-cache] cached price for ${mint} failed sanitization on read ($${data.price_usd}) — treating as no usable cache`);
    return null;
  }

  return {
    priceUsd: sanitized,
    updatedAt: data.updated_at,
    ageMs: Date.now() - new Date(data.updated_at).getTime(),
  };
}

// Fire-and-forget from the caller's perspective (awaited internally so
// errors are caught, but callers don't need to block on this — the
// live-fetched price is already what gets used for the current invoice
// regardless of whether the cache write itself succeeds).
export async function setCachedPrice(mint: string, priceUsd: number): Promise<void> {
  const sanitized = sanitizePrice(priceUsd);
  if (sanitized === null) {
    console.error(`[price-cache] refusing to cache invalid price for ${mint}: $${priceUsd}`);
    return;
  }

  const { error } = await supabase
    .from(TABLE)
    .upsert({ mint, price_usd: sanitized, updated_at: new Date().toISOString() }, { onConflict: 'mint' });

  if (error) console.error('[price-cache] setCachedPrice error:', error.message);
}
