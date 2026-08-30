// Version 1.0 — app/api/notify-x-promo/route.js
//
// Priority ($9) and VIP ($29) tiers now explicitly include an X (Twitter)
// promo post — see app/page.js tierFast/tierVIP copy. There is no
// automated X posting anywhere in this codebase (confirmed — only
// Telegram has an auto-post, via postAuditToTelegram / app/api/sendTelegram,
// and it fires for EVERY tier including free, not exclusive to
// Priority/VIP). So the X post is a manual action the site owner does
// by hand in @TopNewToken.
//
// This route is the reminder mechanism: called client-side right after
// a Priority/VIP payment is verified (app/page.js startPaymentVerification),
// it pings the private admin Telegram group directly.
//
// Deliberately NOT reusing lib/telegram-alert.ts's alertAdmin() — that
// helper hardcodes the message title as "🚨 External service failing",
// meant for genuine service outages. Reusing it here would mislabel a
// successful purchase as a failure. Same admin chat ID and bot token,
// own message text — small, honest duplication rather than a confusing
// shared function.

const ADMIN_CHAT_ID = '-5051939937'; // "Bonus X" private group, same as lib/telegram-alert.ts

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { ca, tier, tokenName } = body;

    if (!ca || !tier) {
      return Response.json({ error: 'ca and tier required' }, { status: 400 });
    }
    if (tier !== 'fast' && tier !== 'vip') {
      // Verified ($3) does not include X promo — nothing to remind about.
      return Response.json({ skipped: true, reason: 'tier does not include X promo' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('[notify-x-promo] TELEGRAM_BOT_TOKEN not set');
      return Response.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });
    }

    const tierLabel = tier === 'vip' ? 'VIP ($29)' : 'Priority ($9)';
    const message =
      `🐦 <b>X promo reminder</b>\n\n` +
      `<b>Tier:</b> ${escapeHtml(tierLabel)}\n` +
      `<b>Token:</b> ${escapeHtml(tokenName || ca)}\n` +
      `<b>CA:</b> <code>${escapeHtml(ca)}</code>\n\n` +
      `This tier includes an X post — don't forget to post it manually in @TopNewToken.`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: message, parse_mode: 'HTML' }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[notify-x-promo] Telegram API error:', errText);
      return Response.json({ error: 'Telegram send failed' }, { status: 502 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('POST /api/notify-x-promo Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
