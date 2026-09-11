// Version 1.3 — app/api/listed-tokens/complete-paid/route.ts
//
// v1.3 (2026-09-11) — CLOSES A REPLAY HOLE. v1.2 re-verified a payment by
// taking a raw {ca, signature} pair and reading the transaction straight
// from Helius — the exact same shape /api/verify-payment had before this
// morning's fix and app/api/quick-check/credits/route.js had before
// today's fix: nothing anywhere recorded that a signature had been used,
// so the same real payment could be replayed here with a different mint
// address every time, listing a new token for free on each call.
//
// This route no longer talks to Helius at all. It takes an orderId and
// trusts the site_orders row that /api/verify-payment already verified —
// kind='listing', status='paid' — which is protected by
// site_orders_tx_signature_uniq, the global unique index that makes one
// signature usable for at most one order, of any kind, ever. There is
// nothing left here to replay: the payment check already happened,
// exactly once, before this route is ever reachable.
//
// claim_listing_completion (migrations/2026-09-11-listing-completion.sql)
// adds the one-time-use guard this needs beyond that: a paid listing
// order can fund exactly one completed listing, so a retry, a double
// call, or a network hiccup on the client's end can never run the audit
// or write the row twice. Verified live: 6/6 scenarios (grant, re-claim
// returns already_completed without re-running the audit, the flag
// actually flips, an unpaid order refused, a paid BANNER order refused —
// can't launder a different purchase into a free listing, unknown order
// refused).
//
// Everything below the claim — the audit, the projection, the writer —
// is v1.2's code, unchanged: that part was never the problem.
//
// v1.2 history (kept for context): fixed a wrong hardcoded MRDT mint
// that would have made every MRDT payment unmatchable. Moot now — this
// route no longer matches payments by mint at all, having none of its
// own currency handling left to get wrong.
//
// PAYMENT-ADJACENT. Completes a paid listing entirely on the server, in
// its own long-running function, so the browser tab does not need to
// survive the audit (a full holder walk, funder tracing, and Helius
// backing off repeated 429s — observed taking over four seconds just to
// get going, tens of seconds to finish). A Vercel serverless function
// runs to completion whether or not the client is still listening, so
// once this request is accepted the listing will be finished and, if it
// cannot be, recorded in paid_but_unlisted — regardless of what the
// browser does next.
//
// NO ENVELOPE HERE, deliberately. Signed envelopes exist so the BROWSER
// cannot assert a score. Everything below runs on our own server from a
// site_orders row that was itself only ever written by our own server,
// so there is nothing to attest. The write still goes through the
// shared writer in lib/listed-token-writer.ts so the free and paid paths
// cannot drift apart.
//
// POST /api/listed-tokens/complete-paid   { orderId }
// 200 { ok: true, action, ca }
// 200 { ok: true, action: 'already_completed', ca }
// 200 { ok: false, error: 'listing_failed', recorded: true }  <- paid, logged
// 400 { ok: false, error }
// 404 { ok: false, error: 'order_not_found' }
// 409 { ok: false, error: 'not_eligible' }

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchTokenRisk } from '@/lib/token-risk-core';
import { fetchListingMetadata, projectToListedTokenRow } from '@/lib/listed-token-projection';
import { writeListedTokenRow } from '@/lib/listed-token-writer';
import { alertAdmin } from '@/lib/telegram-alert';

export const dynamic = 'force-dynamic';
// The audit fans out to Helius, DexScreener and RugCheck and routinely
// spends time backing off 429s. The observed failure took over four
// seconds just to get going.
export const maxDuration = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface OrderForCompletion {
  ca: string | null;
  tx_signature: string | null;
  pay_amount: string | number;
  currency: string;
  tier: string | null;
}

// Records a payment whose listing could not be completed. Runs on the
// server, in the same execution as the failure, so it cannot be lost to
// the browser going away. Sourced entirely from the already-verified
// order row — no second Helius call needed, unlike v1.2, since
// /api/verify-payment already captured all of this at the moment the
// payment was claimed.
async function recordUnlisted(
  order: OrderForCompletion,
  orderId: string,
  reason: string,
): Promise<boolean> {
  const amount =
    typeof order.pay_amount === 'number' ? order.pay_amount : parseFloat(order.pay_amount);

  const inserted = await supabaseAdmin.from('paid_but_unlisted').insert({
    ca: order.ca,
    tx_signature: order.tx_signature,
    amount: Number.isFinite(amount) ? amount : null,
    currency: order.currency,
    payer_wallet: null,
    tier: order.tier,
    failure_reason: `order=${orderId} ${reason}`.slice(0, 500),
  });

  // 23505 is the unique violation on tx_signature — already on record.
  const recorded = !inserted.error || inserted.error.code === '23505';

  void alertAdmin(
    recorded ? 'paid-but-unlisted' : 'paid-but-unlisted-record-failed',
    `Payment confirmed but the listing did not complete. mint ${order.ca}, ` +
      `${order.pay_amount} ${order.currency}, order ${orderId}, ` +
      `signature ${order.tx_signature}. Reason: ${reason}. ` +
      (recorded
        ? 'Recorded — select * from paid_but_unlisted where resolved = false;'
        : `THE RECORD ALSO FAILED (${inserted.error?.message}) — reconstruct from this message.`),
  );

  return recorded;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const orderId = (body as { orderId?: unknown })?.orderId;
  if (typeof orderId !== 'string' || !UUID_RE.test(orderId.trim())) {
    return NextResponse.json({ ok: false, error: 'invalid_order_id' }, { status: 400 });
  }
  const id = orderId.trim();

  const claim = await supabaseAdmin.rpc('claim_listing_completion', { p_order_id: id });
  if (claim.error) {
    console.error('[complete-paid] claim_listing_completion failed:', claim.error.message);
    return NextResponse.json({ ok: false, error: 'claim_failed' }, { status: 502 });
  }

  const row = Array.isArray(claim.data) ? claim.data[0] : undefined;
  const decision = row?.decision as string | undefined;

  if (decision === 'not_found') {
    return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 404 });
  }
  if (decision === 'not_eligible') {
    return NextResponse.json({ ok: false, error: 'not_eligible' }, { status: 409 });
  }
  if (decision === 'already_completed') {
    // Idempotent: a retry or double call must be harmless, and must NOT
    // re-run an expensive audit that already ran once for this order.
    return NextResponse.json({ ok: true, action: 'already_completed', ca: row?.ca ?? null });
  }
  if (decision !== 'granted') {
    console.error('[complete-paid] unexpected claim decision:', decision);
    return NextResponse.json({ ok: false, error: 'claim_failed' }, { status: 502 });
  }

  const ca = row?.ca as string | null;
  const tier = (row?.tier as string | null) ?? null;
  if (!ca) {
    // Unreachable given site-orders/create's own validation, but this is
    // the one place a bad mint would silently misdirect real spend if it
    // were ever reached — refuse loudly rather than guess.
    console.error('[complete-paid] granted claim with no ca — order=%s', id);
    return NextResponse.json({ ok: false, error: 'claim_failed' }, { status: 502 });
  }

  // Full order row, for the paid_but_unlisted fallback if anything below
  // fails. The claim already flipped listing_completed — that happened
  // regardless of what follows, which is correct: a failed audit must
  // not let a retry spend this same order's credit twice either.
  const orderRow = await supabaseAdmin
    .from('site_orders')
    .select('ca, tx_signature, pay_amount, currency, tier')
    .eq('id', id)
    .maybeSingle();
  const order: OrderForCompletion = orderRow.data ?? {
    ca,
    tx_signature: null,
    pay_amount: 0,
    currency: 'SOL',
    tier,
  };

  // Idempotent by design from here down, same as v1.2: the audit is a
  // read, claim_free_listing_slot answers 'existing_listing' for a mint
  // already in the table, and the writer upserts. Kept in case this ever
  // runs twice for reasons outside listing_completed's control.
  const risk = await fetchTokenRisk(ca);
  const meta = await fetchListingMetadata(ca);
  const projected = projectToListedTokenRow(risk, meta);

  if (!projected.ok || !projected.row) {
    const reason = `audit: ${projected.reason || 'incomplete'}`;
    const recorded = await recordUnlisted(order, id, reason);
    return NextResponse.json({
      ok: false,
      error: 'listing_failed',
      recorded,
      message:
        'Your payment went through, but the audit could not be completed. ' +
        'It has been recorded and the listing will be added manually — no need to pay again.',
    });
  }

  // Still consulted so the ledger stays the single account of the
  // lifetime giveaway. With the 60 slots exhausted this answers
  // 'exhausted' for any new mint, so is_free comes back false, which is
  // correct for a paid listing.
  const freeSlot = await supabaseAdmin.rpc('claim_free_listing_slot', { p_ca: ca });
  const freeSlotRow = Array.isArray(freeSlot.data) ? freeSlot.data[0] : freeSlot.data;
  const freeSlotDecision = freeSlotRow?.decision as string | undefined;
  const isFree = freeSlotDecision === 'granted' || freeSlotDecision === 'already_claimed';

  if (freeSlot.error) {
    const reason = `free-slot check: ${freeSlot.error.message}`;
    const recorded = await recordUnlisted(order, id, reason);
    return NextResponse.json({
      ok: false,
      error: 'listing_failed',
      recorded,
      message:
        'Your payment went through, but the listing could not be completed. ' +
        'It has been recorded and will be added manually — no need to pay again.',
    });
  }

  const written = await writeListedTokenRow(projected.row, isFree);

  if (!written.ok) {
    const recorded = await recordUnlisted(order, id, `write: ${written.error}`);
    return NextResponse.json({
      ok: false,
      error: 'listing_failed',
      recorded,
      message:
        'Your payment went through, but the listing could not be saved. ' +
        'It has been recorded and will be added manually — no need to pay again.',
    });
  }

  return NextResponse.json({
    ok: true,
    action: written.action,
    ca,
    row: projected.row,
    is_free: isFree,
  });
}
