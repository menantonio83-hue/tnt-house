// Version 8.3 — app/api/v1/billing/create-invoice/route.ts
//
// v8.3: priceInvoice() can now return null (live price fetch failed AND
// no fresh-enough cached price — see lib/billing-pricing.ts's version
// note for the bug this fixes). When that happens this route refuses to
// create the invoice rather than ever price it off a stale guess, and
// tells the caller to pick a different currency (USDC never fails this
// way — it's a 1:1 stablecoin with no external price dependency).
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
  priceInvoice,
  formatPayAmount,
  WALLET_ADDRESS,
  MRDT_CA,
  USDC_CA,
  SUBSCRIPTION_USD,
  MIN_TOPUP_USD,
  MAX_TOPUP_USD,
  type Currency,
  type InvoiceKind,
} from '@/lib/billing-pricing';
import { createPaymentInvoice } from '@/lib/billing-store';

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

    const priced = await priceInvoice(usdAmount, currency);

    if (!priced) {
      return NextResponse.json(
        {
          error: `Could not get a reliable ${currency} price right now — please try USDC instead, or try ${currency} again in a few minutes.`,
          currency_unavailable: currency,
        },
        { status: 503 },
      );
    }

    const payment = await createPaymentInvoice(key.id, kind, currency, usdAmount, priced.payAmount);

    if (!payment) {
      return NextResponse.json({ error: 'Failed to create invoice, please try again' }, { status: 500 });
    }

    return NextResponse.json({
      payment_id: payment.id,
      kind,
      currency,
      usd_amount: usdAmount,
      pay_amount: priced.payAmount,
      pay_amount_formatted: formatPayAmount(priced.payAmount, currency),
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
