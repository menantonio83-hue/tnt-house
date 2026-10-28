// Version 8.5 — app/api/v1/billing/create-invoice/route.ts
//
// v8.5: logic moved to lib/billing-actions.ts, shared with MCP tools; behaviour unchanged
//
// Version 8.4 — app/api/v1/billing/create-invoice/route.ts
//
// v8.4: [CRITICAL] anti-salt-flood fix. Previously this route computed
// a salted amount once and inserted it — if two invoices (an attacker's
// pre-created flood of pending invoices, and a real victim's genuine
// invoice) ever landed on the exact same (currency, pay_amount), the
// attacker's invoice — created first — could claim the victim's real
// on-chain payment via confirm_payment before the victim's own poll
// did, since matching is by amount+time, not by payer identity. Fixed
// with three layers:
// 1. A per-key cap (MAX_PENDING_INVOICES_PER_KEY) on how many pending
//    invoices one key can hold at once — checked before doing any
//    pricing work.
// 2. A DB-level partial unique index on
//    risk_api_payments(currency, pay_amount) WHERE status='pending' —
//    two pending invoices can never share an amount. This is the real,
//    unconditional guarantee; #1 and #3 just make legitimate use smooth
//    and abuse expensive.
// 3. On a collision (createPaymentInvoice returns collision: true), this
//    route retries with a freshly-salted amount (lib/billing-pricing.ts's
//    applySalt(), cheap — no re-fetch of the live price) up to
//    MAX_SALT_ATTEMPTS times before giving up with a 503.
// An attacker trying to pre-fill the salt space for a fixed price now
// hits hard insert failures well before covering a meaningful fraction
// of it, and can only ever hold MAX_PENDING_INVOICES_PER_KEY invoices
// per key at a time regardless.
//
// Also blocks top-ups for tier: 'paid' keys (already unlimited — there
// is nothing to top up credit for).
//
// POST /api/v1/billing/create-invoice
// Body: { api_key: "tnt_sk_...", kind: "subscription" | "topup", currency: "SOL"|"MRDT"|"USDC", usd_amount?: number }
//
// The API key itself (not a session/cookie) is the proof of ownership —
// same principle as any API-key-based product. Price is always decided
// server-side: subscription is always exactly SUBSCRIPTION_USD, topup
// amount is client-chosen but clamped to [MIN_TOPUP_USD, MAX_TOPUP_USD].
// Never trust a client-supplied price directly.

import { NextRequest, NextResponse } from 'next/server';
import { findApiKeyByRawKey } from '@/lib/api-key-store';
import { createInvoiceForKey } from '@/lib/billing-actions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const rawKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';

    if (!rawKey) {
      return NextResponse.json({ error: 'Missing api_key' }, { status: 400 });
    }

    const key = await findApiKeyByRawKey(rawKey);
    if (!key) {
      return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 });
    }

    const result = await createInvoiceForKey(key, {
      kind: body.kind,
      currency: body.currency,
      usd_amount: body.usd_amount,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error: any) {
    console.error('[billing/create-invoice] error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
