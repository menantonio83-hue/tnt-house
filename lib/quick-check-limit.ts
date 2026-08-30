// Version 1.0 — lib/quick-check-limit.ts
//
// Rate limit + paid credits for the new "Quick Check" product: a
// standalone token-safety lookup, separate from the existing
// listing/submission flow (app/page.js FREE_TOTAL=60, app/api/submit-audit).
// Quick Check never writes to `submissions` / `verified_tokens` — it is
// read-only and does not affect the public Listing table in any way.
//
// Pattern copied directly from the already-proven lib/demo-limit.ts
// (Risk-Data API's anonymous MCP demo limiter): same Redis database
// (KV_REST_API_URL / KV_REST_API_TOKEN), same atomic INCR + midnight-UTC
// expiry technique. Not reusing demo-limit.ts's own key namespace so
// the two products' counters never collide.
//
// Identity = IP + a random httpOnly fingerprint cookie set by the route
// on first request (see app/api/quick-check/route.js). Neither signal
// alone is reliable (IP: shared NAT/VPN; cookie: cleared by the user),
// combining them is a reasonable low-friction MVP — not bulletproof,
// deliberately not over-engineered per the "simple, no new auth system"
// instruction.
//
// Two independent counters per identity:
// - FREE: resets every UTC day, capped at FREE_DAILY_LIMIT (3)
// - CREDITS: paid balance, no expiry, only moves on purchase (add) or
//   consumption (spend) — completely separate key, never touched by
//   the daily free-counter reset.
//
// Fails CLOSED on free-tier checks (same reasoning as demo-limit.ts:
// an unmetered anonymous surface is the wrong place to fail open) but
// fails OPEN on reading credit balance for display purposes only
// (getQuickCheckStatus) — a Redis hiccup should not hide a balance the
// user already paid for, it should just block the *spend* operation,
// which independently fails closed inside spendCredit().

import { Redis } from '@upstash/redis';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

export const FREE_DAILY_LIMIT = 3;

// Same cost-protection reasoning as free-tier-global-pool.ts: bounds
// total upstream (Helius/DexScreener) cost from anonymous Quick Check
// traffic regardless of how many distinct identities show up.
const GLOBAL_FREE_DAILY_LIMIT = 300;

// Credit packages — prices are USD-equivalent, actual payment accepted
// in MRDT / SOL / USDC via the existing Solana Pay + verify-payment
// flow (app/api/verify-payment/route.js). Kept here as the single
// source of truth so the API route and any future UI agree.
export const CREDIT_PACKAGES = {
  '5': { checks: 5, usd: 1 },
  '25': { checks: 25, usd: 4 },
  '100': { checks: 100, usd: 10 },
} as const;

export type CreditPackageId = keyof typeof CREDIT_PACKAGES;

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function incrementDailyCounter(key: string): Promise<number | null> {
  try {
    const used = await redis!.incr(key);
    if (used === 1) {
      await redis!.expire(key, secondsUntilUtcMidnight());
    }
    return used;
  } catch (e) {
    console.error(`[quick-check-limit] Redis error incrementing ${key}:`, (e as Error).message);
    return null;
  }
}

export interface QuickCheckDecision {
  allowed: boolean;
  usedFreeToday: number;
  freeLimit: number;
  creditsRemaining: number;
  // Which bucket the call was actually charged against, or which
  // bucket blocked it when allowed is false.
  source: 'free' | 'credit' | 'blocked_free' | 'blocked_global' | 'blocked_no_credits' | 'blocked_infra';
}

// Call once per incoming request. Consumes either a free slot or one
// paid credit — never both, never neither if allowed is true.
export async function consumeQuickCheck(identity: string): Promise<QuickCheckDecision> {
  const creditsKey = `quick-check:credits:${identity}`;

  if (!redis) {
    console.error('[quick-check-limit] Redis not configured, failing closed.');
    return { allowed: false, usedFreeToday: 0, freeLimit: FREE_DAILY_LIMIT, creditsRemaining: 0, source: 'blocked_infra' };
  }

  const today = todayUtc();
  const freeKey = `quick-check:free:${identity}:${today}`;
  const globalKey = `quick-check:free:global:${today}`;

  const [freeUsed, globalUsed] = await Promise.all([
    incrementDailyCounter(freeKey),
    incrementDailyCounter(globalKey),
  ]);

  if (freeUsed === null || globalUsed === null) {
    return { allowed: false, usedFreeToday: 0, freeLimit: FREE_DAILY_LIMIT, creditsRemaining: 0, source: 'blocked_infra' };
  }

  // Global backstop takes priority — protects upstream cost regardless
  // of any individual identity's own remaining quota.
  if (globalUsed > GLOBAL_FREE_DAILY_LIMIT) {
    // Give back the free slot we just consumed for this identity,
    // since the call is being blocked for a reason unrelated to them.
    try { await redis.decr(freeKey); } catch { /* best-effort only */ }
    const credits = await getCreditsBalance(identity);
    if (credits > 0) {
      const spent = await spendCredit(identity);
      if (spent) {
        return { allowed: true, usedFreeToday: Math.max(0, freeUsed - 1), freeLimit: FREE_DAILY_LIMIT, creditsRemaining: credits - 1, source: 'credit' };
      }
    }
    return { allowed: false, usedFreeToday: Math.max(0, freeUsed - 1), freeLimit: FREE_DAILY_LIMIT, creditsRemaining: credits, source: 'blocked_global' };
  }

  if (freeUsed <= FREE_DAILY_LIMIT) {
    const credits = await getCreditsBalance(identity);
    return { allowed: true, usedFreeToday: freeUsed, freeLimit: FREE_DAILY_LIMIT, creditsRemaining: credits, source: 'free' };
  }

  // Free quota exhausted for today — fall back to paid credits.
  const credits = await getCreditsBalance(identity);
  if (credits > 0) {
    const spent = await spendCredit(identity);
    if (spent) {
      return { allowed: true, usedFreeToday: freeUsed, freeLimit: FREE_DAILY_LIMIT, creditsRemaining: credits - 1, source: 'credit' };
    }
  }

  return { allowed: false, usedFreeToday: freeUsed, freeLimit: FREE_DAILY_LIMIT, creditsRemaining: credits, source: 'blocked_no_credits' };

  async function getCreditsBalance(id: string): Promise<number> {
    try {
      const raw = await redis!.get<number>(creditsKey.replace(identity, id));
      return typeof raw === 'number' ? raw : 0;
    } catch (e) {
      console.error('[quick-check-limit] Redis error reading credits:', (e as Error).message);
      return 0;
    }
  }

  async function spendCredit(id: string): Promise<boolean> {
    try {
      const key = creditsKey.replace(identity, id);
      const remaining = await redis!.decr(key);
      if (remaining < 0) {
        // Compensate — never let the visible balance go negative.
        await redis!.incr(key);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[quick-check-limit] Redis error spending credit:', (e as Error).message);
      return false;
    }
  }
}

// Read-only status for rendering the UI (free slots left today, credit
// balance) WITHOUT consuming anything. Fails open (returns zeros) —
// display-only, the real enforcement happens in consumeQuickCheck.
export async function getQuickCheckStatus(identity: string): Promise<{ usedFreeToday: number; freeLimit: number; creditsRemaining: number }> {
  if (!redis) return { usedFreeToday: 0, freeLimit: FREE_DAILY_LIMIT, creditsRemaining: 0 };
  const today = todayUtc();
  const freeKey = `quick-check:free:${identity}:${today}`;
  const creditsKey = `quick-check:credits:${identity}`;
  try {
    const [usedRaw, creditsRaw] = await Promise.all([redis.get<number>(freeKey), redis.get<number>(creditsKey)]);
    return {
      usedFreeToday: typeof usedRaw === 'number' ? usedRaw : 0,
      freeLimit: FREE_DAILY_LIMIT,
      creditsRemaining: typeof creditsRaw === 'number' ? Math.max(0, creditsRaw) : 0,
    };
  } catch (e) {
    console.error('[quick-check-limit] Redis error reading status:', (e as Error).message);
    return { usedFreeToday: 0, freeLimit: FREE_DAILY_LIMIT, creditsRemaining: 0 };
  }
}

// Called after a payment is verified (see app/api/quick-check/credits/route.js).
// Adds the purchased package's check count to the identity's credit balance.
export async function addCredits(identity: string, packageId: CreditPackageId): Promise<number | null> {
  if (!redis) {
    console.error('[quick-check-limit] Redis not configured, cannot add credits.');
    return null;
  }
  const pkg = CREDIT_PACKAGES[packageId];
  if (!pkg) return null;
  const creditsKey = `quick-check:credits:${identity}`;
  try {
    return await redis.incrby(creditsKey, pkg.checks);
  } catch (e) {
    console.error('[quick-check-limit] Redis error adding credits:', (e as Error).message);
    return null;
  }
}
