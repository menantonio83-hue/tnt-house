// Version 1.0 — app/api/v1/webhooks/check/route.ts
//
// QStash scheduled target (scheduleId scd_611yNNY9v5VLG79bzzXE1R5Ucby2,
// cron */15 * * * *) — sweeps active webhook_subscriptions, re-scores
// each unique mint via the SAME fetchTokenRisk() the public token-risk
// endpoint uses, and detects a threshold CROSSING (not just "currently
// past threshold" — see hasCrossed() below) per subscription. On a
// crossing, publishes a signed delivery THROUGH QStash itself (not a
// direct fetch to callback_url) so QStash's own retry-with-backoff
// covers delivery failures — no custom retry logic lives here.
//
// Auth: verifySignatureAppRouter (from @upstash/qstash/nextjs) confirms
// this request genuinely came from QStash, using
// QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY — not a
// hand-rolled secret header.
//
// Duplicate-run protection: acquireCheckLock() (lib/webhook-lock.ts,
// Upstash Redis SETNX) — QStash is at-least-once delivery, so a retry
// or an overlapping invocation near the schedule boundary could
// otherwise run two sweeps concurrently and double-fire the same
// crossing (both reading the same pre-update last_checked_score before
// either writes theirs). Lock held for the whole sweep, released in
// `finally` so a thrown error still releases it.
//
// Same fan-out pattern as token-risk/batch/route.ts: everything scored
// via Promise.all + p-limit, never a sequential loop, to stay well
// inside the function's time budget regardless of how many mints are
// being watched.

import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import pLimit from 'p-limit';
import { fetchTokenRisk } from '@/lib/token-risk-core';
import { listActiveSubscriptions, updateAfterCheck, type WebhookSubscription } from '@/lib/webhook-store';
import { signWebhookHeader } from '@/lib/webhook-signature';
import { publishWebhookDelivery } from '@/lib/qstash-publish';
import { acquireCheckLock, releaseCheckLock } from '@/lib/webhook-lock';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const CONCURRENCY = 5;

// A subscription only fires the FIRST time it observes the score cross
// from the "wrong" side of the threshold to the "right" side —
// last_checked_score === null means this is the very first sweep that
// has ever seen this subscription, so there's no "previous side" to
// have crossed FROM yet; that sweep only establishes the baseline.
function hasCrossed(sub: WebhookSubscription, currentScore: number): boolean {
  if (sub.last_checked_score === null) return false;
  if (sub.condition === 'below') {
    return sub.last_checked_score >= sub.threshold && currentScore < sub.threshold;
  }
  return sub.last_checked_score <= sub.threshold && currentScore > sub.threshold;
}

async function handler(_request: NextRequest) {
  const startedAt = Date.now();
  const gotLock = await acquireCheckLock();
  if (!gotLock) {
    return NextResponse.json({ skipped: true, reason: 'another sweep is already in progress' });
  }

  try {
    const subscriptions = await listActiveSubscriptions();
    if (subscriptions.length === 0) {
      return NextResponse.json({ checked_mints: 0, checked_subscriptions: 0, triggered: 0 });
    }

    // Dedup: 5 subscriptions watching the same mint still only cost ONE
    // fetchTokenRisk() call this sweep, not 5.
    const uniqueMints = Array.from(new Set(subscriptions.map((s) => s.mint)));
    const scoreByMint = new Map<string, number>();
    const limit = pLimit(CONCURRENCY);

    await Promise.all(
      uniqueMints.map((mint) =>
        limit(async () => {
          try {
            const result = await fetchTokenRisk(mint);
            if (result.ok && typeof result.safety_score === 'number') {
              scoreByMint.set(mint, result.safety_score);
            }
          } catch (e: any) {
            console.error(`[webhooks/check] fetchTokenRisk failed for ${mint}:`, e.message);
          }
        }),
      ),
    );

    let triggered = 0;

    await Promise.all(
      subscriptions.map((sub) =>
        limit(async () => {
          const currentScore = scoreByMint.get(sub.mint);
          // This mint's score fetch failed this round — leave
          // last_checked_score untouched and just try again next sweep,
          // rather than recording a bogus baseline.
          if (currentScore === undefined) return;

          const crossed = hasCrossed(sub, currentScore);

          if (crossed) {
            triggered++;
            const nowIso = new Date().toISOString();
            const payload = {
              id: 'evt_' + Date.now().toString(16) + Math.random().toString(16).slice(2),
              object: 'webhook_event',
              api_version: 'v1',
              created: Math.floor(Date.now() / 1000),
              type: 'risk_score.threshold_crossed',
              data: {
                object: {
                  subscription_id: sub.id,
                  mint: sub.mint,
                  previous_score: sub.last_checked_score,
                  current_score: currentScore,
                  threshold: sub.threshold,
                  condition: sub.condition,
                  crossed_at: nowIso,
                },
              },
            };

            const signatureHeader = signWebhookHeader(sub.webhook_secret, payload);
            await publishWebhookDelivery(sub.callback_url, payload, {
              'X-Webhook-Signature': signatureHeader,
              'Content-Type': 'application/json',
            });
          }

          await updateAfterCheck(sub.id, currentScore, crossed);
        }),
      ),
    );

    return NextResponse.json({
      checked_mints: uniqueMints.length,
      checked_subscriptions: subscriptions.length,
      triggered,
      duration_ms: Date.now() - startedAt,
    });
  } catch (error: any) {
    console.error('[webhooks/check] sweep error:', error);
    return NextResponse.json({ error: 'Internal error', details: error.message }, { status: 500 });
  } finally {
    await releaseCheckLock();
  }
}

export const POST = verifySignatureAppRouter(handler);
