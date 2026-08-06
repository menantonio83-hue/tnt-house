// Version 1.2 — lib/demo-limit.ts
//
// v1.2: added a GLOBAL daily cap (DEMO_DAILY_LIMIT_GLOBAL = 100) on top
// of the existing per-IP cap. Per-IP alone doesn't stop someone who
// actually wants to burn free calls: Vercel overwrites x-forwarded-for
// so a client can't spoof it directly (confirmed against Vercel's own
// docs), but rotating real IPs — VPN, mobile carrier NAT, cloud
// instances — is trivial and each one gets its own fresh 3/day. A
// global ceiling is the real backstop: no matter how many distinct IPs
// show up, the upstream cost (Helius/DexScreener calls via
// fetchTokenRisk) for anonymous, unauthenticated traffic is capped for
// the whole service, not just per visitor. 100/day is generous for
// legitimate first-time visitors (way more than the handful of real
// people testing the listing right now) while bounding worst-case
// abuse cost to a fixed, small number of upstream calls per day.
//
// Both counters live in the same Redis database, separate keys
// ("demo-limit:<ip>:<date>" vs "demo-limit:global:<date>"), both
// expire at UTC midnight the same way. A request is allowed only if
// BOTH the per-IP and the global count are still within their limits —
// whichever is hit first blocks the call, and the response tells the
// caller which one it was.
//
// v1.1: FIXED WRONG ENV VAR NAMES on first deploy — checked
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, which don't exist
// on this project. The real integration (connected Aug 1) is "Vercel
// KV", exposing KV_REST_API_URL / KV_REST_API_TOKEN instead — same REST
// protocol the @upstash/redis client speaks, just different product
// naming. Confirmed directly from the Vercel Environment Variables page
// (KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN, KV_REST_API_READ_ONLY_TOKEN,
// REDIS_URL all present, "Production and Preview", added Aug 1). This
// file's fail-closed design is exactly what surfaced the mismatch in
// the first place — first real anonymous demo call logged
// "[demo-limit] Redis not configured" instead of silently limping along
// like lib/webhook-lock.ts's fail-open had been doing for this same
// wrong-name bug the whole time. See lib/funder-cache.ts v1.2 for the
// full discovery story.
//
// Zero-friction anonymous trial for check_token_risk via MCP — aimed at
// people testing the server straight from a directory's built-in
// inspector/playground (Glama, Smithery, MCP Inspector) with no API key
// configured. Context: Glama analytics showed 411 search impressions /
// 471 profile views / 0 tool calls over 30 days — visitors were reaching
// the listing but never had a key handy to make the FIRST real call, so
// nobody ever saw the tool actually work. This closes that gap without
// touching the real API-key billing/quota system at all.
//
// NOT a replacement for the real free tier (15/day via a real key, see
// lib/rate-limit.ts FREE_DAILY_LIMIT) — deliberately much smaller (see
// DEMO_DAILY_LIMIT_PER_IP below), per-IP rather than per-key, and every
// response upsells getting a real key for the full quota.
//
// Reuses the same Redis credentials as lib/webhook-lock.ts /
// lib/funder-cache.ts (KV_REST_API_URL / KV_REST_API_TOKEN) — same
// database, separate key namespace ("demo-limit:").
//
// FAIL-CLOSED here — the opposite of webhook-lock's fail-open. That's
// deliberate: webhook-lock guards a monitoring sweep where missing a
// lock costs at most one duplicate notification, but this guards an
// otherwise-unmetered anonymous surface. If Redis is unreachable, a real
// API key still works completely normally (enforceRateLimit() is a
// separate code path, untouched by this file) — only the zero-key demo
// path is blocked, which costs nothing but a slightly less charming
// error message for an edge-case infra hiccup.

import { Redis } from '@upstash/redis';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

// Small on purpose: enough for one person to see ONE real response and
// believe the product works (and try a second/third mint if curious),
// not enough to matter as a free scraping vector on its own.
const DEMO_DAILY_LIMIT_PER_IP = 3;

// Backstop across ALL anonymous demo callers combined, regardless of
// how many distinct IPs show up — see v1.2 note above.
const DEMO_DAILY_LIMIT_GLOBAL = 100;

const GLOBAL_KEY_PREFIX = 'demo-limit:global:';

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export interface DemoLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  // Which counter actually blocked the call, when allowed is false —
  // lets the tool handler give an accurate error message instead of
  // always blaming the per-IP quota.
  reason?: 'per_ip' | 'global';
}

// Increments a Redis counter and sets its UTC-midnight expiry on the
// first increment of the day. Shared helper for both the per-IP and
// the global counter — same pattern, different key.
async function incrementDailyCounter(key: string): Promise<number | null> {
  try {
    const used = await redis!.incr(key);
    if (used === 1) {
      await redis!.expire(key, secondsUntilUtcMidnight());
    }
    return used;
  } catch (e) {
    console.error(`[demo-limit] Redis error incrementing ${key}:`, (e as Error).message);
    return null;
  }
}

// clientIp should already be extracted by the caller (first hop of
// X-Forwarded-For) — this module doesn't know about NextRequest/headers,
// same separation of concerns as lib/rate-limit.ts vs lib/rate-limit-store.ts.
export async function checkDemoLimit(clientIp: string): Promise<DemoLimitResult> {
  if (!redis) {
    console.error('[demo-limit] Redis not configured, failing closed on anonymous demo calls.');
    return { allowed: false, used: 0, limit: DEMO_DAILY_LIMIT_PER_IP, reason: 'per_ip' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const perIpKey = `demo-limit:${clientIp}:${today}`;
  const globalKey = `${GLOBAL_KEY_PREFIX}${today}`;

  // Both counters increment on every call — even one that ends up
  // blocked by the OTHER limit — same "counters increment regardless
  // of what happens after" convention as lib/rate-limit.ts. Run in
  // parallel: they're independent keys, no ordering dependency.
  const [perIpUsed, globalUsed] = await Promise.all([
    incrementDailyCounter(perIpKey),
    incrementDailyCounter(globalKey),
  ]);

  // A Redis error on EITHER counter fails closed — same reasoning as
  // v1.1's "Redis not configured" case: an anonymous, unmetered surface
  // is the wrong place to fail open.
  if (perIpUsed === null || globalUsed === null) {
    return { allowed: false, used: 0, limit: DEMO_DAILY_LIMIT_PER_IP, reason: 'per_ip' };
  }

  if (globalUsed > DEMO_DAILY_LIMIT_GLOBAL) {
    return { allowed: false, used: globalUsed, limit: DEMO_DAILY_LIMIT_GLOBAL, reason: 'global' };
  }

  return {
    allowed: perIpUsed <= DEMO_DAILY_LIMIT_PER_IP,
    used: perIpUsed,
    limit: DEMO_DAILY_LIMIT_PER_IP,
    reason: perIpUsed > DEMO_DAILY_LIMIT_PER_IP ? 'per_ip' : undefined,
  };
}
