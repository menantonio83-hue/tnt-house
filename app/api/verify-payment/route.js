// app/api/verify-payment/route.js
import { NextResponse } from 'next/server';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RECIPIENT_WALLET = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const TOKEN_MINT = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';

export async function POST(request) {
  try {
    const { expectedAmount, since } = await request.json();

    // Валидация входных параметров
    if (typeof expectedAmount !== 'number' || typeof since !== 'number') {
      return NextResponse.json(
        { verified: false, reason: 'Invalid parameters: expectedAmount и since должны быть числами' },
        { status: 400 }
      );
    }

    // 1. Получаем последние транзакции для кошелька через Helius Enhanced API
    const url = new URL(`https://api.helius.xyz/v0/addresses/${RECIPIENT_WALLET}/transactions`);
    url.searchParams.set('apiKey', HELIUS_API_KEY);
    url.searchParams.set('limit', '100'); // достаточно для polling каждые 10 сек

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
    }

    const transactions = await response.json();
    const sinceSec = since / 1000; // Helius timestamp в секундах

    // 2. Фильтруем транзакции, произошедшие после переданного since
    const relevantTxs = transactions.filter(tx => tx.timestamp >= sinceSec);

    // 3. Ищем транзакцию с входящим переводом нашего токена
    for (const tx of relevantTxs) {
      // Проверяем tokenBalanceChanges (самый надёжный способ)
      const balanceChanges = tx.tokenBalanceChanges;
      if (!Array.isArray(balanceChanges)) continue;

      const incomingChange = balanceChanges.find(change =>
        change.mint === TOKEN_MINT &&
        change.userAccount === RECIPIENT_WALLET
      );

      if (incomingChange) {
        // rawTokenAmount содержит изменение в базовых единицах и decimals
        const rawAmount = incomingChange.rawTokenAmount.tokenAmount; // строка
        const decimals = incomingChange.rawTokenAmount.decimals;
        const received = parseInt(rawAmount, 10) / Math.pow(10, decimals);

        // Проверяем, что это входящий перевод (положительное изменение) и сумма >= expected с 5% запасом
        if (received > 0 && received >= expectedAmount * 0.95) {
          return NextResponse.json({
            verified: true,
            received,
            signature: tx.signature
          });
        }
      }

      // Дополнительно: можно проверить tokenTransfers (но там toUserAccount – ATA, а не кошелёк)
      // Если хотите, раскомментируйте код ниже, предварительно вычислив ATA
      /*
      const tokenTransfers = tx.tokenTransfers;
      if (Array.isArray(tokenTransfers)) {
        for (const transfer of tokenTransfers) {
          if (transfer.mint === TOKEN_MINT && transfer.amount) {
            // Здесь нужно сравнить transfer.toUserAccount с ATA для вашего кошелька
            // Вычисление ATA: getAssociatedTokenAddress(new PublicKey(RECIPIENT_WALLET), new PublicKey(TOKEN_MINT))
            // Если совпало – проверяем сумму
          }
        }
      }
      */
    }

    // 4. Если ничего не нашли
    return NextResponse.json({
      verified: false,
      reason: 'Транзакция с входящим переводом токена не найдена в последних 100 транзакциях'
    });

  } catch (error) {
    console.error('Ошибка верификации:', error);
    return NextResponse.json(
      { verified: false, reason: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
