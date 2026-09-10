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
//   { kind: 'listing', tier, ca }        | { kind: 'banner', days, banner_slot }
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
    usd = price.usd;
    bannerSlot = slot;
    tierLabel = `${input.days}d`;
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
      })
      .select('id, expires_at')
      .single();

    if (!inserted.error && inserted.data) {
      return NextResponse.json({
        ok: true,
        orderId: inserted.data.id,
        payAmount,
        displayAmount: formatPayAmount(payAmount, currency),
        currency,
        expiresAt: inserted.data.expires_at,
      });
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
