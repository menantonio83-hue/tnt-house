-- Version 1.1 — migrations/2026-09-10-site-orders.sql
--
-- The consumer-site order ledger. This table was applied directly to the
-- production database on 2026-09-10 and was never committed, so the repo
-- could not rebuild the schema it depends on. This file is that schema,
-- transcribed from the live database (information_schema / pg_catalog),
-- not from memory.
--
-- Every statement is idempotent: running this against the production
-- database that already has the table is a no-op, and running it against
-- a fresh database produces the same shape. Constraint and index names
-- match the live ones exactly so a re-run does not create duplicates
-- under different auto-generated names.
--
-- WHAT IT DEFENDS:
--   site_orders_pending_amount_uniq — each pending order holds a unique
--     salted amount per currency, so one incoming transfer identifies one
--     order and no other. The index, not application code, is the
--     authority; /api/site-orders/create retries on 23505.
--   site_orders_tx_signature_uniq — one on-chain signature can pay for at
--     most one order, ever. This is the replay defense: a second claim
--     with an already-used signature fails at the database level.
--   site_orders_paid_has_signature — a row cannot reach 'paid' without
--     recording which transaction paid it.
--
-- SECURITY MODEL: RLS is enabled with zero policies and no grants to
-- anon/authenticated. That combination is fail-closed for the public API
-- and transparent to the service role, which bypasses RLS. Same shape as
-- risk_api_payments and free_listing_claims.

create table if not exists public.site_orders (
  id           uuid        primary key default gen_random_uuid(),
  kind         text        not null,
  ca           text,
  banner_slot  integer,
  tier         text,
  currency     text        not null,
  pay_amount   numeric     not null,
  base_amount  numeric     not null,
  status       text        not null default 'pending',
  tx_signature text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '30 minutes'),
  paid_at      timestamptz,
  created_ip   text,

  constraint site_orders_kind_check
    check (kind = any (array['listing'::text, 'banner'::text])),
  constraint site_orders_currency_check
    check (currency = any (array['SOL'::text, 'USDC'::text, 'MRDT'::text])),
  constraint site_orders_status_check
    check (status = any (array['pending'::text, 'paid'::text, 'expired'::text])),
  constraint site_orders_pay_amount_check
    check (pay_amount > 0),
  constraint site_orders_base_amount_check
    check (base_amount > 0),
  constraint site_orders_kind_identifier
    check (
      (kind = 'listing' and ca is not null)
      or (kind = 'banner' and banner_slot is not null)
    ),
  constraint site_orders_paid_has_signature
    check (status <> 'paid' or (tx_signature is not null and paid_at is not null))
);

-- Added after the initial apply: /api/site-orders/create counts pending
-- orders per IP and inserts this column. Kept as a separate ALTER so a
-- database created from an earlier version of this table converges here
-- instead of failing at insert time with "column does not exist".
alter table public.site_orders
  add column if not exists created_ip text;

-- One live signature per order, forever. The replay defense.
create unique index if not exists site_orders_tx_signature_uniq
  on public.site_orders (tx_signature)
  where tx_signature is not null;

-- One pending order per salted amount per currency. The identity defense.
create unique index if not exists site_orders_pending_amount_uniq
  on public.site_orders (currency, pay_amount)
  where status = 'pending';

create index if not exists site_orders_status_idx
  on public.site_orders (status);

create index if not exists site_orders_expiry_idx
  on public.site_orders (expires_at)
  where status = 'pending';

create index if not exists site_orders_pending_ip_idx
  on public.site_orders (created_ip)
  where status = 'pending';

-- Fail closed: RLS on, no policies, no public grants. Only the service
-- role (which bypasses RLS) and the SECURITY DEFINER function below can
-- read or write this table.
alter table public.site_orders enable row level security;

revoke all on public.site_orders from anon, authenticated;

-- Atomic payment claim. Called only by the server, only after a matching
-- on-chain transfer has been found.
--
-- The single UPDATE is the whole transaction: status, signature and
-- paid_at move together, gated on the row still being pending and not yet
-- expired. Two concurrent polls racing on the same order cannot both
-- succeed — the second sees row_count = 0 and reports 'already_paid'.
-- A signature already recorded against a different order raises 23505 on
-- site_orders_tx_signature_uniq, which the caller treats as a replay.
--
-- Outcomes: 'claimed' | 'already_paid' | 'expired' | 'not_found'.
create or replace function public.claim_site_order_payment(
  p_order_id uuid,
  p_signature text
)
returns table(outcome text, order_status text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_sig     text;
  v_updated integer;
  v_status  text;
begin
  v_sig := btrim(coalesce(p_signature, ''));
  if v_sig = '' then
    raise exception 'claim_site_order_payment: signature must not be empty';
  end if;

  update public.site_orders
     set status = 'paid', tx_signature = v_sig, paid_at = now()
   where id = p_order_id
     and status = 'pending'
     and expires_at > now();
  get diagnostics v_updated = row_count;

  if v_updated = 1 then
    return query select 'claimed'::text, 'paid'::text;
    return;
  end if;

  select status into v_status from public.site_orders where id = p_order_id;

  if v_status is null then
    return query select 'not_found'::text, null::text;
  elsif v_status = 'paid' then
    return query select 'already_paid'::text, v_status;
  else
    return query select 'expired'::text, v_status;
  end if;
end;
$function$;

-- The function is SECURITY DEFINER, so execute rights are the whole
-- access control. Postgres grants EXECUTE to PUBLIC on creation; without
-- this revoke, any anon key could mark any order paid with an arbitrary
-- signature string through PostgREST's /rpc endpoint.
revoke all on function public.claim_site_order_payment(uuid, text) from public, anon, authenticated;

grant execute on function public.claim_site_order_payment(uuid, text) to service_role;
