// Version 1.0 — app/api/demo-public-status/route.ts
//
// Read-only, no-auth status endpoint for the public-demo-key experiment's
// live counter widget on /risk-api (RiskApiPageContent.tsx). Deliberately
// separate from token-risk/route.ts's demo-key handling — this never
// consumes a slot, it's a pure peek (lib/demo-public-key-limit.ts's
// peekDemoPublicKeyStatus()), safe to poll repeatedly from the browser.

import { NextResponse } from 'next/server';
import { peekDemoPublicKeyStatus, DEMO_TOTAL_LIMIT } from '@/lib/demo-public-key-limit';

export const dynamic = 'force-dynamic';

// CORS v1.1: this route no longer advertises Access-Control-Allow-Origin.
// It is the demo counter on our own landing page, same-origin, and it identifies the
// caller by IP or browser fingerprint rather than by a key. A wildcard
// let any other website make ITS visitors spend this quota, with the
// cost landing on the visitor's identity instead of the attacker's.
// Kept as one place to add response headers if any are ever needed.
const RESPONSE_HEADERS = {};

export async function GET() {
  const { globalUsed, globalRemaining } = await peekDemoPublicKeyStatus();
  return NextResponse.json(
    {
      calls_used: globalUsed,
      calls_remaining: globalRemaining,
      calls_total: DEMO_TOTAL_LIMIT,
      alive: globalRemaining > 0,
    },
    { headers: RESPONSE_HEADERS },
  );
}
