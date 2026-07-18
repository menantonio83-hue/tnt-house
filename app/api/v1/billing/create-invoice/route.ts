// Version 7.5 — app/api/v1/billing/create-invoice/route.ts
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
