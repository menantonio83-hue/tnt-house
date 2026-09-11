
// app/api/pay/route.js
// Version 1.3
// FIX v1.3 (M-9 fix): per-IP + global rate limits on POST. Every
// request here costs paid RPC calls (getLatestBlockhash, getMint,
// getAccountInfo), so an anonymous script looping this endpoint could
// drain the Helius quota the whole site depends on. Fails OPEN if
// Redis is down (this is the payment path — refusing a legitimate
// payment because Upstash hiccuped costs a real order), degradation is
// alerted to the admin chat, not silent.
// FIX v1.2: added USDC support. USDC transfers reuse the exact same SPL
// transfer instruction path as MRDT — only the mint address changes — so
// no new branch logic was needed, just a lookup by `method`.
// Solana Pay Transaction Request API — Phantom sends GET (metadata) then
// POST (account pubkey) to this endpoint; we build and return a fully
// serialized transaction with the exact amount baked in. This avoids
// relying on the wallet to auto-populate an `amount` query param, which
// was unreliable (showed 0 SOL/MRDT) both from external browsers and from
// Phantom's own in-app browser.

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { alertAdmin } from '@/lib/telegram-alert';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, getMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

const WALLET_ADDRESS = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_CA = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
const USDC_CA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // official Circle USDC mint on Solana mainnet
const RPC_URL = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// v1.3 (M-9): per-IP + global caps. Generous on purpose: a single
// payment attempt is ~2-3 RPC calls, and the user-facing flow includes
// retries. Same shape as app/api/rpc/route.js's limiter.
const PAY_CALLS_PER_IP_PER_HOUR = 60;
const PAY_CALLS_GLOBAL_PER_DAY = 2000;

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

function extractClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}

// Fails OPEN (payment path) — see the v1.3 header note.
async function withinRateLimit(ip) {
  if (!redis) return { ok: true, degraded: true, detail: 'Upstash env vars not configured' };

  try {
    const hour = new Date().toISOString().slice(0, 13);
    const day = new Date().toISOString().slice(0, 10);
    const ipKey = `pay:ip:${ip}:${hour}`;
    const globalKey = `pay:global:${day}`;

    const [ipCount, globalCount] = await Promise.all([redis.incr(ipKey), redis.incr(globalKey)]);
    await Promise.all([
      ipCount === 1 ? redis.expire(ipKey, 3600) : Promise.resolve(),
      globalCount === 1 ? redis.expire(globalKey, 86400) : Promise.resolve(),
    ]);

    if (globalCount > PAY_CALLS_GLOBAL_PER_DAY) return { ok: false, scope: 'global' };
    if (ipCount > PAY_CALLS_PER_IP_PER_HOUR) return { ok: false, scope: 'ip' };
    return { ok: true, degraded: false };
  } catch (e) {
    void alertAdmin('pay-rate-limit', `Redis error in /api/pay limiter: ${e.message}`);
    return { ok: true, degraded: true, detail: e.message };
  }
}

// GET — Phantom fetches label/icon metadata first
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const label = searchParams.get('label') || 'TNT House';

  return NextResponse.json({
    label,
    icon: new URL('/favicon.ico', request.url).toString(),
  }, { headers: CORS_HEADERS });
}

// POST — Phantom sends user's public key, we return serialized transaction
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const amount = parseFloat(searchParams.get('amount') || '0');
    const method = searchParams.get('method') || 'SOL'; // 'SOL' | 'MRDT' | 'USDC'
    const label = searchParams.get('label') || 'TNT House Payment';

    if (!isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid or missing amount.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // v1.3 (M-9): rate gate BEFORE any RPC work.
    const limit = await withinRateLimit(extractClientIp(request));
    if (!limit.ok) {
      return NextResponse.json(
        {
          error:
            limit.scope === 'global'
              ? 'Payment service is at capacity for today. Please try again later.'
              : 'Too many payment requests from this connection. Please try again in an hour.',
        },
        { status: 429, headers: CORS_HEADERS }
      );
    }

    const body = await request.json();
    const senderPubkey = new PublicKey(body.account);
    const recipientPubkey = new PublicKey(WALLET_ADDRESS);

    const connection = new Connection(RPC_URL, 'confirmed');
    const { blockhash } = await connection.getLatestBlockhash();

    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderPubkey;

    if (method === 'SOL') {
      // Native SOL transfer
      const lamports = Math.round(amount * LAMPORTS_PER_SOL);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: senderPubkey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );
    } else {
      // SPL token (MRDT or USDC) transfer.
      // FIX v1.1: read real decimals from the mint on-chain instead of
      // assuming a fixed value — the frontend constant (MRDT_DECIMALS=9)
      // and the old hardcoded 1e6 here disagreed, which would have sent
      // the wrong token amount (off by orders of magnitude).
      // FIX v1.2: pick the mint by `method` — USDC uses 6 decimals, MRDT
      // uses whatever getMint reports, so this stays correct either way.
      const mintCA = method === 'USDC' ? USDC_CA : MRDT_CA;
      const mintPubkey = new PublicKey(mintCA);
      const mintInfo = await getMint(connection, mintPubkey);
      const tokenAmount = Math.round(amount * Math.pow(10, mintInfo.decimals));

      const senderATA = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
      const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

      // FIX v1.2: Phantom simulates the transaction before asking the user
      // to sign it. If the recipient's associated token account doesn't
      // exist, the transfer instruction fails simulation, and Phantom shows
      // "This dApp could be malicious" — NOT because of a domain reputation
      // issue, but because the tx would genuinely fail on-chain. Create the
      // recipient ATA (paid for by the sender) if it doesn't exist yet.
      const recipientATAInfo = await connection.getAccountInfo(recipientATA);
      if (!recipientATAInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            senderPubkey, // payer
            recipientATA, // ata to create
            recipientPubkey, // owner
            mintPubkey,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      transaction.add(
        createTransferInstruction(
          senderATA,
          recipientATA,
          senderPubkey,
          tokenAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );
    }

    const serializedTx = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return NextResponse.json({
      transaction: serializedTx.toString('base64'),
      message: label,
    }, { headers: CORS_HEADERS });

  } catch (err) {
    console.error('[PAY API] Error:', err);
    return NextResponse.json(
      { error: 'Transaction build failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
