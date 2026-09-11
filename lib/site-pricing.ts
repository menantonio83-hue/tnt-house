// Version 1.1 — lib/site-pricing.ts
//
// The prices for consumer-site listings and banners, on the server.
//
// WHY THIS EXISTS: /api/verify-payment used to take expectedAmount from
// the browser. The server never knew what was being bought, so it could
// not tell a correct payment from an underpayment — an order for the $29
// tier could be "confirmed" with a $3 transfer. Moving the price here is
// what makes that checkable: the browser asks for a tier, and the server
// decides what that costs.
//
// The figures below are exactly what app/page.js charges today. Each is
// currently written twice in that file — once in a helper
// (getMrdtDiscountedUsd / getAmountForBanner) and again inline at the
// point of sale (page.js ~2442 and ~3553) — which is one edit away from
// the two disagreeing. Once the browser stops computing prices, these are
// the only copies.
//
// Both ladders were repriced in v1.111 and the inline comment there states
// there is no longer a separate MRDT-discounted ladder: the helper and the
// inline table return the same numbers, and that single ladder is what is
// reproduced here.
//
// The mappings are exhaustive allowlists, not defaults. app/page.js falls
// through to the cheapest price for any unrecognised tier, which is
// exactly the shape that lets a typo become a discount; an unknown tier is
// rejected here instead.

export type SiteOrderKind = 'listing' | 'banner';

// selectedTier values in app/page.js: 'basic' (initial state), 'fast', 'vip'.
export const LISTING_TIER_USD: Record<string, number> = {
  basic: 3,
  fast: 9,
  vip: 29,
};

// bannerFormData.days values in app/page.js: '1', '2', '6'.
export const BANNER_DAYS_USD: Record<string, number> = {
  '1': 5,
  '2': 9,
  '6': 19,
};

export const BANNER_SLOTS = 3;

// app/page.js FREE_BANNER_TOTAL. Kept here so the server, not the browser,
// is the authority on how many free banners remain.
export const FREE_BANNER_TOTAL = 5;

export interface PriceLookup {
  ok: boolean;
  usd: number | null;
  reason: string | null;
}

export function priceListingUsd(tier: unknown): PriceLookup {
  if (typeof tier !== 'string' || !(tier in LISTING_TIER_USD)) {
    return {
      ok: false,
      usd: null,
      reason: `unknown listing tier: ${typeof tier === 'string' ? tier : typeof tier}`,
    };
  }
  return { ok: true, usd: LISTING_TIER_USD[tier], reason: null };
}

export function priceBannerUsd(days: unknown): PriceLookup {
  const key = typeof days === 'number' ? String(days) : days;
  if (typeof key !== 'string' || !(key in BANNER_DAYS_USD)) {
    return {
      ok: false,
      usd: null,
      reason: `unknown banner duration: ${typeof key === 'string' ? key : typeof key}`,
    };
  }
  return { ok: true, usd: BANNER_DAYS_USD[key], reason: null };
}
