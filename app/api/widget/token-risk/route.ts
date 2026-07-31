// Version 1.0 — app/api/widget/token-risk/route.ts
//
// Server-side route for the consumer "Check Token" widget's holder-
// concentration numbers (top10Percent, largestHolderPercent,
// holderCount). Previously the widget (app/page.js) fetched RugCheck's
// topHolders directly from the browser and summed pct values, with no
// server-side validation and no control over staleness. Observed live:
// RugCheck returned 243% top-10 concentration for a token right after
// a burn, while Solscan showed a correct, live ~46% at the same time.
//
// This route reuses the SAME Helius-backed calculation that already
// powers the paid Risk-Data API (lib/holder-distribution.ts, with its
// own stale-index retry logic and known-burn-wallet exclusion — see
// v6.17/v6.17b there), so the B2B API and the consumer widget agree on
// one number from one source, instead of two independently-computed
// figures that can silently diverge. RugCheck is still used by the
// widget for everything it uniquely provides (score, LP lock, risks,
// mint/freeze authority, tax) — only the holder-concentration math
// moves here.
//
// Even after holder-distribution.ts's own stale-retries, this route
// adds one more honest check before responding: an impossible (>100%)
// reading is never forwarded to the client as if it were real data —
// the widget gets a clear error and can show "data unavailable"
// instead of a number that cannot be true.
import { NextRequest, NextResponse } from 'next/server';
import { getHolderDistributionRobust } from '@/lib/holder-distribution';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'address query param is required' }, { status: 400 });
  }

  try {
    const data = await getHolderDistributionRobust(address);

    if (
      !Number.isFinite(data.top10Percent) ||
      !Number.isFinite(data.largestHolderPercent) ||
      data.top10Percent > 100 ||
      data.largestHolderPercent > 100
    ) {
      console.warn(
        `[widget/token-risk] ${address}: refusing to forward impossible reading (top10=${data.top10Percent}, largest=${data.largestHolderPercent}) to client`,
      );
      return NextResponse.json({ error: 'invalid_holder_data' }, { status: 422 });
    }

    return NextResponse.json(
      { ...data, source: 'helius' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    console.error(`[widget/token-risk] ${address}: upstream failure — ${message}`);
    return NextResponse.json({ error: 'upstream_error', message }, { status: 502 });
  }
}
