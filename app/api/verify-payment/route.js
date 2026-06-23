// Temporary debug version - very lenient for testing
// app/api/verify-payment/route.js
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RECIPIENT = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_MINT = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';

export async function POST(req) {
  try {
    const body = await req.json();
    const expectedAmount = Number(body.expectedAmount) || 0;
    const since = Number(body.since);

    const sinceSec = Math.floor((since || Date.now() - 40 * 60 * 1000) / 1000);

    console.log('[verify-DEBUG] Checking payment', { expectedAmount, sinceSec });

    // Get recent incoming transfers (very lenient)
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    const payload = {
      jsonrpc: '2.0',
      id: 'verify-debug',
      method: 'getTransfersByAddress',
      params: [
        RECIPIENT,
        {
          direction: 'in',
          mint: MRDT_MINT,
          limit: 20,
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

    const transfers = json.result?.data || [];

    console.log('[verify-DEBUG] Found transfers:', transfers.length);

    // Very lenient: accept any incoming transfer in last ~40 minutes
    for (const tx of transfers) {
      const amount = parseFloat(tx.uiAmount) || 0;
      const txTime = tx.blockTime || 0;

      if (amount > 0.01 && txTime >= sinceSec - 600) {
        console.log('[verify-DEBUG] ACCEPTED (lenient)', { amount, sig: tx.signature });
        return NextResponse.json({
          verified: true,
          received: amount,
          signature: tx.signature,
          from: tx.fromUserAccount,
          note: 'DEBUG LENIENT MODE'
        });
      }
    }

    return NextResponse.json({
      verified: false,
      reason: 'DEBUG: No incoming $MRDT found in recent transfers',
      transfersFound: transfers.length,
      sample: transfers.slice(0, 2).map(t => ({ amount: t.uiAmount, time: t.blockTime }))
    });

  } catch (e) {
    console.error('[verify-DEBUG] Error:', e);
    return NextResponse.json({ verified: false, reason: e.message });
  }
}
