// Version 1.0 — lib/free-tier-global-pool.ts
//
// Atomic, site-wide daily cap on TRULY FREE (non-credit-covered)
// Risk-Data API calls, layered on top of each key's own personal
// FREE_DAILY_LIMIT (lib/billing-pricing.ts). Explicit business decision
// (не техническая, продуктовая), not a technical default: bounds the
// total upstream cost (Helius/DexScreener calls) the free tier can
// generate across ALL free keys combined in one UTC day, regardless of
// how many different emails signed up.
//
// Deliberately does NOT apply to:
// - overage-credit-covered calls (a free-tier key drawing down a
//   topped-up balance is a PAYING call at that point — cost exposure
//   already has a $ answer, no reason to also block it here)
// - subscription/paid tiers (already fully unmetered by this concept)
//
// Same atomic-INCR-with-midnight-expiry pattern as lib/demo-limit.ts's
// anonymous MCP demo path — reusing a proven, already-tested approach
// rather than inventing a new one. Same Redis database (KV_REST_API_URL
// / KV_REST_API_TOKEN — see lib/demo-limit.ts v1.1 header for why these
// specific names, not the UPSTASH_REDIS_REST_* ones the code originally
// and wrongly assumed).
//
// FAIL-OPEN if Redis is unreachable — the opposite choice from
// lib/demo-limit.ts, and deliberately so: demo-limit.ts guards a
// completely unauthenticated surface (fail-closed is the safe default
// there), but this guards calls from a key that has ALREADY passed its
// own personal rate-limit check. An infra hiccup on this cost-control
// layer should not block an otherwise-legitimate authenticated call —
// same reasoning lib/webhook-lock.ts already uses for its own
// fail-open choice.

import { Redis } from '@upstash/redis';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

export const GLOBAL_FREE_DAILY_LIMIT = 100;

const POOL_KEY_PREFIX = 'free-tier-pool:';

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export interface GlobalPoolResult {
  allowed: boolean;
  used: number;
  limit: number;
}

// count defaults to 1 (single-call path, lib/rate-limit.ts
// enforceRateLimit); the batch endpoint (enforceRateLimitBatch) passes
// the number of free-tier-covered mints in that batch, reserving all N
// slots in one atomic step — never partially consumes the pool for a
// batch that ultimately gets blocked.
export async function consumeGlobalFreePool(count = 1): Promise<GlobalPoolResult> {
  if (!redis) {
    console.error(
      '[free-tier-pool] Redis not configured, failing OPEN (not blocking an already-authenticated free-tier call over a cost-control infra gap).',
    );
    return { allowed: true, used: 0, limit: GLOBAL_FREE_DAILY_LIMIT };
  }

  const key = `${POOL_KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`;

  try {
    const used = await redis.incrby(key, count);
    if (used === count) {
      // This increment brought the counter from 0 to `count` — i.e.
      // this call created today's key. Set the expiry once; re-setting
      // it on every call would keep pushing the window out and the
      // pool would never actually reset at UTC midnight.
      await redis.expire(key, secondsUntilUtcMidnight());
    }
    return { allowed: used <= GLOBAL_FREE_DAILY_LIMIT, used, limit: GLOBAL_FREE_DAILY_LIMIT };
  } catch (e) {
    console.error('[free-tier-pool] Redis error, failing open:', (e as Error).message);
    return { allowed: true, used: 0, limit: GLOBAL_FREE_DAILY_LIMIT };
  }
}
