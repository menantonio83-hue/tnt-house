// app/api/verify-payment/route.js
// Verifies Solana SPL token payment by polling wallet transaction history

export const runtime = 'edge';

const WALLET_ADDRESS = "Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";

// Public Solana RPC endpoints (fallback chain)
const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
];

async function rpcCall(endpoint, method, params) {
  var res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error('RPC error: ' + res.status);
  var data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function rpcCallWithFallback(method, params) {
  for (var i = 0; i < RPC_ENDPOINTS.length; i++) {
    try {
      return await rpcCall(RPC_ENDPOINTS[i], method, params);
    } catch (e) {
      if (i === RPC_ENDPOINTS.length - 1) throw e;
    }
  }
}

export async function POST(request) {
  try {
    var body = await request.json();
    var { expectedAmount, since } = body;
    // expectedAmount: number of MRDT tokens (integer)
    // since: unix timestamp ms — only check txs after this time

    // 1. Get recent signatures for our wallet
    var signatures = await rpcCallWithFallback('getSignaturesForAddress', [
      WALLET_ADDRESS,
      { limit: 20, commitment: 'confirmed' }
    ]);

    if (!signatures || signatures.length === 0) {
      return Response.json({ verified: false, reason: 'No recent transactions' });
    }

    // 2. Filter to only recent signatures (after payment was initiated)
    var sinceSeconds = Math.floor(since / 1000) - 60; // 60s buffer
    var recentSigs = signatures.filter(function (s) {
      return s.blockTime && s.blockTime >= sinceSeconds && !s.err;
    });

    if (recentSigs.length === 0) {
      return Response.json({ verified: false, reason: 'No transactions since payment initiated' });
    }

    // 3. Check each transaction for SPL token transfer of MRDT
    for (var i = 0; i < recentSigs.length; i++) {
      try {
        var tx = await rpcCallWithFallback('getTransaction', [
          recentSigs[i].signature,
          { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }
        ]);

        if (!tx || !tx.meta) continue;

        // Look through post token balances for MRDT transfer to our wallet
        var postBalances = tx.meta.postTokenBalances || [];
        var preBalances = tx.meta.preTokenBalances || [];

        for (var j = 0; j < postBalances.length; j++) {
          var post = postBalances[j];

          // Must be MRDT mint and our wallet
          if (post.mint !== MRDT_CA) continue;
          if (post.owner !== WALLET_ADDRESS) continue;

          // Find pre-balance for same account index
          var pre = preBalances.find(function (p) { return p.accountIndex === post.accountIndex; });
          var preAmount = pre ? parseFloat(pre.uiTokenAmount.uiAmount || 0) : 0;
          var postAmount = parseFloat(post.uiTokenAmount.uiAmount || 0);
          var received = postAmount - preAmount;

          // Allow 5% tolerance for price fluctuation
          var tolerance = 0.05;
          var minExpected = expectedAmount * (1 - tolerance);

          if (received >= minExpected) {
            return Response.json({
              verified: true,
              received: Math.round(received),
              expected: expectedAmount,
              signature: recentSigs[i].signature,
            });
          }
        }
      } catch (e) {
        // Skip failed tx parse, try next
        continue;
      }
    }

    return Response.json({ verified: false, reason: 'Payment not found in recent transactions' });

  } catch (e) {
    return Response.json({ verified: false, reason: 'RPC error: ' + e.message }, { status: 500 });
  }
}
