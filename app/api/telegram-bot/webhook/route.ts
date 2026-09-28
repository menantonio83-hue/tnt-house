// Version 1.0 — app/api/telegram-bot/webhook/route.ts
//
// "Insider Alerts" Telegram bot — a thin Telegram-protocol wrapper
// around the SAME core logic as the HTTP API: lib/token-risk-core.ts
// for scoring, lib/rate-limit.ts + lib/billing-pricing.ts for
// quota/tiers, api_keys for billing state. No new billing/payment code
// — /upgrade just points at the existing crypto checkout
// (tnt-audit.com/risk-api#billing). Only new table: telegram_bot_links
// (see lib/telegram-bot-store.ts for schema + why).
//
// This is a SEPARATE bot from @TnT_house_bot (that one is the internal
// admin-alert bot, lib/telegram-alert.ts, private "Bonus X" group) —
// this one is new and customer-facing. Set it up via @BotFather, then
// set these env vars on Vercel:
//
//   TELEGRAM_INSIDER_BOT_TOKEN      — the bot token @BotFather gives you
//   TELEGRAM_INSIDER_WEBHOOK_SECRET — a random string; also passed to
//     Telegram's setWebhook call as secret_token. Telegram echoes it
//     back on every update as the X-Telegram-Bot-Api-Secret-Token
//     header, checked below so this endpoint can't be spoofed by
//     someone who merely finds the URL.
//
// POST /api/telegram-bot/webhook — called by Telegram itself, never by
// end users directly.

import { NextRequest, NextResponse } from 'next/server';
import { fetchTokenRisk } from '@/lib/token-risk-core';
import { enforceRateLimit } from '@/lib/rate-limit';
import {
  getOrCreateLinkedKey,
  linkExistingKey,
  touchLastCheck,
  peekTodayUsage,
} from '@/lib/telegram-bot-store';
import { FREE_DAILY_LIMIT, SUBSCRIPTION_MONTHLY_QUOTA } from '@/lib/billing-pricing';

export const dynamic = 'force-dynamic';
// Same budget as the real token-risk route — fetchTokenRisk's own
// cluster-detection background job decides whether to wait or defer.
export const maxDuration = 60;

const UPGRADE_URL = 'https://tnt-audit.com/risk-api#billing';
const GET_KEY_URL = 'https://tnt-audit.com/risk-api#get-key';

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

async function sendMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_INSIDER_BOT_TOKEN;
  if (!token) {
    console.error('[telegram-bot] TELEGRAM_INSIDER_BOT_TOKEN not set — cannot reply');
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error('[telegram-bot] sendMessage failed:', await res.text());
    }
  } catch (err) {
    console.error('[telegram-bot] sendMessage error:', err instanceof Error ? err.message : err);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shortMint(mint: string): string {
  return mint.length > 10 ? `${mint.slice(0, 4)}...${mint.slice(-4)}` : mint;
}

function verdictFor(score: number | undefined): string {
  if (score === undefined) return 'Unknown';
  if (score >= 70) return '🟢 Safe';
  if (score >= 40) return '🟡 Caution';
  return '🔴 High Risk';
}

// `used`/`limit` describe the CALLER's quota state right after this
// call was counted (from enforceRateLimit's RateLimitResult) — limit is
// null for an unlimited ('paid') key, in which case we skip that line
// entirely rather than print a confusing "X/null".
function formatCheckResult(
  result: Awaited<ReturnType<typeof fetchTokenRisk>>,
  used: number,
  limit: number | null,
): string {
  if (!result.ok) {
    return `❌ ${escapeHtml(result.error ?? 'Could not check this mint')}`;
  }

  const clusters = result.insider_clusters ?? [];
  const clusterLine =
    result.cluster_analysis === 'pending'
      ? '🚨 Insider clusters: still scanning, check again in ~10s'
      : clusters.length > 0
        ? `🚨 Insider clusters: ${clusters.length} found (${clusters.reduce((n, c) => n + c.wallets.length, 0)} wallets)`
        : '✅ Insider clusters: none found';

  const lines = [
    `🔍 <code>${escapeHtml(shortMint(result.mint))}</code>`,
    `Risk Score: <b>${result.safety_score ?? '?'}/100</b> — ${verdictFor(result.safety_score)}`,
    clusterLine,
    `Mint authority: ${result.mint_authority?.revoked ? 'revoked ✅' : 'active ⚠️'}`,
    `Freeze authority: ${result.freeze_authority?.revoked ? 'revoked ✅' : 'active ⚠️'}`,
    `Honeypot: ${result.honeypot_risk === null || result.honeypot_risk === undefined ? 'unknown' : result.honeypot_risk ? '⚠️ yes' : '✅ no'}`,
    `LP locked: ${result.lp_locked ? `${result.lp_locked.locked ? '✅ yes' : '⚠️ no'} (${result.lp_locked.percent}%)` : 'unknown'}`,
  ];

  if (limit !== null) {
    lines.push('', `Checks used today: ${used}/${limit}`);
  } else {
    lines.push('', 'Plan: unlimited');
  }

  return lines.join('\n');
}

const HELP_TEXT =
  '🛡 <b>Insider Alerts</b> — powered by Risk-Data API (TNT House)\n\n' +
  'Send <code>/check &lt;mint_address&gt;</code> to scan a Solana token for insider wallet clusters, mint/freeze authority, honeypot and LP-lock risk.\n\n' +
  '<b>Commands:</b>\n' +
  '/check &lt;mint&gt; — scan a token\n' +
  '/status — your plan and usage\n' +
  '/link &lt;api_key&gt; — attach an existing Risk-Data API key\n' +
  '/upgrade — get more checks per day\n\n' +
  `New here? You get ${FREE_DAILY_LIMIT} free checks/day automatically, no signup needed — just send /check.`;

// Parses "/check@SomeBot foo bar" -> { command: "check", args: "foo bar" }.
// The "@BotName" suffix appears when the bot is used in a group chat;
// stripping it is what lets the same handler work in DMs and groups.
function parseCommand(text: string): { command: string; args: string } {
  // [\s\S]* instead of the dotAll /s flag ("." matches newlines) — this
  // repo's tsconfig targets below ES2018, where /s isn't available.
  const match = text.match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/);
  if (!match) return { command: '', args: '' };
  return { command: match[1].toLowerCase(), args: match[2].trim() };
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_INSIDER_WEBHOOK_SECRET;
  if (secret) {
    const receivedSecret = request.headers.get('x-telegram-bot-api-secret-token');
    if (receivedSecret !== secret) {
      // Not a genuine Telegram delivery — reject before touching
      // Supabase/Helius at all.
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true }); // malformed body, nothing to do
  }

  const message = update.message;
  const chatId = message?.chat?.id;
  const text = message?.text?.trim();

  // Always 200 back to Telegram even on a no-op update (e.g. an edited
  // message, a photo with no text) — a non-200 makes Telegram retry
  // delivery, which we don't want for updates we simply ignore.
  if (!chatId || !text) {
    return NextResponse.json({ ok: true });
  }

  const { command, args } = parseCommand(text);

  try {
    if (command === 'start' || command === 'help') {
      await sendMessage(chatId, HELP_TEXT);
      return NextResponse.json({ ok: true });
    }

    if (command === 'upgrade') {
      await sendMessage(
        chatId,
        `💳 <b>Upgrade</b>\n\nFree tier: ${FREE_DAILY_LIMIT} checks/day.\nSubscription: $45 = ${SUBSCRIPTION_MONTHLY_QUOTA} checks/30 days, paid in SOL/USDC/MRDT — no card needed.\n\nSubscribe here: ${UPGRADE_URL}\n\nAlready subscribed on the website? Send /link with your api key to use it here too.`,
      );
      return NextResponse.json({ ok: true });
    }

    if (command === 'link') {
      if (!args) {
        await sendMessage(chatId, `Usage: <code>/link tnt_sk_...</code>\n\nGet a key at ${GET_KEY_URL}`);
        return NextResponse.json({ ok: true });
      }

      const result = await linkExistingKey(chatId, args);
      if (!result.ok || !result.key) {
        const reason =
          result.reason === 'malformed'
            ? "That doesn't look like a Risk-Data API key (should start with tnt_sk_)."
            : 'No active key found matching that value — double-check you copied it in full.';
        await sendMessage(chatId, `❌ ${reason}`);
        return NextResponse.json({ ok: true });
      }

      const key = result.key;
      const tierLabel =
        key.tier === 'subscription'
          ? `subscription (${SUBSCRIPTION_MONTHLY_QUOTA}/30 days)`
          : key.tier === 'paid'
            ? 'unlimited'
            : `free (${FREE_DAILY_LIMIT}/day)`;
      await sendMessage(chatId, `✅ Linked. Plan: <b>${tierLabel}</b>. Send /check &lt;mint&gt; to use it here.`);
      return NextResponse.json({ ok: true });
    }

    if (command === 'status') {
      const key = await getOrCreateLinkedKey(chatId);
      if (!key) {
        await sendMessage(chatId, '⚠️ Could not load your account, try again shortly.');
        return NextResponse.json({ ok: true });
      }

      const subscriptionActive =
        key.tier === 'subscription' &&
        !!key.subscription_expires_at &&
        new Date(key.subscription_expires_at).getTime() > Date.now();

      let statusText: string;
      if (key.tier === 'paid') {
        statusText = 'Plan: <b>unlimited</b>';
      } else if (subscriptionActive) {
        statusText = `Plan: <b>subscription</b>\nUsed this cycle: ${key.subscription_cycle_calls_used}/${SUBSCRIPTION_MONTHLY_QUOTA}\nExpires: ${key.subscription_expires_at}`;
      } else {
        const used = await peekTodayUsage(key.id);
        statusText = `Plan: <b>free</b>\nUsed today: ${used}/${FREE_DAILY_LIMIT}`;
      }

      await sendMessage(chatId, `📊 <b>Your status</b>\n\n${statusText}\n\nCredit balance: $${key.credit_balance_usd}`);
      return NextResponse.json({ ok: true });
    }

    if (command === 'check') {
      if (!args) {
        await sendMessage(chatId, 'Usage: <code>/check &lt;mint_address&gt;</code>');
        return NextResponse.json({ ok: true });
      }

      const key = await getOrCreateLinkedKey(chatId);
      if (!key) {
        await sendMessage(chatId, '⚠️ Could not load your account, try again shortly.');
        return NextResponse.json({ ok: true });
      }

      const limitResult = await enforceRateLimit(key);
      if (!limitResult.allowed) {
        await sendMessage(
          chatId,
          `🚫 Limit reached (${limitResult.used}/${limitResult.limit ?? '?'}).\n\nUpgrade: ${UPGRADE_URL}`,
        );
        return NextResponse.json({ ok: true });
      }

      touchLastCheck(chatId);
      const result = await fetchTokenRisk(args);
      await sendMessage(chatId, formatCheckResult(result, limitResult.used, limitResult.limit));
      return NextResponse.json({ ok: true });
    }

    await sendMessage(chatId, 'Unknown command. Send /help to see what I can do.');
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[telegram-bot webhook] error:', error);
    // Best-effort — let the user know something broke rather than
    // leaving them with silence.
    await sendMessage(chatId, '⚠️ Something went wrong on our side, try again shortly.');
    return NextResponse.json({ ok: true }); // still 200 — a Telegram retry would just hit the same error
  }
}

// Telegram never sends GET here — this just avoids a bare 405 if
// someone opens the webhook URL in a browser.
export async function GET() {
  return NextResponse.json({ status: 'Insider Alerts Telegram bot webhook is live. POST only.' });
}
