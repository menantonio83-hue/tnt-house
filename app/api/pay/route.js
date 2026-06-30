
// app/api/pay/route.js
// Version 1.1
// Solana Pay Transaction Request API — Phantom sends GET (metadata) then
// POST (account pubkey) to this endpoint; we build and return a fully
// serialized transaction with the exact amount baked in. This avoids
// relying on the wallet to auto-populate an `amount` query param, which
// was unreliable (showed 0 SOL/MRDT) both from external browsers and from
// Phantom's own in-app browser.

import { NextResponse } from 'next/server';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress, getMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const WALLET_ADDRESS = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_CA = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
const RPC_URL = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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
    const method = searchParams.get('method') || 'SOL'; // 'SOL' or 'MRDT'
    const label = searchParams.get('label') || 'TNT House Payment';

    if (!isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid or missing amount.' },
        { status: 400, headers: CORS_HEADERS }
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
      // SPL token (MRDT) transfer.
      // FIX v1.1: read real decimals from the mint on-chain instead of
      // assuming a fixed value — the frontend constant (MRDT_DECIMALS=9)
      // and the old hardcoded 1e6 here disagreed, which would have sent
      // the wrong token amount (off by orders of magnitude).
      const mintPubkey = new PublicKey(MRDT_CA);
      const mintInfo = await getMint(connection, mintPubkey);
      const tokenAmount = Math.round(amount * Math.pow(10, mintInfo.decimals));

      const senderATA = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
      const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

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
      { error: err.message || 'Transaction build failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
