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
import {
  resolveBaseAmount,
  applySalt,
  formatPayAmount,
  WALLET_ADDRESS,
  MRDT_CA,
  USDC_CA,
  SUBSCRIPTION_USD,
  MIN_TOPUP_USD,
  MAX_TOPUP_USD,
  MAX_PENDING_INVOICES_PER_KEY,
  MAX_SALT_ATTEMPTS,
  type Currency,
  type InvoiceKind,
} from '@/lib/billing-pricing';
import { createPaymentInvoice, countPendingInvoicesForKey } from '@/lib/billing-store';

export const dynamic = 'force-dynamic';

const VALID_CURRENCIES: Currency[] = ['SOL', 'MRDT', 'USDC'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const rawKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';
    const kind: InvoiceKind = body.kind === 'topup' ? 'topup' : 'subscription';
    const currency: Currency = VALID_CURRENCIES.includes(body.currency) ? body.currency : 'USDC';

    if (!rawKey) {
      return NextResponse.json({ error: 'Missing api_key' }, { status: 400 });
    }

    const key = await findApiKeyByRawKey(rawKey);
    if (!key) {
      return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 });
    }

    let usdAmount: number;
    let label: string;

    if (kind === 'subscription') {
      if (key.tier === 'paid') {
        return NextResponse.json(
          { error: 'This key already has unlimited access — no subscription needed.' },
          { status: 400 },
        );
      }
      usdAmount = SUBSCRIPTION_USD;
      label = 'TNT House Risk-Data API — 30-day subscription';
    } else {
      if (key.tier === 'paid') {
        return NextResponse.json(
          { error: 'This key already has unlimited access — no call credits needed.' },
          { status: 400 },
        );
      }
      const requested = Number(body.usd_amount);
      if (!Number.isFinite(requested) || requested < MIN_TOPUP_USD || requested > MAX_TOPUP_USD) {
        return NextResponse.json(
          { error: `usd_amount must be between $${MIN_TOPUP_USD} and $${MAX_TOPUP_USD}` },
          { status: 400 },
        );
      }
      usdAmount = Math.round(requested * 100) / 100;
      label = `TNT House Risk-Data API — $${usdAmount} call credit top-up`;
    }

    // Anti-salt-flood layer 1: per-key cap, checked before any pricing work.
    const pendingCount = await countPendingInvoicesForKey(key.id);
    if (pendingCount >= MAX_PENDING_INVOICES_PER_KEY) {
      return NextResponse.json(
        {
          error: `You already have ${pendingCount} pending invoice(s). Pay or wait for one to expire (${MAX_PENDING_INVOICES_PER_KEY} max at a time) before creating another.`,
        },
        { status: 429 },
      );
    }

    const base = await resolveBaseAmount(usdAmount, currency);

    if (!base) {
      return NextResponse.json(
        {
          error: `Could not get a reliable ${currency} price right now — please try USDC instead, or try ${currency} again in a few minutes.`,
          currency_unavailable: currency,
        },
        { status: 503 },
      );
    }

    // Anti-salt-flood layers 2+3: the DB unique index is the real
    // guarantee; retrying with a fresh salt on a collision is what makes
    // that guarantee invisible to legitimate, non-adversarial traffic.
    let payment = null;
    for (let attempt = 0; attempt < MAX_SALT_ATTEMPTS; attempt++) {
      const payAmount = applySalt(base.baseAmount, currency);
      const result = await createPaymentInvoice(key.id, kind, currency, usdAmount, payAmount);

      if (result.payment) {
        payment = result.payment;
        break;
      }
      if (!result.collision) {
        // A real (non-collision) database error — no point retrying blindly.
        return NextResponse.json({ error: 'Failed to create invoice, please try again' }, { status: 500 });
      }
      // collision: true — loop again with a fresh salt.
    }

    if (!payment) {
      console.error(
        `[billing/create-invoice] exhausted ${MAX_SALT_ATTEMPTS} salt attempts for ${currency}/$${usdAmount} — possible salt-space exhaustion attempt or extremely unlucky collisions`,
      );
      return NextResponse.json(
        { error: 'Could not generate a unique invoice amount right now, please try again in a moment.' },
        { status: 503 },
      );
    }

    return NextResponse.json({
      payment_id: payment.id,
      kind,
      currency,
      usd_amount: usdAmount,
      pay_amount: payment.pay_amount,
      pay_amount_formatted: formatPayAmount(payment.pay_amount, currency),
      wallet_address: WALLET_ADDRESS,
      mrdt_ca: MRDT_CA,
      usdc_ca: USDC_CA,
      label,
      created_at: payment.created_at,
    });
  } catch (error: any) {
    console.error('[billing/create-invoice] error:', error);
    return NextResponse.json({ error: 'Internal error', details: error.message }, { status: 500 });
  }
}
