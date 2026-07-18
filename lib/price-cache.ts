// Version 8.1 — lib/price-cache.ts
//
// Bug that motivated this file: a real MRDT invoice was priced using
// FALLBACK_MRDT_PRICE_USD ($0.0000130, a hardcoded constant) while the
// actual live DexScreener price at that exact moment was $0.000006808 —
// the server overcharged by ~1.9x. The live fetch had silently fallen
// through to the fallback with no logged reason, and a stale hardcoded
// constant is inherently dangerous for a volatile memecoin like MRDT.
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

const TABLE = 'risk_api_price_cache';

export interface CachedPrice {
  priceUsd: number;
  updatedAt: string;
  ageMs: number;
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

  return {
    priceUsd: Number(data.price_usd),
    updatedAt: data.updated_at,
    ageMs: Date.now() - new Date(data.updated_at).getTime(),
  };
}

// Fire-and-forget from the caller's perspective (awaited internally so
// errors are caught, but callers don't need to block on this — the
// live-fetched price is already what gets used for the current invoice
// regardless of whether the cache write itself succeeds).
export async function setCachedPrice(mint: string, priceUsd: number): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ mint, price_usd: priceUsd, updated_at: new Date().toISOString() }, { onConflict: 'mint' });

  if (error) console.error('[price-cache] setCachedPrice error:', error.message);
}
