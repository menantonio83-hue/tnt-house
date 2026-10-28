// Version 1.0 — lib/holder-snapshot-cache.ts
//
// Caches the last good holder-distribution reading for a mint so that a
// later transient holder read failure can still be scored from a recent,
// trustworthy snapshot instead of refusing the audit. Always fail-open:
// no Redis, malformed cache entries, or any Redis error behave exactly
// like a cache miss / no-op and never throw.

import { Redis } from '@upstash/redis';
import type { HolderDistributionResult } from './holder-distribution';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

export const LARGE_TOKEN_HOLDER_THRESHOLD = 100_000;
const TTL_LARGE_SECONDS = 6 * 60 * 60;
const TTL_DEFAULT_SECONDS = 60 * 60;
const KEY_PREFIX = 'holder-snap:v1:';

export interface HolderSnapshot extends HolderDistributionResult {
  effectiveHolderCount: number;
  savedAt: number; // epoch ms
}

export function snapshotTtlSeconds(effectiveHolderCount: number | null | undefined): number {
  return typeof effectiveHolderCount === 'number' &&
    Number.isFinite(effectiveHolderCount) &&
    effectiveHolderCount >= LARGE_TOKEN_HOLDER_THRESHOLD
    ? TTL_LARGE_SECONDS
    : TTL_DEFAULT_SECONDS;
}

export function saveHolderSnapshotAsync(
  mint: string,
  result: HolderDistributionResult,
  effectiveHolderCount: number,
): void {
  if (!redis) return;
  if (
    result.riskLevel === 'ERROR' ||
    typeof effectiveHolderCount !== 'number' ||
    !Number.isFinite(effectiveHolderCount) ||
    effectiveHolderCount <= 0 ||
    !Number.isFinite(result.top10Percent)
  ) {
    return;
  }

  const ttl = snapshotTtlSeconds(effectiveHolderCount);
  redis
    .set(`${KEY_PREFIX}${mint}`, { ...result, effectiveHolderCount, savedAt: Date.now() }, { ex: ttl })
    .catch((e) => {
      console.error('[holder-snapshot] set error:', (e as Error).message);
    });
}

export async function getHolderSnapshot(mint: string): Promise<HolderSnapshot | null> {
  if (!redis) return null;
  try {
    const value = await redis.get<HolderSnapshot>(`${KEY_PREFIX}${mint}`);
    if (!value) {
      console.log(`[holder-snapshot] MISS ${mint}`);
      return null;
    }

    if (
      typeof value.riskLevel !== 'string' ||
      value.riskLevel === 'ERROR' ||
      !Number.isFinite(value.largestHolderPercent) ||
      !Number.isFinite(value.top10Percent) ||
      !Number.isFinite(value.holderCount) ||
      !Number.isFinite(value.effectiveHolderCount) ||
      !Number.isFinite(value.savedAt) ||
      typeof value.totalSupplyRaw !== 'string'
    ) {
      console.log(`[holder-snapshot] MISS ${mint}`);
      return null;
    }

    if (Date.now() - value.savedAt > snapshotTtlSeconds(value.effectiveHolderCount) * 1000) {
      console.log(`[holder-snapshot] MISS ${mint}`);
      return null;
    }

    console.log(`[holder-snapshot] HIT ${mint}`);
    return value;
  } catch (e) {
    console.error('[holder-snapshot] get error:', (e as Error).message);
    return null;
  }
}
