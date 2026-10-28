// Version 1.0 — lib/verify-throttle.ts
//
// v1.0: throttle for on-chain payment verification (MCP check_payment and
// REST POST /api/v1/billing/verify-payment). Every verify call can cost a
// Helius lookup plus Supabase round trips, so polling is bounded:
//   - per payment_id (scoped to the owning key): 1 check / 5 s
//   - per key: 30 full-speed checks / clock hour; past that the key is
//     slowed to 1 check per minute per payment_id (never fully blocked)
//   - per client IP (REST only, checked before the key lookup): 600 / hour
// A throttled call returns retry_after (seconds) WITHOUT touching Helius or
// Supabase. Fail-open: if Redis is not configured or errors, the check is
// allowed, so a real paying user is never blocked by a cache outage. These
// counters are separate from, and never count against, call quotas.
// Owner-handoff page polling has its own per-payment slot (lib/owner-handoff.ts)
// and is not counted here.

import { Redis } from '@upstash/redis';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

export const VERIFY_MIN_INTERVAL_SECONDS = 5;
export const VERIFY_MAX_PER_KEY_PER_HOUR = 30;
// Per-IP cap guards the API-key lookup against floods. It counts every
// request (throttled ones too), so it is sized to fit the site's own billing
// poller (one request per 5 s for up to 15 min = 180) with headroom.
export const VERIFY_MAX_PER_IP_PER_HOUR = 600;
// Once a key has used its hourly budget, each payment_id is still checked
// once per minute instead of being refused outright.
export const VERIFY_SLOW_INTERVAL_SECONDS = 60;

export type VerifyThrottleResult =
  | { allowed: true }
  | { allowed: false; scope: 'payment' | 'key' | 'ip'; retry_after: number };

function hourWindow(): { hour: number; secondsLeft: number } {
  const nowSec = Math.floor(Date.now() / 1000);
  const hour = Math.floor(nowSec / 3600);
  return { hour, secondsLeft: Math.max(1, (hour + 1) * 3600 - nowSec) };
}

async function hourlyCount(bucket: string, limit: number): Promise<number | null> {
  // Returns null when allowed, else seconds until the window resets.
  if (!redis) return null;
  const { hour, secondsLeft } = hourWindow();
  const k = `verify:rl:${bucket}:${hour}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, 7200);
  return n > limit ? secondsLeft : null;
}

// REST only: call BEFORE the API-key lookup so a flood never reaches Supabase.
export async function checkVerifyIpThrottle(clientIp: string): Promise<VerifyThrottleResult> {
  try {
    const wait = await hourlyCount(`ip:${clientIp || 'unknown'}`, VERIFY_MAX_PER_IP_PER_HOUR);
    return wait === null ? { allowed: true } : { allowed: false, scope: 'ip', retry_after: wait };
  } catch (e: any) {
    console.warn('[verify-throttle] ip check failed open:', e?.message);
    return { allowed: true };
  }
}

// Call after the key is authenticated and BEFORE verifyPaymentForKey.
// Only checks that win the per-payment slot (i.e. would reach Helius) count
// toward the per-key hourly budget. Past the budget the key is slowed, not
// blocked: each payment_id still gets one check per VERIFY_SLOW_INTERVAL_SECONDS,
// so an owner who pays late in a long polling session is still credited.
export async function checkVerifyThrottle(keyId: string, paymentId: string): Promise<VerifyThrottleResult> {
  if (!redis) return { allowed: true };
  try {
    const slotKey = `verify:poll:${keyId}:${paymentId}`;
    const slot = await redis.set(slotKey, '1', { nx: true, ex: VERIFY_MIN_INTERVAL_SECONDS });
    if (slot !== 'OK') {
      const ttl = await redis.ttl(slotKey);
      return {
        allowed: false,
        scope: 'payment',
        retry_after: ttl > 0 ? ttl : VERIFY_MIN_INTERVAL_SECONDS,
      };
    }
    const overBudget = await hourlyCount(`key:${keyId}`, VERIFY_MAX_PER_KEY_PER_HOUR);
    if (overBudget === null) return { allowed: true };
    const slowKey = `verify:slow:${keyId}:${paymentId}`;
    const slow = await redis.set(slowKey, '1', { nx: true, ex: VERIFY_SLOW_INTERVAL_SECONDS });
    if (slow === 'OK') return { allowed: true };
    const ttl = await redis.ttl(slowKey);
    return { allowed: false, scope: 'key', retry_after: ttl > 0 ? ttl : VERIFY_SLOW_INTERVAL_SECONDS };
  } catch (e: any) {
    console.warn('[verify-throttle] check failed open:', e?.message);
    return { allowed: true };
  }
}

export function throttledBody(t: Extract<VerifyThrottleResult, { allowed: false }>) {
  const why =
    t.scope === 'payment'
      ? `Payment checks are limited to one every ${VERIFY_MIN_INTERVAL_SECONDS} seconds per payment_id.`
      : t.scope === 'key'
        ? `This API key used its ${VERIFY_MAX_PER_KEY_PER_HOUR} full-speed payment checks for this hour; each payment_id is now checked at most once every ${VERIFY_SLOW_INTERVAL_SECONDS} seconds.`
        : `Too many payment checks from this IP (${VERIFY_MAX_PER_IP_PER_HOUR} per hour).`;
  return {
    verified: false,
    error_code: 'verify_rate_limited',
    reason: `${why} Retry after ${t.retry_after} seconds. This did not use any API call quota, and a payment that already landed on-chain will still be credited on a later check.`,
    retry_after: t.retry_after,
  };
}
