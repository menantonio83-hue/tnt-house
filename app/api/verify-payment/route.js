import { NextResponse } from 'next/server';

export const runtime = 'edge';

const RECIPIENT_WALLET = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_MINT = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
const LAMPORTS_PER_SOL = 1_000_000_000;

export async function POST(request) {
  try {
    const body = await request.json();
    const { expectedAmount, since, method } = body;

    if (typeof expectedAmount !== 'number' || typeof since !== 'number') {
      return NextResponse.json(
        { verified: false, reason: 'Invalid parameters.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { verified: false, reason: 'HELIUS_API_KEY missing.' },
        { status: 500 }
      );
    }

    // Subtract 10s buffer for clock sync
    const sinceSeconds = Math.floor(since / 1000) - 10;

    // PROVEN FIX (from June 2026 working build):
    // token-accounts=balanceChanged tracks ATA changes for recipient wallet
    // gte-time filters old transactions at Helius API level
    const heliusUrl = `https://api.helius.xyz/v0/addresses/${RECIPIENT_WALLET}/transactions?api-key=${apiKey}&type=TRANSFER&token-accounts=balanceChanged&gte-time=${sinceSeconds}`;

    const response = await fetch(heliusUrl);

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { verified: false, reason: `Helius error: ${response.status} - ${errText}` },
        { status: 502 }
      );
    }

    const transactions = await response.json();

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ verified: false, reason: 'No recent transactions found.' });
    }

    const paymentMethod = method || 'MRDT';
    const TOLERANCE = 0.95; // 5% tolerance

    for (const tx of transactions) {
      // Check MRDT token transfers
      if (paymentMethod !== 'SOL' && tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        for (const transfer of tx.tokenTransfers) {
          const isMrdt = transfer.mint === MRDT_MINT;
          const isOurs = transfer.toUserAccount === RECIPIENT_WALLET;
          if (isMrdt && isOurs) {
            const received = parseFloat(transfer.tokenAmount ?? transfer.amount ?? 0);
            if (received >= expectedAmount * TOLERANCE) {
              return NextResponse.json({ verified: true, received, method: 'MRDT', signature: tx.signature });
            }
          }
        }
      }

      // Check SOL native transfers
      if (paymentMethod === 'SOL' && tx.nativeTransfers && tx.nativeTransfers.length > 0) {
        for (const transfer of tx.nativeTransfers) {
          if (transfer.toUserAccount === RECIPIENT_WALLET) {
            const receivedSol = (transfer.amount || 0) / LAMPORTS_PER_SOL;
            if (receivedSol >= expectedAmount * TOLERANCE) {
              return NextResponse.json({ verified: true, received: receivedSol, method: 'SOL', signature: tx.signature });
            }
          }
        }
      }
    }

    return NextResponse.json({
      verified: false,
      reason: 'No matching transaction found.',
    });

  } catch (error) {
    return NextResponse.json(
      { verified: false, reason: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
