// Version 1.0 — lib/telegram-alert.ts
//
// Admin-only Telegram alerts for external-service failures (Groq,
// RugCheck, Helius, DexScreener, etc). Separate from
// app/api/sendTelegram/route.js, which posts public "new audit passed"
// announcements to the public @tnt_house2026 channel — these alerts go
// to a private group ("Bonus X", chat_id -5051939937) that only the
// product owner can see, since error details shouldn't be public.
//
// Backstory (2026-08-27): Groq deprecated and shut down
// llama-3.1-8b-instant on Aug 16, 2026. Both chat widgets on the site
// (main site + /risk-api) had been silently returning 500s to every
// visitor for 11 days before anyone noticed — caught only because a
// visitor happened to screenshot the raw error and send it over. There
// was no monitoring in place for this class of failure. This helper
// is the fix: call alertAdmin() from any external-API call site's
// error path, and the product owner gets pinged in Telegram instead of
// finding out from a screenshot next time.
//
// Cooldown: per-service, 1 hour (COOLDOWN_MS below), tracked in the
// external_service_alerts Supabase table (service_name primary key,
// last_alerted_at). Prevents spamming the admin chat on every single
// failed request when a service is down for an extended period — one
// alert per service per hour is enough to know something's wrong
// without flooding the chat.
//
// Fire-and-forget by design: alertAdmin() never throws and never
// blocks the caller's own error response — a failure to send the
// Telegram alert itself (e.g. TELEGRAM_BOT_TOKEN unset, or the
// external_service_alerts query failing) is logged to console but must
// never turn into a second, unrelated 500 on top of the original
// external-API failure the caller is already handling.

import { supabaseAdmin } from './supabase-admin';

const ADMIN_CHAT_ID = '-5051939937'; // "Bonus X" private group, TnT_house_bot is a member
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per service

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Alert the admin in Telegram that an external service (Groq,
 * RugCheck, Helius, DexScreener, etc.) just failed — but only if we
 * haven't already alerted for that same service within the last hour.
 *
 * @param service Short identifier for the failing service, e.g.
 *   'groq-chat', 'rugcheck', 'helius-rpc', 'dexscreener'. Used both as
 *   the cooldown key and shown in the alert message.
 * @param detail Short error detail (status code, error message). Kept
 *   short — this is a heads-up ping, not a full log dump.
 */
export async function alertAdmin(service: string, detail: string): Promise<void> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('[telegram-alert] TELEGRAM_BOT_TOKEN not set — cannot send admin alert');
      return;
    }

    const { data: existing, error: readError } = await supabaseAdmin
      .from('external_service_alerts')
      .select('last_alerted_at')
      .eq('service_name', service)
      .maybeSingle();

    if (readError) {
      console.error('[telegram-alert] cooldown lookup failed:', readError.message);
      // Fail open on the read: better to occasionally over-alert than
      // to silently skip alerting because of an unrelated DB hiccup.
    } else if (existing) {
      const lastAlertedMs = new Date(existing.last_alerted_at).getTime();
      if (Date.now() - lastAlertedMs < COOLDOWN_MS) {
        return; // still within cooldown, skip
      }
    }

    const message =
      `🚨 <b>External service failing</b>\n\n` +
      `<b>Service:</b> ${escapeHtml(service)}\n` +
      `<b>Detail:</b> ${escapeHtml(detail).slice(0, 500)}\n` +
      `<b>Time:</b> ${new Date().toISOString()}`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[telegram-alert] Telegram API error:', errText);
      return;
    }

    // Upsert regardless of whether a row already existed — updates
    // last_alerted_at to now so the next hour's cooldown starts fresh.
    const { error: writeError } = await supabaseAdmin
      .from('external_service_alerts')
      .upsert({ service_name: service, last_alerted_at: new Date().toISOString() });

    if (writeError) {
      console.error('[telegram-alert] cooldown write failed:', writeError.message);
    }
  } catch (err) {
    console.error('[telegram-alert] unexpected error:', err instanceof Error ? err.message : err);
  }
}
