// Version 8.2 — lib/billing-pricing.ts
//
// v8.2: real production bug — an MRDT invoice was priced at
// FALLBACK_MRDT_PRICE_USD ($0.0000130) while the true live DexScreener
// price at that exact moment was $0.000006808, an ~1.9x overcharge.
// getLivePriceUsd caught any failure silently and fell straight through
// to a hardcoded constant with zero logging of WHY the live fetch
// failed, and that constant itself had no mechanism to ever get updated
// — inherently dangerous for a volatile memecoin like MRDT, and a real
// (if smaller) risk for SOL too.
//
// Replaced the whole resolution strategy. New order, per mint:
//   1. Live DexScreener price (via lib/helius-client.js's
//      getDexScreenerData, NOT modified — wrapped here with an explicit
//      timeout, since that function itself has none and a hang was
//      exactly the class of bug that caused Stage 6's 502 issue).
//      On success: used immediately AND cached (lib/price-cache.ts) for
//      next time.
//   2. If live fails: the last successfully-observed live price, IF it's
//      not older than PRICE_CACHE_MAX_AGE_MS. Real market data, not a
//      guess — self-updating every time a live fetch succeeds, unlike a
//      hardcoded constant that silently rots.
//   3. If both fail: priceInvoice() returns null. The caller
//      (app/api/v1/billing/create-invoice) MUST refuse to create the
//      invoice in that currency rather than ever guess a price again —
//      see that route for the user-facing error.
// Every branch now logs why, so a future incident is diagnosable instead
// of silent.
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

const PRICE_FETCH_TIMEOUT_MS = 8000;
// Deliberately short — MRDT can move a lot in a few hours. A stale-but-
// recent cached price is still real market data and far better than a
// number someone typed in once; past this age it's no better than the
// hardcoded constant this replaced, so it's treated as unavailable too.
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

// Every otherwise-identical invoice (e.g. every $49 subscription) gets a
// small unique offset so payments can be matched by amount+time against
// Helius without colliding — see lib/billing-verify.ts. Applied AFTER
// currency conversion and per-currency, because MRDT amounts are whole
// tokens only (no fractional precision to salt in USD-cents terms; a
// tiny USD salt could round away to nothing depending on MRDT's price).
//
// Ranges widened after collision-testing (see v7.9's history) — still
// visually negligible next to the invoice total, but with a much larger
// slot space. This is a probabilistic defense; the database's unique
// tx_signature constraint is what actually guarantees no double-
// crediting even on the rare residual collision.
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

// Returns null if this currency can't be safely priced right now (live
// fetch failed AND no fresh-enough cached price) — the caller MUST
// refuse to create the invoice rather than ever fall back to a guess.
export async function priceInvoice(usdAmount: number, currency: Currency): Promise<PricedInvoice | null> {
  if (currency === 'USDC') {
    // 1:1 stablecoin — no external price dependency at all.
    return { currency, usdAmount, payAmount: saltUsdc(usdAmount) };
  }

  if (currency === 'SOL') {
    const resolved = await resolvePriceUsd(WRAPPED_SOL_MINT, 'SOL');
    if (!resolved) return null;
    const solAmount = usdAmount / resolved.price;
    return { currency, usdAmount, payAmount: saltSol(solAmount) };
  }

  // MRDT
  const resolved = await resolvePriceUsd(MRDT_CA, 'MRDT');
  if (!resolved) return null;
  const mrdtAmount = usdAmount / resolved.price;
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
