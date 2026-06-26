import { NextResponse } from 'next/server';

// --- Constants ---
const RECIPIENT_WALLET = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_MINT = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
const MRDT_DECIMALS = 6;

function getRpcUrl() {
  const apiKey = process.env.HELIUS_API_KEY;
  if (apiKey) return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  return 'https://api.mainnet-beta.solana.com';
}

// GET: Returns metadata shown in Phantom before payment
export async function GET() {
  return NextResponse.json({
    label: 'TNT HOUSE',
    icon: 'https://tnt-audit.com/icon.png',
  });
}

// POST: Phantom sends user public key, we build and return the transaction
export async function POST(request) {
  try {
    const url = new URL(request.url);
    const amountParam = url.searchParams.get('amount');
    const body = await request.json();
    const { account } = body;

    if (!account) {
      return NextResponse.json({ error: 'Missing account' }, { status: 400 });
    }

    const amount = parseFloat(amountParam);
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const rpcUrl = getRpcUrl();

    // 1. Get latest blockhash via raw RPC call (no @solana/web3.js needed)
    const blockhashRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getLatestBlockhash',
        params: [{ commitment: 'confirmed' }],
      }),
    });
    const blockhashData = await blockhashRes.json();
    const blockhash = blockhashData.result?.value?.blockhash;
    if (!blockhash) {
      return NextResponse.json({ error: 'Failed to get blockhash' }, { status: 500 });
    }

    // 2. Derive ATA addresses via raw RPC (getProgramAccounts not needed — use getOrCreate pattern)
    // We'll use @solana/spl-token which is already installed
    const { Connection, PublicKey, Transaction } = await import('@solana/web3.js');
    const { createTransferCheckedInstruction, getAssociatedTokenAddressSync } = await import('@solana/spl-token');

    const connection = new Connection(rpcUrl, 'confirmed');
    const senderPubkey = new PublicKey(account);
    const mintPubkey = new PublicKey(MRDT_MINT);
    const recipientPubkey = new PublicKey(RECIPIENT_WALLET);

    const senderATA = getAssociatedTokenAddressSync(mintPubkey, senderPubkey);
    const recipientATA = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey);

    // Raw amount = human-readable amount (already in MRDT units, not smallest units)
    // e.g. amount=1250000 means 1,250,000 MRDT tokens
    const rawAmount = BigInt(Math.round(amount));

    const transferInstruction = createTransferCheckedInstruction(
      senderATA,
      mintPubkey,
      recipientATA,
      senderPubkey,
      rawAmount,
      MRDT_DECIMALS
    );

    const transaction = new Transaction({
      feePayer: senderPubkey,
      blockhash,
      lastValidBlockHeight: blockhashData.result?.value?.lastValidBlockHeight,
    });

    transaction.add(transferInstruction);

    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    const base64Transaction = serialized.toString('base64');

    return NextResponse.json({
      transaction: base64Transaction,
      message: `TNT HOUSE — ${Math.round(amount).toLocaleString()} $MRDT`,
    });

  } catch (error) {
    console.error('pay-mrdt error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
