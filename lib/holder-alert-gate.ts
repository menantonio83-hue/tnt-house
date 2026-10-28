// Version 1.0 — lib/holder-alert-gate.ts
//
// Rate-limits repeated holder-data-unavailable admin alerts. Fail-open:
// if Redis is unavailable or errors, alert exactly as before (return true)
// so a cache outage cannot silently suppress operational alerts.

import { Redis } from '@upstash/redis';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

export const MINT_FAIL_THRESHOLD = 3;
export const MINT_WINDOW_SECONDS = 3600;
export const GLOBAL_FAIL_THRESHOLD = 5;
export const GLOBAL_WINDOW_SECONDS = 600;

export function holderAlertDecision(mintCount: number, globalCount: number): boolean {
  return mintCount >= MINT_FAIL_THRESHOLD || globalCount >= GLOBAL_FAIL_THRESHOLD;
}

export async function shouldAlertHolderFailure(mint: string): Promise<boolean> {
  if (!redis) return true;
  try {
    const [mintCount, globalCount] = await Promise.all([
      redis.incr(`holder-fail:mint:${mint}`),
      redis.incr('holder-fail:global'),
    ]);

    if (mintCount === 1) await redis.expire(`holder-fail:mint:${mint}`, MINT_WINDOW_SECONDS);
    if (globalCount === 1) await redis.expire('holder-fail:global', GLOBAL_WINDOW_SECONDS);

    const shouldAlert = holderAlertDecision(mintCount, globalCount);
    console.log(
      `[holder-alert-gate] ${mint}: mint failures=${mintCount}/${MINT_FAIL_THRESHOLD}, global failures=${globalCount}/${GLOBAL_FAIL_THRESHOLD} -> ${shouldAlert ? 'alert' : 'suppress'}`,
    );
    return shouldAlert;
  } catch (e) {
    console.error('[holder-alert-gate] error:', (e as Error).message);
    return true;
  }
}
