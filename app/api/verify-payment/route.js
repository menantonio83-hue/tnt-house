// app/api/verify-payment/route.js
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RECIPIENT = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_MINT = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';

export async function POST(req) {
  try {
    const body = await req.json();
    const expectedAmount = Number(body.expectedAmount);
    const since = Number(body.since);

    if (!expectedAmount || expectedAmount <= 0) {
      return NextResponse.json({ verified: false, reason: 'Invalid expectedAmount' });
    }

    const sinceSec = Math.floor((since || Date.now() - 30 * 60 * 1000) / 1000);
    const minAmount = expectedAmount * 0.95;

    console.log('[verify] Checking payment', { expectedAmount, minAmount, sinceSec });

    // === 1. Try getTransfersByAddress ===
    let transfers = [];
    let usedMethod = 'getTransfersByAddress';

    try {
      const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
      const payload = {
        jsonrpc: '2.0',
        id: 'verify-mrdt',
        method: 'getTransfersByAddress',
        params: [
          RECIPIENT,
          {
            direction: 'in',
            mint: MRDT_MINT,
            limit: 40,
            sortOrder: 'desc',
            commitment: 'confirmed'
          }
        ]
      };

      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.error) {
        console.error('[verify] getTransfersByAddress error:', json.error);
      } else {
        transfers = json.result?.data || [];
      }
    } catch (e) {
      console.error('[verify] getTransfersByAddress fetch failed:', e.message);
    }

    // Search in getTransfersByAddress results
    for (const tx of transfers) {
      const amount = parseFloat(tx.uiAmount) || 0;
      const txTime = tx.blockTime || 0;

      if (amount >= minAmount && txTime >= sinceSec - 600) {
        console.log('[verify] SUCCESS via getTransfersByAddress', tx.signature);
        return NextResponse.json({
          verified: true,
          received: amount,
          signature: tx.signature,
          from: tx.fromUserAccount,
          method: usedMethod
        });
      }
    }

    // === 2. Fallback to Enhanced Transactions API ===
    usedMethod = 'enhanced-fallback';
    console.log('[verify] Falling back to Enhanced API, transfers found so far:', transfers.length);

    try {
      const enhancedUrl = `https://mainnet.helius-rpc.com/v0/addresses/${RECIPIENT}/transactions?api-key=${HELIUS_API_KEY}&type=TRANSFER&token-accounts=balanceChanged&sort-order=desc&limit=30`;
      const res = await fetch(enhancedUrl);
      const txs = await res.json();

      if (Array.isArray(txs)) {
        for (const tx of txs) {
          if (!tx.tokenTransfers) continue;

          const transfer = tx.tokenTransfers.find(t => 
            t.toUserAccount === RECIPIENT && t.mint === MRDT_MINT
          );

          if (transfer) {
            // Get decimals from accountData
            let decimals = 6;
            const accData = tx.accountData?.find(a => 
              a.tokenBalanceChanges?.some(b => b.mint === MRDT_MINT)
            );
            if (accData) {
              const change = accData.tokenBalanceChanges.find(b => b.mint === MRDT_MINT);
              if (change?.rawTokenAmount?.decimals) decimals = change.rawTokenAmount.decimals;
            }

            const rawAmount = Number(transfer.tokenAmount) || 0;
            const received = rawAmount / Math.pow(10, decimals);
            const txTime = tx.timestamp || 0;

            if (received >= minAmount && txTime >= sinceSec - 600) {
              console.log('[verify] SUCCESS via Enhanced', tx.signature);
              return NextResponse.json({
                verified: true,
                received,
                signature: tx.signature,
                method: usedMethod
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('[verify] Enhanced fallback error:', e.message);
    }

    // === Not found ===
    console.log('[verify] No matching transfer found after both methods');

    return NextResponse.json({
      verified: false,
      reason: 'No matching $MRDT incoming transfer found',
      expectedAmount,
      minAmount,
      since: sinceSec,
      getTransfersCount: transfers.length,
      methodTried: usedMethod,
      // Show first few for debug
      sampleTransfers: transfers.slice(0, 3).map(t => ({
        sig: t.signature?.slice(0, 20) + '...',
        uiAmount: t.uiAmount,
        time: t.blockTime
      }))
    });

  } catch (e) {
    console.error('[verify] Uncaught error:', e);
    return NextResponse.json({ verified: false, reason: e.message || 'Server error' });
  }
}
