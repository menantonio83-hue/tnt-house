// Version 1.1 — lib/funder-cache.ts
//
// v1.1: added a plain console.log per lookup ('[funder-cache] HIT' /
// 'MISS' + address) so real hit/miss rates are visible in Vercel
// function logs on live traffic — no counter table, no extra moving
// parts, just grep-able log lines.
//
// Optional Upstash Redis cache for wallet funder resolution, used by
// lib/insider-cluster-detector.ts. A wallet's first-funding source is a
// historical on-chain fact that can never change once observed, so
// entries here have NO TTL — they're valid forever, no expiry logic
// needed.
//
// FAIL-OPEN BY DESIGN: if UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// aren't set (Upstash integration not connected yet, or briefly down),
// every function below is a safe no-op — callers just fall through to
// the uncached RPC path exactly as if this file didn't exist. No crash,
// no behavior change either way. Caching activates automatically the
// moment those env vars are present — nothing else to wire up.
//
// ONE-TIME MANUAL SETUP (cannot be done from here — needs the Vercel
// dashboard): project -> Storage -> Marketplace Database Storage ->
// Upstash Redis -> Free tier (no card required). This sets
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN on the project
// automatically. A redeploy (or the next deploy) is needed for a
// running serverless function to pick up newly-added env vars.

import { Redis } from '@upstash/redis';

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const KEY_PREFIX = 'funder:';

export interface CachedFunder {
  funder: string;
  blockTime: number | null;
}

// Returns the cached funder-resolution result for a wallet address, or
// null on a cache miss / cache unavailable / any Redis error — all three
// cases are treated identically by callers (fall back to RPC).
export async function getCachedFunder(address: string): Promise<CachedFunder | null> {
  if (!redis) return null;
  try {
    const value = await redis.get<CachedFunder>(`${KEY_PREFIX}${address}`);
    console.log(value ? `[funder-cache] HIT ${address}` : `[funder-cache] MISS ${address}`);
    return value ?? null;
  } catch (e) {
    console.error('[funder-cache] get error:', (e as Error).message);
    return null;
  }
}

// Fire-and-forget by design — never awaited on the request's critical
// path. A write failure here should never fail (or even slow down) the
// caller; worst case, that address is simply re-resolved via RPC next
// time it's seen.
export function setCachedFunderAsync(address: string, value: CachedFunder): void {
  if (!redis) return;
  redis.set(`${KEY_PREFIX}${address}`, value).catch((e) => {
    console.error('[funder-cache] set error:', (e as Error).message);
  });
}
