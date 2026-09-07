// app/api/sendTelegram/route.js
// Version 1.2
//
// Announces a newly-audited token in the PUBLIC Telegram channel
// @tnt_house2026. Distinct from lib/telegram-alert.ts, which sends
// error alerts to a private admin group.
//
// FIX v1.1: switched from parse_mode "Markdown" (legacy) to "HTML".
// Legacy Markdown breaks the ENTIRE message if any user-supplied field
// (token name, symbol) contains an unescaped special char — since token
// names come straight from user submissions, this was near-guaranteed to
// eventually 400 silently (the frontend call is fire-and-forget, so
// failures were never seen).
//
// FIX v1.2 — CONTENT INJECTION INTO A PUBLIC CHANNEL.
//
// v1.1 took every field of the announcement from the POST body, with no
// auth of any kind. Anyone who found the URL could publish arbitrary text
// — any token name, any contract address, any liquidity figure — into the
// public channel under TNT House's name. For a product whose entire value
// is "we tell you which tokens are safe", letting a stranger publish a
// fabricated clean audit is about the worst possible content injection.
//
// There is no user account system to authenticate against here, so the fix
// is not authentication but removing the ability to assert anything: the
// route now accepts ONLY a mint address, reads the row from listed_tokens
// itself, and builds the message from what is actually stored. A caller
// can no longer state a single fact. The worst they can do is re-announce
// a token that genuinely is listed, and the per-mint cooldown below caps
// even that.
//
// Also fixed: escapeHtml did not escape double quotes, while dexUrl was
// interpolated straight into href="...". A crafted URL could close the
// attribute and inject another one. The URL is now taken from the database
// and required to be https before it is used as a link at all.

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { supabaseAdmin } from '@/lib/supabase-admin';

const CHANNEL = '@tnt_house2026';

// One announcement per mint per 24h. The legitimate flow announces a token
// once, right after its audit is saved; anything beyond that is either a
// double-submit or someone replaying the call.
const ANNOUNCE_COOLDOWN_SECONDS = 24 * 60 * 60;

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

// Escapes everything Telegram's HTML mode treats as markup, INCLUDING the
// double quote — v1.1 omitted it, which mattered because a value was being
// placed inside an href attribute.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatOrUnknown(value, suffix) {
  if (value === null || value === undefined || value === '') return 'Unknown';
  return escapeHtml(value) + (suffix || '');
}

export async function POST(request) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[sendTelegram] TELEGRAM_BOT_TOKEN not set');
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ca = typeof body?.ca === 'string' ? body.ca.trim() : '';
  if (!ca) {
    return NextResponse.json({ error: 'ca is required' }, { status: 400 });
  }

  // Every announced fact comes from here. Nothing in the request body
  // besides the mint address is used.
  const { data: token, error: lookupError } = await supabaseAdmin
    .from('listed_tokens')
    .select('name, symbol, ca, mint_authority, freeze_authority, top10_percent, liquidity, lp_locked_percent, dex_url')
    .eq('ca', ca)
    .maybeSingle();

  if (lookupError) {
    console.error('[sendTelegram] listed_tokens lookup failed:', lookupError.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 502 });
  }

  if (!token) {
    // Not an error worth alerting on — it is the expected answer for a
    // caller trying to announce something that was never audited.
    console.error('[sendTelegram] refused: no listed_tokens row for ca:', ca);
    return NextResponse.json(
      { error: 'This token is not listed, so it cannot be announced.' },
      { status: 404 },
    );
  }

  // Per-mint cooldown. Fails OPEN if Redis is down: a duplicate channel
  // post is a cosmetic problem, and the lookup above already means only
  // genuinely listed tokens can be announced at all.
  if (redis) {
    try {
      const key = `tg:announced:${ca}`;
      const first = await redis.set(key, '1', { nx: true, ex: ANNOUNCE_COOLDOWN_SECONDS });
      if (first === null) {
        return NextResponse.json(
          { ok: true, skipped: 'already announced in the last 24h' },
          { status: 200 },
        );
      }
    } catch (e) {
      console.error('[sendTelegram] cooldown check failed, posting anyway:', e.message);
    }
  }

  const liquidity = typeof token.liquidity === 'number' ? token.liquidity : 0;

  let message =
    `🔍 <b>New Token Passed AI Audit!</b>\n\n` +
    `<b>Token:</b> ${escapeHtml(token.name)} ($${escapeHtml(token.symbol)})\n` +
    `<b>CA:</b> <code>${escapeHtml(token.ca)}</code>\n` +
    `<b>Mint Authority:</b> ${formatOrUnknown(token.mint_authority)}\n` +
    `<b>Freeze Authority:</b> ${formatOrUnknown(token.freeze_authority)}\n` +
    `<b>Top-10 Holder Concentration:</b> ${formatOrUnknown(token.top10_percent, '%')}\n` +
    `<b>Liquidity:</b> $${liquidity.toLocaleString()}\n` +
    `<b>LP Locked:</b> ${formatOrUnknown(token.lp_locked_percent, '% locked')}`;

  // Only linked if it is really an https URL. A stored value that is not
  // one is simply left out rather than rendered as a link.
  if (typeof token.dex_url === 'string' && token.dex_url.startsWith('https://')) {
    message += `\n<b>DexScreener:</b> <a href="${escapeHtml(token.dex_url)}">Open</a>`;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHANNEL,
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
      return NextResponse.json({ error: result.description }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('[sendTelegram] fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
