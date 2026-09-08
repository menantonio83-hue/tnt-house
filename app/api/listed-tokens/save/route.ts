// Version 1.1 — app/api/listed-tokens/save/route.ts
//
// Step 2 of moving the listed_tokens write off the browser. The write half;
// /api/listed-tokens/audit is the computing half.
//
// THIS ROUTE READS NOTHING FROM THE REQUEST BODY EXCEPT THE ENVELOPE.
// Not the score, not the mint, not is_free, not a "harmless" display field.
// Everything written to the table comes out of a payload this server
// computed and signed minutes earlier. There is no user account system on
// the consumer site, so there is nobody to authenticate — the security
// property here is not "we know who you are", it is "you cannot state a
// fact". A caller may obtain an envelope for any mint they like, but only
// ever containing the honest numbers the server calculated.
//
// ORDER OF OPERATIONS, and why each step sits where it does:
//
//   1. Verify the signature. Until it passes, every other field in the
//      envelope is attacker-controlled and not worth reasoning about —
//      including exp, which is why lib/listed-token-envelope.ts checks the
//      signature BEFORE the expiry rather than the cheaper way round.
//   2. Burn the nonce in Redis, BEFORE touching the database. If it were
//      burned after a successful write, a write that failed halfway would
//      leave a still-valid envelope that could be replayed. Burning first
//      costs the caller a re-audit when the database is down, and that is
//      the right way to be wrong.
//   3. Write.
//   4. If the write failed and the envelope had consumed a free slot,
//      hand the slot back. The nonce is already burned so this exact
//      envelope cannot return, and 59 of 60 lifetime slots are gone —
//      leaking one to a failed insert is not affordable.
//
// POST /api/listed-tokens/save   { "envelope": { ... } }
// 200 { ok: true, action: 'inserted' | 'updated', ca }
// 400 { ok: false, error: 'invalid_envelope', reason }
// 409 { ok: false, error: 'envelope_already_used' }
// 502 { ok: false, error: 'database_write_failed' }
// 503 { ok: false, error: 'replay_guard_unavailable' }

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyEnvelope } from '@/lib/listed-token-envelope';
import type { ListedTokenRow } from '@/lib/listed-token-projection';
import { alertAdmin } from '@/lib/telegram-alert';

export const dynamic = 'force-dynamic';

// Comfortably longer than the envelope's own 5-minute lifetime, so a burnt
// nonce cannot expire out of Redis while the envelope carrying it is still
// within its validity window.
const NONCE_TTL_SECONDS = 30 * 60;

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : null;

// No rate limit here on purpose. An envelope can only be obtained from
// /api/listed-tokens/audit, which is rate limited and fails closed, and each
// envelope is single-use. A second limiter on this route would add a way to
// fail without adding a way to abuse anything.

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json', message: 'Request body is not valid JSON.' },
      { status: 400 },
    );
  }

  // The ONLY field read from the request. Anything else the caller sends is
  // ignored rather than merged — there is deliberately no code path here
  // that can copy a caller-supplied value into the table.
  const envelope = (body as { envelope?: unknown })?.envelope;

  const verified = verifyEnvelope<ListedTokenRow>(envelope);
  if (!verified.valid || !verified.payload || !verified.nonce) {
    console.error(`[listed-tokens/save] rejected envelope: ${verified.reason}`);
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_envelope',
        reason: verified.reason,
        message:
          verified.reason === 'envelope expired'
            ? 'This audit result has expired. Please run the audit again.'
            : 'This audit result could not be verified. Please run the audit again.',
      },
      { status: 400 },
    );
  }

  const row = verified.payload;
  const isFree = verified.is_free;

  // ── Replay guard, before the database ──
  // Fails CLOSED. Without Redis there is no way to tell a first submission
  // from a replay, and an unguarded write path is worse than a temporary
  // refusal on a route the caller can retry by re-auditing.
  if (!redis) {
    console.error('[listed-tokens/save] Redis not configured — refusing, cannot guard replays');
    void alertAdmin(
      'listed-save-replay-guard',
      'Redis is unavailable for /api/listed-tokens/save, so envelope replay cannot be ' +
        'prevented and the route is refusing every write. Listings cannot be saved until ' +
        'Upstash recovers.',
    );
    return NextResponse.json(
      {
        ok: false,
        error: 'replay_guard_unavailable',
        message: 'Saving is temporarily unavailable. Please try again shortly.',
      },
      { status: 503 },
    );
  }

  let firstUse: string | null = null;
  try {
    // NX: sets only if absent. A null return means the key already existed,
    // i.e. this envelope has been submitted before.
    firstUse = await redis.set(`listed-save:nonce:${verified.nonce}`, '1', {
      nx: true,
      ex: NONCE_TTL_SECONDS,
    });
  } catch (e) {
    console.error('[listed-tokens/save] nonce burn failed:', (e as Error).message);
    void alertAdmin(
      'listed-save-replay-guard',
      'Redis errored while burning a save nonce for /api/listed-tokens/save, so the write ' +
        `was refused rather than performed unguarded. Detail: ${(e as Error).message}`,
    );
    return NextResponse.json(
      {
        ok: false,
        error: 'replay_guard_unavailable',
        message: 'Saving is temporarily unavailable. Please try again shortly.',
      },
      { status: 503 },
    );
  }

  if (firstUse === null) {
    return NextResponse.json(
      {
        ok: false,
        error: 'envelope_already_used',
        message: 'This audit result has already been saved.',
      },
      { status: 409 },
    );
  }

  // ── Write ──
  // last_audit_at is stamped here rather than carried in the envelope: it is
  // what the site sorts "Newest" by, and it should reflect when the listing
  // was actually stored, not when the envelope happened to be minted.
  const stamped = { ...row, last_audit_at: new Date().toISOString() };

  const existing = await supabaseAdmin
    .from('listed_tokens')
    .select('id')
    .eq('ca', row.ca)
    .limit(1);

  if (existing.error) {
    console.error('[listed-tokens/save] lookup failed:', existing.error.message);
    await releaseSlotIfNeeded(isFree, row.ca);
    return NextResponse.json(
      {
        ok: false,
        error: 'database_read_failed',
        message: 'Could not save this audit. Please run the audit again.',
      },
      { status: 502 },
    );
  }

  const alreadyListed = Array.isArray(existing.data) && existing.data.length > 0;

  if (alreadyListed) {
    // is_free is deliberately NOT part of an update. A re-audit of an
    // already-listed token takes the 'existing_listing' branch in
    // claim_free_listing_slot, so its envelope carries is_free: false —
    // writing that would flip a token that WAS free-listed to not-free and
    // silently desynchronise listed_tokens from the claim ledger. Whatever
    // is stored stays stored; only the audit data is refreshed.
    const { is_free: _ignored, ...updatable } = stamped as typeof stamped & { is_free?: boolean };

    const updated = await supabaseAdmin
      .from('listed_tokens')
      .update(updatable)
      .eq('ca', row.ca)
      .select('id');

    if (updated.error) {
      console.error('[listed-tokens/save] update failed:', updated.error.message);
      return NextResponse.json(
        {
          ok: false,
          error: 'database_write_failed',
          message: 'Could not save this audit. Please run the audit again.',
        },
        { status: 502 },
      );
    }

    // A successful call that changed zero rows is not a success — that is
    // exactly how the RLS-blocked writes in cluster-check went unnoticed.
    if (!updated.data || updated.data.length === 0) {
      console.error(`[listed-tokens/save] update matched 0 rows for ca=${row.ca}`);
      return NextResponse.json(
        {
          ok: false,
          error: 'write_matched_no_rows',
          message: 'Could not save this audit. Please run the audit again.',
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, action: 'updated', ca: row.ca });
  }

  const inserted = await supabaseAdmin
    .from('listed_tokens')
    .insert({ ...stamped, is_free: isFree })
    .select('id');

  if (inserted.error || !inserted.data || inserted.data.length === 0) {
    const detail = inserted.error ? inserted.error.message : 'insert returned no row';
    console.error(`[listed-tokens/save] insert failed for ca=${row.ca}: ${detail}`);
    await releaseSlotIfNeeded(isFree, row.ca);
    return NextResponse.json(
      {
        ok: false,
        error: 'database_write_failed',
        message: 'Could not save this audit. Please run the audit again.',
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, action: 'inserted', ca: row.ca });
}

/**
 * Hand a consumed free slot back when the listing it was consumed for never
 * made it into the table.
 *
 * The nonce is already burnt by the time this runs, so the envelope holding
 * the claim cannot come back — without this the slot would be lost for good.
 * release_free_listing_slot() refuses to release a slot whose mint IS in
 * listed_tokens, so a stray call cannot free a legitimately spent one.
 */
async function releaseSlotIfNeeded(isFree: boolean, ca: string): Promise<void> {
  if (!isFree) return;
  try {
    const released = await supabaseAdmin.rpc('release_free_listing_slot', { p_ca: ca });
    if (released.error) {
      console.error('[listed-tokens/save] slot release failed:', released.error.message);
      void alertAdmin(
        'listed-save-slot-leak',
        `A free listing slot was consumed for ${ca} but the listing write failed, and ` +
          `releasing the slot ALSO failed (${released.error.message}). The lifetime free-slot ` +
          'count is now one lower than the number of free listings. Check ' +
          'free_listing_claims against listed_tokens.is_free.',
      );
    }
  } catch (e) {
    console.error('[listed-tokens/save] slot release threw:', (e as Error).message);
  }
}
