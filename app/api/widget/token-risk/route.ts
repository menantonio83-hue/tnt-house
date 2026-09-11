// Version 1.1 — app/api/widget/token-risk/route.ts
//
// v1.1 (M-8 fix): per-IP + global rate limits. Every call to this
// anonymous endpoint fans out to Helius with retries, so unmetered
// anonymous traffic could drain the RPC quota the whole site depends
// on. Fail CLOSED: a Redis blip takes the widget number down (the
// client falls back to RugCheck-derived values) rather than turning
// the endpoint into an unmetered proxy.
//
// Version 1.0 — app/api/widget/token-risk/route.ts
//
// Server-side route for the consumer "Check Token" widget's holder-
// concentration numbers (top10Percent, largestHolderPercent,
// holderCount). Previously the widget (app/page.js) fetched RugCheck's
// topHolders directly from the browser and summed pct values, with no
// server-side validation and no control over staleness. Observed live:
// RugCheck returned 243% top-10 concentration for a token right after
// a burn, while Solscan showed a correct, live ~46% at the same time.
//
// This route reuses the SAME Helius-backed calculation that already
// powers the paid Risk-Data API (lib/holder-distribution.ts, with its
// own stale-index retry logic and known-burn-wallet exclusion — see
// v6.17/v6.17b there), so the B2B API and the consumer widget agree on
// one number from one source, instead of two independently-computed
// figures that can silently diverge. RugCheck is still used by the
// widget for everything it uniquely provides (score, LP lock, risks,
// mint/freeze authority, tax) — only the holder-concentration math
// moves here.
//
// Even after holder-distribution.ts's own stale-retries, this route
// adds one more honest check before responding: an impossible (>100%)
// reading is never forwarded to the client as if it were real data —
// the widget gets a clear error and can show "data unavailable"
// instead of a number that cannot be true.
import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { getHolderDistributionRobust } from '@/lib/holder-distribution';
import {
  isHolderReadingUnusable,
  HOLDER_DATA_UNAVAILABLE_ERROR,
  HOLDER_DATA_UNAVAILABLE_MESSAGE,
} from '@/lib/holder-data-guard';

// v1.1: per-IP + global caps — see the v1.1 header note.
const CALLS_PER_IP_PER_HOUR = 30;
const CALLS_GLOBAL_PER_DAY = 1500;

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : null;

function extractClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}

async function withinLimit(
  ip: string,
): Promise<{ ok: boolean; reason?: 'per_ip' | 'global' | 'infra' }> {
  if (!redis) {
    console.error('[widget/token-risk] Redis not configured, failing closed.');
    return { ok: false, reason: 'infra' };
  }
  try {
    const hour = new Date().toISOString().slice(0, 13);
    const day = new Date().toISOString().slice(0, 10);
    const ipKey = `widget-token-risk:ip:${ip}:${hour}`;
    const globalKey = `widget-token-risk:global:${day}`;

    const [ipCount, globalCount] = await Promise.all([redis.incr(ipKey), redis.incr(globalKey)]);
    await Promise.all([
      ipCount === 1 ? redis.expire(ipKey, 3600) : Promise.resolve(),
      globalCount === 1 ? redis.expire(globalKey, 86400) : Promise.resolve(),
    ]);

    if (globalCount > CALLS_GLOBAL_PER_DAY) return { ok: false, reason: 'global' };
    if (ipCount > CALLS_PER_IP_PER_HOUR) return { ok: false, reason: 'per_ip' };
    return { ok: true };
  } catch (e) {
    console.error('[widget/token-risk] Redis error, failing closed:', (e as Error).message);
    return { ok: false, reason: 'infra' };
  }
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'address query param is required' }, { status: 400 });
  }

  const limit = await withinLimit(extractClientIp(request));
  if (!limit.ok) {
    if (limit.reason === 'infra') {
      return NextResponse.json(
        {
          error: 'holder_distribution_unavailable',
          message: 'Holder data is temporarily unavailable. Please try again shortly.',
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      {
        error: 'rate_limited',
        message: 'Too many holder-data requests from this connection. Please try again later.',
      },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const data = await getHolderDistributionRobust(address);

    // The impossible-value guard below catches readings that cannot be true
    // (>100%, NaN). It does NOT catch a FAILED reading: getHolderDistributionRobust
    // reports failure as riskLevel 'ERROR' with zeroed percentages, and zero is
    // both finite and <= 100, so it sailed through and this route answered 200
    // with top10Percent: 0. app/page.js then accepted it as authoritative —
    // `typeof data.top10Percent === 'number'` is true for 0 — and did not even
    // fall back to RugCheck. That is how a token with real concentration got
    // recorded as 0% concentrated. See lib/holder-data-guard.ts.
    if (isHolderReadingUnusable(data)) {
      console.error(
        `[widget/token-risk] ${address}: holder reading unusable (riskLevel=${data.riskLevel}), refusing to forward`,
      );
      return NextResponse.json(
        { error: HOLDER_DATA_UNAVAILABLE_ERROR, message: HOLDER_DATA_UNAVAILABLE_MESSAGE },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (
      !Number.isFinite(data.top10Percent) ||
      !Number.isFinite(data.largestHolderPercent) ||
      data.top10Percent > 100 ||
      data.largestHolderPercent > 100
    ) {
      console.warn(
        `[widget/token-risk] ${address}: refusing to forward impossible reading (top10=${data.top10Percent}, largest=${data.largestHolderPercent}) to client`,
      );
      return NextResponse.json({ error: 'invalid_holder_data' }, { status: 422 });
    }

    return NextResponse.json(
      { ...data, source: 'helius' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    console.error(`[widget/token-risk] ${address}: upstream failure — ${message}`);
    return NextResponse.json({ error: 'upstream_error', message }, { status: 502 });
  }
}
