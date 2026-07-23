// Version 1.0 — app/api/v1/token-risk/batch/route.ts
//
// POST /api/v1/token-risk/batch
// Header: Authorization: Bearer <api_key>
// Body:   { "mints": ["<mint_1>", "<mint_2>", ...] }   (1-25 items)
//
// Billing model (explicitly decided by the project owner, NOT a
// technical default — see lib/rate-limit.ts v3.6's enforceRateLimitBatch
// comment): N mints in one request = N calls charged, same per-call
// economics as the single-mint endpoint. No bulk discount.
//
// MAX_BATCH_SIZE = 25, also explicitly decided (owner's own reasoning:
// without a hard cap, one request with thousands of mints could hold
// the function's RPC/upstream budget open for tens of seconds and look
// like abuse regardless of intent). All mints in a batch are fetched
// concurrently (Promise.all over the same fetchTokenRisk() the
// single-mint route uses), so total latency is close to the single
// slowest mint in the batch, not the sum of all of them — but 25
// concurrent upstream calls is still a meaningful spike against the
// free public Solana RPC / DexScreener, hence the cap.
//
// All-or-nothing on rate limiting: if the batch can't be fully covered
// by remaining free quota + credit balance, the WHOLE batch is blocked
// with a single 402 — never partially processed (which would mean
// charging for some mints while silently dropping others).
//
// Does NOT require new database tables — reuses api_key_usage_daily,
// api_keys.subscription_cycle_calls_used, and api_key_usage's
// credit_balance_usd exactly as the single-mint endpoint does, just
// incremented/decremented by N instead of 1 (see lib/rate-limit.ts
// v3.6, lib/rate-limit-store.ts v6.5, lib/billing-store.ts v7.15 — each
// needs one new SQL function, listed in their own header comments).
//
// NOT YET MERGED TO main / NOT YET LIVE: this is billing-adjacent code
// (changes exactly how credits get deducted), so per the project's
// standing payment-code rule it waits for the owner's explicit "OK"
// after review, even though it's fully tested (tsc + build clean, see
// this feature's commit message for the isolated test run).

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { requireApiKey } from '@/lib/api-auth';
import { enforceRateLimitBatch } from '@/lib/rate-limit';
import { logApiRequest } from '@/lib/request-logger';
import { fetchTokenRisk } from '@/lib/token-risk-core';

// Same 60s ceiling as the single-mint route — a batch of 25 concurrent
// fetchTokenRisk() calls has the same worst-case per-item budget
// (~32s for a slow holder-distribution retry cycle), run in PARALLEL
// via Promise.all, not sequentially, so the batch as a whole shouldn't
// take meaningfully longer than the single slowest mint in it.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MAX_BATCH_SIZE = 25;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let keyId: string | null = null;
  let mintCount: number | null = null;

  function logBatch(statusCode: number, error: string | null): void {
    waitUntil(
      logApiRequest({
        keyId,
        mint: mintCount !== null ? `batch:${mintCount}` : 'batch',
        statusCode,
        responseTimeMs: Date.now() - startedAt,
        error,
      }),
    );
  }

  try {
    // 0. Auth first — before touching the request body or any upstream call.
    const auth = await requireApiKey(request, CORS_HEADERS);
    if (!auth.ok || !auth.key) {
      logBatch(401, 'unauthorized');
      return auth.response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
    }
    keyId = auth.key.id;

    // 1. Parse + validate the body shape before spending anything on rate
    // limiting or upstream calls — a malformed request shouldn't cost
    // the caller a call.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logBatch(400, 'invalid_json');
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400, headers: CORS_HEADERS });
    }

    const mints = (body as { mints?: unknown } | null)?.mints;

    if (!Array.isArray(mints) || mints.length === 0) {
      logBatch(400, 'missing_mints');
      return NextResponse.json(
        { error: 'Request body must include a non-empty "mints" array' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (mints.length > MAX_BATCH_SIZE) {
      logBatch(400, 'batch_too_large');
      return NextResponse.json(
        { error: `Batch too large: ${mints.length} mints requested, ${MAX_BATCH_SIZE} max per request` },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (!mints.every((m) => typeof m === 'string' && m.length > 0)) {
      logBatch(400, 'invalid_mints_array');
      return NextResponse.json(
        { error: '"mints" must be an array of non-empty strings' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const mintList = mints as string[];
    mintCount = mintList.length;

    // 2. Rate limit — charges N calls (one per mint), atomically, before
    // any upstream work happens. All-or-nothing: either the whole batch
    // is allowed, or none of it runs.
    const rateLimit = await enforceRateLimitBatch(auth.key, mintList.length, CORS_HEADERS);
    if (!rateLimit.allowed) {
      logBatch(402, 'rate_limited');
      return (
        rateLimit.response ?? NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: CORS_HEADERS })
      );
    }

    const rateLimitHeaders: Record<string, string> = { ...CORS_HEADERS, 'X-RateLimit-Reset': rateLimit.resetAt };
    if (rateLimit.limit !== null) {
      rateLimitHeaders['X-RateLimit-Limit'] = String(rateLimit.limit);
      rateLimitHeaders['X-RateLimit-Remaining'] = String(rateLimit.remaining ?? 0);
    }
    if (rateLimit.creditBalanceUsd !== null) {
      rateLimitHeaders['X-Credit-Balance-Usd'] = rateLimit.creditBalanceUsd.toFixed(4);
    }

    // 3. Fetch every mint concurrently — fetchTokenRisk() never throws,
    // every failure mode (bad address, upstream error) resolves to a
    // { ok: false, ... } result, so one bad mint in the batch can't
    // abort the others.
    const results = await Promise.all(mintList.map((mint) => fetchTokenRisk(mint)));

    // Fire-and-forget per-mint logging — same analytics granularity as
    // the single-mint endpoint (which mints get queried, error rates),
    // just N rows from one HTTP call instead of one.
    for (const result of results) {
      waitUntil(
        logApiRequest({
          keyId,
          mint: result.mint,
          statusCode: result.ok ? 200 : result.status ?? 502,
          safetyScore: result.ok ? result.safety_score ?? null : null,
          clusterAnalysis: result.ok ? result.cluster_analysis ?? null : null,
          responseTimeMs: Date.now() - startedAt,
          error: result.ok ? null : result.error ?? 'unknown_error',
        }),
      );
    }

    return NextResponse.json(
      {
        results: results.map((result) =>
          result.ok
            ? {
                ok: true,
                mint: result.mint,
                safety_score: result.safety_score,
                cluster_analysis: result.cluster_analysis,
                insider_clusters: result.insider_clusters,
                mint_authority: result.mint_authority,
                freeze_authority: result.freeze_authority,
                honeypot_risk: result.honeypot_risk,
                lp_locked: result.lp_locked,
                holder_distribution: result.holder_distribution,
                market: result.market,
                note: result.note,
                checked_at: result.checked_at,
              }
            : {
                ok: false,
                mint: result.mint,
                error: result.error,
                ...(result.details ? { details: result.details } : {}),
              },
        ),
        batch_size: mintList.length,
        charged_calls: mintList.length,
      },
      { headers: rateLimitHeaders },
    );
  } catch (error: any) {
    console.error('[token-risk/batch] API error:', error);
    logBatch(500, error.message);
    return NextResponse.json({ error: 'Internal error', details: error.message }, { status: 500, headers: CORS_HEADERS });
  }
}
