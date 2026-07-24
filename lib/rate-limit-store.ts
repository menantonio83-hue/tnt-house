// Version 6.5 — lib/rate-limit-store.ts
//
// v6.5: added incrementDailyUsageBy() for the batch endpoint
// (app/api/v1/token-risk/batch/route.ts) — N mints in one HTTP call
// need to increment the daily counter by N, atomically, not N separate
// round trips. New SQL function increment_daily_usage_by(), NOT a
// change to the existing increment_daily_usage() used by the single-mint
// route — zero risk of touching that already-proven-in-production path.
//
// REQUIRED: run this in the Supabase SQL editor before deploying the
// batch endpoint (not yet applied — holding for explicit sign-off since
// this is billing-adjacent, per the standing payment-code rule).
//
// Unlike the original increment_daily_usage() (no search_path, no
// input guard), this new function adds both: an explicit search_path
// (this repo already hit a real Supabase-linter bug from a missing
// search_path on other RPCs — see v7.12's note in lib/billing-store.ts
// — no reason to risk repeating it on a brand new function) and a hard
// guard against p_amount <= 0, since a caller passing a non-positive
// batch size here would otherwise silently DECREMENT or no-op the
// counter instead of erroring:
//
//   create or replace function increment_daily_usage_by(p_key_id uuid, p_usage_date date, p_amount int)
//   returns int
//   language plpgsql
//   set search_path = public
//   as $$
//   declare
//     new_count int;
//   begin
//     if p_amount <= 0 then
//       raise exception 'p_amount must be positive, got %', p_amount;
//     end if;
//
//     insert into api_key_usage_daily (key_id, usage_date, request_count)
//     values (p_key_id, p_usage_date, p_amount)
//     on conflict (key_id, usage_date)
//     do update set request_count = api_key_usage_daily.request_count + p_amount
//     returning request_count into new_count;
//
//     return new_count;
//   end;
//   $$;
//
// Still a single atomic statement (INSERT ... ON CONFLICT ... DO UPDATE
// ... RETURNING) — no read-then-write race window, same as the
// original function.
//
// Version 6.4 — lib/rate-limit-store.ts
//
// v6.4: switched to the service-role Supabase client (lib/supabase-admin.ts)
// — api_key_usage_daily now has RLS enabled with no anon policies. Since
// increment_daily_usage() isn't SECURITY DEFINER, it runs with the
// caller's privileges — calling it via the anon key would now fail
// against RLS; the service-role client bypasses RLS and keeps working.
//
// Atomic daily usage counter for the Risk-Data API. Uses a Postgres
// function via Supabase RPC instead of read-then-write from JS, so
// concurrent requests from the same bot can't race past the limit
// (two parallel calls both reading count=99 and both writing 100).
//
// REQUIRED: run this in the Supabase SQL editor before deploying Stage 3:
//
//   create table api_key_usage_daily (
//     key_id uuid not null references api_keys(id) on delete cascade,
//     usage_date date not null,
//     request_count int not null default 0,
//     primary key (key_id, usage_date)
//   );
//
//   create or replace function increment_daily_usage(p_key_id uuid, p_usage_date date)
//   returns int
//   language plpgsql
//   as $$
//   declare
//     new_count int;
//   begin
//     insert into api_key_usage_daily (key_id, usage_date, request_count)
//     values (p_key_id, p_usage_date, 1)
//     on conflict (key_id, usage_date)
//     do update set request_count = api_key_usage_daily.request_count + 1
//     returning request_count into new_count;
//     return new_count;
//   end;
//   $$;
//
// Window is calendar-day UTC (not a rolling 24h window) — simpler to
// reason about and explain to API customers than a sliding window.

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

// Increments today's (UTC) usage counter for this key and returns the
// new total. Returns null on a database error — callers should fail
// open rather than block traffic over an infra hiccup.
export async function incrementDailyUsage(keyId: string, usageDateUtc: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('increment_daily_usage', {
    p_key_id: keyId,
    p_usage_date: usageDateUtc,
  });

  if (error) {
    console.error('[rate-limit-store] increment_daily_usage error:', error.message);
    return null;
  }
  return data as number;
}

// Same as incrementDailyUsage() but by an arbitrary amount — used by the
// batch endpoint (N mints in one call = N counted, per the decided
// billing model, not a discounted "1 call per batch"). Returns null on
// a database error, same fail-open contract as the single-increment path.
export async function incrementDailyUsageBy(
  keyId: string,
  usageDateUtc: string,
  amount: number,
): Promise<number | null> {
  const { data, error } = await supabase.rpc('increment_daily_usage_by', {
    p_key_id: keyId,
    p_usage_date: usageDateUtc,
    p_amount: amount,
  });

  if (error) {
    console.error('[rate-limit-store] increment_daily_usage_by error:', error.message);
    return null;
  }
  return data as number;
}

export function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" in UTC
}

export function nextUtcMidnightIso(): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0),
  );
  return next.toISOString();
}
