// Version 1.2 — lib/quick-check-limit.ts
//
// v1.2 (2026-09-11): split "identity" into two separate concepts that
// v1.1 conflated into one string (`${ip}:${fp}`):
//
//   ABUSE IDENTITY (ip + fingerprint) — still governs the free daily
//   counter and the global daily counter. Losing this on an IP change
//   costs nothing real; it exists only to make the free tier annoying
//   to script, and IP is a useful signal for exactly that.
//
//   CREDIT IDENTITY (fingerprint alone) — now governs the paid credit
//   balance. Credits are money the person already spent; tying them to
//   an IP as well meant a mobile visitor who switched from wifi to
//   cellular between "buy" and "spend" could lose access to credits
//   they paid for. The fingerprint cookie is httpOnly with a one-year
//   Max-Age and does not change with network conditions, which IP does
//   constantly on mobile.
//
// KNOWN LIMITATION, stated rather than hidden: this does not solve
// credit recovery after a cleared cookie or a new device — there is no
// account system here, so the fingerprint IS the identity, full stop.
// What it fixes is the much more common case (network switching), not
// the rarer deliberate one.
//
// MIGRATION NOTE: before this version, credits were purchased AND spent
// under an ip:fp key. After this deploy, spending happens under an
// fp-only key. Any real balance that existed under the old ip:fp key
// becomes unreachable through the app - it is still sitting in Redis
// under its old key, just no longer read from. Checked before shipping
// this: the only purchase path (the since-deleted
// app/api/quick-check/credits/route.js) recorded nothing anywhere
// checkable from here, and site_orders - the new purchase path - has
// zero rows, meaning no purchase has gone through that ledger yet.
// Whether anyone completed a purchase through the OLD endpoint before
// today cannot be confirmed from this session: Redis is not queryable
// here, and Vercel's runtime-log retention on this plan does not reach
// back far enough to check. If a real balance turns out to exist under
// an old ip:fp key, it needs a one-time manual credit (addCredits with
// the affected fp) - the old key itself is undamaged, only unreachable.
//
// Version 1.1 — lib/quick-check-limit.ts
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
export async function consumeQuickCheck(
  abuseIdentity: string,
  creditIdentity: string,
): Promise<QuickCheckDecision> {
  const creditsKey = `quick-check:credits:${creditIdentity}`;

  if (!redis) {
    console.error('[quick-check-limit] Redis not configured, failing closed.');
    return { allowed: false, usedFreeToday: 0, freeLimit: FREE_DAILY_LIMIT, creditsRemaining: 0, source: 'blocked_infra' };
  }

  const today = todayUtc();
  const freeKey = `quick-check:free:${abuseIdentity}:${today}`;
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
    const credits = await getCreditsBalance();
    if (credits > 0) {
      const spent = await spendCredit();
      if (spent) {
        return { allowed: true, usedFreeToday: Math.max(0, freeUsed - 1), freeLimit: FREE_DAILY_LIMIT, creditsRemaining: credits - 1, source: 'credit' };
      }
    }
    return { allowed: false, usedFreeToday: Math.max(0, freeUsed - 1), freeLimit: FREE_DAILY_LIMIT, creditsRemaining: credits, source: 'blocked_global' };
  }

  if (freeUsed <= FREE_DAILY_LIMIT) {
    const credits = await getCreditsBalance();
    return { allowed: true, usedFreeToday: freeUsed, freeLimit: FREE_DAILY_LIMIT, creditsRemaining: credits, source: 'free' };
  }

  // Free quota exhausted for today — fall back to paid credits.
  const credits = await getCreditsBalance();
  if (credits > 0) {
    const spent = await spendCredit();
    if (spent) {
      return { allowed: true, usedFreeToday: freeUsed, freeLimit: FREE_DAILY_LIMIT, creditsRemaining: credits - 1, source: 'credit' };
    }
  }

  return { allowed: false, usedFreeToday: freeUsed, freeLimit: FREE_DAILY_LIMIT, creditsRemaining: credits, source: 'blocked_no_credits' };

  async function getCreditsBalance(): Promise<number> {
    try {
      const raw = await redis!.get<number>(creditsKey);
      return typeof raw === 'number' ? raw : 0;
    } catch (e) {
      console.error('[quick-check-limit] Redis error reading credits:', (e as Error).message);
      return 0;
    }
  }

  async function spendCredit(): Promise<boolean> {
    try {
      const remaining = await redis!.decr(creditsKey);
      if (remaining < 0) {
        // Compensate — never let the visible balance go negative.
        await redis!.incr(creditsKey);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[quick-check-limit] Redis error spending credit:', (e as Error).message);
      return false;
    }
  }
}

// Returns a slot or credit that was consumed for a request which then failed
// for a reason outside the user's control — specifically a Solana RPC outage,
// where performFullAudit now hard-fails instead of fabricating a score (see
// lib/helius-client.js). The slot is consumed before the audit runs, so
// without this the user would lose a check to our own infrastructure.
//
// Best-effort by design: a failed refund must never break the error response
// the user is already receiving.
//
// The GLOBAL daily counter is deliberately NOT refunded — it exists to cap
// upstream RPC cost, and a failed call (three attempts with backoff) still
// consumed that cost.
export async function refundQuickCheck(
  abuseIdentity: string,
  creditIdentity: string,
  source: QuickCheckDecision['source'],
): Promise<void> {
  if (!redis) return;

  try {
    if (source === 'free') {
      await redis.decr(`quick-check:free:${abuseIdentity}:${todayUtc()}`);
    } else if (source === 'credit') {
      await redis.incr(`quick-check:credits:${creditIdentity}`);
    }
  } catch (e) {
    console.error(
      `[quick-check-limit] Refund failed (abuse=${abuseIdentity}, credit=${creditIdentity}):`,
      (e as Error).message,
    );
  }
}

// Read-only status for rendering the UI (free slots left today, credit
// balance) WITHOUT consuming anything. Fails open (returns zeros) —
// display-only, the real enforcement happens in consumeQuickCheck.
export async function getQuickCheckStatus(
  abuseIdentity: string,
  creditIdentity: string,
): Promise<{ usedFreeToday: number; freeLimit: number; creditsRemaining: number }> {
  if (!redis) return { usedFreeToday: 0, freeLimit: FREE_DAILY_LIMIT, creditsRemaining: 0 };
  const today = todayUtc();
  const freeKey = `quick-check:free:${abuseIdentity}:${today}`;
  const creditsKey = `quick-check:credits:${creditIdentity}`;
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
