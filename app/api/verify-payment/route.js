// app/api/verify-payment/route.js
import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RECIPIENT_WALLET = new PublicKey('Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z');
const TOKEN_MINT = new PublicKey('8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg');

// Вычисляем ATA для получателя
const RECIPIENT_ATA = getAssociatedTokenAddressSync(TOKEN_MINT, RECIPIENT_WALLET).toBase58();

export async function POST(request) {
  try {
    const { expectedAmount, since } = await request.json();

    if (typeof expectedAmount !== 'number' || typeof since !== 'number') {
      return NextResponse.json(
        { verified: false, reason: 'Invalid parameters' },
        { status: 400 }
      );
    }

    // Получаем последние транзакции кошелька (без фильтра типа)
    const url = new URL(`https://api.helius.xyz/v0/addresses/${RECIPIENT_WALLET.toBase58()}/transactions`);
    url.searchParams.set('apiKey', HELIUS_API_KEY);
    url.searchParams.set('limit', '200'); // побольше для надёжности

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const transactions = await response.json();
    const sinceSec = since / 1000;

    // Ищем транзакцию с входящим SPL-переводом нашего токена
    for (const tx of transactions) {
      if (tx.timestamp < sinceSec) continue;

      const transfers = tx.tokenTransfers;
      if (!Array.isArray(transfers)) continue;

      for (const transfer of transfers) {
        // Проверяем mint и получателя (ATA)
        if (transfer.mint !== TOKEN_MINT.toBase58()) continue;
        if (transfer.toUserAccount !== RECIPIENT_ATA) continue;

        // Получаем сумму в человеческих единицах (uiAmountString / uiAmount)
        const received = transfer.uiTokenAmount?.uiAmount ?? transfer.rawTokenAmount?.tokenAmount;
        if (received === undefined) continue;

        // rawTokenAmount.tokenAmount – строка с количеством в базовых единицах
        // uiTokenAmount.uiAmount – число с плавающей точкой
        const amount = typeof received === 'string'
          ? parseInt(received, 10) / Math.pow(10, transfer.rawTokenAmount?.decimals || 0)
          : received; // уже число от uiTokenAmount.uiAmount

        if (amount >= expectedAmount * 0.95) {
          return NextResponse.json({
            verified: true,
            received: amount,
            signature: tx.signature
          });
        }
      }
    }

    return NextResponse.json({
      verified: false,
      reason: 'Payment not detected'
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { verified: false, reason: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
