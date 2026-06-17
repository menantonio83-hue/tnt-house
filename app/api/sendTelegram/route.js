export async function POST(request) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not set' }), { status: 500 });
  }
  
  const data = await request.json();
  const { tokenName, symbol, ca, mintAuthority, freezeAuthority, top10Percent, liquidityUSD, lpLocked, dexUrl } = data;
  
  const message = `🔍 *Новый прошедший ИИ-аудит!*

` +
    `*Токен:* ${tokenName} ($${symbol})
` +
    `*CA:* \`${ca}\`
` +
    `*Mint Authority:* ${mintAuthority}
` +
    `*Freeze Authority:* ${freezeAuthority}
` +
    `*Концентрация топ-10 холдеров:* ${top10Percent}%
` +
    `*Ликвидность:* $${liquidityUSD.toLocaleString()}
` +
    `*LP заблокированы:* ${lpLocked}
` +
    `*DexScreener:* [Открыть](${dexUrl})`;

  const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: '@tnt_house2026',
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      })
    });
    
    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram API error:', result);
      return new Response(JSON.stringify({ error: result.description }), { status: 500 });
    }
    
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('Telegram fetch error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
