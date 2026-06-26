import { NextResponse } from 'next/server';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createTransferCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';

// --- Constants ---
const RECIPIENT_WALLET = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_MINT = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
const MRDT_DECIMALS = 6;

// Use Helius RPC for reliable connection
function getRpcUrl() {
  const apiKey = process.env.HELIUS_API_KEY;
  if (apiKey) return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  return 'https://api.mainnet-beta.solana.com';
}

// GET: Returns metadata shown in Phantom before payment
export async function GET() {
  return NextResponse.json({
    label: 'TNT HOUSE',
    icon: 'https://tnt-audit.com/logo.png',
  });
}

// POST: Phantom sends user's public key, we return a ready transaction
export async function POST(request) {
  try {
    const body = await request.json();
    const { account, amount } = body;

    if (!account) {
      return NextResponse.json(
        { error: 'Missing account parameter' },
        { status: 400 }
      );
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid amount parameter' },
        { status: 400 }
      );
    }

    const connection = new Connection(getRpcUrl(), 'confirmed');
    const senderPubkey = new PublicKey(account);
    const mintPubkey = new PublicKey(MRDT_MINT);
    const recipientPubkey = new PublicKey(RECIPIENT_WALLET);

    // Derive Associated Token Accounts for sender and recipient
    const senderATA = getAssociatedTokenAddressSync(mintPubkey, senderPubkey);
    const recipientATA = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey);

    // Convert human-readable amount to raw units (multiply by 10^decimals)
    // amount from query is human-readable integer e.g. 1250000 MRDT
    const rawAmount = BigInt(Math.round(Number(amount)));

    // Get latest blockhash for transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Build the transfer instruction using TransferChecked (safer, validates decimals)
    const transferInstruction = createTransferCheckedInstruction(
      senderATA,        // source ATA (sender's MRDT account)
      mintPubkey,       // MRDT mint address
      recipientATA,     // destination ATA (our wallet's MRDT account)
      senderPubkey,     // owner of source ATA (signs the tx)
      rawAmount,        // amount in raw units
      MRDT_DECIMALS     // decimals validation
    );

    // Build the transaction
    const transaction = new Transaction({
      feePayer: senderPubkey,
      blockhash,
      lastValidBlockHeight,
    });

    transaction.add(transferInstruction);

    // Serialize without requiring all signatures (Phantom will sign)
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    const base64Transaction = serializedTransaction.toString('base64');

    return NextResponse.json({
      transaction: base64Transaction,
      message: `TNT HOUSE payment — ${Number(amount).toLocaleString()} $MRDT`,
    });

  } catch (error) {
    console.error('pay-mrdt route error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

