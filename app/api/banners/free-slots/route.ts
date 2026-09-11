// Version 1.1 — app/api/banners/free-slots/route.ts
//
// Authoritative count of consumed free-banner slots. Mirrors
// /api/listed-tokens/free-slots's shape for the same reason: the old
// getFreeBannersUsedCount() in app/page.js read free_banner_claims
// directly from the browser with the publishable key and returned 0
// from its catch block on any failure — since the UI computes
// FREE_BANNER_TOTAL - usedCount, a network hiccup made the site believe
// every giveaway slot was still available. No cross-check table exists
// here the way listed_tokens.is_free does for listings, since
// free_banner_claims was always the only record of a free banner ever
// having been given away — so this route is simpler, but the fail-closed
// contract is identical: a number it actually read, or an explicit
// error. It never guesses.
//
// GET /api/banners/free-slots
// 200 { ok: true, used, limit, remaining }
// 502 { ok: false, error, message }   <- caller must NOT assume a number

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Mirrors c_limit hardcoded inside claim_free_banner_slot(). Both are
// deliberately constants: there is no code path, here or in Postgres,
// that can raise the cap.
const FREE_BANNER_TOTAL = 5;

export async function GET() {
  const ledger = await supabaseAdmin
    .from('free_banner_claims')
    .select('id', { count: 'exact', head: true });

  if (ledger.error || ledger.count === null || ledger.count === undefined) {
    const detail = ledger.error ? ledger.error.message : 'ledger returned a null count';
    console.error('[banners/free-slots] ledger count failed:', detail);
    return NextResponse.json(
      {
        ok: false,
        error: 'count_unavailable',
        message: 'Free-banner availability could not be determined right now.',
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const used = ledger.count;
  const remaining = Math.max(0, FREE_BANNER_TOTAL - used);

  return NextResponse.json(
    { ok: true, used, limit: FREE_BANNER_TOTAL, remaining },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
