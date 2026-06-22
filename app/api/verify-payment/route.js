// app/api/verify-payment/route.js
// Verifies Solana SPL token payment using Helius RPC

export const runtime = 'edge';

const WALLET_ADDRESS = "Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";

function getHeliusUrl() {
  const key = process.env.HELIUS_API_KEY;
  return `https://mainnet.helius-rpc.com/?api-key=${key}`;
}

async function rpcCall(method, params) {
  const url = getHeliusUrl();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error('Helius RPC error: ' + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { expectedAmount, since } = body;

    if (!expectedAmount || !since) {
      return Response.json({ verified: false, reason: 'Missing expectedAmount or since' });
    }

    // 1. Get recent confirmed signatures for our wallet
    const signatures = await rpcCall('getSignaturesForAddress', [
      WALLET_ADDRESS,
      { limit: 25, commitment: 'confirmed' }
    ]);

    if (!signatures || signatures.length === 0) {
      return Response.json({ verified: false, reason: 'No recent transactions found' });
    }

    // 2. Filter to txs after payment was initiated (with 90s buffer)
    const sinceSeconds = Math.floor(since / 1000) - 90;
    const recentSigs = signatures.filter(s =>
      s.blockTime && s.blockTime >= sinceSeconds && !s.err
    );

    if (recentSigs.length === 0) {
      return Response.json({ verified: false, reason: 'No new transactions since payment started' });
    }

    // 3. Check each tx for MRDT SPL transfer to our wallet
    for (const sig of recentSigs) {
      try {
        const tx = await rpcCall('getTransaction', [
          sig.signature,
          {
            encoding: 'jsonParsed',
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          }
        ]);

        if (!tx?.meta) continue;

        const postBalances = tx.meta.postTokenBalances || [];
        const preBalances = tx.meta.preTokenBalances || [];

        for (const post of postBalances) {
          // Must be MRDT token received by our wallet
          if (post.mint !== MRDT_CA) continue;
          if (post.owner !== WALLET_ADDRESS) continue;

          const pre = preBalances.find(p => p.accountIndex === post.accountIndex);
          const preAmount = pre ? parseFloat(pre.uiTokenAmount.uiAmount || 0) : 0;
          const postAmount = parseFloat(post.uiTokenAmount.uiAmount || 0);
          const received = postAmount - preAmount;

          // Allow 5% tolerance for price fluctuation
          if (received >= expectedAmount * 0.95) {
            return Response.json({
              verified: true,
              received: Math.round(received),
              expected: expectedAmount,
              signature: sig.signature,
            });
          }
        }
      } catch (e) {
        // Skip failed tx, try next
        continue;
      }
    }

    return Response.json({
      verified: false,
      reason: 'Payment not found',
      checked: recentSigs.length
    });

  } catch (e) {
    return Response.json({
      verified: false,
      reason: 'Server error: ' + e.message
    }, { status: 500 });
  }
}
