// app/api/verify-payment/route.js
// v3 - Uses Helius Enhanced Transactions API for reliable SPL token detection

export const runtime = 'edge';

const WALLET_ADDRESS = "Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";

export async function POST(request) {
  try {
    const body = await request.json();
    const { expectedAmount, since } = body;

    if (!expectedAmount || !since) {
      return Response.json({ verified: false, reason: 'Missing params' });
    }

    const key = process.env.HELIUS_API_KEY;

    // Use Helius Enhanced Transactions API - parses SPL transfers automatically
    const res = await fetch(
      `https://api.helius.xyz/v0/addresses/${WALLET_ADDRESS}/transactions?api-key=${key}&limit=20&type=TRANSFER`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );

    if (!res.ok) {
      return Response.json({ verified: false, reason: 'Helius API error: ' + res.status });
    }

    const txs = await res.json();

    if (!txs || txs.length === 0) {
      return Response.json({ verified: false, reason: 'No transactions found' });
    }

    // Filter to txs after payment was initiated (90s buffer)
    const sinceSeconds = Math.floor(since / 1000) - 90;
    const recentTxs = txs.filter(tx => tx.timestamp && tx.timestamp >= sinceSeconds);

    if (recentTxs.length === 0) {
      return Response.json({
        verified: false,
        reason: 'No recent transactions',
        debug: { total: txs.length, latest: txs[0]?.timestamp, sinceSeconds }
      });
    }

    // Check each tx for MRDT token transfers to our wallet
    for (const tx of recentTxs) {
      // Helius Enhanced API provides tokenTransfers array
      const tokenTransfers = tx.tokenTransfers || [];

      for (const transfer of tokenTransfers) {
        // Check if MRDT was transferred TO our wallet
        if (
          transfer.mint === MRDT_CA &&
          transfer.toUserAccount === WALLET_ADDRESS &&
          transfer.tokenAmount >= expectedAmount * 0.95
        ) {
          return Response.json({
            verified: true,
            received: Math.round(transfer.tokenAmount),
            expected: expectedAmount,
            signature: tx.signature,
          });
        }
      }

      // Also check nativeTransfers and accountData as fallback
      const accountData = tx.accountData || [];
      for (const account of accountData) {
        if (account.account === WALLET_ADDRESS) {
          const tokenChanges = account.tokenBalanceChanges || [];
          for (const change of tokenChanges) {
            if (change.mint === MRDT_CA) {
              const received = parseFloat(change.rawTokenAmount?.uiAmount || 0);
              if (received >= expectedAmount * 0.95) {
                return Response.json({
                  verified: true,
                  received: Math.round(received),
                  expected: expectedAmount,
                  signature: tx.signature,
                });
              }
            }
          }
        }
      }
    }

    return Response.json({
      verified: false,
      reason: 'MRDT payment not found',
      debug: { checkedTxs: recentTxs.length }
    });

  } catch (e) {
    return Response.json({
      verified: false,
      reason: 'Error: ' + e.message
    }, { status: 500 });
  }
}
