// Version 1.0 — lib/demo-public-key-limit.ts
//
// One hardcoded, publicly-shared demo API key — a time-boxed growth
// experiment (Бро + Grok/GPT/DeepSeek/Gemini consensus, 2026-09-03),
// NOT a new permanent tier. Distinct from every other limiter in this
// codebase:
//   - lib/demo-limit.ts / lib/quick-check-limit.ts: anonymous, NO key,
//     reset every UTC day, forever-recurring.
//   - lib/mcp-anon-limit.ts: anonymous MCP calls, 5/day, resets daily.
//   - lib/rate-limit.ts: a REAL signed-up key's personal 15/day quota.
//   - THIS FILE: one single shared key, LIFETIME total budget, NEVER
//     resets. Once exhausted, dead forever — that finality is the
//     point (real scarcity/FOMO for an announcement post, not a
//     permanent free tier in disguise).
//
// Three layers, checked in this order:
//   1. Global pace lock — max 1 request / DEMO_PACE_SECONDS across the
//      WHOLE key, regardless of caller. A Redis SET NX EX lock, not a
//      counter — exists purely so one fast script can't burn the
//      entire lifetime budget in under a second before anyone else
//      gets a chance. Consumes no budget itself.
//   2. Per-identity cap (hash of IP + User-Agent) — DEMO_PER_IDENTITY_LIMIT
//      calls per identity, for the experiment's whole lifetime (there
//      is no "daily" here — the key may not survive a day). Keeps the
//      shared 300 spread across many distinct tries instead of one
//      caller claiming a big slice.
//   3. Global lifetime counter — DEMO_TOTAL_LIMIT calls total, ever.
//      Atomic INCR + compensate-on-overshoot (Upstash has no native
//      "increment if less than", so an overshoot decrements itself
//      back out — same technique as lib/quick-check-limit.ts).
//
// Route-level responsibility (app/api/v1/token-risk/route.ts), NOT this
// file: recognizing the demo key string itself, and wiring it into
// ONLY the single-mint token-risk endpoint. check_token_risk_batch,
// history, billing, webhooks, and admin routes must never special-case
// this key — an unrecognized Bearer token there just fails normal auth
// like any other invalid key, which is the desired lockout (demo key
// must be read-only, single-mint-only, no path to anything else).
//
// No TTL driving the reset (this experiment doesn't self-clean on a
// schedule — it ends when 300 is reached, full stop), but a generous
// 30-day safety-net TTL is set on both counters anyway so an abandoned
// experiment doesn't linger in Redis forever if nobody finishes
// burning it down.

import { createHash } from 'crypto';
import { Redis } from '@upstash/redis';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

export const DEMO_TOTAL_LIMIT = 300;
export const DEMO_PER_IDENTITY_LIMIT = 5;
const DEMO_PACE_SECONDS = 3;
const SAFETY_NET_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days, cleanup only — not a reset mechanism

const GLOBAL_KEY = 'demo-public:global';
const PACE_LOCK_KEY = 'demo-public:pace-lock';

// Exported so other funnel-tracking code (e.g. app/api/demo-cta/route.ts)
// can compute the SAME hash for the same IP+UA pair — lets a CTA click
// be cross-referenced against this identity's demo calls later, without
// this file needing to know anything about that other table.
export function hashIdentity(ip: string, userAgent: string): string {
  return createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').slice(0, 16);
}

function identityKey(ip: string, userAgent: string): string {
  return `demo-public:identity:${hashIdentity(ip, userAgent)}`;
}

// NOTE: deliberately a flat interface, NOT a discriminated union keyed
// on `allowed`. Same reasoning as lib/api-auth.ts's ApiKeyAuthResult:
// this project's tsconfig.json has "strict": false (strictNullChecks
// off), and under that setting TS's control-flow narrowing on
// boolean-literal discriminants is unreliable even for this exact
// textbook pattern. A flat interface with nullable fields sidesteps
// the issue entirely and is just as safe to consume.
export interface DemoPublicKeyDecision {
  allowed: boolean;
  reason: 'paced' | 'identity_exhausted' | 'global_exhausted' | 'infra_error' | null;
  globalRemaining: number;
  identityRemaining: number | null;
}

// Read-only peek, no side effects — used by the public site widget to
// display the live counter without spending a slot.
export async function peekDemoPublicKeyStatus(): Promise<{ globalUsed: number; globalRemaining: number }> {
  if (!redis) return { globalUsed: DEMO_TOTAL_LIMIT, globalRemaining: 0 };
  try {
    const used = (await redis.get<number>(GLOBAL_KEY)) ?? 0;
    return { globalUsed: used, globalRemaining: Math.max(0, DEMO_TOTAL_LIMIT - used) };
  } catch (e) {
    console.error('[demo-public-key-limit] Redis error peeking status:', (e as Error).message);
    return { globalUsed: DEMO_TOTAL_LIMIT, globalRemaining: 0 };
  }
}

// Call once per incoming request that presents the public demo key.
// Consumes a slot from BOTH the identity cap and the global lifetime
// budget only if fully allowed — an identity-ok-but-global-full call
// consumes nothing from either counter.
export async function consumeDemoPublicKey(ip: string, userAgent: string): Promise<DemoPublicKeyDecision> {
  if (!redis) {
    console.error('[demo-public-key-limit] Redis not configured, failing closed.');
    return { allowed: false, reason: 'infra_error', globalRemaining: 0, identityRemaining: null };
  }

  // 1. Pace lock — cheap global gate, checked first, consumes nothing.
  try {
    const acquired = await redis.set(PACE_LOCK_KEY, '1', { nx: true, ex: DEMO_PACE_SECONDS });
    if (acquired !== 'OK') {
      const { globalRemaining } = await peekDemoPublicKeyStatus();
      return { allowed: false, reason: 'paced', globalRemaining, identityRemaining: null };
    }
  } catch (e) {
    console.error('[demo-public-key-limit] Redis error on pace lock:', (e as Error).message);
    return { allowed: false, reason: 'infra_error', globalRemaining: 0, identityRemaining: null };
  }

  // 2. Per-identity cap — peek before touching the global counter, so a
  // caller who's already used their 5 never eats into the shared
  // budget just by trying again.
  const idKey = identityKey(ip, userAgent);
  let identityUsed: number;
  try {
    identityUsed = (await redis.get<number>(idKey)) ?? 0;
  } catch (e) {
    console.error('[demo-public-key-limit] Redis error reading identity usage:', (e as Error).message);
    return { allowed: false, reason: 'infra_error', globalRemaining: 0, identityRemaining: null };
  }

  if (identityUsed >= DEMO_PER_IDENTITY_LIMIT) {
    const { globalRemaining } = await peekDemoPublicKeyStatus();
    return { allowed: false, reason: 'identity_exhausted', globalRemaining, identityRemaining: 0 };
  }

  // 3. Global lifetime counter — atomic increment, compensate on overshoot.
  let globalUsed: number;
  try {
    globalUsed = await redis.incr(GLOBAL_KEY);
    if (globalUsed === 1) {
      await redis.expire(GLOBAL_KEY, SAFETY_NET_TTL_SECONDS);
    }
  } catch (e) {
    console.error('[demo-public-key-limit] Redis error incrementing global counter:', (e as Error).message);
    return { allowed: false, reason: 'infra_error', globalRemaining: 0, identityRemaining: null };
  }

  if (globalUsed > DEMO_TOTAL_LIMIT) {
    // Over budget — compensate the increment back out so the counter
    // never permanently overshoots past what was actually granted.
    try {
      await redis.decr(GLOBAL_KEY);
    } catch {
      /* best-effort only */
    }
    return { allowed: false, reason: 'global_exhausted', globalRemaining: 0, identityRemaining: null };
  }

  // Both checks passed — now spend the identity slot too.
  try {
    await redis.incr(idKey);
    await redis.expire(idKey, SAFETY_NET_TTL_SECONDS);
  } catch (e) {
    // Non-fatal — the call already succeeded against the global budget,
    // an identity-tracking hiccup shouldn't retroactively fail it.
    console.error('[demo-public-key-limit] Redis error incrementing identity usage:', (e as Error).message);
  }

  return {
    allowed: true,
    reason: null,
    globalRemaining: Math.max(0, DEMO_TOTAL_LIMIT - globalUsed),
    identityRemaining: Math.max(0, DEMO_PER_IDENTITY_LIMIT - (identityUsed + 1)),
  };
}
