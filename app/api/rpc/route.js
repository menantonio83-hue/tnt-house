// app/api/rpc/route.js
// Version 1.3
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
//
// v1.2: prefer deriving the RPC URL from HELIUS_API_KEY (this project's
// main Helius credential) ahead of whatever HELIUS_RPC_URL already holds.
// HELIUS_RPC_URL still works as an explicit override; the fully public
// endpoint remains only the last-resort fallback if neither is set.
//
// FIX v1.3 — METHOD ALLOW-LIST.
//
// Until now this forwarded ANY JSON-RPC body straight to Helius with no
// auth and no rate limit, at a URL that is discoverable in a public
// repository. That made it a free, anonymous Helius proxy: getProgramAccounts
// over a large program, or getSignaturesForAddress in a loop, all billed to
// this project. Helius backs the entire site, not just this endpoint, so
// draining it takes down audits and quick-check too.
//
// Reading app/pay/page.js end to end, the payment flow needs exactly two
// methods:
//
//   getAccountInfo     - spl-token's getMint() on the MRDT/USDC mint, and
//                        the explicit getAccountInfo(recipientATA) that
//                        decides whether to add a create-ATA instruction.
//   getLatestBlockhash - tx.recentBlockhash, on every path including SOL.
//
// signAndSendTransaction goes through the wallet's own RPC, not ours.
//
// That list was derived by reading the code, which cannot prove what
// @solana/web3.js does internally on some edge path. This is a payment
// route: a wrongly blocked method means a failed payment, which is far
// worse than an over-permissive proxy. So a rejection is never silent —
// every blocked method is logged AND pushed to Telegram with its name, so
// a missing entry surfaces within minutes rather than as unexplained drop-off
// in the pay funnel. If an alert names a legitimate method, add it to
// ALLOWED_METHODS below and redeploy.
//
// The likeliest candidate to appear is getVersion (web3.js feature
// detection). It is deliberately NOT pre-allowed: the point of this pass is
// to learn what the flow actually calls, not to guess wider.

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { alertAdmin } from '@/lib/telegram-alert';

const HELIUS_RPC_URL = process.env.HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  : process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';

// The entire surface app/pay/page.js needs. Add here (and redeploy) if a
// Telegram alert names a method the payment flow genuinely requires.
const ALLOWED_METHODS = new Set(['getAccountInfo', 'getLatestBlockhash']);

// A batch bigger than this is not something the payment page produces.
const MAX_BATCH_SIZE = 10;

// Generous on purpose: a single payment attempt is ~3 calls, and the page
// has a "Try Again" button. 60/hour still leaves room for ~20 attempts from
// one address while bounding a scripted loop. The allow-list is the real
// protection here; this is a second line.
const CALLS_PER_IP_PER_HOUR = 60;
const CALLS_GLOBAL_PER_DAY = 2000;

// Used ONLY to decide how to bucket alerts, never for authorization. A
// recognisable Solana method gets its own cooldown key so a genuinely new
// internal call always pings even if something else already alerted this
// hour; unrecognised junk shares one key so a caller inventing method names
// cannot flood the admin chat.
const KNOWN_SOLANA_METHODS = new Set([
  'getAccountInfo', 'getBalance', 'getBlock', 'getBlockHeight', 'getBlockTime',
  'getClusterNodes', 'getEpochInfo', 'getEpochSchedule', 'getFeeForMessage',
  'getFirstAvailableBlock', 'getGenesisHash', 'getHealth', 'getHighestSnapshotSlot',
  'getIdentity', 'getInflationGovernor', 'getInflationRate', 'getInflationReward',
  'getLargestAccounts', 'getLatestBlockhash', 'getLeaderSchedule',
  'getMaxRetransmitSlot', 'getMaxShredInsertSlot', 'getMinimumBalanceForRentExemption',
  'getMultipleAccounts', 'getProgramAccounts', 'getRecentPerformanceSamples',
  'getRecentPrioritizationFees', 'getSignatureStatuses', 'getSignaturesForAddress',
  'getSlot', 'getSlotLeader', 'getSlotLeaders', 'getStakeMinimumDelegation',
  'getSupply', 'getTokenAccountBalance', 'getTokenAccountsByDelegate',
  'getTokenAccountsByOwner', 'getTokenLargestAccounts', 'getTokenSupply',
  'getTransaction', 'getTransactionCount', 'getVersion', 'getVoteAccounts',
  'isBlockhashValid', 'minimumLedgerSlot', 'requestAirdrop', 'sendTransaction',
  'simulateTransaction',
]);

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

// Vercel overwrites x-forwarded-for with the real client IP and does not
// forward externally supplied values, so the first entry is trustworthy.
function extractClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id === undefined ? null : id, error: { code, message } };
}

// Fails OPEN. This is the payment path: refusing a legitimate payment
// because Upstash is unavailable costs a real order, while the allow-list
// above already caps what an abuser can do with this proxy. Degradation is
// alerted, not silent.
async function withinRateLimit(ip) {
  if (!redis) return { ok: true, degraded: true, detail: 'Upstash env vars not configured' };

  try {
    const hour = new Date().toISOString().slice(0, 13);
    const day = new Date().toISOString().slice(0, 10);
    const ipKey = `rpc:ip:${ip}:${hour}`;
    const globalKey = `rpc:global:${day}`;

    const [ipCount, globalCount] = await Promise.all([redis.incr(ipKey), redis.incr(globalKey)]);
    await Promise.all([
      ipCount === 1 ? redis.expire(ipKey, 3600) : Promise.resolve(),
      globalCount === 1 ? redis.expire(globalKey, 86400) : Promise.resolve(),
    ]);

    if (globalCount > CALLS_GLOBAL_PER_DAY) return { ok: false, scope: 'global' };
    if (ipCount > CALLS_PER_IP_PER_HOUR) return { ok: false, scope: 'ip' };
    return { ok: true, degraded: false };
  } catch (e) {
    return { ok: true, degraded: true, detail: e.message };
  }
}

// Collect every method name in the payload, whether single or batch.
// Returns null if the payload isn't a shape we understand.
function extractMethods(body) {
  if (Array.isArray(body)) {
    if (body.length === 0 || body.length > MAX_BATCH_SIZE) return null;
    const methods = [];
    for (const entry of body) {
      if (!entry || typeof entry !== 'object' || typeof entry.method !== 'string') return null;
      methods.push(entry.method);
    }
    return methods;
  }
  if (body && typeof body === 'object' && typeof body.method === 'string') {
    return [body.method];
  }
  return null;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(jsonRpcError(null, -32700, 'Parse error'), { status: 400 });
  }

  const methods = extractMethods(body);
  const requestId = Array.isArray(body) ? null : body && body.id;

  if (methods === null) {
    console.error('[rpc-proxy] rejected: unrecognised JSON-RPC payload shape');
    return NextResponse.json(
      jsonRpcError(requestId, -32600, 'Invalid Request'),
      { status: 400 },
    );
  }

  const blocked = methods.filter((m) => !ALLOWED_METHODS.has(m));

  if (blocked.length > 0) {
    // Loud on purpose — see the v1.3 note at the top. A method missing from
    // the allow-list must be discovered here, not through a silent drop in
    // completed payments.
    console.error(`[rpc-proxy] BLOCKED method(s): ${blocked.join(', ')}`);

    for (const method of blocked) {
      const known = KNOWN_SOLANA_METHODS.has(method);
      const alertKey = known ? `rpc-proxy-blocked:${method}` : 'rpc-proxy-blocked-unknown';
      void alertAdmin(
        alertKey,
        `/api/rpc refused the JSON-RPC method "${method}". This proxy serves the payment ` +
          'page only, and its allow-list is getAccountInfo + getLatestBlockhash. ' +
          (known
            ? 'This IS a real Solana RPC method, so @solana/web3.js may be calling it on a ' +
              'path not visible in app/pay/page.js — PAYMENTS MAY BE BROKEN. If the payment ' +
              'flow needs it, add it to ALLOWED_METHODS in app/api/rpc/route.js and redeploy.'
            : 'This is not a recognised Solana RPC method, so it is most likely someone ' +
              'probing the endpoint rather than a real payment. No action needed unless it ' +
              'repeats.'),
      );
    }

    return NextResponse.json(
      jsonRpcError(
        requestId,
        -32601,
        `Method not supported by this proxy: ${blocked.join(', ')}`,
      ),
      { status: 403 },
    );
  }

  const limit = await withinRateLimit(extractClientIp(request));

  if (limit.degraded) {
    void alertAdmin(
      'rpc-proxy-redis-degraded',
      'Redis is unreachable for /api/rpc, so the per-IP rate limit is currently bypassed. ' +
        'Payments keep working and the two-method allow-list still applies, so exposure is ' +
        `limited — but the ceiling is gone until Upstash recovers. Detail: ${limit.detail}`,
    );
  }

  if (!limit.ok) {
    console.error(`[rpc-proxy] rate limited (${limit.scope})`);
    return NextResponse.json(
      jsonRpcError(requestId, -32005, 'Too many requests to the RPC proxy. Please try again shortly.'),
      { status: 429 },
    );
  }

  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('RPC proxy error:', error);
    return NextResponse.json(jsonRpcError(requestId, -32603, 'RPC proxy failed'), { status: 500 });
  }
}
