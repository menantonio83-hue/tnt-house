// app/api/rpc/route.js
// Version 1.2
//
// v1.2: same fix already proven via real-device testing on
// lib/holder-distribution.ts (Risk-Data API) — prefer deriving the RPC
// URL from HELIUS_API_KEY (this project's main Helius credential, used
// successfully all day by lib/billing-verify.ts and now by
// holder-distribution.ts) ahead of whatever HELIUS_RPC_URL already
// holds. This file's own original comment below already says the
// intent was "our Helius RPC key" — deriving directly from
// HELIUS_API_KEY makes that explicit instead of depending on a second,
// separately-set env var that may or may not point to the same place.
// HELIUS_RPC_URL still works as an explicit override if set to
// something intentionally different; the fully public endpoint remains
// only the last-resort fallback if neither is configured.
//
// WHY THIS EXISTS: app/pay/page.js runs entirely client-side (inside
// Phantom's in-app browser) and needs to call getMint / getAccountInfo /
// getLatestBlockhash before building the transaction. Hitting the public
// Solana RPC (api.mainnet-beta.solana.com) directly from the client got
// rate-limited / blocked with a 403 "Access forbidden" almost immediately
// — public endpoints are meant for light, infrequent use, not production
// dApp traffic. Our Helius RPC key already exists as a server-only env var
// (used by /api/pay, /api/verify-payment, /api/cluster-check) — this route
// just proxies JSON-RPC requests through it so the client never needs (or
// exposes) the key directly.

import { NextResponse } from 'next/server';

const HELIUS_RPC_URL = process.env.HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  : process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';

export async function POST(request) {
  try {
    const body = await request.json();

    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('RPC proxy error:', error);
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'RPC proxy failed' } },
      { status: 500 },
    );
  }
}
