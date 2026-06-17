import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const data = await request.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN is not set');
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    const chatId = '@tnt_house2026'; // Group username

    const message = `🚨 <b>Новый аудит в TNT House!</b>

` +
      `<b>Токен:</b> ${data.tokenName} ($${data.symbol})
` +
      `<b>CA:</b> <code>${data.ca}</code>
` +
      `<b>Mint Authority:</b> ${data.mintAuthority}
` +
      `<b>Freeze Authority:</b> ${data.freezeAuthority}
` +
      `<b>Топ-10 холдеров:</b> ${data.top10Percent}%
` +
      `<b>Ликвидность:</b> $${data.liquidityUSD?.toLocaleString() || 'N/A'}
` +
      `<b>LP заблокирован:</b> ${data.lpLocked}

` +
      `🔗 <a href="${data.dexUrl}">DexScreener</a>`;

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Telegram API error:', errorData);
      return NextResponse.json({ error: 'Failed to send Telegram message' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in sendTelegram route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
