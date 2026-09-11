-- Version 1.1 — migrations/2026-09-11-listing-completion.sql
--
-- Closes a replay hole in the not-yet-merged feat/paid-listing-server-
-- completion branch (commit 467ca7b), found while resuming it: its
-- /api/listed-tokens/complete-paid re-derived a payment's amount/
-- currency/payer directly from Helius by raw signature, with NO record
-- anywhere of which signatures had already been used. The exact same
-- real payment could be replayed against that route with a different
-- mint address every time, and each call would list a new token for
-- free — the same underpayment/replay shape as /api/verify-payment
-- before this morning's fix and app/api/quick-check/credits/route.js
-- before today's fix, in a third independent implementation that
-- predates both.
--
-- The fix does not add a second signature-tracking mechanism. It routes
-- listing completion through the ONE that already exists:
-- site_orders_tx_signature_uniq, the global unique index that already
-- makes a signature usable for at most one order across every kind —
-- listing, banner, credits. complete-paid now trusts an already-paid
-- site_orders row instead of re-deriving payment facts from chain a
-- second time.
--
-- listing_completed is this feature's one-time-use flag, the same shape
-- as vip_banner_claimed: a listing order can fund exactly one completed
-- listing, never more, no matter how many times complete-paid is called
-- for it (a retry, a double-tap, a network hiccup) — see
-- claim_listing_completion below.
--
-- Idempotent: safe to run again against a database that already has it.

alter table public.site_orders
  add column if not exists listing_completed boolean not null default false;

-- Atomic listing-completion claim. Unlike claim_free_banner_slot and
-- claim_vip_banner_credit, this function does NOT write the product
-- content itself — a listing's content (score, holder data, cluster
-- findings) is not known until the audit actually runs, which takes
-- tens of seconds and belongs in application code, not a database
-- function. This function's only job is to answer, atomically, "am I
-- the one call that gets to run that audit for this order" — `for
-- update` row-locks the order so two concurrent calls can't both hear
-- 'granted' for the same one.
create or replace function public.claim_listing_completion(
  p_order_id uuid
)
returns table(decision text, ca text, tier text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status    text;
  v_kind      text;
  v_ca        text;
  v_tier      text;
  v_completed boolean;
begin
  select o.status, o.kind, o.ca, o.tier, o.listing_completed
    into v_status, v_kind, v_ca, v_tier, v_completed
    from public.site_orders o
   where o.id = p_order_id
   for update;

  if v_status is null then
    return query select 'not_found'::text, null::text, null::text;
    return;
  end if;

  if v_kind <> 'listing' or v_status <> 'paid' then
    return query select 'not_eligible'::text, null::text, null::text;
    return;
  end if;

  if v_completed then
    return query select 'already_completed'::text, v_ca, v_tier;
    return;
  end if;

  update public.site_orders set listing_completed = true where id = p_order_id;

  return query select 'granted'::text, v_ca, v_tier;
end;
$function$;

revoke all on function public.claim_listing_completion(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_listing_completion(uuid)
  to service_role;
