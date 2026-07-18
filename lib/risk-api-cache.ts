// Version 1.2 — lib/risk-api-cache.ts
//
// Supabase-backed cache for the slow insider-cluster detection step only.
// Everything else in the Risk-Data API response (mint/freeze authority,
// holder %, market data) is fetched live on every call — that data is
// cheap and changes constantly, so caching it would just make the API
// return stale prices/liquidity. Only the expensive "First Funder Trace"
// result (up to 60s of RPC calls) is cached here.
//
// REQUIRED: create this table in Supabase before deploying Stage 1:
//
//   create table risk_cluster_cache (
//     mint text primary key,
//     status text not null default 'pending', -- 'pending' | 'complete' | 'failed'
//     clusters jsonb not null default '[]',
//     checked_holders int not null default 0,
//     error text,
//     updated_at timestamptz not null default now()
//   );
//
// Stale-while-revalidate flow used by app/api/v1/token-risk/route.ts:
//   1. No row yet              -> mark 'pending', trigger background job, return fast response.
//   2. Row status = 'complete' and fresh -> return cached clusters instantly.
//   3. Row status = 'complete' but stale (> COMPLETE_TTL_MS) -> return cached
//      clusters instantly AND silently re-trigger a background refresh.
//   4. Row status = 'pending' but stale (> PENDING_TTL_MS, likely crashed job)
//      -> re-trigger background job, return fast response without clusters.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pjtvjslcffuulsqxerpx.supabase.co',
  'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU',
);

const TABLE = 'risk_cluster_cache';

// How long a 'complete' result is considered fresh before a background
// refresh is silently triggered (the cached result is still served instantly).
const COMPLETE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// How long a 'pending' row is trusted before we assume the background job
// crashed or hit the 60s timeout, and allow a new attempt to be triggered.
const PENDING_TTL_MS = 90 * 1000; // 90 seconds

export type ClusterCacheStatus = 'pending' | 'complete' | 'failed';

export interface ClusterCacheRow {
  mint: string;
  status: ClusterCacheStatus;
  clusters: Array<{ funder: string; wallets: string[] }>;
  checked_holders: number;
  error: string | null;
  updated_at: string;
}

export interface CacheLookup {
  row: ClusterCacheRow | null;
  // false = no usable row, OR row exists but is old enough that a
  // background (re)compute should be triggered.
  isFresh: boolean;
}

export async function getClusterCache(mint: string): Promise<CacheLookup> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('mint', mint)
    .maybeSingle();

  if (error) {
    console.error('[risk-api-cache] read error:', error.message);
    return { row: null, isFresh: false };
  }
  if (!data) {
    return { row: null, isFresh: false };
  }

  const ageMs = Date.now() - new Date(data.updated_at).getTime();
  const ttl = data.status === 'complete' ? COMPLETE_TTL_MS : PENDING_TTL_MS;

  return { row: data as ClusterCacheRow, isFresh: ageMs < ttl };
}

export async function markClusterPending(mint: string): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      mint,
      status: 'pending',
      clusters: [],
      checked_holders: 0,
      error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'mint' },
  );
  if (error) console.error('[risk-api-cache] markClusterPending error:', error.message);
}

export async function saveClusterResult(
  mint: string,
  clusters: Array<{ funder: string; wallets: string[] }>,
  checkedHolders: number,
): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      mint,
      status: 'complete',
      clusters,
      checked_holders: checkedHolders,
      error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'mint' },
  );
  if (error) console.error('[risk-api-cache] saveClusterResult error:', error.message);
}

export async function markClusterFailed(mint: string, message: string): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      mint,
      status: 'failed',
      clusters: [],
      checked_holders: 0,
      error: message,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'mint' },
  );
  if (error) console.error('[risk-api-cache] markClusterFailed error:', error.message);
}
