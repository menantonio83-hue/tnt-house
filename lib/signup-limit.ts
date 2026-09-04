// Version 1.0 — lib/signup-limit.ts
//
// Abuse guard for POST /api/v1/signup — the endpoint has no email
// verification by design (see that route's header: self-serve, bot-
// friendly, key returned directly in the JSON response). That's a
// deliberate product decision, but it means the ONLY thing standing
// between "one legitimate free key" and "a script mints 100 keys/min
// with fake emails for 1500 free calls/day" was the per-email dedup
// check — which does nothing against an attacker who controls the
// email string. This file closes that gap without touching the
// no-verification, no-human-required signup flow itself.
//
// Same two-layer shape as lib/demo-limit.ts (per-IP + global backstop),
// same reasoning: per-IP alone doesn't stop someone who actually wants
// to abuse this, since rotating real IPs (VPN, mobile NAT, cloud
// instances) is trivial and each one gets its own fresh allowance. The
// global cap bounds worst-case free-key issuance for the whole service
// per day, no matter how many distinct IPs show up.
//
// Deliberately NOT a browser/device fingerprint. A signup is a raw
// server-to-server POST (that's the whole point — bots must be able to
// self-serve with no browser involved at all), so there's no JS
// execution context to fingerprint, and a scripted caller fully
// controls every header it sends (User-Agent included) — keying on
// anything the attacker controls just adds fake friction without real
// protection. IP is the one signal a scripted attacker can't rewrite,
// only rotate at a real (much higher) cost.
//
// Same Redis database as lib/demo-limit.ts / lib/mcp-anon-limit.ts
// (KV_REST_API_URL / KV_REST_API_TOKEN), separate key namespace
// ("signup-limit:") so none of the three counters can collide.
//
// FAIL-CLOSED — same reasoning as lib/demo-limit.ts: an endpoint that
// mints new billable-cost API keys is not a place to fail open just
// because Redis had a bad moment. If Redis is unreachable, signup is
// blocked (a real inconvenience for the rare legitimate caller hitting
// that exact window) rather than silently reverting to unlimited free
// key issuance.

import { Redis } from '@upstash/redis';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

// Generous for a real person/team signing up (and retrying a typo'd
// email, or one person on a shared office/CGNAT IP signing up a
// teammate too) while making "spin up N keys from one machine" cost
// real IP-rotation effort instead of being free.
const SIGNUP_LIMIT_PER_IP = 3;

// Backstop across ALL signups combined regardless of how many distinct
// IPs show up — bounds worst-case free-key issuance (and the resulting
// 15/day-per-key upstream call cost) for the whole service per day.
const SIGNUP_LIMIT_GLOBAL = 50;

const GLOBAL_KEY_PREFIX = 'signup-limit:global:';

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export interface SignupLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  // Which counter actually blocked the call, when allowed is false —
  // lets the route give an accurate error message instead of always
  // blaming the per-IP quota.
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
    console.error(`[signup-limit] Redis error incrementing ${key}:`, (e as Error).message);
    return null;
  }
}

// clientIp should already be extracted by the caller (first hop of
// X-Forwarded-For) — this module doesn't know about NextRequest/headers,
// same separation of concerns as lib/demo-limit.ts.
export async function checkSignupLimit(clientIp: string): Promise<SignupLimitResult> {
  if (!redis) {
    console.error('[signup-limit] Redis not configured, failing closed on signup.');
    return { allowed: false, used: 0, limit: SIGNUP_LIMIT_PER_IP, reason: 'per_ip' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const perIpKey = `signup-limit:${clientIp}:${today}`;
  const globalKey = `${GLOBAL_KEY_PREFIX}${today}`;

  // Both counters increment on every attempt — even one that ends up
  // blocked by the OTHER limit, or by the pre-existing per-email dedup
  // check further down the route — same "counters increment regardless
  // of what happens after" convention as lib/demo-limit.ts. Run in
  // parallel: they're independent keys, no ordering dependency.
  const [perIpUsed, globalUsed] = await Promise.all([
    incrementDailyCounter(perIpKey),
    incrementDailyCounter(globalKey),
  ]);

  // A Redis error on EITHER counter fails closed — minting free API
  // keys is not the place to guess and fail open.
  if (perIpUsed === null || globalUsed === null) {
    return { allowed: false, used: 0, limit: SIGNUP_LIMIT_PER_IP, reason: 'per_ip' };
  }

  if (globalUsed > SIGNUP_LIMIT_GLOBAL) {
    return { allowed: false, used: globalUsed, limit: SIGNUP_LIMIT_GLOBAL, reason: 'global' };
  }

  return {
    allowed: perIpUsed <= SIGNUP_LIMIT_PER_IP,
    used: perIpUsed,
    limit: SIGNUP_LIMIT_PER_IP,
    reason: perIpUsed > SIGNUP_LIMIT_PER_IP ? 'per_ip' : undefined,
  };
}
