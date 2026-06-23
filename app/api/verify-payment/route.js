import { NextResponse } from 'next/server';

export const runtime = 'edge';

const RECIPIENT_WALLET = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_MINT = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';

export async function POST(request) {
  try {
    const { expectedAmount, since } = await request.json();

    // Базовая валидация входящих параметров
    if (typeof expectedAmount !== 'number' || typeof since !== 'number') {
      return NextResponse.json(
        { verified: false, reason: 'Invalid or missing parameters: expectedAmount and since are required.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { verified: false, reason: 'Server configuration error: HELIUS_API_KEY is missing.' },
        { status: 500 }
      );
    }

    // Helius принимает Unix-таймстамп в секундах. Подгоняем ms из фронтенда.
    // Вычитаем 10 секунд запаса на случай микро-рассинхронизации часов между серверами.
    const sinceSeconds = Math.floor(since / 1000) - 10;

    // КРИТИЧЕСКИЙ ФИКС:
    // 1. Добавлен token-accounts=balanceChanged для автоматического трекинга ATA.
    // 2. Добавлен gte-time для фильтрации старого бэклога на уровне Helius API.
    const heliusUrl = `https://api.helius.xyz/v0/addresses/${RECIPIENT_WALLET}/transactions?api-key=${apiKey}&type=TRANSFER&token-accounts=balanceChanged&gte-time=${sinceSeconds}`;

    const response = await fetch(heliusUrl);
    
    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { verified: false, reason: `Helius API error: ${response.status} - ${errText}` },
        { status: 502 }
      );
    }

    const transactions = await response.json();

    // Парсим массив деструктурированных транзакций от Helius
    for (const tx of transactions) {
      if (!tx.tokenTransfers || tx.tokenTransfers.length === 0) continue;

      for (const transfer of tx.tokenTransfers) {
        const isMrdtToken = transfer.mint === MRDT_MINT;
        const isOurRecipient = transfer.toUserAccount === RECIPIENT_WALLET;

        if (isMrdtToken && isOurRecipient) {
          // В Helius Enhanced API поле tokenAmount возвращает уже валидный UI-amount (float),
          // с учётом decimals токена. Делаем fallback на amount на всякий случай.
          const receivedAmount = transfer.tokenAmount ?? transfer.amount ?? 0;
          const minAllowedAmount = expectedAmount * 0.95; // 5% tolerance

          if (receivedAmount >= minAllowedAmount) {
            return NextResponse.json({
              verified: true,
              received: receivedAmount,
              signature: tx.signature
            });
          }
        }
      }
    }

    return NextResponse.json({
      verified: false,
      reason: 'No matching transaction found within the specified timeframe and amount.'
    });

  } catch (error) {
    return NextResponse.json(
      { verified: false, reason: error instanceof Error ? error.message : 'Unknown internal error' },
      { status: 500 }
    );
  }
}
