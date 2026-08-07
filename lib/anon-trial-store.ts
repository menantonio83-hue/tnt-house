// Version 1.0 — lib/anon-trial-store.ts
//
// Atomic increment-and-read for the browser-fingerprint-based anonymous
// trial (landing page "try it now" widget, no email required). Same
// UPSERT-via-RPC pattern as lib/rate-limit-store.ts's
// incrementDailyUsage() — one atomic Postgres statement, no
// read-then-write race window between two parallel calls from the same
// fingerprint.
//
// Separate concept from:
// - lib/demo-limit.ts — IP-based, Redis-backed, gates the MCP-inspector
//   demo path only (Glama/Smithery "try the tool" playgrounds).
// - lib/rate-limit.ts / api_key_usage_daily — the REAL per-key daily
//   quota once a caller has an actual API key.
//
// This table (anon_trials, see the migration applied directly via
// Supabase) is the pre-signup funnel step: fingerprint -> 3 free calls
// -> caller is pushed to /api/v1/signup for a real 15/day key.
//
// Fail-CLOSED if Supabase errors — same reasoning as lib/demo-limit.ts's
// fail-closed choice: this guards a completely unauthenticated surface,
// so an infra hiccup should block the free call rather than silently
// hand out unmetered access.

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

export const ANON_TRIAL_LIMIT = 3;

// Returns the new calls_used total after incrementing, or null on a
// database error (caller fails closed on null).
export async function incrementAnonTrial(fingerprintHash: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('increment_anon_trial', {
    p_fingerprint_hash: fingerprintHash,
  });

  if (error) {
    console.error('[anon-trial-store] increment_anon_trial error:', error.message);
    return null;
  }
  return data as number;
}
