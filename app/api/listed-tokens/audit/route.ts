// Version 1.1 — app/api/listed-tokens/audit/route.ts
//
// Step 1 of moving the listed_tokens write off the browser.
//
// Today app/page.js assembles a listing row in the browser — score
// included — and PATCHes/POSTs it straight into listed_tokens with the
// public publishable key. That only works because the table carries
// `Public insert` and `Public update` RLS policies whose expression is
// literally `true`, which also means anyone on the internet can rewrite
// any token's score. Those policies cannot be closed until the server is
// the one writing.
//
// This route does the computing half:
//
//   1. Takes ONE input: a mint address. Nothing else is accepted, so a
//      caller cannot assert a single fact about the token.
//   2. Runs fetchTokenRisk() — the same server-side engine the paid
//      Risk-Data API uses, which ends in lib/scoring.ts, the very module
//      app/page.js imports on its line 4. Same function, same inputs,
//      same number. Moving the computation does not move any score.
//   3. Decides is_free ITSELF via claim_free_listing_slot(), which takes
//      an advisory lock and counts the append-only ledger inside one
//      transaction. The browser used to send this as a boolean.
//   4. Signs the result into a short-lived envelope. /api/listed-tokens/save
//      (next change) will accept nothing but that envelope.
//
// WHAT THIS DOES NOT DO: it does not write to listed_tokens, and it does
// not authenticate anybody — there are no accounts on this site to
// authenticate against. It removes the caller's ability to lie rather
// than checking who the caller is. Anyone may request an envelope for any
// mint; it will only ever contain honest numbers.
//
// FREE SLOTS: 58 of the 60 lifetime slots are already spent and the cap
// can never be raised. A mint already present in listed_tokens takes the
// 'existing_listing' branch and consumes nothing, so re-auditing is free
// in every sense. Only a genuinely new mint can consume one, and only via
// the database function.
//
// POST /api/listed-tokens/audit   { "ca": "<mint>" }
// 200 { ok: true, row, envelope, free: {...} }
// 400 { ok: false, error, message }
// 429 { ok: false, error: 'rate_limited' }
// 502 { ok: false, error, message }
// 503 { ok: false, error: 'signing_unavailable' | 'rate_limiter_unavailable' }

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { PublicKey } from '@solana/web3.js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchTokenRisk } from '@/lib/token-risk-core';
import { fetchListingMetadata, projectToListedTokenRow } from '@/lib/listed-token-projection';
import { signEnvelope } from '@/lib/listed-token-envelope';
import { alertAdmin } from '@/lib/telegram-alert';

export const dynamic = 'force-dynamic';
// fetchTokenRisk fans out to Helius, DexScreener, RugCheck and the holder
// walk; the default 10s ceiling is not enough for a busy mint.
export const maxDuration = 60;

// A full audit is genuinely expensive, so this is tighter than the
// cluster-check budget. A person auditing tokens one after another will
// not notice; a script enumerating fresh mints stops quickly.
const AUDITS_PER_IP_PER_HOUR = 15;
const AUDITS_GLOBAL_PER_DAY = 300;

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : null;

function extractClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}

interface LimitOutcome {
  allowed: boolean;
  reason: 'ok' | 'per_ip' | 'global' | 'infra';
}

// Fails CLOSED, unlike /api/rpc and /api/cluster-check. Those protect
// functionality; this one can consume a free slot from a 60-slot cap that
// can never be topped up, and it drives an expensive upstream fan-out. An
// unmetered path to both is not something to leave open on a Redis blip.
async function checkAuditLimit(ip: string): Promise<LimitOutcome> {
  if (!redis) {
    console.error('[listed-tokens/audit] Redis not configured — failing closed');
    return { allowed: false, reason: 'infra' };
  }
  try {
    const hour = new Date().toISOString().slice(0, 13);
    const day = new Date().toISOString().slice(0, 10);
    const ipKey = `listed-audit:ip:${ip}:${hour}`;
    const globalKey = `listed-audit:global:${day}`;

    const [ipCount, globalCount] = await Promise.all([redis.incr(ipKey), redis.incr(globalKey)]);
    await Promise.all([
      ipCount === 1 ? redis.expire(ipKey, 3600) : Promise.resolve(),
      globalCount === 1 ? redis.expire(globalKey, 86400) : Promise.resolve(),
    ]);

    if (globalCount > AUDITS_GLOBAL_PER_DAY) return { allowed: false, reason: 'global' };
    if (ipCount > AUDITS_PER_IP_PER_HOUR) return { allowed: false, reason: 'per_ip' };
    return { allowed: true, reason: 'ok' };
  } catch (e) {
    console.error('[listed-tokens/audit] Redis error, failing closed:', (e as Error).message);
    return { allowed: false, reason: 'infra' };
  }
}

function isRealSolanaAddress(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Checked before any work: without it there is nothing to sign, and an
  // unsigned payload must never reach the caller looking like a valid one.
  const secretPresent =
    !!process.env.LISTED_TOKEN_SIGNING_SECRET &&
    process.env.LISTED_TOKEN_SIGNING_SECRET.length >= 32;

  if (!secretPresent) {
    console.error('[listed-tokens/audit] LISTED_TOKEN_SIGNING_SECRET missing or too short');
    void alertAdmin(
      'listed-token-signing-secret',
      'LISTED_TOKEN_SIGNING_SECRET is missing or shorter than 32 characters, so ' +
        '/api/listed-tokens/audit cannot sign anything and is refusing every request. ' +
        'Set it in the Vercel environment (openssl rand -hex 32) and redeploy.',
    );
    return NextResponse.json(
      {
        ok: false,
        error: 'signing_unavailable',
        message: 'Audits are temporarily unavailable. Nothing was charged or consumed.',
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json', message: 'Request body is not valid JSON.' },
      { status: 400 },
    );
  }

  const raw = (body as { ca?: unknown })?.ca;
  const ca = typeof raw === 'string' ? raw.trim() : '';

  if (!ca || !isRealSolanaAddress(ca)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_mint', message: 'ca must be a valid Solana mint address.' },
      { status: 400 },
    );
  }

  const limit = await checkAuditLimit(extractClientIp(request));
  if (!limit.allowed) {
    if (limit.reason === 'infra') {
      return NextResponse.json(
        {
          ok: false,
          error: 'rate_limiter_unavailable',
          message: 'Audits are temporarily unavailable. Please try again shortly.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: 'rate_limited',
        scope: limit.reason,
        message:
          limit.reason === 'global'
            ? 'Audits are at capacity for today. Please try again tomorrow.'
            : 'Too many audits from this connection in the last hour. Please try again later.',
      },
      { status: 429 },
    );
  }

  // The expensive part. Same engine as the paid API, ending in
  // lib/scoring.ts — not a second implementation.
  const risk = await fetchTokenRisk(ca);
  const meta = await fetchListingMetadata(ca);
  const projected = projectToListedTokenRow(risk, meta);

  if (!projected.ok || !projected.row) {
    return NextResponse.json(
      {
        ok: false,
        error: 'audit_incomplete',
        message: projected.reason || 'The audit could not be completed for this mint.',
      },
      { status: 502 },
    );
  }

  // is_free is decided here, by the database, never by the caller. The
  // function takes an advisory lock and counts the append-only ledger
  // inside a single transaction, so two simultaneous requests at 59 used
  // cannot both be granted.
  const claim = await supabaseAdmin.rpc('claim_free_listing_slot', { p_ca: ca });

  if (claim.error) {
    console.error('[listed-tokens/audit] claim_free_listing_slot failed:', claim.error.message);
    return NextResponse.json(
      {
        ok: false,
        error: 'free_slot_check_failed',
        message: 'Could not determine free-listing availability. Nothing was consumed.',
      },
      { status: 502 },
    );
  }

  const decisionRow = Array.isArray(claim.data) ? claim.data[0] : claim.data;
  const decision = decisionRow?.decision as string | undefined;

  if (!decision) {
    console.error('[listed-tokens/audit] claim_free_listing_slot returned no decision');
    return NextResponse.json(
      {
        ok: false,
        error: 'free_slot_check_failed',
        message: 'Could not determine free-listing availability. Nothing was consumed.',
      },
      { status: 502 },
    );
  }

  // 'granted' consumed a slot for this mint. 'already_claimed' means one
  // was consumed for it earlier and the listing write never landed — it
  // still counts as free, and re-charging for it would be wrong.
  const isFree = decision === 'granted' || decision === 'already_claimed';

  const envelope = signEnvelope(projected.row, isFree);
  if (!envelope) {
    // Only reachable if the secret vanished between the check above and
    // here. Refusing is correct: an unsigned row must never look valid.
    return NextResponse.json(
      {
        ok: false,
        error: 'signing_unavailable',
        message: 'Audits are temporarily unavailable. Nothing was charged or consumed.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    // Returned unsigned as well so the UI can render the audit card
    // directly. The save route ignores this copy entirely and reads only
    // what is inside the envelope.
    row: projected.row,
    free: {
      decision,
      is_free: isFree,
      used: decisionRow?.free_used ?? null,
      limit: decisionRow?.free_limit ?? null,
    },
    envelope,
  });
}
