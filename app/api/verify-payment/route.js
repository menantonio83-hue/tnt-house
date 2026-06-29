import { NextResponse } from 'next/server';

export const runtime = 'edge';

const RECIPIENT_WALLET = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_MINT = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
const LAMPORTS_PER_SOL = 1_000_000_000;
const TOLERANCE = 0.90; // 10% tolerance for price fluctuations

export async function POST(request) {
  try {
    const body = await request.json();
    const { expectedAmount, since, method } = body;

    if (typeof expectedAmount !== 'number' || typeof since !== 'number') {
      return NextResponse.json(
        { verified: false, reason: 'Invalid parameters: expectedAmount and since are required.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { verified: false, reason: 'Server config error: HELIUS_API_KEY missing.' },
        { status: 500 }
      );
    }

    // Subtract 30 seconds buffer for clock sync issues
    const sinceSeconds = Math.floor(since / 1000) - 30;

    // Fetch recent transactions for our wallet
    const heliusUrl = `https://api.helius.xyz/v0/addresses/${RECIPIENT_WALLET}/transactions?api-key=${apiKey}&type=TRANSFER&limit=20`;

    const response = await fetch(heliusUrl);

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { verified: false, reason: `Helius API error: ${response.status} - ${errText}` },
        { status: 502 }
      );
    }

    const transactions = await response.json();

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ verified: false, reason: 'No recent transactions found.' });
    }

    const minAllowedAmount = expectedAmount * TOLERANCE;
    const paymentMethod = method || 'MRDT';

    for (const tx of transactions) {
      // Skip transactions older than our payment start time
      const txTime = tx.timestamp || 0;
      if (txTime < sinceSeconds) continue;

      // Check MRDT token transfers
      if (paymentMethod === 'MRDT' && tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        for (const transfer of tx.tokenTransfers) {
          const isMrdt = transfer.mint === MRDT_MINT;
          const isOurWallet = transfer.toUserAccount === RECIPIENT_WALLET;

          if (isMrdt && isOurWallet) {
            // Helius returns UI amount (already adjusted for decimals)
            const received = parseFloat(transfer.tokenAmount ?? transfer.amount ?? 0);
            if (received >= minAllowedAmount) {
              return NextResponse.json({
                verified: true,
                received,
                method: 'MRDT',
                signature: tx.signature,
              });
            }
          }
        }
      }

      // Check SOL native transfers
      if (paymentMethod === 'SOL' && tx.nativeTransfers && tx.nativeTransfers.length > 0) {
        for (const transfer of tx.nativeTransfers) {
          const isOurWallet = transfer.toUserAccount === RECIPIENT_WALLET;

          if (isOurWallet) {
            // nativeTransfers amount is in lamports — convert to SOL
            const receivedSol = (transfer.amount || 0) / LAMPORTS_PER_SOL;
            if (receivedSol >= minAllowedAmount) {
              return NextResponse.json({
                verified: true,
                received: receivedSol,
                method: 'SOL',
                signature: tx.signature,
              });
            }
          }
        }
      }

      // Fallback: check both if method unknown
      if (!method) {
        // Check tokenTransfers for MRDT
        if (tx.tokenTransfers) {
          for (const transfer of tx.tokenTransfers) {
            if (transfer.mint === MRDT_MINT && transfer.toUserAccount === RECIPIENT_WALLET) {
              const received = parseFloat(transfer.tokenAmount ?? transfer.amount ?? 0);
              if (received >= minAllowedAmount) {
                return NextResponse.json({ verified: true, received, method: 'MRDT', signature: tx.signature });
              }
            }
          }
        }
        // Check nativeTransfers for SOL
        if (tx.nativeTransfers) {
          for (const transfer of tx.nativeTransfers) {
            if (transfer.toUserAccount === RECIPIENT_WALLET) {
              const receivedSol = (transfer.amount || 0) / LAMPORTS_PER_SOL;
              if (receivedSol >= minAllowedAmount) {
                return NextResponse.json({ verified: true, received: receivedSol, method: 'SOL', signature: tx.signature });
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      verified: false,
      reason: 'No matching transaction found. Amount may not match or transaction is too old.',
    });

  } catch (error) {
    return NextResponse.json(
      { verified: false, reason: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
