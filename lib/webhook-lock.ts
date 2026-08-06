// Version 1.1 — lib/webhook-lock.ts
//
// v1.1: FIXED WRONG ENV VAR NAMES — was checking
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, which were never
// actually set on this project. The real integration (connected Aug 1)
// is "Vercel KV", exposing KV_REST_API_URL / KV_REST_API_TOKEN instead
// (same REST protocol, different product naming) — see
// lib/funder-cache.ts v1.2 for the full discovery story. This lock was
// fail-open, so the wrong names never crashed anything; the mutex had
// just silently never been active (every sweep proceeded as if it
// always won the lock, i.e. exactly the pre-lock behavior this file
// was written to fix). Not believed to have caused a real duplicate
// delivery in practice — 15-minute cron ticks rarely overlap — but
// worth having actually working now that it costs nothing to fix.
//
// Tiny Redis-backed mutex for app/api/v1/webhooks/check/route.ts. QStash
// guarantees AT-LEAST-once delivery of its scheduled invocation — a
// retry (or two invocations overlapping near the 15-min schedule
// boundary) could otherwise run the whole subscription sweep twice in
// parallel. Since each run reads a subscription's last_checked_score
// BEFORE writing its own update, two concurrent runs could both observe
// the same pre-crossing score and both fire the same webhook — a real
// duplicate-delivery bug, not a theoretical one.
//
// Reuses the same Redis credentials as lib/funder-cache.ts
// (KV_REST_API_URL / KV_REST_API_TOKEN) — same database, separate key
// namespace. FAIL-OPEN if Redis isn't reachable for any reason:
// acquireCheckLock() returns true (proceeds without the lock) rather
// than silently skipping every scheduled sweep forever because of an
// infra hiccup. A missed lock in that rare window trades a small
// chance of one duplicate notification for never going fully silent —
// the better failure mode for a monitoring feature.

import { Redis } from '@upstash/redis';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

const LOCK_KEY = 'webhook-check:lock';
// Longer than the expected sweep duration (well under the 60s function
// budget in practice) so a crashed/timed-out run self-clears instead of
// jamming every future sweep forever.
const LOCK_TTL_SECONDS = 90;

export async function acquireCheckLock(): Promise<boolean> {
  if (!redis) return true; // fail-open — see header
  try {
    const result = await redis.set(LOCK_KEY, Date.now().toString(), { nx: true, ex: LOCK_TTL_SECONDS });
    return result === 'OK';
  } catch (e) {
    console.error('[webhook-lock] acquire error, proceeding without lock:', (e as Error).message);
    return true;
  }
}

export async function releaseCheckLock(): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(LOCK_KEY);
  } catch (e) {
    console.error('[webhook-lock] release error (lock will self-expire):', (e as Error).message);
  }
}
