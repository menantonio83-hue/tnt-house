// Version 1.2 — lib/funder-cache.ts
//
// v1.2: FIXED WRONG ENV VAR NAMES — this file (and lib/webhook-lock.ts,
// lib/demo-limit.ts) checked process.env.UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN, which were NEVER SET. The actual Vercel
// Marketplace integration that was connected on Aug 1 is the "Vercel
// KV" product (Upstash-backed under the hood, but exposed under its
// own var names): KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN,
// KV_REST_API_READ_ONLY_TOKEN, REDIS_URL — confirmed directly from the
// Environment Variables page, all "Production and Preview", added Aug
// 1. KV_REST_API_URL / KV_REST_API_TOKEN are the correct REST
// credentials for the @upstash/redis client (same protocol, just a
// different product wrapper/naming than raw Upstash). This file was
// fail-open by design (see below), so the wrong var names never
// crashed anything — the cache had just silently never been active
// since it was first written, always falling through to uncached RPC.
// Discovered via lib/demo-limit.ts (v1.0, fail-CLOSED) logging an
// explicit "Redis not configured" error the moment real traffic hit
// it, which this file's silent fail-open never would have surfaced.
//
// v1.1: added a plain console.log per lookup ('[funder-cache] HIT' /
// 'MISS' + address) so real hit/miss rates are visible in Vercel
// function logs on live traffic — no counter table, no extra moving
// parts, just grep-able log lines.
//
// Optional Redis cache for wallet funder resolution, used by
// lib/insider-cluster-detector.ts. A wallet's first-funding source is a
// historical on-chain fact that can never change once observed, so
// entries here have NO TTL — they're valid forever, no expiry logic
// needed.
//
// FAIL-OPEN BY DESIGN: if KV_REST_API_URL / KV_REST_API_TOKEN aren't
// set (integration not connected, or briefly down), every function
// below is a safe no-op — callers just fall through to the uncached
// RPC path exactly as if this file didn't exist. No crash, no behavior
// change either way.

import { Redis } from '@upstash/redis';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
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
