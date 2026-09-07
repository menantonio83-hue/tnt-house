// Version 1.2 — app/api/listed-tokens/free-slots/route.ts
//
// Authoritative count of consumed lifetime free-listing slots.
//
// WHY THIS EXISTS: getFreeAuditsUsedCount() in app/page.js counted this
// from the browser with the publishable key, and returned 0 from its
// catch block on any failure. Since the UI computes
// FREE_TOTAL - usedCount, a single network hiccup made the site believe
// all 60 slots were still available. 58 are already spent and the cap
// can never be raised, so a wrong answer here gives away something
// unrecoverable. This route fails closed instead: it either returns a
// number it actually read, or an error. It never guesses.
//
// The count comes from free_listing_claims (append-only ledger, RLS on,
// no policies, service-role only) rather than from
// listed_tokens.is_free. That column sits under a
// `Public update USING true` RLS policy, so anyone holding the
// publishable key can flip it and move the count in either direction —
// an attacker-writable column is not a source of truth for a cap that
// can never be raised.
//
// v1.2: mismatches and hard count failures now ping the admin Telegram
// group via alertAdmin() instead of only reaching a Vercel log nobody
// reads. Both are fired through waitUntil() so a slow Telegram call
// never delays the page's own request.
//
// GET /api/listed-tokens/free-slots
// 200 { ok: true, used, limit, remaining }
// 502 { ok: false, error, message }   <- caller must NOT assume a number

import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { alertAdmin } from '@/lib/telegram-alert';

export const dynamic = 'force-dynamic';

// Mirrors the c_limit constant hardcoded inside the database function
// claim_free_listing_slot(). Both are deliberately constants rather than
// configuration: there is no code path, here or in Postgres, that can
// raise the cap. FREE_TOTAL = 60 is final.
const FREE_TOTAL = 60;

// Distinct cooldown keys so a persistent mismatch and a persistent
// outage don't suppress each other's alerts — alertAdmin() rate-limits
// per service name, one alert per hour.
const ALERT_KEY_MISMATCH = 'free-slot-ledger-mismatch';
const ALERT_KEY_UNAVAILABLE = 'free-slot-count-unavailable';

function countUnavailableResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: 'count_unavailable',
      message: 'Free-slot availability could not be determined right now.',
    },
    { status: 502, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET() {
  // Primary source: the claim ledger.
  const ledger = await supabaseAdmin
    .from('free_listing_claims')
    .select('ca', { count: 'exact', head: true });

  const ledgerCount = ledger.error ? null : ledger.count ?? null;

  if (ledgerCount === null) {
    const detail = ledger.error ? ledger.error.message : 'ledger returned a null count';
    console.error('[free-slots] ledger count failed:', detail);
    // Not just noise: while this fails, every visitor sees zero free
    // slots and the free-audit path is effectively down for everyone.
    // That is the exact class of silent breakage alertAdmin exists for.
    waitUntil(
      alertAdmin(
        ALERT_KEY_UNAVAILABLE,
        'Free-slot count is UNAVAILABLE — the site is showing 0 free slots to every visitor ' +
          `and the free-audit path is effectively down. Cause: ${detail}`,
      ),
    );
    return countUnavailableResponse();
  }

  // Cross-check against the legacy is_free column. These should agree —
  // the ledger was backfilled from it. If they ever diverge we take the
  // HIGHER number, i.e. we assume MORE slots are spent, never fewer.
  // For a cap that cannot be raised, the safe direction of an
  // inconsistency is always "give away less".
  const legacy = await supabaseAdmin
    .from('listed_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('is_free', true);

  let used = ledgerCount;

  if (legacy.error || legacy.count === null || legacy.count === undefined) {
    // Non-fatal: the ledger is the source of truth, the cross-check is a
    // safety net. Logged, but not alerted — losing the safety net does
    // not itself put a slot at risk.
    console.warn(
      '[free-slots] legacy is_free cross-check unavailable:',
      legacy.error ? legacy.error.message : 'null count',
    );
  } else if (legacy.count !== ledgerCount) {
    used = Math.max(ledgerCount, legacy.count);

    const detail =
      'DATA INTEGRITY — this is NOT a service outage. The free-slot counter ' +
      `disagrees with itself: free_listing_claims=${ledgerCount}, ` +
      `listed_tokens.is_free=${legacy.count}. Serving the higher value (${used}) ` +
      `so no extra slot is handed out. Lifetime cap is ${FREE_TOTAL} and cannot be ` +
      'raised — check which side moved before allowing any further free listing.';

    console.error(`[free-slots] ${detail}`);
    waitUntil(alertAdmin(ALERT_KEY_MISMATCH, detail));
  }

  // Clamped so a count that somehow exceeds the cap can never produce a
  // negative "remaining" that a `> 0` check elsewhere might mishandle.
  const remaining = Math.max(0, FREE_TOTAL - used);

  return NextResponse.json(
    { ok: true, used, limit: FREE_TOTAL, remaining },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
