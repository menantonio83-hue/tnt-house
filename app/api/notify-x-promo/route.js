// Version 2.0 — app/api/notify-x-promo/route.js
//
// v2.0 (M-3 fix): the route no longer trusts ANY client-supplied fact.
// v1.0 accepted { ca, tier, tokenName } straight from the browser with
// no auth and no payment proof — anyone could ping the private admin
// Telegram group with arbitrary content, or socially engineer a promo
// for a token that was never bought. Now:
//
//   1. It accepts ONE field: orderId (a server-issued UUID).
//   2. It reads the order from site_orders and refuses unless the row is
//      kind='listing', tier IN ('fast','vip') AND status='paid' — the
//      same trust chain as /api/listed-tokens/complete-paid:
//      site_orders_tx_signature_uniq guarantees the payment was real and
//      unique, and only the server ever wrote the row.
//   3. A Redis SET NX dedup key caps notifications at ONE per order,
//      ever (a re-fired poll after a network hiccup cannot spam the
//      chat).
//   4. Every fact in the Telegram message comes from the database, not
//      the request body.
//
// The caller (app/page.js startPaymentVerification) sends
// { orderId: auditData.orderId } after a verified payment.
//
// Deliberately NOT reusing lib/telegram-alert.ts's alertAdmin() — that
// helper hardcodes the message title as "🚨 External service failing",
// meant for genuine service outages. Reusing it here would mislabel a
// successful purchase as a failure. Same admin chat ID and bot token,
// own message text — small, honest duplication rather than a confusing
// shared function.

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Env override so the chat id isn't frozen in source; the constant keeps
// working for the current deployment.
const ADMIN_CHAT_ID = process.env.X_PROMO_ADMIN_CHAT_ID || '-5051939937';

// One reminder per order, ever. 30 days is far longer than any
// legitimate retry window; it exists so the dedup key self-cleans.
const NOTIFY_ONCE_TTL_SECONDS = 30 * 24 * 60 * 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function POST(request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('[notify-x-promo] TELEGRAM_BOT_TOKEN not set');
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    if (!UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'invalid_order_id' }, { status: 400 });
    }

    // Every fact below comes from the site_orders row the server wrote
    // at purchase time — never from the request body.
    const { data: order, error: lookupError } = await supabaseAdmin
      .from('site_orders')
      .select('kind, tier, ca, status')
      .eq('id', orderId)
      .maybeSingle();

    if (lookupError) {
      console.error('[notify-x-promo] site_orders lookup failed:', lookupError.message);
      return NextResponse.json({ error: 'Lookup failed' }, { status: 502 });
    }
    if (!order) {
      return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
    }
    if (order.kind !== 'listing' || order.status !== 'paid') {
      // Same generic shape as not-found: don't confirm to a caller that
      // an order exists but is unpaid (or a banner order).
      return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
    }
    if (order.tier !== 'fast' && order.tier !== 'vip') {
      // Verified ($3) does not include X promo — nothing to remind about.
      return NextResponse.json({ skipped: true, reason: 'tier does not include X promo' });
    }
    if (!order.ca) {
      // Unreachable given site_orders_kind_identifier, but refuse loudly
      // rather than send a message with no CA.
      console.error('[notify-x-promo] paid listing order with no ca:', orderId);
      return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
    }

    // One reminder per order, ever. Fails open on a Redis error: the
    // paid-order check above is the real gate, and a duplicate reminder
    // during a Redis outage is cosmetic.
    if (redis) {
      try {
        const first = await redis.set(`xpromo:notified:${orderId}`, '1', {
          nx: true,
          ex: NOTIFY_ONCE_TTL_SECONDS,
        });
        if (first === null) {
          return NextResponse.json({ ok: true, skipped: 'already_notified' });
        }
      } catch (e) {
        console.error('[notify-x-promo] dedup check failed, sending anyway:', e.message);
      }
    }

    const tierLabel = order.tier === 'vip' ? 'VIP ($29)' : 'Priority ($9)';
    const message =
      `🐦 <b>X promo reminder</b>\n\n` +
      `<b>Tier:</b> ${tierLabel}\n` +
      `<b>CA:</b> <code>${escapeHtml(order.ca)}</code>\n\n` +
      `This tier includes an X post — don't forget to post it manually in @TopNewToken.`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: message, parse_mode: 'HTML' }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[notify-x-promo] Telegram API error:', errText);
      return NextResponse.json({ error: 'Telegram send failed' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/notify-x-promo Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
