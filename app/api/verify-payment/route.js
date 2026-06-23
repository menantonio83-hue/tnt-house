// app/api/verify-payment/route.js
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RECIPIENT = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_MINT = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';

export async function POST(req) {
  try {
    const { expectedAmount, since } = await req.json();

    if (!expectedAmount || typeof expectedAmount !== 'number' || expectedAmount <= 0) {
      return NextResponse.json({ verified: false, reason: 'Invalid expectedAmount' }, { status: 400 });
    }

    const sinceSec = Math.floor((since || (Date.now() - 15 * 60 * 1000)) / 1000);

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
          limit: 25,
          sortOrder: 'desc',
          commitment: 'finalized',
          filters: {
            blockTime: { gte: sinceSec - 180 } // небольшой буфер
          }
        }
      ]
    };

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Helius RPC ${res.status}`);

    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'Helius error');

    const transfers = json.result?.data || [];
    const minAmount = expectedAmount * 0.95;

    for (const tx of transfers) {
      if (!tx.uiAmount || tx.blockTime < sinceSec - 300) continue;

      if (tx.uiAmount >= minAmount) {
        return NextResponse.json({
          verified: true,
          received: tx.uiAmount,
          signature: tx.signature,
          from: tx.fromUserAccount,
          timestamp: tx.blockTime,
        });
      }
    }

    return NextResponse.json({
      verified: false,
      reason: 'No matching incoming $MRDT transfer found',
      checked: transfers.length,
    });

  } catch (e) {
    console.error('[verify-payment]', e);
    return NextResponse.json({
      verified: false,
      reason: e.message || 'Internal error',
    }, { status: 500 });
  }
}
