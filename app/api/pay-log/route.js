// app/api/pay-log/route.js
// Version 1.1
//
// WHY THIS EXISTS: Vercel's free Web Analytics tier doesn't support custom
// events (Pro-only), so there was no way to see WHERE in the /pay flow
// (connect -> build tx -> sign -> send) a visitor drops off. 2 visits to
// /pay with 0 completed orders could mean: Phantom not installed, wallet
// rejected connect, RPC failed building the tx, user closed without
// signing, or a genuine send error. This just logs each stage transition
// server-side so it's visible in Vercel Dashboard -> Functions -> Logs.

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const data = await request.json();
    // Tagged so it's easy to grep in Vercel logs.
    console.log('[PAY_FLOW]', JSON.stringify(data));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 200 }); // never break the pay flow over a logging failure
  }
}
