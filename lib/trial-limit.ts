// Version 1.0 — lib/trial-limit.ts
//
// H-2 fix: per-IP + global daily limits for the anonymous "try it now"
// trial (POST /api/v1/trial/check). Replaces the client-supplied browser
// fingerprint as the quota identity: a fingerprint is generated in the
// browser, so rotating it costs an attacker nothing and used to mint a
// fresh 3-call quota per rotation — with no ceiling at all on total
// daily upstream cost (every trial call runs the full fetchTokenRisk
// fan-out: Helius + DexScreener + RugCheck).
//
// Same shape as lib/demo-limit.ts (per-IP daily + global daily counters
// in Redis, both expiring at UTC midnight, fail-closed), separate key
// namespace ("trial-limit:") so the trial funnel and the REST/MCP demo
// paths never share or double-count a bucket.
//
// Vercel overwrites x-forwarded-for with the real client IP, so the
// per-IP bucket cannot be spoofed by header forgery; the global ceiling
// is the backstop for real IP rotation (VPN / mobile NAT / cloud
// instances). Whichever cap is hit first blocks the call, and the
// result carries the reason so the route can phrase the upsell
// accurately.
//
// FAIL-CLOSED: an unmetered anonymous surface is the wrong place to
// fail open. A Redis outage blocks only this trial path — a real API
// key (lib/rate-limit.ts) is a separate code path and is unaffected.

import { Redis } from '@upstash/redis';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

// Matches the old fingerprint quota: enough for one person to see a
// real result and try a second/third mint, not a free scraping vector.
export const ANON_TRIAL_LIMIT = 3;

// Backstop across ALL anonymous trial callers combined, regardless of
// how many distinct IPs show up. Kept in the same ballpark as the
// site's other anonymous full-audit surfaces (quick-check and
// listed-tokens/audit both cap at 300/day globally).
const TRIAL_DAILY_LIMIT_GLOBAL = 200;

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export interface TrialLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  // Which counter decided the call: 'per_ip' and 'global' when blocked,
  // 'infra' when Redis is unavailable (fail closed), 'ok' when allowed.
  reason: 'ok' | 'per_ip' | 'global' | 'infra';
}

async function incrementDailyCounter(key: string): Promise<number | null> {
  try {
    const used = await redis!.incr(key);
    if (used === 1) {
      await redis!.expire(key, secondsUntilUtcMidnight());
    }
    return used;
  } catch (e) {
    console.error(`[trial-limit] Redis error incrementing ${key}:`, (e as Error).message);
    return null;
  }
}

// clientIp should already be extracted by the caller (first hop of
// x-forwarded-for) — this module doesn't know about NextRequest/headers,
// same separation of concerns as lib/demo-limit.ts.
export async function checkTrialLimit(clientIp: string): Promise<TrialLimitResult> {
  if (!redis) {
    console.error('[trial-limit] Redis not configured, failing closed on anonymous trial calls.');
    return { allowed: false, used: 0, limit: ANON_TRIAL_LIMIT, reason: 'infra' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const perIpKey = `trial-limit:${clientIp}:${today}`;
  const globalKey = `trial-limit:global:${today}`;

  // Both counters increment on every call — even one that ends up
  // blocked by the other limit — same "counters move regardless of
  // what happens after" convention as lib/rate-limit.ts.
  const [perIpUsed, globalUsed] = await Promise.all([
    incrementDailyCounter(perIpKey),
    incrementDailyCounter(globalKey),
  ]);

  if (perIpUsed === null || globalUsed === null) {
    return { allowed: false, used: 0, limit: ANON_TRIAL_LIMIT, reason: 'infra' };
  }

  if (globalUsed > TRIAL_DAILY_LIMIT_GLOBAL) {
    return { allowed: false, used: globalUsed, limit: TRIAL_DAILY_LIMIT_GLOBAL, reason: 'global' };
  }

  if (perIpUsed > ANON_TRIAL_LIMIT) {
    return { allowed: false, used: perIpUsed, limit: ANON_TRIAL_LIMIT, reason: 'per_ip' };
  }

  return { allowed: true, used: perIpUsed, limit: ANON_TRIAL_LIMIT, reason: 'ok' };
}
