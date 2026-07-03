// app/api/sendTelegram/route.js
// Version 1.1
//
// FIX v1.1: switched from parse_mode "Markdown" (legacy) to "HTML".
// Legacy Markdown breaks the ENTIRE message if any user-supplied field
// (token name, symbol) contains an unescaped special char (_ * [ ] ( ) ~
// ` > # + - = | { } . !) — since token names come straight from user
// submissions, this was near-guaranteed to eventually 400 silently
// (the frontend call is fire-and-forget, so failures were never seen).
// HTML mode only requires escaping < > & , which we do explicitly below,
// so this can no longer break on arbitrary token names.

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function POST(request) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[sendTelegram] TELEGRAM_BOT_TOKEN not set');
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not set' }), { status: 500 });
  }

  const data = await request.json();
  const {
    tokenName,
    symbol,
    ca,
    mintAuthority,
    freezeAuthority,
    top10Percent,
    liquidityUSD,
    lpLocked,
    dexUrl,
  } = data;

  const safeLiquidity = typeof liquidityUSD === 'number' ? liquidityUSD : 0;

  const message =
    `🔍 <b>Новый прошедший ИИ-аудит!</b>\n\n` +
    `<b>Токен:</b> ${escapeHtml(tokenName)} ($${escapeHtml(symbol)})\n` +
    `<b>CA:</b> <code>${escapeHtml(ca)}</code>\n` +
    `<b>Mint Authority:</b> ${escapeHtml(mintAuthority)}\n` +
    `<b>Freeze Authority:</b> ${escapeHtml(freezeAuthority)}\n` +
    `<b>Концентрация топ-10 холдеров:</b> ${escapeHtml(top10Percent)}%\n` +
    `<b>Ликвидность:</b> $${safeLiquidity.toLocaleString()}\n` +
    `<b>LP заблокированы:</b> ${escapeHtml(lpLocked)}\n` +
    `<b>DexScreener:</b> <a href="${escapeHtml(dexUrl)}">Открыть</a>`;

  const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: '@tnt_house2026',
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const result = await response.json();
    if (!result.ok) {
      // FIX v1.1: log the FULL Telegram error object (not just .description)
      // so misconfigurations like "bot not a group member" or "chat not
      // found" are visible in Vercel logs instead of a vague message.
      console.error('[sendTelegram] Telegram API error:', JSON.stringify(result));
      return new Response(JSON.stringify({ error: result.description, full: result }), {
        status: 500,
      });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('[sendTelegram] fetch error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
