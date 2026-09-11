-- Version 1.0 — migrations/2026-09-11-free-banner-ip-lockdown.sql
--
-- Closes the "one script grabs all 5 lifetime free-banner slots"
-- giveaway hole: free_banner_claims had no identity column, so the
-- lifetime cap of 5 (claim_free_banner_slot's c_limit) could be spent
-- entirely by a single attacker from one machine.
--
-- Fix: every free-banner claim now records the claimant's IP, and a
-- partial unique index guarantees ONE free banner per IP, ever. The
-- claim function's signature gains p_claimed_ip (text) — the old
-- 6-argument overload is left in place but has its EXECUTE revoked
-- from service_role so it cannot be used to bypass the per-IP check.
--
-- The route-side caller (app/api/banners/claim/route.ts v1.2) passes
-- the Vercel-set x-forwarded-for IP and handles the new
-- 'already_claimed_by_ip' decision (409).
--
-- Idempotent: safe to run again against a database that already has it.

alter table public.free_banner_claims
  add column if not exists claimed_ip text;

create unique index if not exists free_banner_claims_ip_uniq
  on public.free_banner_claims (claimed_ip)
  where claimed_ip is not null;

-- New 7-argument overload: same atomic giveaway claim as the 6-arg
-- version, plus the one-free-banner-per-IP guarantee.
create or replace function public.claim_free_banner_slot(
  p_slot integer,
  p_token_name text,
  p_banner_img text,
  p_description text,
  p_target_link text,
  p_expires_at timestamptz,
  p_claimed_ip text
)
returns table(decision text, free_used integer, free_limit integer)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  c_limit constant integer := 5;
  v_used  integer;
begin
  if p_slot is null or p_slot < 1 then
    raise exception 'claim_free_banner_slot: invalid slot';
  end if;
  if coalesce(btrim(p_token_name), '') = ''
     or coalesce(btrim(p_description), '') = ''
     or coalesce(btrim(p_target_link), '') = '' then
    raise exception 'claim_free_banner_slot: token_name, description and target_link are required';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'claim_free_banner_slot: expires_at must be in the future';
  end if;
  if p_claimed_ip is null or btrim(p_claimed_ip) = '' then
    raise exception 'claim_free_banner_slot: claimed_ip is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('tnt_free_banner_slot'));

  select count(*)::integer into v_used from public.free_banner_claims;

  if v_used >= c_limit then
    return query select 'exhausted'::text, v_used, c_limit;
    return;
  end if;

  if exists (
    select 1 from public.free_banner_claims where claimed_ip = p_claimed_ip
  ) then
    return query select 'already_claimed_by_ip'::text, v_used, c_limit;
    return;
  end if;

  insert into public.free_banner_claims (claimed_ip) values (p_claimed_ip);

  insert into public.active_banner (id, token_name, banner_img, description, target_link, expires_at)
  values (p_slot, p_token_name, p_banner_img, p_description, p_target_link, p_expires_at)
  on conflict (id) do update set
    token_name  = excluded.token_name,
    banner_img  = excluded.banner_img,
    description = excluded.description,
    target_link = excluded.target_link,
    expires_at  = excluded.expires_at;

  return query select 'granted'::text, (v_used + 1), c_limit;
end;
$function$;

-- The NEW overload is service-role only, like the original.
revoke all on function public.claim_free_banner_slot(integer, text, text, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.claim_free_banner_slot(integer, text, text, text, text, timestamptz, text)
  to service_role;

-- Close the bypass: the OLD 6-argument overload must not stay callable
-- (its lack of p_claimed_ip is exactly the per-IP hole being closed).
revoke all on function public.claim_free_banner_slot(integer, text, text, text, text, timestamptz)
  from public, anon, authenticated, service_role;
