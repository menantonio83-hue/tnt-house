// Version 1.3 — app/api/site-orders/create/route.ts
//
// v1.3 (2026-09-11): kind: 'banner' now also carries the banner's actual
// content (tokenName, bannerImg, description, targetLink), validated
// here and stored on the order. Previously the browser held this
// content until payment confirmed, then wrote it directly to
// active_banner with the publishable key — the write itself checked
// nothing, which combined with that table's then-public RLS meant
// anyone could overwrite any banner slot without paying at all (see
// migrations/2026-09-11-banner-lockdown.sql). The content now travels
// with the order so /api/verify-payment can write it server-side, at
// the moment a real payment is claimed, the same way it already awards
// Quick Check credits.
//
// Version 1.2 — app/api/site-orders/create/route.ts
//
// v1.2 (2026-09-11): adds kind: 'credits' for Quick Check paid credit
// packages, replacing the standalone app/api/quick-check/credits/route.js
// (deleted). That route took expectedAmount/since/method from the
// browser with a 5% tolerance and recorded no signature anywhere, so the
// same on-chain transfer could be replayed to mint unlimited credits.
// Routing credits through this same order ledger gives them, for free,
// everything already built for listing/banner: a server-decided price,
// a salted amount, and a signature that is globally unique across every
// order kind — a signature spent on one credits order can never pay for
// another order of any kind.
//
// credit_identity is the Quick Check fingerprint cookie value (NOT
// IP+fingerprint — see lib/quick-check-limit.ts v1.2), read from or
// minted into the same tnt_qc_fp cookie app/api/quick-check/route.js
// already sets, so a credits purchase does not require having run a
// free check first the way the old endpoint did.
//
// Version 1.1 — app/api/site-orders/create/route.ts
//
// PAYMENT PATH. Creates the server-side record of what is being bought.
//
// Until now the consumer site had no order record at all. The browser
// picked a tier, converted it to a token amount with a live price it
// fetched itself, and later told /api/verify-payment what to look for.
// The server had nothing to compare against, so two things were
// impossible to detect: an underpayment (order the $29 tier, pay $3) and
// a replay (the same transaction confirming any number of purchases).
//
// This route fixes the first half by deciding the price itself. The
// browser sends what it wants to buy — never how much it costs — and gets
// back an order id and the exact amount to send.
//
// THE AMOUNT IS SALTED, and that is what makes matching by amount safe.
// A few random units in the 6th decimal make each pending order's amount
// unique, so a transfer of that exact size identifies one order and no
// other. A partial unique index on (currency, pay_amount) WHERE status =
// 'pending' enforces the uniqueness in the database rather than trusting
// the loop below to have got it right. Same mechanism as
// risk_api_payments, deliberately — that table already survives this in
// production, and a second differently-shaped solution would be a second
// thing to get wrong.
//
// POST /api/site-orders/create
//   { kind: 'listing', tier, ca }
//   | { kind: 'banner', days, banner_slot, tokenName, bannerImg, description, targetLink }
//   | { kind: 'credits', packageId }
//   + currency: 'SOL' | 'USDC' | 'MRDT'
// 200 { ok: true, orderId, payAmount, displayAmount, currency, expiresAt }
// 400 { ok: false, error }
// 429 { ok: false, error: 'too_many_pending' }
// 503 { ok: false, error: 'pricing_unavailable' | 'salt_exhausted' }

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveBaseAmount, applySalt, formatPayAmount } from '@/lib/billing-pricing';
import { priceListingUsd, priceBannerUsd, BANNER_SLOTS } from '@/lib/site-pricing';
import { CREDIT_PACKAGES, type CreditPackageId } from '@/lib/quick-check-limit';

export const dynamic = 'force-dynamic';

type Currency = 'SOL' | 'USDC' | 'MRDT';
const CURRENCIES: Currency[] = ['SOL', 'USDC', 'MRDT'];

// Anti-salt-flood. Every pending order holds its salted amount out of
// circulation until it is paid or expires, so an anonymous buyer must not
// be able to open them without limit. risk_api_payments caps this per API
// key; there is no key here, so the cap is per IP.
const MAX_PENDING_PER_IP = 4;

// Retry budget when a freshly salted amount collides with another pending
// order. Mirrors MAX_SALT_ATTEMPTS in lib/billing-pricing.ts.
const MAX_SALT_ATTEMPTS = 8;

// Vercel overwrites x-forwarded-for with the real client IP and does not
// forward externally supplied values, so the first entry is trustworthy.
function extractClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}

function isRealSolanaAddress(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

// Server-side twin of app/page.js's isValidHttpUrl — same rule (parse as
// a real URL, accept only http/https), because the client's own check is
// no longer the authority once the content is stored and used here.
function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// M-10: hard caps on stored banner content, mirroring
// app/api/banners/claim/route.ts v1.2.
const BANNER_TOKEN_NAME_MAX = 50;
const BANNER_DESC_MAX = 300;
const BANNER_LINK_MAX = 500;
const BANNER_IMG_MAX_CHARS = 400_000;

function isValidBannerImage(value: string): boolean {
  if (value.length > BANNER_IMG_MAX_CHARS) return false;
  if (/^https?:\/\//i.test(value)) return isValidHttpUrl(value);
  return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(value);
}

// Same cookie app/api/quick-check/route.js already sets and reads. A
// credits order needs an identity to credit on payment, and reusing this
// cookie means "buy credits" no longer requires "have already run a free
// check" the way the old, now-deleted endpoint did — it mints one here
// if none exists yet.
const FP_COOKIE = 'tnt_qc_fp';
const FP_MAX_AGE = 60 * 60 * 24 * 365; // 1 year — matches quick-check/route.js

function getOrCreateFingerprint(request: NextRequest): { fp: string; isNew: boolean } {
  const existing = request.cookies.get(FP_COOKIE)?.value;
  if (existing) return { fp: existing, isNew: false };
  // Global Web Crypto, not node:crypto's randomUUID export — this repo's
  // pinned @types/node (12.20.55, predating that export) does not
  // declare it, and the DOM lib already in tsconfig.json types the
  // global instead. Available on Vercel's Node runtime without import.
  return { fp: crypto.randomUUID(), isNew: true };
}

// Expiring a stale order is what returns its salted amount to the pool.
// Done opportunistically on each create rather than on a schedule, since
// this is the only place that cares.
async function expireStaleOrders(): Promise<void> {
  const { error } = await supabaseAdmin
    .from('site_orders')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());
  if (error) {
    // Non-fatal: the worst case is a slightly smaller salt pool.
    console.error('[site-orders/create] expiring stale orders failed:', error.message);
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const input = body as {
    kind?: unknown;
    tier?: unknown;
    ca?: unknown;
    days?: unknown;
    banner_slot?: unknown;
    packageId?: unknown;
    tokenName?: unknown;
    bannerImg?: unknown;
    description?: unknown;
    targetLink?: unknown;
    currency?: unknown;
  };

  const currency = input?.currency as Currency;
  if (!CURRENCIES.includes(currency)) {
    return NextResponse.json({ ok: false, error: 'invalid_currency' }, { status: 400 });
  }

  const kind = input?.kind;
  let usd: number | null = null;
  let ca: string | null = null;
  let bannerSlot: number | null = null;
  let tierLabel: string | null = null;
  let creditIdentity: string | null = null;
  let fpIsNew = false;
  let bannerTokenName: string | null = null;
  let bannerImg: string | null = null;
  let bannerDesc: string | null = null;
  let bannerTargetLink: string | null = null;

  if (kind === 'listing') {
    const price = priceListingUsd(input?.tier);
    if (!price.ok) {
      return NextResponse.json(
        { ok: false, error: 'invalid_tier', message: price.reason },
        { status: 400 },
      );
    }
    const mint = typeof input?.ca === 'string' ? input.ca.trim() : '';
    if (!mint || !isRealSolanaAddress(mint)) {
      return NextResponse.json({ ok: false, error: 'invalid_mint' }, { status: 400 });
    }
    usd = price.usd;
    ca = mint;
    tierLabel = String(input.tier);
  } else if (kind === 'banner') {
    const price = priceBannerUsd(input?.days);
    if (!price.ok) {
      return NextResponse.json(
        { ok: false, error: 'invalid_duration', message: price.reason },
        { status: 400 },
      );
    }
    const slot = Number(input?.banner_slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > BANNER_SLOTS) {
      return NextResponse.json({ ok: false, error: 'invalid_banner_slot' }, { status: 400 });
    }
    const name = typeof input?.tokenName === 'string' ? input.tokenName.trim() : '';
    const desc = typeof input?.description === 'string' ? input.description.trim() : '';
    const link = typeof input?.targetLink === 'string' ? input.targetLink.trim() : '';
    if (
      name.length > BANNER_TOKEN_NAME_MAX ||
      desc.length > BANNER_DESC_MAX ||
      link.length > BANNER_LINK_MAX
    ) {
      return NextResponse.json({ ok: false, error: 'banner_content_too_long' }, { status: 400 });
    }
    if (!name || !desc) {
      return NextResponse.json({ ok: false, error: 'invalid_banner_content' }, { status: 400 });
    }
    if (!isValidHttpUrl(link)) {
      return NextResponse.json({ ok: false, error: 'invalid_target_link' }, { status: 400 });
    }
    const img = typeof input?.bannerImg === 'string' ? input.bannerImg.trim() : '';
    if (img && !isValidBannerImage(img)) {
      return NextResponse.json({ ok: false, error: 'invalid_banner_img' }, { status: 400 });
    }
    usd = price.usd;
    bannerSlot = slot;
    tierLabel = `${input.days}d`;
    bannerTokenName = name.toUpperCase();
    bannerImg = img;
    bannerDesc = desc;
    bannerTargetLink = link;
  } else if (kind === 'credits') {
    const packageId = input?.packageId;
    const pkg =
      typeof packageId === 'string'
        ? CREDIT_PACKAGES[packageId as CreditPackageId]
        : undefined;
    if (!pkg) {
      return NextResponse.json(
        { ok: false, error: 'invalid_package', message: `unknown credit package: ${String(packageId)}` },
        { status: 400 },
      );
    }
    const { fp, isNew } = getOrCreateFingerprint(request);
    usd = pkg.usd;
    tierLabel = packageId as string;
    creditIdentity = fp;
    fpIsNew = isNew;
  } else {
    return NextResponse.json({ ok: false, error: 'invalid_kind' }, { status: 400 });
  }

  await expireStaleOrders();

  const ip = extractClientIp(request);
  const pending = await supabaseAdmin
    .from('site_orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('created_ip', ip);

  if (pending.error) {
    console.error('[site-orders/create] pending count failed:', pending.error.message);
    return NextResponse.json({ ok: false, error: 'order_check_failed' }, { status: 502 });
  }
  if ((pending.count ?? 0) >= MAX_PENDING_PER_IP) {
    return NextResponse.json(
      {
        ok: false,
        error: 'too_many_pending',
        message:
          'You already have several unpaid orders open. Finish or wait for one to expire before starting another.',
      },
      { status: 429 },
    );
  }

  // Live price -> base amount in the chosen currency. Shared with the
  // Risk-API so the site cannot drift onto a different conversion.
  const base = await resolveBaseAmount(usd as number, currency);
  if (!base) {
    return NextResponse.json(
      {
        ok: false,
        error: 'pricing_unavailable',
        message: 'Could not price this order right now. Please try again shortly.',
      },
      { status: 503 },
    );
  }

  // Retry on collision rather than pre-checking: the unique index is the
  // authority, and a check-then-insert would race two concurrent buyers.
  for (let attempt = 0; attempt < MAX_SALT_ATTEMPTS; attempt++) {
    const payAmount = applySalt(base.baseAmount, currency);

    const inserted = await supabaseAdmin
      .from('site_orders')
      .insert({
        kind,
        ca,
        banner_slot: bannerSlot,
        tier: tierLabel,
        currency,
        pay_amount: payAmount,
        base_amount: base.baseAmount,
        created_ip: ip,
        credit_identity: creditIdentity,
        banner_token_name: bannerTokenName,
        banner_img: bannerImg,
        banner_desc: bannerDesc,
        banner_target_link: bannerTargetLink,
      })
      .select('id, expires_at')
      .single();

    if (!inserted.error && inserted.data) {
      const res = NextResponse.json({
        ok: true,
        orderId: inserted.data.id,
        payAmount,
        displayAmount: formatPayAmount(payAmount, currency),
        currency,
        expiresAt: inserted.data.expires_at,
      });
      // Only credits orders carry an identity to persist, and only a
      // freshly minted one needs setting — an existing cookie already
      // round-trips on its own.
      if (kind === 'credits' && fpIsNew && creditIdentity) {
        res.headers.append(
          'Set-Cookie',
          `${FP_COOKIE}=${creditIdentity}; Path=/; Max-Age=${FP_MAX_AGE}; HttpOnly; SameSite=Lax; Secure`,
        );
      }
      return res;
    }

    // 23505 on the (currency, pay_amount) partial index means another
    // pending order already holds this amount — salt again.
    if (inserted.error?.code === '23505') continue;

    console.error('[site-orders/create] insert failed:', inserted.error?.message);
    return NextResponse.json({ ok: false, error: 'order_create_failed' }, { status: 502 });
  }

  console.error('[site-orders/create] salt exhausted after %d attempts', MAX_SALT_ATTEMPTS);
  return NextResponse.json(
    {
      ok: false,
      error: 'salt_exhausted',
      message: 'Could not start this order right now. Please try again in a minute.',
    },
    { status: 503 },
  );
}
