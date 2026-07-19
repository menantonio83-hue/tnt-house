// Version 8.3 — lib/billing-pricing.ts
//
// v8.3: two fixes from the second external-review round:
//
// 1. [CRITICAL] Anti-salt-flood: priceInvoice() (which resolved a price
//    AND salted it in one shot) is replaced by resolveBaseAmount() +
//    applySalt(), split apart specifically so app/api/v1/billing/
//    create-invoice can retry ONLY the cheap salting step (not the
//    expensive live-price fetch) when a salt collision is rejected by
//    the new partial unique index on risk_api_payments(currency,
//    pay_amount) WHERE status='pending' — see that route and the SQL
//    migration for the full attack this closes (salt-space exhaustion
//    letting an attacker steal a victim's real payment).
//
// 2. formatPayAmount for USDC changed from toFixed(4) to toFixed(6) —
//    the salt lives in the 5th/6th decimal (saltUsdc adds
//    $0.000001-$0.009999), so a 4-decimal display could round away part
//    of the salt and show the user an amount that, if paid exactly as
//    displayed, might fall outside billing-verify.ts's 0.00005
//    tolerance. The automated /pay flow itself always used the full-
//    precision `pay_amount` value regardless (never the formatted
//    string), so this was a display-only gap, not a live mismatch — but
//    a real one if anyone ever pays by reading the screen instead of
//    letting /pay's auto-flow run.
//
// --- (v8.2 history) ---
// Real production bug: an MRDT invoice was priced at
// FALLBACK_MRDT_PRICE_USD ($0.0000130) while the true live DexScreener
// price at that exact moment was $0.000006808, an ~1.9x overcharge.
// Resolution order: live price (explicit timeout, the underlying fetch
// has none) -> last successfully-cached live price (<=6h old) -> refuse
// to price this currency at all. No hardcoded fallback constant exists
// anywhere in this file anymore.
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

import { waitUntil } from '@vercel/functions';
import { getDexScreenerData } from '@/lib/helius-client';
import { getCachedPrice, setCachedPrice } from '@/lib/price-cache';

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
export const MAX_PENDING_INVOICES_PER_KEY = 3; // anti-salt-flood: caps how many pending invoices one key can hold at once
export const MAX_SALT_ATTEMPTS = 8; // anti-salt-flood: retry budget when a salted amount collides with another pending invoice

const PRICE_FETCH_TIMEOUT_MS = 8000;
// Deliberately short — MRDT can move a lot in a few hours. A stale-but-
// recent cached price is still real market data and far better than a
// hardcoded number; past this age it's treated as unavailable too.
const PRICE_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface PricedInvoice {
  currency: Currency;
  usdAmount: number; // nominal value credited on confirm (unsalted)
  payAmount: number; // exact amount in `currency` the user must send (salted)
}

type DexPriceData = { price: number | null } | null;

// Explicit, typed race instead of reusing lib/with-timeout.ts's generic
// sentinel-fallback shape (which would need an `any` cast here to
// distinguish "timed out" from "resolved with no price" — not worth the
// loss of type safety for one call site).
function fetchLivePriceWithTimeout(mint: string): Promise<DexPriceData | 'timeout'> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve('timeout');
      }
    }, PRICE_FETCH_TIMEOUT_MS);

    getDexScreenerData(mint)
      .then((data: DexPriceData) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(data);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      });
  });
}

type PriceResolution = { price: number; source: 'live' | 'cache' } | null;

async function resolvePriceUsd(mint: string, label: string): Promise<PriceResolution> {
  const liveResult = await fetchLivePriceWithTimeout(mint);

  if (liveResult === 'timeout') {
    console.warn(
      `[billing-pricing] ${label} (${mint}): live price fetch timed out after ${PRICE_FETCH_TIMEOUT_MS}ms — falling back to cache`,
    );
  } else if (liveResult && typeof liveResult.price === 'number' && liveResult.price > 0) {
    waitUntil(setCachedPrice(mint, liveResult.price));
    return { price: liveResult.price, source: 'live' };
  } else {
    console.warn(
      `[billing-pricing] ${label} (${mint}): DexScreener returned no usable live price (no pool yet, upstream error, or null priceUsd) — falling back to cache`,
    );
  }

  const cached = await getCachedPrice(mint);
  if (cached && cached.ageMs <= PRICE_CACHE_MAX_AGE_MS) {
    console.warn(
      `[billing-pricing] ${label} (${mint}): using cached price $${cached.priceUsd} from ${Math.round(cached.ageMs / 60000)}min ago`,
    );
    return { price: cached.priceUsd, source: 'cache' };
  }

  console.error(
    `[billing-pricing] ${label} (${mint}): price unavailable — live fetch failed and cache is ${
      cached ? `stale (${Math.round(cached.ageMs / 3600000)}h old)` : 'empty'
    }. Refusing to price an invoice in this currency.`,
  );
  return null;
}

export interface ResolvedBaseAmount {
  currency: Currency;
  usdAmount: number;
  baseAmount: number; // unsalted amount in `currency` — salt applied separately, per attempt, via applySalt()
}

// The expensive half: resolve how much of `currency` equals `usdAmount`,
// with no randomness involved. Call this ONCE per invoice request —
// retries on a salt collision (see create-invoice) only need applySalt()
// again, not another live-price round trip.
export async function resolveBaseAmount(usdAmount: number, currency: Currency): Promise<ResolvedBaseAmount | null> {
  if (currency === 'USDC') {
    return { currency, usdAmount, baseAmount: usdAmount };
  }
  if (currency === 'SOL') {
    const resolved = await resolvePriceUsd(WRAPPED_SOL_MINT, 'SOL');
    if (!resolved) return null;
    return { currency, usdAmount, baseAmount: usdAmount / resolved.price };
  }
  const resolved = await resolvePriceUsd(MRDT_CA, 'MRDT');
  if (!resolved) return null;
  return { currency, usdAmount, baseAmount: usdAmount / resolved.price };
}

// Every otherwise-identical invoice (e.g. every $49 subscription) gets a
// small unique offset so payments can be matched by amount+time against
// Helius without colliding — see lib/billing-verify.ts. Applied AFTER
// currency conversion and per-currency, because MRDT amounts are whole
// tokens only (no fractional precision to salt in USD-cents terms; a
// tiny USD salt could round away to nothing depending on MRDT's price).
//
// Ranges widened after collision-testing found the original MRDT range
// (+1-50 whole tokens) collided ~38% of the time across just 5
// concurrent draws (birthday paradox). This randomness is now ALSO the
// thing retried on a DB-level unique-constraint rejection (see
// create-invoice's MAX_SALT_ATTEMPTS loop) — the constraint is the real
// guarantee against a colliding amount ever being accepted; the wide
// random range just keeps collisions (and therefore retries) rare in
// ordinary use.
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

// The cheap half: generates a fresh random salted amount from an
// already-resolved base amount. Safe to call repeatedly in a retry loop
// — pure math, no network/database access.
export function applySalt(baseAmount: number, currency: Currency): number {
  if (currency === 'USDC') return saltUsdc(baseAmount);
  if (currency === 'SOL') return saltSol(baseAmount);
  return saltMrdtWholeTokens(baseAmount);
}

// Same whole-vs-decimal formatting convention as app/page.js's
// formatPaymentAmountStr, so amounts displayed/paid here look identical
// in style to the rest of the site.
export function formatPayAmount(payAmount: number, currency: Currency): string {
  if (currency === 'SOL') return payAmount.toFixed(6);
  if (currency === 'USDC') return payAmount.toFixed(6); // was toFixed(4) — salt lives past the 4th decimal
  return String(Math.round(payAmount)); // MRDT: always a whole token amount
}
