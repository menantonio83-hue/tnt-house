// Version 1.0 — lib/demo-limit.ts
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
// Reuses the same Upstash Redis credentials as lib/webhook-lock.ts /
// lib/funder-cache.ts (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)
// — same database, separate key namespace ("demo-limit:").
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
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Small on purpose: enough for one person to see ONE real response and
// believe the product works (and try a second/third mint if curious),
// not enough to matter as a free scraping vector. Per-IP, not global,
// so one bad actor can't burn every stranger's demo allowance for the
// whole day.
const DEMO_DAILY_LIMIT_PER_IP = 3;

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export interface DemoLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
}

// clientIp should already be extracted by the caller (first hop of
// X-Forwarded-For) — this module doesn't know about NextRequest/headers,
// same separation of concerns as lib/rate-limit.ts vs lib/rate-limit-store.ts.
export async function checkDemoLimit(clientIp: string): Promise<DemoLimitResult> {
  if (!redis) {
    console.error('[demo-limit] Redis not configured, failing closed on anonymous demo calls.');
    return { allowed: false, used: 0, limit: DEMO_DAILY_LIMIT_PER_IP };
  }

  const key = `demo-limit:${clientIp}:${new Date().toISOString().slice(0, 10)}`;

  try {
    const used = await redis.incr(key);
    if (used === 1) {
      // Only set the expiry on the FIRST increment of the day for this
      // IP — re-setting it on every call would keep pushing the window
      // out and the counter would never actually reset at UTC midnight.
      await redis.expire(key, secondsUntilUtcMidnight());
    }
    return { allowed: used <= DEMO_DAILY_LIMIT_PER_IP, used, limit: DEMO_DAILY_LIMIT_PER_IP };
  } catch (e) {
    console.error('[demo-limit] Redis error, failing closed:', (e as Error).message);
    return { allowed: false, used: 0, limit: DEMO_DAILY_LIMIT_PER_IP };
  }
}
