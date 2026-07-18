// Version 7.14 — lib/billing-pricing.ts
//
// v7.14: added PENDING_INVOICE_TTL_MINUTES — how long a 'pending'
// invoice is given before app/api/v1/billing/verify-payment lazily
// flips it to 'expired' (see lib/billing-store.ts's
// expireStalePendingPayment). Deliberately generous and deliberately
// NOT the same thing as a transaction's blockhash validity window
// (~60-90s, a Solana-level concern handled inside app/pay/page.js when
// it builds the tx) — this is how long a *person* gets to open their
// wallet app and approve the payment.
//
// v7.9: widened salt ranges after collision-testing revealed the
// original MRDT range (+1-50 whole tokens) collided ~38% of the time
// across just 5 concurrent draws (birthday paradox) — not safe enough.
// Also: uniqueness here is now defense-in-depth, not the only
// protection — risk_api_payments.tx_signature has a hard unique
// constraint in the database (see the migration + confirm_payment()
// RPC), so even in the residual chance of a salt collision, only ONE
// invoice can ever successfully claim a given on-chain transaction.
// Verified both properties directly against Supabase: wide-range salts
// via an isolated collision-rate test, and the DB constraint via two
// payment rows racing for the same tx_signature (only one claimed).
//
// Pricing model (per project brief, confirmed after consulting three
// other AIs on the approach):
//   - Free:          15 req/day, full functionality, no card
//   - Pay-per-call:  $0.07/call over the free limit (rate drops to
//                    $0.03/call once subscribed — see below)
//   - Subscription:  $49 one-time payment = 1000 calls / 30 days from
//                     payment date (Solana Pay has no auto-recurring
//                     billing, so "subscription" means manual renewal,
//                     not auto-charge)
//
// Reuses the SAME recipient wallet, MRDT/USDC mints, and price source
// (DexScreener via lib/helius-client.js's getDexScreenerData — already
// built in Stage 1, not re-implemented) as the existing site payment
// flow in app/page.js. Does not import from app/page.js (it's a
// 'use client' page component, not an importable module) — these
// constants are the same PUBLIC values already visible in that file
// and in Vercel's page source, not secrets.

import { getDexScreenerData } from '@/lib/helius-client';

export const WALLET_ADDRESS = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
export const MRDT_CA = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
export const USDC_CA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112';

export type Currency = 'SOL' | 'MRDT' | 'USDC';
export type InvoiceKind = 'subscription' | 'topup';

export const FREE_DAILY_LIMIT = 15;
export const SUBSCRIPTION_USD = 49;
export const SUBSCRIPTION_MONTHLY_QUOTA = 1000;
export const SUBSCRIPTION_CYCLE_DAYS = 30;
export const OVERAGE_RATE_FREE_USD = 0.07; // per call, free tier over the daily cap
export const OVERAGE_RATE_SUBSCRIBED_USD = 0.03; // per call, subscribed and over monthly quota
export const MIN_TOPUP_USD = 5;
export const MAX_TOPUP_USD = 500;
export const PENDING_INVOICE_TTL_MINUTES = 45;

// Fallback prices if DexScreener is unreachable — same fallbacks already
// used client-side in app/page.js (getSafePrice / getSafeSolPrice), kept
// in sync so an invoice never fails outright over a price-fetch hiccup.
const FALLBACK_MRDT_PRICE_USD = 0.000013;
const FALLBACK_SOL_PRICE_USD = 85;

export interface PricedInvoice {
  currency: Currency;
  usdAmount: number; // nominal value credited on confirm (unsalted)
  payAmount: number; // exact amount in `currency` the user must send (salted)
}

async function getLivePriceUsd(mint: string, fallback: number): Promise<number> {
  try {
    const data = await getDexScreenerData(mint);
    if (data && typeof data.price === 'number' && data.price > 0) return data.price;
  } catch {
    // fall through to fallback
  }
  return fallback;
}

// Every otherwise-identical invoice (e.g. every $49 subscription) gets a
// small unique offset so payments can be matched by amount+time against
// Helius without colliding — see lib/billing-verify.ts. Applied AFTER
// currency conversion and per-currency, because MRDT amounts are whole
// tokens only (no fractional precision to salt in USD-cents terms; a
// tiny USD salt could round away to nothing depending on MRDT's price).
//
// Ranges widened after collision-testing (see version note above) —
// still visually negligible next to the invoice total, but with a much
// larger slot space. This is a probabilistic defense; the database's
// unique tx_signature constraint is what actually guarantees no
// double-crediting even on the rare residual collision.
function saltUsdc(usdAmount: number): number {
  const saltMicros = 1 + Math.floor(Math.random() * 9999); // $0.000001–$0.009999
  return Math.round(usdAmount * 1e6 + saltMicros) / 1e6;
}

function saltSol(solAmount: number): number {
  const saltMicroSol = 1 + Math.floor(Math.random() * 9999); // 0.000001–0.009999 SOL
  return Math.round(solAmount * 1e6 + saltMicroSol) / 1e6;
}

function saltMrdtWholeTokens(mrdtAmount: number): number {
  const saltTokens = 1 + Math.floor(Math.random() * 4999); // +1–4999 whole MRDT
  return Math.round(mrdtAmount) + saltTokens;
}

export async function priceInvoice(usdAmount: number, currency: Currency): Promise<PricedInvoice> {
  if (currency === 'USDC') {
    return { currency, usdAmount, payAmount: saltUsdc(usdAmount) };
  }

  if (currency === 'SOL') {
    const price = await getLivePriceUsd(WRAPPED_SOL_MINT, FALLBACK_SOL_PRICE_USD);
    const solAmount = usdAmount / price;
    return { currency, usdAmount, payAmount: saltSol(solAmount) };
  }

  // MRDT
  const price = await getLivePriceUsd(MRDT_CA, FALLBACK_MRDT_PRICE_USD);
  const mrdtAmount = usdAmount / price;
  return { currency, usdAmount, payAmount: saltMrdtWholeTokens(mrdtAmount) };
}

// Same whole-vs-decimal formatting convention as app/page.js's
// formatPaymentAmountStr, so amounts displayed/paid here look identical
// in style to the rest of the site.
export function formatPayAmount(payAmount: number, currency: Currency): string {
  if (currency === 'SOL') return payAmount.toFixed(6);
  if (currency === 'USDC') return payAmount.toFixed(4); // salted to 4dp, unlike the site's plain .toFixed(2)
  return String(Math.round(payAmount)); // MRDT: always a whole token amount
}
