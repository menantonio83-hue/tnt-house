// Version 6.5 — lib/request-logger.ts
//
// v6.5: switched to the service-role Supabase client (lib/supabase-admin.ts)
// — api_request_log now has RLS enabled with no anon policies (it's a
// per-key usage record, billing-adjacent, shouldn't be publicly readable).
//
// Per-request audit log for the Risk-Data API — the source of truth for
// both billing (who called how many times) and analytics (which mints
// get queried, error rates, latency).
//
// REQUIRED: create this table in Supabase before deploying Stage 4:
//
//   create table api_request_log (
//     id uuid primary key default gen_random_uuid(),
//     key_id uuid references api_keys(id) on delete set null,
//     mint text,
//     status_code int not null,
//     safety_score int,
//     cluster_analysis text,
//     response_time_ms int,
//     error text,
//     created_at timestamptz not null default now()
//   );
//   create index api_request_log_key_id_idx on api_request_log (key_id);
//   create index api_request_log_mint_idx on api_request_log (mint);
//   create index api_request_log_created_at_idx on api_request_log (created_at desc);
//
// Logging is always fire-and-forget via waitUntil() from the route —
// never awaited on the request's critical path, and never allowed to
// fail the actual API response if the insert fails.

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

const TABLE = 'api_request_log';

export interface ApiRequestLogEntry {
  keyId: string | null;
  mint: string | null;
  statusCode: number;
  safetyScore?: number | null;
  clusterAnalysis?: string | null;
  responseTimeMs: number;
  error?: string | null;
}

export async function logApiRequest(entry: ApiRequestLogEntry): Promise<void> {
  const { error } = await supabase.from(TABLE).insert({
    key_id: entry.keyId,
    mint: entry.mint,
    status_code: entry.statusCode,
    safety_score: entry.safetyScore ?? null,
    cluster_analysis: entry.clusterAnalysis ?? null,
    response_time_ms: entry.responseTimeMs,
    error: entry.error ?? null,
  });

  if (error) console.error('[request-logger] insert error:', error.message);
}
