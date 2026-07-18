// Version 7.13 — lib/billing-store.ts
//
// v7.13: added expireStalePendingPayment() — lazy TTL check for invoices
// stuck in 'pending' too long (see lib/billing-pricing.ts's
// PENDING_INVOICE_TTL_MINUTES). Checked on read from
// app/api/v1/billing/verify-payment, same lazy-expiry pattern already
// used by lib/risk-api-cache.ts, not a cron job.
//
// v7.12: fixed the Supabase linter's function_search_path_mutable
// warning on all three RPC functions below — applied directly against
// Supabase (ALTER FUNCTION ... SET search_path = public), no app code
// change needed. A function without a pinned search_path is vulnerable
// to hijacking if a caller can get objects created in a schema that
// resolves earlier in their search_path; pinning to `public` matches
// the schema everything here actually lives in. Re-verified all three
// RPCs still work correctly afterward (confirm_payment,
// decrement_credit_if_sufficient, increment_subscription_usage) via a
// smoke test against Supabase.
//
// v7.10: ConfirmPaymentResult now carries an optional `reason` — the
// confirm_payment() RPC returns one when a claim fails because the
// tx_signature was already used by a different payment row (the hard
// DB-level defense against double-crediting on a rare salt collision;
// see lib/billing-pricing.ts's version note).
//
// Supabase access for risk_api_payments and the billing RPC functions
// (increment_subscription_usage, decrement_credit_if_sufficient,
// confirm_payment, expire_stale_pending_payment — see the migration in
// this feature's SQL history). Uses the service-role client
// (lib/supabase-admin.ts) — this table has RLS enabled with no anon
// policies, same lockdown as the rest of the Risk-Data API tables.

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

export async function createPaymentInvoice(
  keyId: string,
  kind: InvoiceKind,
  currency: Currency,
  usdAmount: number,
  payAmount: number,
): Promise<PaymentRecord | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ key_id: keyId, kind, currency, usd_amount: usdAmount, pay_amount: payAmount })
    .select()
    .single();

  if (error) {
    console.error('[billing-store] createPaymentInvoice error:', error.message);
    return null;
  }
  return data as PaymentRecord;
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
export async function incrementSubscriptionUsage(keyId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('increment_subscription_usage', { p_key_id: keyId });

  if (error) {
    console.error('[billing-store] incrementSubscriptionUsage error:', error.message);
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
