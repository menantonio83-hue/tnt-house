// Version 1.3 — app/api/verify-payment/route.ts
//
// v1.3 (2026-09-11): handles kind === 'banner' orders the same way v1.2
// handles kind === 'credits' — the actual product effect (here, writing
// active_banner) happens inside the winning claim, not from a client
// call after seeing verified:true. Before this, app/page.js wrote the
// banner itself directly to Supabase with the publishable key once it
// saw a successful poll; combined with active_banner's then-open RLS
// (migrations/2026-09-11-banner-lockdown.sql), that write path checked
// nothing at all — verified:true from a client's own polling loop was
// never proof of anything the server could rely on for what to persist.
//
// Version 1.2 — app/api/verify-payment/route.ts
//
// v1.2 (2026-09-11): handles kind === 'credits' orders (Quick Check
// paid packages, see app/api/site-orders/create/route.ts v1.2) by
// crediting the order's fingerprint identity through addCredits() at
// the exact moment this request wins the atomic claim — never on a
// re-poll of an already-paid order, since claim_site_order_payment only
// returns 'claimed' once per order. This is what closes the replay hole
// the old, now-deleted app/api/quick-check/credits/route.js had: that
// endpoint recorded no signature anywhere, so the same transaction could
// mint credits an unlimited number of times.
//
// REPLACES app/api/verify-payment/route.js. That file MUST BE DELETED in
// the same commit — Next.js refuses to build with two route files in one
// folder.
//
// WHAT WAS WRONG WITH THE OLD ROUTE
//
// It took `expectedAmount`, `since` and `method` straight from the
// browser, matched any incoming transfer within 5% of that amount, and
// returned verified:true. Three consequences:
//
//   1. Underpayment. The server never knew what was being bought, so a
//      $29 tier could be confirmed by asking it to look for $3.
//   2. Replay. Nothing was recorded. One real transaction could confirm
//      an unlimited number of purchases — just keep polling.
//   3. 5% tolerance. On a $29 order that is $1.45 of free room, wide
//      enough for a different order's payment to satisfy this one.
//
// WHAT THIS ROUTE DOES INSTEAD
//
// It accepts one field: orderId. Everything else — what was bought, what
// it costs, which currency, when the clock started — is read from the
// site_orders row the server itself wrote in /api/site-orders/create. The
// browser cannot influence any of it.
//
// The amount is salted to be unique among pending orders, so matching by
// amount identifies exactly one order. findMatchingPayment (shared with
// the Risk-API billing path) uses a currency-appropriate tolerance —
// microSOL, not 5% — plus failed-transaction filtering, pagination, and
// an independent timestamp check.
//
// The claim is atomic and happens in the database:
// claim_site_order_payment moves status/signature/paid_at together, gated
// on the row still being pending and unexpired. A signature already used
// by any other order violates site_orders_tx_signature_uniq and is
// rejected as a replay.
//
// POST /api/verify-payment
//   { orderId: string }
// 200 { verified: true,  received, signature, method, order }
// 200 { verified: false, reason }                  — still waiting
// 400 { verified: false, reason: 'invalid_order_id' }
// 404 { verified: false, reason: 'order_not_found' }
// 409 { verified: false, reason: 'signature_already_used' }
// 410 { verified: false, reason: 'order_expired' }
// 502 { verified: false, reason: 'order_lookup_failed' | 'claim_failed' }

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { findMatchingPayment } from '@/lib/billing-verify';
import { addCredits, type CreditPackageId } from '@/lib/quick-check-limit';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Currency = 'SOL' | 'MRDT' | 'USDC';
const CURRENCIES: Currency[] = ['SOL', 'MRDT', 'USDC'];

interface SiteOrderRow {
  id: string;
  kind: string;
  ca: string | null;
  banner_slot: number | null;
  tier: string | null;
  currency: string;
  pay_amount: string | number;
  status: string;
  tx_signature: string | null;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  credit_identity: string | null;
  banner_token_name: string | null;
  banner_img: string | null;
  banner_desc: string | null;
  banner_target_link: string | null;
}

const ORDER_COLUMNS =
  'id, kind, ca, banner_slot, tier, currency, pay_amount, status, tx_signature, created_at, expires_at, paid_at, credit_identity, banner_token_name, banner_img, banner_desc, banner_target_link';

// What the browser is allowed to learn about an order. Deliberately does
// not include created_ip or credit_identity — the latter is a
// fingerprint value, not something a client response needs to echo.
function publicOrder(order: SiteOrderRow) {
  return {
    id: order.id,
    kind: order.kind,
    tier: order.tier,
    ca: order.ca,
    banner_slot: order.banner_slot,
    currency: order.currency,
    status: order.status,
    paid_at: order.paid_at,
  };
}

// PostgREST serialises Postgres `numeric` as a JSON string, not a number.
// Multiplying or comparing it without this conversion silently produces
// NaN, which would make every comparison in findMatchingPayment false and
// the route would never confirm a real payment.
function readNumeric(value: string | number): number | null {
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function loadOrder(
  orderId: string,
): Promise<{ order: SiteOrderRow | null; failed: boolean }> {
  const { data, error } = await supabaseAdmin
    .from('site_orders')
    .select(ORDER_COLUMNS)
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    console.error('[verify-payment] order lookup failed:', error.message);
    return { order: null, failed: true };
  }
  return { order: (data as SiteOrderRow | null) ?? null, failed: false };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ verified: false, reason: 'invalid_json' }, { status: 400 });
  }

  const orderId = (body as { orderId?: unknown })?.orderId;
  if (typeof orderId !== 'string' || !UUID_RE.test(orderId.trim())) {
    return NextResponse.json({ verified: false, reason: 'invalid_order_id' }, { status: 400 });
  }

  const lookup = await loadOrder(orderId.trim());
  if (lookup.failed) {
    return NextResponse.json({ verified: false, reason: 'order_lookup_failed' }, { status: 502 });
  }
  if (!lookup.order) {
    return NextResponse.json({ verified: false, reason: 'order_not_found' }, { status: 404 });
  }

  const order = lookup.order;

  // Already settled. The poll loop keeps firing for a beat after success,
  // and a reloaded page may poll an order that was paid minutes ago —
  // both answer from the ledger instead of spending a Helius call.
  if (order.status === 'paid') {
    return NextResponse.json({
      verified: true,
      received: readNumeric(order.pay_amount),
      signature: order.tx_signature,
      method: order.currency,
      order: publicOrder(order),
    });
  }

  if (order.status !== 'pending' || new Date(order.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ verified: false, reason: 'order_expired' }, { status: 410 });
  }

  const payAmount = readNumeric(order.pay_amount);
  if (payAmount === null) {
    // The row is malformed — refuse rather than guess an amount. A CHECK
    // constraint makes this unreachable, which is exactly why reaching it
    // must be loud.
    console.error('[verify-payment] unreadable pay_amount on order %s', order.id);
    return NextResponse.json({ verified: false, reason: 'order_lookup_failed' }, { status: 502 });
  }

  const currency = order.currency as Currency;
  if (!CURRENCIES.includes(currency)) {
    console.error('[verify-payment] unknown currency on order %s: %s', order.id, order.currency);
    return NextResponse.json({ verified: false, reason: 'order_lookup_failed' }, { status: 502 });
  }

  // The clock starts when the server created the order, never at a time
  // the browser supplies. A transfer that predates the order cannot pay
  // for it.
  const since = new Date(order.created_at).getTime();
  const match = await findMatchingPayment(payAmount, currency, since);

  if (!match.found || !match.signature) {
    return NextResponse.json({
      verified: false,
      reason: match.reason || 'No matching transaction found.',
    });
  }

  const claim = await supabaseAdmin.rpc('claim_site_order_payment', {
    p_order_id: order.id,
    p_signature: match.signature,
  });

  if (claim.error) {
    // 23505 on site_orders_tx_signature_uniq: this signature already paid
    // for some other order. That is the replay case — refuse it loudly
    // and never confirm.
    if (claim.error.code === '23505') {
      console.error(
        '[verify-payment] replay refused: signature %s is already recorded against another order (attempted on %s)',
        match.signature,
        order.id,
      );
      return NextResponse.json(
        { verified: false, reason: 'signature_already_used' },
        { status: 409 },
      );
    }
    console.error('[verify-payment] claim failed:', claim.error.message);
    return NextResponse.json({ verified: false, reason: 'claim_failed' }, { status: 502 });
  }

  const outcome = Array.isArray(claim.data) ? claim.data[0]?.outcome : undefined;

  if (outcome === 'claimed') {
    // This request just won the atomic DB transition — claim_site_order_
    // payment's single gated UPDATE returns 'claimed' at most once per
    // order, so this branch runs exactly once regardless of how many
    // concurrent or later polls hit this route for the same order. That
    // is what makes it the right and only place to award credits: no
    // re-poll of an already-paid order reaches here.
    if (order.kind === 'credits' && order.credit_identity && order.tier) {
      const newBalance = await addCredits(order.credit_identity, order.tier as CreditPackageId);
      if (newBalance === null) {
        // The on-chain payment is real and the order is correctly marked
        // paid — only the Redis write failed. Unlike the old endpoint,
        // this is now a recorded, debuggable state: order id and
        // signature are both in site_orders, so a manual credit is
        // possible. It must never look like the payment itself failed.
        console.error(
          '[verify-payment] payment claimed but crediting failed — order=%s identity=%s package=%s signature=%s',
          order.id,
          order.credit_identity,
          order.tier,
          match.signature,
        );
      }
    }

    if (
      order.kind === 'banner' &&
      order.banner_slot &&
      order.banner_token_name &&
      order.banner_desc &&
      order.banner_target_link
    ) {
      // tier is written as `${days}d` by site-orders/create (e.g. '6d').
      // parseInt stops at the first non-digit, so this reads the day
      // count regardless of that suffix; a missing/malformed tier falls
      // back to 1 day rather than crashing the response for a payment
      // that has already, correctly, been marked paid.
      const days = parseInt(order.tier || '1', 10) || 1;
      const expiresAt = new Date(Date.now() + days * 86400 * 1000).toISOString();
      const bannerWrite = await supabaseAdmin.from('active_banner').upsert({
        id: order.banner_slot,
        token_name: order.banner_token_name,
        banner_img: order.banner_img || '',
        description: order.banner_desc,
        target_link: order.banner_target_link,
        expires_at: expiresAt,
      });
      if (bannerWrite.error) {
        // Same shape as the credits failure above: the payment is real
        // and paid, only the content write failed. Recorded loudly so
        // it can be replayed manually — order id and slot are both in
        // site_orders, nothing about which banner was bought is lost.
        console.error(
          '[verify-payment] payment claimed but banner write failed — order=%s slot=%s signature=%s error=%s',
          order.id,
          order.banner_slot,
          match.signature,
          bannerWrite.error.message,
        );
      }
    }

    const settled = await loadOrder(order.id);
    return NextResponse.json({
      verified: true,
      received: match.received ?? payAmount,
      signature: match.signature,
      method: currency,
      order: publicOrder(settled.order ?? { ...order, status: 'paid' }),
    });
  }

  if (outcome === 'already_paid') {
    // Another poll of this same order won the race. It is paid; report the
    // signature the ledger actually recorded, not the one this request
    // happened to match.
    const settled = await loadOrder(order.id);
    return NextResponse.json({
      verified: true,
      received: match.received ?? payAmount,
      signature: settled.order?.tx_signature ?? match.signature,
      method: currency,
      order: publicOrder(settled.order ?? { ...order, status: 'paid' }),
    });
  }

  if (outcome === 'expired') {
    return NextResponse.json({ verified: false, reason: 'order_expired' }, { status: 410 });
  }

  if (outcome === 'not_found') {
    return NextResponse.json({ verified: false, reason: 'order_not_found' }, { status: 404 });
  }

  console.error('[verify-payment] unexpected claim outcome on %s: %s', order.id, String(outcome));
  return NextResponse.json({ verified: false, reason: 'claim_failed' }, { status: 502 });
}
