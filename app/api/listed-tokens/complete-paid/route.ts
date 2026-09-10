// Version 1.1 — app/api/listed-tokens/complete-paid/route.ts
//
// PAYMENT PATH. Completes a paid listing entirely on the server.
//
// WHY THIS REPLACES THE BROWSER-DRIVEN VERSION. The previous attempt kept
// the work in the browser: after the payment verified, the page ran the
// audit and the save itself. It failed on the first real payment, and the
// logs show exactly how — the audit started at 10:57:30, the page
// navigated to / at 10:57:34, and the save was never called. The buyer
// paid, nothing was listed, and even the paid-but-unlisted fallback never
// ran, because it lived in the same JS context that had just been
// destroyed.
//
// The mistake was not a bug in that code. It was the shape: the old client
// write was one fast PATCH, and it was replaced with a chain that takes
// tens of seconds — a full holder walk, funder tracing, and Helius
// backing off through repeated 429s. Anything that long cannot depend on a
// tab staying open. A tab can be closed, a phone can sleep, a network can
// drop, and a payment flow that redirects on success will pull the rug
// itself.
//
// So the browser now makes ONE call and does not have to survive it. A
// Vercel serverless function runs to completion whether or not the client
// is still listening, so once this request is accepted the listing will be
// finished and, if it cannot be, recorded — regardless of what the browser
// does next. The response is a convenience for a caller that is still
// there, not the mechanism.
//
// NO ENVELOPE HERE, deliberately. Signed envelopes exist so the BROWSER
// cannot assert a score. Everything below runs on our own server from a
// mint address, so there is nothing to attest; signing a payload in order
// to verify it two lines later would be ceremony rather than safety. The
// write still goes through the shared writer in lib/listed-token-writer.ts
// so the free and paid paths cannot drift apart.
//
// POST /api/listed-tokens/complete-paid   { ca, signature, tier? }
// 200 { ok: true, action, ca }
// 200 { ok: false, error: 'listing_failed', recorded: true }  <- paid, logged
// 400 { ok: false, error }
// 402 { ok: false, error: 'payment_not_found' }

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
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

const RECIPIENT_WALLET = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_MINT = '2Sc1QpG6VhTVGqPGwvPBNrpxYYhZFTNTQ4WCcteJpump';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const LAMPORTS_PER_SOL = 1_000_000_000;

interface ChainFacts {
  amount: number | null;
  currency: string | null;
  payer: string | null;
}

function isRealSolanaAddress(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

// The payment is re-verified here from the signature rather than trusted
// from the caller. The browser has already seen /api/verify-payment say
// yes, but that answer reached us through the browser, and this route can
// consume a listing slot and publish a token.
async function readPaymentFromChain(signature: string): Promise<ChainFacts | null> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    console.error('[complete-paid] HELIUS_API_KEY not set');
    return null;
  }

  const res = await fetch(`https://api.helius.xyz/v0/transactions?api-key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: [signature] }),
  });
  if (!res.ok) {
    console.error(`[complete-paid] Helius returned ${res.status} for ${signature}`);
    return null;
  }

  const parsed = await res.json();
  const tx = Array.isArray(parsed) ? parsed[0] : null;
  if (!tx || tx.transactionError) return null;

  for (const t of tx.tokenTransfers || []) {
    if (t.toUserAccount !== RECIPIENT_WALLET) continue;
    if (t.mint === USDC_MINT) {
      return { amount: t.tokenAmount ?? null, currency: 'USDC', payer: t.fromUserAccount ?? null };
    }
    if (t.mint === MRDT_MINT) {
      return { amount: t.tokenAmount ?? null, currency: 'MRDT', payer: t.fromUserAccount ?? null };
    }
  }
  for (const t of tx.nativeTransfers || []) {
    if (t.toUserAccount !== RECIPIENT_WALLET) continue;
    return {
      amount: typeof t.amount === 'number' ? t.amount / LAMPORTS_PER_SOL : null,
      currency: 'SOL',
      payer: t.fromUserAccount ?? null,
    };
  }
  return null;
}

// Records a payment whose listing could not be completed. Runs on the
// server, in the same execution as the failure, so unlike the previous
// design it cannot be lost to the browser going away.
async function recordUnlisted(
  ca: string,
  signature: string,
  facts: ChainFacts,
  tier: string | null,
  reason: string,
): Promise<boolean> {
  const inserted = await supabaseAdmin.from('paid_but_unlisted').insert({
    ca,
    tx_signature: signature,
    amount: facts.amount,
    currency: facts.currency,
    payer_wallet: facts.payer,
    tier,
    failure_reason: reason.slice(0, 500),
  });

  // 23505 is the unique violation on tx_signature — already on record.
  const recorded = !inserted.error || inserted.error.code === '23505';

  void alertAdmin(
    recorded ? 'paid-but-unlisted' : 'paid-but-unlisted-record-failed',
    `Payment confirmed but the listing did not complete. mint ${ca}, ` +
      `${facts.amount ?? '?'} ${facts.currency ?? '?'} from ${facts.payer ?? 'unknown'}, ` +
      `signature ${signature}. Reason: ${reason}. ` +
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

  const input = body as { ca?: unknown; signature?: unknown; tier?: unknown };
  const ca = typeof input?.ca === 'string' ? input.ca.trim() : '';
  const signature = typeof input?.signature === 'string' ? input.signature.trim() : '';
  const tier = typeof input?.tier === 'string' ? input.tier.slice(0, 32) : null;

  if (!ca || !isRealSolanaAddress(ca)) {
    return NextResponse.json({ ok: false, error: 'invalid_mint' }, { status: 400 });
  }
  if (!signature || signature.length < 60 || signature.length > 100) {
    return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 400 });
  }

  const facts = await readPaymentFromChain(signature);
  if (!facts) {
    return NextResponse.json(
      {
        ok: false,
        error: 'payment_not_found',
        message: 'No confirmed payment to our wallet was found for that signature.',
      },
      { status: 402 },
    );
  }

  // Idempotent by design. The browser may well call this twice — a retry, a
  // reload, a double-tap — and the whole point of this route is that the
  // caller need not be careful. Everything below is safe to repeat: the
  // audit is a read, claim_free_listing_slot answers 'existing_listing' for
  // a mint already in the table, and the writer upserts.
  const risk = await fetchTokenRisk(ca);
  const meta = await fetchListingMetadata(ca);
  const projected = projectToListedTokenRow(risk, meta);

  if (!projected.ok || !projected.row) {
    const reason = `audit: ${projected.reason || 'incomplete'}`;
    const recorded = await recordUnlisted(ca, signature, facts, tier, reason);
    return NextResponse.json({
      ok: false,
      error: 'listing_failed',
      recorded,
      message:
        'Your payment went through, but the audit could not be completed. ' +
        'It has been recorded and the listing will be added manually — no need to pay again.',
    });
  }

  // Still consulted so the ledger stays the single account of the lifetime
  // giveaway. With the 60 slots exhausted this answers 'exhausted' for any
  // new mint, so is_free comes back false, which is correct for a paid
  // listing. See the note in the audit route about that being accidental
  // rather than designed correctness.
  const claim = await supabaseAdmin.rpc('claim_free_listing_slot', { p_ca: ca });
  const decisionRow = Array.isArray(claim.data) ? claim.data[0] : claim.data;
  const decision = decisionRow?.decision as string | undefined;
  const isFree = decision === 'granted' || decision === 'already_claimed';

  if (claim.error) {
    const reason = `free-slot check: ${claim.error.message}`;
    const recorded = await recordUnlisted(ca, signature, facts, tier, reason);
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
    const recorded = await recordUnlisted(ca, signature, facts, tier, `write: ${written.error}`);
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
