-- Version 1.1 — migrations/2026-09-11-banner-lockdown.sql
--
-- Closes a live, currently-exploitable hole: active_banner had RLS
-- policies named "public insert" / "public update" with `check: true`,
-- and the anon role held direct INSERT/UPDATE/DELETE grants. The
-- publishable key is visible in every page load, so anyone — no site
-- visit required, a bare curl is enough — could overwrite any of the
-- three live banner slots (including ones someone had just paid for)
-- with arbitrary content and a phishing link, or delete them outright.
-- free_banner_claims had the same "Public insert, check: true" shape.
--
-- Every current writer of these two tables was a direct client-side
-- fetch() with the publishable key (app/page.js: saveBannerToSupabase,
-- claimFreeBanner) gated only by React state that a curl request simply
-- ignores. All three call sites — free giveaway, VIP-earned credit, and
-- the paid path — move to server routes in this same change, so there
-- is nothing left writing to either table outside a SECURITY DEFINER
-- function. That is what makes locking the RLS safe here, unlike
-- listed_tokens, whose lockdown stays deferred while other legacy
-- writers to it still exist.
--
-- WHAT STAYS PUBLIC: reading active_banner. Showing live banners to
-- every visitor without a key is the actual product; only WRITE access
-- was ever the hole. free_banner_claims has no legitimate reader outside
-- the server (its count is now served by /api/banners/free-slots, which
-- runs under the service role), so it goes fully service-role-only.
--
-- Idempotent: safe to run again against a database that already has it.

-- site_orders gains the banner content a paid order needs to remember
-- between "order created" and "payment claimed" — the write now happens
-- inside /api/verify-payment at claim time, not from the client after
-- seeing verified:true, so the content has to travel with the order.
alter table public.site_orders
  add column if not exists banner_token_name text,
  add column if not exists banner_img text,
  add column if not exists banner_desc text,
  add column if not exists banner_target_link text,
  add column if not exists vip_banner_claimed boolean not null default false;

-- Lock active_banner: drop the wide-open write policies, keep public
-- read, revoke the write grants that made the policies reachable at all.
drop policy if exists "public insert" on public.active_banner;
drop policy if exists "public update" on public.active_banner;

revoke insert, update, delete, truncate, references, trigger on public.active_banner from anon, authenticated;
grant select on public.active_banner to anon, authenticated;

-- Lock free_banner_claims completely — service role only, same shape as
-- free_listing_claims and site_orders.
drop policy if exists "Public read" on public.free_banner_claims;
drop policy if exists "Public insert" on public.free_banner_claims;

revoke all on public.free_banner_claims from anon, authenticated;

-- Atomic free-banner giveaway claim. Mirrors claim_free_listing_slot's
-- shape (advisory lock, count-based limit) but also performs the actual
-- banner write in the same transaction: a free banner is never "granted"
-- without its content landing in active_banner, and never written
-- without the ledger row that counts it against the cap.
--
-- c_limit is a literal, not read from anywhere configurable, for the
-- same reason FREE_TOTAL=60 is a literal in claim_free_listing_slot:
-- there is no code path that can raise the free-banner cap.
create or replace function public.claim_free_banner_slot(
  p_slot integer,
  p_token_name text,
  p_banner_img text,
  p_description text,
  p_target_link text,
  p_expires_at timestamptz
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

  perform pg_advisory_xact_lock(hashtext('tnt_free_banner_slot'));

  select count(*)::integer into v_used from public.free_banner_claims;

  if v_used >= c_limit then
    return query select 'exhausted'::text, v_used, c_limit;
    return;
  end if;

  insert into public.free_banner_claims default values;

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

-- Atomic VIP-earned banner credit claim. A VIP audit purchase includes
-- one free banner (v1.110/v1.111 in app/page.js); this is what makes
-- that credit real instead of a client-side counter anyone can ignore
-- by calling the write endpoint directly. Eligibility is checked against
-- the site_orders row itself — kind='listing', tier='vip', status='paid'
-- — not trusted from the caller, and `for update` row-locks that order
-- so two concurrent claims on the same VIP purchase can't both win.
--
-- Duration is hardcoded to exactly 24 hours here, matching the existing
-- product rule ("VIP-credited banner is fixed at exactly 24h, regardless
-- of whatever the Duration dropdown happens to show") — enforced
-- server-side now rather than trusted from the client.
create or replace function public.claim_vip_banner_credit(
  p_order_id uuid,
  p_slot integer,
  p_token_name text,
  p_banner_img text,
  p_description text,
  p_target_link text
)
returns table(decision text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status  text;
  v_kind    text;
  v_tier    text;
  v_claimed boolean;
begin
  if p_slot is null or p_slot < 1 then
    raise exception 'claim_vip_banner_credit: invalid slot';
  end if;
  if coalesce(btrim(p_token_name), '') = ''
     or coalesce(btrim(p_description), '') = ''
     or coalesce(btrim(p_target_link), '') = '' then
    raise exception 'claim_vip_banner_credit: token_name, description and target_link are required';
  end if;

  select status, kind, tier, vip_banner_claimed
    into v_status, v_kind, v_tier, v_claimed
    from public.site_orders
   where id = p_order_id
   for update;

  if v_status is null then
    return query select 'not_found'::text;
    return;
  end if;

  if v_kind <> 'listing' or v_tier <> 'vip' or v_status <> 'paid' then
    return query select 'not_eligible'::text;
    return;
  end if;

  if v_claimed then
    return query select 'already_claimed'::text;
    return;
  end if;

  update public.site_orders set vip_banner_claimed = true where id = p_order_id;

  insert into public.active_banner (id, token_name, banner_img, description, target_link, expires_at)
  values (p_slot, p_token_name, p_banner_img, p_description, p_target_link, now() + interval '24 hours')
  on conflict (id) do update set
    token_name  = excluded.token_name,
    banner_img  = excluded.banner_img,
    description = excluded.description,
    target_link = excluded.target_link,
    expires_at  = excluded.expires_at;

  return query select 'granted'::text;
end;
$function$;

revoke all on function public.claim_free_banner_slot(integer, text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_free_banner_slot(integer, text, text, text, text, timestamptz)
  to service_role;

revoke all on function public.claim_vip_banner_credit(uuid, integer, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_vip_banner_credit(uuid, integer, text, text, text, text)
  to service_role;
