// Version 1.0 — lib/mint-risk-history-store.ts
//
// Time-series history for the Risk-Data API's "history/trends" feature.
// One row per (mint, hour_bucket) — NOT one row per API call. A mint
// getting checked 50 times in the same UTC hour (a trading bot polling
// it every 30s is the expected case, not an edge case) produces ONE
// row, last-write-wins, via upsert. This is what keeps table growth
// proportional to (unique mints × hours), not to raw API traffic.
//
// REQUIRED: create this table in Supabase before deploying:
//
//   create table mint_risk_history (
//     id uuid primary key default gen_random_uuid(),
//     mint text not null,
//     hour_bucket timestamptz not null,
//     safety_score int,
//     insider_cluster_count int,
//     holder_count int,
//     top10_percent numeric,
//     price_usd numeric,
//     liquidity_usd numeric,
//     volume_24h_usd numeric,
//     price_change_24h_percent numeric,
//     updated_at timestamptz not null default now()
//   );
//   create unique index mint_risk_history_mint_hour_idx
//     on mint_risk_history (mint, hour_bucket);
//   -- the unique index above is also what makes ON CONFLICT (mint,
//   -- hour_bucket) possible below — it's not just a query optimization.
//   create index mint_risk_history_mint_hour_desc_idx
//     on mint_risk_history (mint, hour_bucket desc);
//
//   alter table mint_risk_history enable row level security;
//   -- no anon policies added, on purpose — same as api_request_log
//   -- (lib/request-logger.ts v6.5) and api_keys. Only accessed via the
//   -- service-role client below, never from the browser.
//
// Retention: 90 days, enforced by a daily cron
// (app/api/v1/admin/cleanup-history) calling
// deleteMintRiskHistoryOlderThan() — NOT a database-level scheduled job,
// since Supabase's pg_cron isn't set up in this project and adding it
// is more moving parts than a simple Vercel Cron hitting an admin route
// this repo already has the pattern for (RISK_API_ADMIN_SECRET-style
// auth, just using CRON_SECRET instead — see that route).
//
// Write path: fire-and-forget via waitUntil() from
// lib/token-risk-core.ts, same as the existing background cluster job
// and request logging in that file. History is a side effect for
// analytics, not part of the API's response contract — unlike rate
// limiting (which IS awaited, because the response's allowed/blocked
// status depends on it), a failed history write should never affect
// the actual /token-risk or /token-risk/batch response.

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

const TABLE = 'mint_risk_history';
const RETENTION_DAYS = 90;

// Truncates to the start of the current UTC hour, as an ISO string —
// same role as rate-limit-store.ts's todayUtcDateString(), just at
// hour granularity instead of day granularity.
export function hourBucketUtcIso(date: Date = new Date()): string {
  const truncated = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), 0, 0, 0),
  );
  return truncated.toISOString();
}

export interface MintRiskHistoryPoint {
  mint: string;
  safetyScore: number | null;
  insiderClusterCount: number | null;
  holderCount: number | null;
  top10Percent: number | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  priceChange24hPercent: number | null;
}

// Single atomic UPSERT — supabase-js's .upsert() with onConflict compiles
// to one INSERT ... ON CONFLICT (mint, hour_bucket) DO UPDATE statement
// via PostgREST, not a separate SELECT-then-INSERT-or-UPDATE round trip.
// Unlike the billing counters (lib/rate-limit-store.ts,
// lib/billing-store.ts), this doesn't need a custom SQL function with a
// row lock: there's no arithmetic here (no "+N"), just "set these
// columns to their latest values" — last-write-wins is the correct
// behavior for a trend point, so plain upsert semantics are sufficient
// and there's no analogous race to what batch billing had.
//
// Never throws — logs and swallows errors, since this is always called
// fire-and-forget and must never surface as an unhandled rejection in
// a waitUntil() background task.
export async function upsertMintRiskHistory(point: MintRiskHistoryPoint): Promise<void> {
  try {
    const { error } = await supabase.from(TABLE).upsert(
      {
        mint: point.mint,
        hour_bucket: hourBucketUtcIso(),
        safety_score: point.safetyScore,
        insider_cluster_count: point.insiderClusterCount,
        holder_count: point.holderCount,
        top10_percent: point.top10Percent,
        price_usd: point.priceUsd,
        liquidity_usd: point.liquidityUsd,
        volume_24h_usd: point.volume24hUsd,
        price_change_24h_percent: point.priceChange24hPercent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'mint,hour_bucket' },
    );

    if (error) {
      console.error('[mint-risk-history-store] upsert error:', error.message);
    }
  } catch (e: any) {
    // Belt-and-suspenders on top of the `error` field check above: covers
    // the rare case of a transport-level failure (DNS, timeout before any
    // response) where supabase-js throws instead of returning an `error`
    // field. Since this runs inside waitUntil() with no caller awaiting
    // it, an uncaught exception here would be an unhandled rejection in
    // the background — this keeps it a clean, logged no-op instead.
    console.error('[mint-risk-history-store] upsert threw:', e?.message || e);
  }
}

export interface MintRiskHistoryRow {
  hour_bucket: string;
  safety_score: number | null;
  insider_cluster_count: number | null;
  holder_count: number | null;
  top10_percent: number | null;
  price_usd: number | null;
  liquidity_usd: number | null;
  volume_24h_usd: number | null;
  price_change_24h_percent: number | null;
}

// Returns points oldest-first, capped at RETENTION_DAYS regardless of
// what the caller asks for — there's never anything older than that on
// disk, so clamping here avoids a caller-supplied `days` from turning
// into a pointlessly wide (and identical-result) query.
export async function getMintRiskHistory(mint: string, days: number): Promise<MintRiskHistoryRow[] | null> {
  const clampedDays = Math.max(1, Math.min(days, RETENTION_DAYS));
  const since = new Date(Date.now() - clampedDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'hour_bucket, safety_score, insider_cluster_count, holder_count, top10_percent, price_usd, liquidity_usd, volume_24h_usd, price_change_24h_percent',
    )
    .eq('mint', mint)
    .gte('hour_bucket', since)
    .order('hour_bucket', { ascending: true });

  if (error) {
    console.error('[mint-risk-history-store] select error:', error.message);
    return null;
  }
  return data as MintRiskHistoryRow[];
}

// Called from the daily retention cron (app/api/v1/admin/cleanup-history).
// Returns the number of deleted rows, or null on error.
export async function deleteMintRiskHistoryOlderThan(days: number = RETENTION_DAYS): Promise<number | null> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase.from(TABLE).delete({ count: 'exact' }).lt('hour_bucket', cutoff);

  if (error) {
    console.error('[mint-risk-history-store] delete error:', error.message);
    return null;
  }
  return count ?? 0;
}
