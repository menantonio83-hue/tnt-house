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

function graceKey(mint: string): string {
  return `x402-pending-grace:${mint}`;
}

// Checked BEFORE the payment challenge — if true, the caller skips
// verify/settle entirely for this request.
export async function hasPendingGrace(mint: string): Promise<boolean> {
  if (!redis) return false; // fail closed — no Redis means no free rides
  try {
    const exists = await redis.get(graceKey(mint));
    return exists !== null;
  } catch (e) {
    console.error('[x402/pending-grace] Redis error reading grace state:', (e as Error).message);
    return false;
  }
}

// Called AFTER a successful, PAID call whose result came back pending —
// opens the free-repoll window for this mint.
export async function grantPendingGrace(mint: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(graceKey(mint), '1', { ex: GRACE_TTL_SECONDS });
  } catch (e) {
    console.error('[x402/pending-grace] Redis error granting grace:', (e as Error).message);
  }
}
