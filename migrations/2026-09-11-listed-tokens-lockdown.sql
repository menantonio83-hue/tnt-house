-- Version 1.0 — migrations/2026-09-11-listed-tokens-lockdown.sql
--
-- Closes the last open direct-write hole in the public schema:
-- listed_tokens.
--
-- Until this migration the table carried open RLS policies ("Public
-- insert" / "Public update", expression literally `true`) and the anon
-- role held direct INSERT/UPDATE/DELETE grants. The publishable key is
-- visible in every page load (app/page.js), so anyone — no site visit
-- required, a bare curl is enough — could INSERT fake listings or PATCH
-- any existing listing's score, links and logo. This is the same hole
-- shape that migrations/2026-09-11-banner-lockdown.sql already closed
-- for active_banner.
--
-- Every legitimate writer has already moved server-side, under the
-- service role (which bypasses RLS by design):
--   * free path: /api/listed-tokens/audit -> /api/listed-tokens/save
--                (signed envelope, service role)
--   * paid path: /api/listed-tokens/complete-paid (service role)
--   * shared writer: lib/listed-token-writer.ts (service role)
-- The browser no longer contains any write path to this table
-- (saveTokenToSupabase() was removed from app/page.js in the same
-- change as this migration).
--
-- WHAT STAYS PUBLIC: reading. Showing live listings to every visitor
-- without a key is the actual product; only WRITE access was ever the
-- hole. Reads that keep working after this migration:
--   * app/page.js loadTokensFromSupabase() (anon, SELECT)
--   * app/audit/[ca]/page.js (anon, SELECT)
--   * app/api/sendTelegram (service role, SELECT)
--
-- track_view / cast_vote RPC functions are unaffected: they write
-- token_views / token_votes, not listed_tokens.
--
-- Idempotent: safe to run again against a database that already has it.

-- Drop the wide-open write policies. The exact names below are the ones
-- the live table carried; drop-if-exists keeps this re-runnable no
-- matter which casing the deployed copy used.
drop policy if exists "Public insert" on public.listed_tokens;
drop policy if exists "Public update" on public.listed_tokens;
drop policy if exists "Public delete" on public.listed_tokens;
drop policy if exists "public insert" on public.listed_tokens;
drop policy if exists "public update" on public.listed_tokens;
drop policy if exists "public delete" on public.listed_tokens;

-- Take away the direct write grants that made those policies reachable
-- at all. With no table-level INSERT/UPDATE/DELETE grants for anon /
-- authenticated, no policy — even a permissive one left behind under a
-- different name — can perform a write through the public REST API.
revoke insert, update, delete, truncate, references, trigger
  on public.listed_tokens
  from anon, authenticated;

-- Fail closed: RLS on, zero write grants for the public roles, reads
-- stay open for every visitor.
alter table public.listed_tokens enable row level security;
grant select on public.listed_tokens to anon, authenticated;
