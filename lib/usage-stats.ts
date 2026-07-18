// Version 6.6 — lib/usage-stats.ts
//
// v6.6: switched to the service-role Supabase client (lib/supabase-admin.ts)
// — api_request_log now has RLS enabled with no anon policies.
//
// Aggregates api_request_log for the admin usage/billing view.
//
// total_requests and requests_today use exact Supabase counts (accurate
// regardless of volume). top_mints is computed in JS over the most
// recent RECENT_SAMPLE_SIZE matching rows rather than a full-table
// GROUP BY — simpler than adding another Postgres function, and honest:
// the response says exactly how many rows the breakdown is based on.
// Fine for a solo project's current volume; revisit with a real
// aggregate query if request volume grows enough to matter.

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

const TABLE = 'api_request_log';
const RECENT_SAMPLE_SIZE = 500;
const RECENT_RETURN_SIZE = 100;
const TOP_MINTS_LIMIT = 20;

export interface UsageFilters {
  keyId?: string;
  mint?: string;
  fromIso?: string;
  toIso?: string;
}

export interface UsageRequestRow {
  id: string;
  key_id: string | null;
  mint: string | null;
  status_code: number;
  safety_score: number | null;
  cluster_analysis: string | null;
  response_time_ms: number | null;
  error: string | null;
  created_at: string;
}

export interface UsageStats {
  totalRequests: number;
  requestsToday: number;
  topMints: Array<{ mint: string; count: number }>;
  recentRequests: UsageRequestRow[];
  sampleSize: number; // how many recent rows topMints is based on
}

// Supabase's PostgrestFilterBuilder generic typing gets unwieldy to
// thread through a shared helper — `any` here is a deliberate, contained
// escape hatch in this one data-access helper, not a project-wide habit.
function applyFilters(query: any, filters: UsageFilters): any {
  let q = query;
  if (filters.keyId) q = q.eq('key_id', filters.keyId);
  if (filters.mint) q = q.eq('mint', filters.mint);
  if (filters.fromIso) q = q.gte('created_at', filters.fromIso);
  if (filters.toIso) q = q.lte('created_at', filters.toIso);
  return q;
}

export async function getUsageStats(filters: UsageFilters): Promise<UsageStats> {
  const todayStartUtc = new Date();
  todayStartUtc.setUTCHours(0, 0, 0, 0);

  const totalQuery = applyFilters(
    supabase.from(TABLE).select('id', { count: 'exact', head: true }),
    filters,
  );

  const todayQuery = applyFilters(
    supabase.from(TABLE).select('id', { count: 'exact', head: true }),
    filters,
  ).gte('created_at', todayStartUtc.toISOString());

  const recentQuery = applyFilters(
    supabase.from(TABLE).select('*').order('created_at', { ascending: false }).limit(RECENT_SAMPLE_SIZE),
    filters,
  );

  const [totalResult, todayResult, recentResult] = await Promise.all([
    totalQuery,
    todayQuery,
    recentQuery,
  ]);

  if (totalResult.error) console.error('[usage-stats] total count error:', totalResult.error.message);
  if (todayResult.error) console.error('[usage-stats] today count error:', todayResult.error.message);
  if (recentResult.error) console.error('[usage-stats] recent rows error:', recentResult.error.message);

  const rows: UsageRequestRow[] = recentResult.data || [];

  const mintCounts: Record<string, number> = {};
  for (const row of rows) {
    if (!row.mint) continue;
    mintCounts[row.mint] = (mintCounts[row.mint] || 0) + 1;
  }
  const topMints = Object.entries(mintCounts)
    .map(([mint, count]) => ({ mint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_MINTS_LIMIT);

  return {
    totalRequests: totalResult.count || 0,
    requestsToday: todayResult.count || 0,
    topMints,
    recentRequests: rows.slice(0, RECENT_RETURN_SIZE),
    sampleSize: rows.length,
  };
}
