// Version 1.0 — app/api/v1/token-risk/history/route.ts
//
// GET /api/v1/token-risk/history?mint=<mint_address>&days=<1-90>
// Header: Authorization: Bearer <api_key>
//
// Separate route from /api/v1/token-risk, not a `?history=true` query
// param on it — decided explicitly, not a default:
// - Different response shape entirely (a time-series array, not a
//   single risk object) — folding that into the main endpoint's schema
//   as an optional field complicates it for every caller, including the
//   ones who never ask for history.
// - Different cost: this is a pure read from our own database (no
//   Solana RPC, no DexScreener call), unlike /token-risk which always
//   does live upstream work. Keeping it a separate route makes it easy
//   to price/rate-limit differently later without entangling the two.
//
// Does NOT call enforceRateLimit()/enforceRateLimitBatch() — reading
// history doesn't touch any upstream API and costs this project
// nothing per call beyond a cheap indexed DB read, so it isn't charged
// against the free/subscription call quota. Still requires a valid API
// key (not public) to avoid unauthenticated scraping, and every call is
// logged via logApiRequest same as the metered endpoints, so abuse is
// at least visible even though it isn't blocked automatically yet.

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { requireApiKey } from '@/lib/api-auth';
import { logApiRequest } from '@/lib/request-logger';
import { getMintRiskHistory } from '@/lib/mint-risk-history-store';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90; // matches the retention window — nothing older exists

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  let mint: string | null = null;
  let keyId: string | null = null;

  function respond(response: NextResponse, error: string | null = null): NextResponse {
    waitUntil(
      logApiRequest({
        keyId,
        mint,
        statusCode: response.status,
        responseTimeMs: Date.now() - startedAt,
        error,
      }),
    );
    return response;
  }

  try {
    const auth = await requireApiKey(request, CORS_HEADERS);
    if (!auth.ok || !auth.key) {
      return respond(
        auth.response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS }),
        'unauthorized',
      );
    }
    keyId = auth.key.id;

    const { searchParams } = new URL(request.url);
    mint = searchParams.get('mint');

    if (!mint) {
      return respond(
        NextResponse.json({ error: 'Missing required parameter: mint' }, { status: 400, headers: CORS_HEADERS }),
        'missing_mint',
      );
    }

    const daysParam = searchParams.get('days');
    let days = DEFAULT_DAYS;
    if (daysParam !== null) {
      const parsed = Number(daysParam);
      if (!Number.isFinite(parsed) || parsed < 1) {
        return respond(
          NextResponse.json(
            { error: `Invalid "days" parameter: must be a positive number (max ${MAX_DAYS})` },
            { status: 400, headers: CORS_HEADERS },
          ),
          'invalid_days',
        );
      }
      days = Math.min(parsed, MAX_DAYS);
    }

    const rows = await getMintRiskHistory(mint, days);

    if (rows === null) {
      return respond(
        NextResponse.json({ error: 'Internal error reading history' }, { status: 502, headers: CORS_HEADERS }),
        'history_read_failed',
      );
    }

    return respond(
      NextResponse.json(
        {
          mint,
          days_requested: days,
          points: rows.map((row) => ({
            hour: row.hour_bucket,
            safety_score: row.safety_score,
            insider_cluster_count: row.insider_cluster_count,
            holder_count: row.holder_count,
            top10_percent: row.top10_percent,
            price_usd: row.price_usd,
            liquidity_usd: row.liquidity_usd,
            volume_24h_usd: row.volume_24h_usd,
            price_change_24h_percent: row.price_change_24h_percent,
          })),
          note:
            rows.length === 0
              ? 'No history yet for this mint — points are only recorded once someone checks a mint via /api/v1/token-risk or /api/v1/token-risk/batch.'
              : undefined,
        },
        { headers: CORS_HEADERS },
      ),
    );
  } catch (error: any) {
    console.error('[token-risk/history] API error:', error);
    return respond(
      NextResponse.json({ error: 'Internal error', details: error.message }, { status: 500, headers: CORS_HEADERS }),
      error.message,
    );
  }
}
