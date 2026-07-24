// Version 7.16 — lib/billing-store.ts
//
// v7.16: FIXES A REAL RACE CONDITION found on review of v7.15, before
// anything touched a real database — the exact same bug class this repo
// already hit once with salt-flood/verify-payment.
//
// v7.15's design read the "before" count from key.subscription_cycle_
// calls_used, which lib/api-auth.ts's requireApiKey() had already
// fetched EARLIER in the request — a separate, stale SELECT, not part
// of the same atomic operation as the increment. Two concurrent batch
// requests on the SAME key can both read that same stale "before"
// value, both compute their own free/overage split against it, and
// together under-charge overage credit for calls that were, in
// reality, entirely in overage by the time the second one actually
// landed. Confirmed with a concrete run: usedBefore=997, quota=1000,
// two concurrent batches of 20 each — v7.15's math would charge 17+17=
// 34 overage calls total, when the real number (997+20+20-1000) is 37.
// A 3-call under-charge, real money, not a display glitch.
//
// v7.16 fixes this by moving the "read old count" INSIDE the SQL
// function, using SELECT ... FOR UPDATE to take a row lock at read
// time — so a concurrent call to this function on the SAME key_id
// blocks on that same SELECT until the first call's transaction
// commits, and correctly sees the first call's already-applied result
// as its own "old" value. The function now returns BOTH old_count and
// new_count from that single atomic operation. lib/rate-limit.ts's
// enforceRateLimitBatch() (v3.7) no longer touches key.subscription_
// cycle_calls_used for the batch math at all — it uses only this
// RPC's own old_count.
//
// REQUIRED: run this in the Supabase SQL editor before deploying the
// batch endpoint (STILL not yet applied — sending this specific fix
// out for a second look before it touches a real database, per the
// standing payment-code rule):
//
//   create or replace function increment_subscription_usage_by(p_key_id uuid, p_quota int, p_amount int)
//   returns table(old_count int, new_count int)
//   language plpgsql
//   set search_path = public
//   as $$
//   declare
//     v_old int;
//     v_new int;
//   begin
//     if p_amount <= 0 then
//       raise exception 'p_amount must be positive, got %', p_amount;
//     end if;
//
//     -- FOR UPDATE takes an exclusive row lock at the moment of this
//     -- read. A concurrent call to this same function on the same
//     -- key_id blocks HERE until this transaction commits — that's
//     -- what actually closes the race, not just doing the read and
//     -- the write inside one function body.
//     select subscription_cycle_calls_used into v_old
//     from api_keys
//     where id = p_key_id
//     for update;
//
//     v_new := least(v_old + p_amount, p_quota + 1);
//
//     update api_keys
//     set subscription_cycle_calls_used = v_new
//     where id = p_key_id;
//
//     return query select v_old, v_new;
//   end;
//   $$;
//
// Version 7.15 — lib/billing-store.ts
//
// v7.15: added incrementSubscriptionUsageBy() for the batch endpoint —
// N mints in one call need the subscription cycle counter incremented
// by N, atomically. New SQL function increment_subscription_usage_by(),
// separate from the existing increment_subscription_usage() (still used
// by the single-mint route, untouched). decrementCreditIfSufficient()
// already takes an arbitrary `amount` — no change needed there, the
// batch route just passes overageCount * rate.
//
// SUPERSEDED BY v7.16 above — the function signature this version
// describes (returns int, no row lock) has a real race condition, kept
// here only for the historical record of what the first draft looked
// like before review caught it.
//
// Version 7.14 — lib/billing-store.ts
//
// v7.14: two changes for the anti-salt-flood fix (see the SQL migration
// adding a partial unique index on risk_api_payments(currency,
// pay_amount) WHERE status='pending', and lib/billing-pricing.ts's
// resolveBaseAmount/applySalt split):
// 1. createPaymentInvoice() now returns { payment, collision } instead
//    of a bare PaymentRecord | null — callers need to distinguish "the
//    salted amount collided with another pending invoice, retry with a
//    fresh salt" (collision: true) from any other database error
//    (collision: false, already logged here).
// 2. countPendingInvoicesForKey() backs the per-key pending-invoice cap
//    (MAX_PENDING_INVOICES_PER_KEY in lib/billing-pricing.ts) enforced
//    in app/api/v1/billing/create-invoice — a secondary defense; the
//    unique index above is the actual, unconditional guarantee.
//
// v7.13: added expireStalePendingPayment() — lazy TTL check for invoices
// stuck in 'pending' too long (see lib/billing-pricing.ts's
// PENDING_INVOICE_TTL_MINUTES). Checked on read from
// app/api/v1/billing/verify-payment, same lazy-expiry pattern already
// used by lib/risk-api-cache.ts, not a cron job.
//
// v7.12: fixed the Supabase linter's function_search_path_mutable
// warning on all RPC functions below — applied directly against
// Supabase (ALTER FUNCTION ... SET search_path = public).
//
// v7.10: ConfirmPaymentResult now carries an optional `reason` — the
// confirm_payment() RPC returns one when a claim fails because the
// tx_signature was already used by a different payment row (the hard
// DB-level defense against double-crediting on a rare salt collision).
//
// Supabase access for risk_api_payments and the billing RPC functions.
// Uses the service-role client (lib/supabase-admin.ts) — this table has
// RLS enabled with no anon policies, same lockdown as the rest of the
// Risk-Data API tables.

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import type { Currency, InvoiceKind } from '@/lib/billing-pricing';

const TABLE = 'risk_api_payments';

export type PaymentStatus = 'pending' | 'confirmed' | 'expired';

export interface PaymentRecord {
  id: string;
  key_id: string;
  kind: InvoiceKind;
  currency: Currency;
  usd_amount: number;
  pay_amount: number;
  status: PaymentStatus;
  tx_signature: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface CreateInvoiceResult {
  payment: PaymentRecord | null;
  // true = failed specifically because (currency, pay_amount) already
  // has a pending row (the anti-salt-flood unique index) — caller
  // should retry with a freshly-salted amount, NOT surface an error yet.
  collision: boolean;
}

export async function createPaymentInvoice(
  keyId: string,
  kind: InvoiceKind,
  currency: Currency,
  usdAmount: number,
  payAmount: number,
): Promise<CreateInvoiceResult> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ key_id: keyId, kind, currency, usd_amount: usdAmount, pay_amount: payAmount })
    .select()
    .single();

  if (error) {
    // Postgres unique_violation is SQLSTATE 23505, surfaced by
    // PostgREST as error.code — checking the message text too as a
    // defensive fallback in case that field isn't populated for some
    // reason, since correctly detecting a collision (vs. any other DB
    // error) is what makes the retry loop in create-invoice safe.
    const isCollision =
      error.code === '23505' ||
      (typeof error.message === 'string' && error.message.includes('duplicate key value violates unique constraint'));
    if (!isCollision) {
      console.error('[billing-store] createPaymentInvoice error:', error.message);
    }
    return { payment: null, collision: isCollision };
  }
  return { payment: data as PaymentRecord, collision: false };
}

// Backs the per-key pending-invoice cap in create-invoice. Fails OPEN
// (returns 0) on a database error — this is a secondary/defense-in-
// depth check; the unique index is what actually, unconditionally
// prevents salt-space exhaustion regardless of whether this count is
// available right now.
export async function countPendingInvoicesForKey(keyId: string): Promise<number> {
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('key_id', keyId)
    .eq('status', 'pending');

  if (error) {
    console.error('[billing-store] countPendingInvoicesForKey error:', error.message);
    return 0;
  }
  return count || 0;
}

export async function getPaymentById(paymentId: string): Promise<PaymentRecord | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', paymentId).maybeSingle();

  if (error) {
    console.error('[billing-store] getPaymentById error:', error.message);
    return null;
  }
  return data as PaymentRecord | null;
}

export interface ConfirmPaymentResult {
  claimed: boolean;
  kind?: InvoiceKind;
  subscription_expires_at?: string;
  credit_balance_usd?: number;
  reason?: string;
}

// Atomically claims the payment (guards against double-crediting on a
// concurrent re-poll) and applies its effect to the owning api_keys row,
// in a single database transaction — see the confirm_payment() RPC.
export async function confirmPayment(paymentId: string, txSignature: string): Promise<ConfirmPaymentResult> {
  const { data, error } = await supabase.rpc('confirm_payment', {
    p_payment_id: paymentId,
    p_tx_signature: txSignature,
  });

  if (error) {
    console.error('[billing-store] confirmPayment RPC error:', error.message);
    return { claimed: false };
  }
  return data as ConfirmPaymentResult;
}

// Returns the new cycle-call count, or null on error (caller should fail
// open rather than block a paying subscriber over an infra hiccup).
// Growth is capped at quota+1 server-side (see the RPC) — once a
// subscriber is definitively in overage, the exact count past that
// point is meaningless for billing (tracked via credit_balance_usd
// instead) and shouldn't grow unbounded for a heavy overage user.
export async function incrementSubscriptionUsage(keyId: string, quota: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('increment_subscription_usage', { p_key_id: keyId, p_quota: quota });

  if (error) {
    console.error('[billing-store] incrementSubscriptionUsage error:', error.message);
    return null;
  }
  return data as number;
}

// Result of incrementSubscriptionUsageBy() — both values come from the
// SAME atomic SQL operation (v7.16's SELECT ... FOR UPDATE), not a
// separate earlier read. oldCount is the count BEFORE this batch's
// increment landed — this is what the free/overage split in
// lib/rate-limit.ts's enforceRateLimitBatch() must use instead of any
// pre-fetched key.subscription_cycle_calls_used, precisely to avoid the
// race v7.16 fixes.
export interface SubscriptionUsageIncrement {
  oldCount: number;
  newCount: number;
}

// Same as incrementSubscriptionUsage() but by an arbitrary amount — used
// by the batch endpoint (N mints in one call = N counted against the
// subscription's monthly quota). Same fail-open-null contract.
//
// increment_subscription_usage_by() is declared `returns table(...)` in
// Postgres, so PostgREST/supabase-js returns `data` as an array of rows
// (always exactly one row here, since the underlying UPDATE targets a
// single key_id) — not a bare scalar like the single-increment RPC.
export async function incrementSubscriptionUsageBy(
  keyId: string,
  quota: number,
  amount: number,
): Promise<SubscriptionUsageIncrement | null> {
  const { data, error } = await supabase.rpc('increment_subscription_usage_by', {
    p_key_id: keyId,
    p_quota: quota,
    p_amount: amount,
  });

  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) {
    console.error('[billing-store] incrementSubscriptionUsageBy error:', error?.message ?? 'no row returned');
    return null;
  }
  return { oldCount: row.old_count, newCount: row.new_count };
}

// Returns the new balance on success, or null if the balance was
// insufficient (or on a database error — both fail the overage call).
export async function decrementCreditIfSufficient(keyId: string, amount: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('decrement_credit_if_sufficient', {
    p_key_id: keyId,
    p_amount: amount,
  });

  if (error) {
    console.error('[billing-store] decrementCreditIfSufficient error:', error.message);
    return null;
  }
  return data as number | null;
}

// Returns true if this payment WAS pending and just got flipped to
// 'expired' (i.e. the caller should treat it as expired now); false if
// it was too fresh to expire, already resolved, or on a database error
// (fails closed toward "not expired" — never silently discards a
// possibly-still-payable invoice).
export async function expireStalePendingPayment(paymentId: string, ttlMinutes: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('expire_stale_pending_payment', {
    p_payment_id: paymentId,
    p_ttl_minutes: ttlMinutes,
  });

  if (error) {
    console.error('[billing-store] expireStalePendingPayment error:', error.message);
    return false;
  }
  return data === true;
}
