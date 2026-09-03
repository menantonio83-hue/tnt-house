// Version 1.0 — app/api/demo-cta/route.ts
//
// Funnel step 2 of the public-demo-key experiment. The demo response's
// get_your_own_key / x402 URLs point here instead of the raw
// destination directly — logs a click (lib/demo-cta-clicks.ts), then
// 302-redirects to the real page. A bare URL string sitting inside a
// JSON field has zero attribution on its own; this is the minimal way
// to get a real click-through count out of it.
//
// Two allowed targets ONLY (?to=risk-api | ?to=x402-docs) — deliberately
// not an open redirect (no arbitrary destination URL accepted), since
// this route has no auth and is meant to be linked from a public API
// response.

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { logDemoCtaClick } from '@/lib/demo-cta-clicks';
import { hashIdentity } from '@/lib/demo-public-key-limit';

const TARGETS: Record<string, string> = {
  'risk-api': 'https://www.tnt-audit.com/risk-api?ref=demo_public',
  'x402-docs': 'https://www.tnt-audit.com/risk-api/docs#x402',
};

const DEFAULT_TARGET = 'risk-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get('to') ?? DEFAULT_TARGET;
  const target = TARGETS[requested] ?? TARGETS[DEFAULT_TARGET];

  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
  const userAgent = request.headers.get('user-agent') ?? 'unknown';

  waitUntil(logDemoCtaClick(requested in TARGETS ? requested : DEFAULT_TARGET, hashIdentity(ip, userAgent)));

  return NextResponse.redirect(target, { status: 302 });
}
