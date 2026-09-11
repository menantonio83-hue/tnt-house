-- Version 1.1 — migrations/2026-09-11-quick-check-credits-orders.sql
--
-- Extends site_orders (migrations/2026-09-10-site-orders.sql) with a
-- third kind: 'credits'. Quick Check credit purchases move onto the same
-- order ledger the listing/banner flow already uses, instead of the
-- separate, unauthenticated /api/quick-check/credits endpoint they used
-- before.
--
-- WHY: that endpoint took expectedAmount/since/method from the browser
-- (the exact underpayment shape /api/verify-payment used to have) with a
-- 5% tolerance, AND recorded no used signature anywhere — the same
-- transaction could be replayed against it without limit, minting
-- credits every time. Routing through site_orders inherits, for free,
-- everything already built and tested for verify-payment: a
-- server-decided price, a salted amount that identifies exactly one
-- order, and a global unique index on tx_signature that makes a
-- signature usable for at most one order across every kind — listing,
-- banner or credits alike.
--
-- credit_identity holds the long-lived fingerprint cookie value
-- (app/api/quick-check/route.js's tnt_qc_fp) that should be credited
-- when this order is claimed as paid. NOT the ip:fp compound identity
-- the free-tier daily counter uses — see lib/quick-check-limit.ts v1.2
-- for why credits and abuse-limiting deliberately use different
-- identities now.
--
-- Idempotent: safe to run again against a database that already has
-- this migration applied.

alter table public.site_orders
  add column if not exists credit_identity text;

alter table public.site_orders
  drop constraint if exists site_orders_kind_check;
alter table public.site_orders
  add constraint site_orders_kind_check
    check (kind = any (array['listing'::text, 'banner'::text, 'credits'::text]));

alter table public.site_orders
  drop constraint if exists site_orders_kind_identifier;
alter table public.site_orders
  add constraint site_orders_kind_identifier
    check (
      (kind = 'listing' and ca is not null)
      or (kind = 'banner' and banner_slot is not null)
      or (kind = 'credits' and credit_identity is not null)
    );
