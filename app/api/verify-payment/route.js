// app/api/verify-payment/route.js
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RECIPIENT = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_MINT = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';

export async function POST(req) {
  try {
    const { expectedAmount, since } = await req.json();

    if (!expectedAmount || typeof expectedAmount !== 'number') {
      return NextResponse.json({ verified: false, reason: 'Bad expectedAmount' });
    }

    const sinceSec = Math.floor((since || Date.now() - 20 * 60 * 1000) / 1000);
    const minAmount = expectedAmount * 0.95;

    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

    // Убрал жёсткий filters из Helius — берём последние входящие и фильтруем сами
    const payload = {
      jsonrpc: '2.0',
      id: 'verify',
      method: 'getTransfersByAddress',
      params: [
        RECIPIENT,
        {
          direction: 'in',
          mint: MRDT_MINT,
          limit: 30,
          sortOrder: 'desc',
          commitment: 'confirmed'   // ← поменял на confirmed (быстрее)
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
      return NextResponse.json({
        verified: false,
        reason: 'Helius error: ' + json.error.message,
        heluisResponse: json
      });
    }

    const transfers = json.result?.data || [];

    // Ищем подходящий перевод
    for (const tx of transfers) {
      const amount = Number(tx.uiAmount) || 0;
      const txTime = tx.blockTime || 0;

      if (amount >= minAmount && txTime >= sinceSec - 300) {
        return NextResponse.json({
          verified: true,
          received: amount,
          signature: tx.signature,
          from: tx.fromUserAccount,
          timestamp: txTime
        });
      }
    }

    // Если не нашли — возвращаем что именно видел эндпоинт (для дебага)
    return NextResponse.json({
      verified: false,
      reason: 'No matching transfer found',
      expectedAmount,
      minAmount,
      since: sinceSec,
      transfersFound: transfers.length,
      recentTransfers: transfers.slice(0, 5).map(t => ({
        signature: t.signature,
        uiAmount: t.uiAmount,
        blockTime: t.blockTime,
        from: t.fromUserAccount
      }))
    });

  } catch (e) {
    return NextResponse.json({
      verified: false,
      reason: e.message || 'Server error'
    });
  }
}
