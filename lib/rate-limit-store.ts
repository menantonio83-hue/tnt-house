// Version 3.1 — lib/rate-limit-store.ts
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

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pjtvjslcffuulsqxerpx.supabase.co',
  'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU',
);

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
