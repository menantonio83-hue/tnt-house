// app/api/pay/route.js
// Solana Pay Transaction Request API
// Phantom sends GET (metadata) then POST (transaction) to this endpoint

import { NextResponse } from 'next/server';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const WALLET_ADDRESS = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_CA = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
const MRDT_DECIMALS = 9;
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const SITE_URL = 'https://tnt-house.vercel.app';

// GET — Phantom fetches label/icon metadata first
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const label = searchParams.get('label') || 'TNT House';
  const message = searchParams.get('message') || 'AI Audit Payment';

  return NextResponse.json({
    label,
    icon: `${SITE_URL}/favicon.ico`,
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    }
  });
}

// POST — Phantom sends user's public key, we return serialized transaction
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const amount = parseFloat(searchParams.get('amount') || '0');
    const method = searchParams.get('method') || 'SOL'; // SOL or MRDT
    const label = searchParams.get('label') || 'TNT House Payment';

    const body = await request.json();
    const senderPubkey = new PublicKey(body.account);
    const recipientPubkey = new PublicKey(WALLET_ADDRESS);

    const connection = new Connection(RPC_URL, 'confirmed');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

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
      // SPL token (MRDT) transfer
      const mintPubkey = new PublicKey(MRDT_CA);
      const senderATA = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
      const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

      // FIX: MRDT has 9 decimals (not 6!)
      const tokenAmount = Math.round(amount * Math.pow(10, MRDT_DECIMALS));

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

    // Serialize transaction for Phantom to sign
    const serializedTx = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    const base64Tx = serializedTx.toString('base64');

    return NextResponse.json({
      transaction: base64Tx,
      message: label,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      }
    });

  } catch (err) {
    console.error('[PAY API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Transaction build failed' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
