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
// REQUIRED: run this in the Supabase SQL editor before deploying the
// batch endpoint (not yet applied — billing-adjacent, holding for
// explicit sign-off per the standing payment-code rule). Confirmed the
// exact live definition of increment_subscription_usage() via
// pg_get_functiondef() before writing this — same
// least(current + N, quota + 1) cap logic, generalized from a
// hardcoded +1 to +p_amount. Two additions the original function
// doesn't have, both requested on review before this touches a real
// database: an explicit search_path (this repo already hit a real
// Supabase-linter bug from a missing search_path on other RPCs — see
// v7.12's note above), and a hard guard against p_amount <= 0 so a
// non-positive batch size errors instead of silently doing nothing or
// decrementing usage:
//
//   create or replace function increment_subscription_usage_by(p_key_id uuid, p_quota int, p_amount int)
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
//     update api_keys
//     set subscription_cycle_calls_used = least(subscription_cycle_calls_used + p_amount, p_quota + 1)
//     where id = p_key_id
//     returning subscription_cycle_calls_used into new_count;
//
//     return new_count;
//   end;
//   $$;
//
// Still a single atomic UPDATE ... RETURNING — no read-then-write race
// window, same as the original function.
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

// Same as incrementSubscriptionUsage() but by an arbitrary amount — used
// by the batch endpoint (N mints in one call = N counted against the
// subscription's monthly quota). Same fail-open-null contract.
export async function incrementSubscriptionUsageBy(
  keyId: string,
  quota: number,
  amount: number,
): Promise<number | null> {
  const { data, error } = await supabase.rpc('increment_subscription_usage_by', {
    p_key_id: keyId,
    p_quota: quota,
    p_amount: amount,
  });

  if (error) {
    console.error('[billing-store] incrementSubscriptionUsageBy error:', error.message);
    return null;
  }
  return data as number;
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
