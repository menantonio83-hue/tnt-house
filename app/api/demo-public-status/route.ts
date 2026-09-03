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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const { globalUsed, globalRemaining } = await peekDemoPublicKeyStatus();
  return NextResponse.json(
    {
      calls_used: globalUsed,
      calls_remaining: globalRemaining,
      calls_total: DEMO_TOTAL_LIMIT,
      alive: globalRemaining > 0,
    },
    { headers: CORS_HEADERS },
  );
}
