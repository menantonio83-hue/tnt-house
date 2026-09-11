// Version 1.1 — lib/x402/pending-grace.ts
//
// v1.1 (M-4 fix): the grace window is no longer an unlimited free
// ride. The 3-minute mint-scoped window stays (see v1.0 below for why
// it exists), but every free re-poll now consumes a budget:
//
//   * GRACE_CALLS_PER_MINT — max free re-polls per mint per window, so
//     one paid call funds at most a handful of polls for THAT mint
//     (which is all a poll-until-complete loop legitimately needs).
//   * GRACE_GLOBAL_DAILY_LIMIT — hard daily ceiling across ALL mints,
//     the backstop for the "one paid call, then hammer every mint in
//     pending state" pattern. Whichever is hit first ends the free ride
//     and the caller is challenged with a normal 402.
//
// Version 1.0 — lib/x402/pending-grace.ts
//
// Fixes a real gap surfaced publicly in an X thread (@greenalien_gt /
// @RiskDataApiSol, 2026-09-03): a mint's first-ever check returns
// cluster_analysis: 'pending' (the full insider-cluster trace runs in
// the background, ~1-2 min) — but the x402 route settled payment
// unconditionally on ANY successful result, pending or not. A caller
// polling the same mint again a few seconds later to see if it had
// resolved paid AGAIN for what is functionally the same job still in
// flight. "The job should be one payment" — a poll-until-complete
// loop shouldn't 402 repeatedly.
//
// Mechanism: after a call that genuinely triggers and pays for a
// pending result, grant a short-lived, mint-scoped grace window (not
// tied to a specific payer — x402 has no session/identity to tie it
// to, and since the compute is already running in the background
// regardless of who asks, letting ANY caller poll that specific mint
// for free during the window costs us nothing extra). TTL is 3
// minutes — comfortably covers the "~1-2 min" background enrichment
// window with margin, then reverts to normal paid access.
//
// Deliberately NOT granted for an already-'complete' result — there's
// no "still computing" story there, so no reason to waive payment.

import { Redis } from '@upstash/redis';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

const GRACE_TTL_SECONDS = 180; // 3 minutes

// v1.1: free re-poll budgets (see header).
const GRACE_CALLS_PER_MINT = 5;
const GRACE_GLOBAL_DAILY_LIMIT = 200;

function graceKey(mint: string): string {
  return `x402-pending-grace:${mint}`;
}

function graceCallsKey(mint: string): string {
  return `x402-pending-grace:calls:${mint}`;
}

function graceGlobalKey(): string {
  return `x402-pending-grace:global:${new Date().toISOString().slice(0, 10)}`;
}

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

// Checked BEFORE the payment challenge — if true, the caller skips
// verify/settle entirely for this request. Each true consumes one
// free re-poll from the mint's and the day's grace budgets (v1.1).
export async function consumePendingGrace(mint: string): Promise<boolean> {
  if (!redis) return false; // fail closed — no Redis means no free rides

  try {
    const active = await redis.get(graceKey(mint));
    if (active === null) return false;

    const globalKey = graceGlobalKey();
    const [perMint, global] = await Promise.all([
      redis.incr(graceCallsKey(mint)),
      redis.incr(globalKey),
    ]);

    await Promise.all([
      perMint === 1 ? redis.expire(graceCallsKey(mint), GRACE_TTL_SECONDS) : Promise.resolve(),
      global === 1 ? redis.expire(globalKey, secondsUntilUtcMidnight()) : Promise.resolve(),
    ]);

    if (global > GRACE_GLOBAL_DAILY_LIMIT) return false;
    return perMint <= GRACE_CALLS_PER_MINT;
  } catch (e) {
    console.error('[x402/pending-grace] Redis error consuming grace:', (e as Error).message);
    return false;
  }
}

// Called AFTER a successful, PAID call whose result came back pending —
// opens the free-repoll window for this mint and resets its per-mint
// re-poll budget (v1.1).
export async function grantPendingGrace(mint: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(graceKey(mint), '1', { ex: GRACE_TTL_SECONDS });
    // Best-effort reset: a NEW paid pending call re-opens the window,
    // so a fresh budget for the new window is the right semantics.
    await redis.del(graceCallsKey(mint));
  } catch (e) {
    console.error('[x402/pending-grace] Redis error granting grace:', (e as Error).message);
  }
}
