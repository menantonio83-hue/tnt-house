// Version 1.4 — app/api/telegram-bot/webhook/route.ts
//
// v1.4: no verdict label (Safe/Caution/High Risk) while the cluster scan
// is pending — the card says "preliminary" instead, since the score at
// that moment includes a placeholder for the insider-cluster component.
//
// Version 1.3 — app/api/telegram-bot/webhook/route.ts
//
// v1.3: result card now shows the cap explanation (result.explanation)
// under the checks when the score was pulled down by a cap, so a score
// like 40/100 always comes with its reason.
//
// Version 1.2 — app/api/telegram-bot/webhook/route.ts
//
// v1.2: one clean message instead of two. v1.1 sent the full result
// twice (first with "still scanning", then a whole second block), which
// read as clutter. Now the first reply is edited IN PLACE via
// editMessageText once the cluster scan finishes, so the user only ever
// sees a single card. Card layout is also uniform: one emoji-first line
// per check (status icon, label, value), a divider under the score.
// If the edit fails (message deleted, Telegram hiccup) we fall back to
// a fresh message, and if the scan never finishes the card is edited to
// say so instead of being left on "scanning" forever.
//
// Version 1.1 — app/api/telegram-bot/webhook/route.ts
//
// v1.1: on a never-before-scanned mint, insider-cluster detection is
// still a pending background job at reply time — the bot said "still
// scanning, check again in ~10s", which a real user just doesn't do.
// Worse, the safety_score shown at that point used a neutral placeholder
// for the insider-cluster component (lib/scoring.ts), not the real
// penalty — so the first score could be flat wrong, not just incomplete.
// followUpClusterScan() now polls the cluster cache after replying and
// sends a corrected follow-up message once the background job finishes,
// with no extra quota charged. See that function's own header for the
// exact mechanism.
//
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
import { waitUntil } from '@vercel/functions';
import { fetchTokenRisk } from '@/lib/token-risk-core';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClusterCache } from '@/lib/risk-api-cache';
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

// Returns the sent message's id (needed to edit it later), or null if
// the send failed.
async function sendMessage(chatId: number, text: string): Promise<number | null> {
  const token = process.env.TELEGRAM_INSIDER_BOT_TOKEN;
  if (!token) {
    console.error('[telegram-bot] TELEGRAM_INSIDER_BOT_TOKEN not set — cannot reply');
    return null;
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
      return null;
    }
    const json = await res.json();
    return typeof json?.result?.message_id === 'number' ? json.result.message_id : null;
  } catch (err) {
    console.error('[telegram-bot] sendMessage error:', err instanceof Error ? err.message : err);
    return null;
  }
}

// Edits a previously sent message in place. Returns true on success.
async function editMessage(chatId: number, messageId: number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_INSIDER_BOT_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error('[telegram-bot] editMessageText failed:', await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[telegram-bot] editMessageText error:', err instanceof Error ? err.message : err);
    return false;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shortMint(mint: string): string {
  return mint.length > 10 ? `${mint.slice(0, 4)}...${mint.slice(-4)}` : mint;
}

function verdictFor(score: number | undefined): { icon: string; label: string } {
  if (score === undefined) return { icon: '⚪', label: 'Unknown' };
  if (score >= 70) return { icon: '🟢', label: 'Safe' };
  if (score >= 40) return { icon: '🟡', label: 'Caution' };
  return { icon: '🔴', label: 'High Risk' };
}

// `used`/`limit` describe the CALLER's quota state right after this
// call was counted (from enforceRateLimit's RateLimitResult) — limit is
// null for an unlimited ('paid') key, in which case we skip that line
// entirely rather than print a confusing "X/null".
function formatCheckResult(
  result: Awaited<ReturnType<typeof fetchTokenRisk>>,
  used: number,
  limit: number | null,
  scanTimedOut = false,
): string {
  if (!result.ok) {
    return `❌ ${escapeHtml(result.error ?? 'Could not check this mint')}`;
  }

  const clusters = result.insider_clusters ?? [];
  let clusterLine: string;
  if (result.cluster_analysis === 'pending') {
    clusterLine = scanTimedOut
      ? '⏳ Insider clusters: scan is slow — send /check again in a minute'
      : '⏳ Insider clusters: scanning… this card updates itself';
  } else if (clusters.length > 0) {
    const wallets = clusters.reduce((n, c) => n + c.wallets.length, 0);
    clusterLine = `🚨 Insider clusters: ${clusters.length} found (${wallets} wallets)`;
  } else {
    clusterLine = '✅ Insider clusters: none found';
  }

  // v1.4: while the insider-cluster scan is still running, the score
  // contains a neutral placeholder for that component (lib/scoring.ts),
  // so it is provisional. Never show a verdict like "Safe" on a
  // provisional number — it could drop once clusters are known. If the
  // scan timed out, the score stays provisional and says so.
  const provisional = result.cluster_analysis === 'pending';
  const verdict = provisional
    ? { icon: '⏳', label: 'preliminary, cluster scan not finished' }
    : verdictFor(result.safety_score);
  const honeypotLine =
    result.honeypot_risk === null || result.honeypot_risk === undefined
      ? '❔ Honeypot: unknown'
      : result.honeypot_risk
        ? '🚨 Honeypot: yes'
        : '✅ Honeypot: no';
  const lpLine = result.lp_locked
    ? `${result.lp_locked.locked ? '✅' : '⚠️'} LP locked: ${result.lp_locked.locked ? 'yes' : 'no'} (${result.lp_locked.percent}%)`
    : '❔ LP locked: unknown';

  // One emoji-first line per check, same shape everywhere: icon, label, value.
  const lines = [
    `🔍 <code>${escapeHtml(shortMint(result.mint))}</code>`,
    `${verdict.icon} Risk Score: <b>${result.safety_score ?? '?'}/100</b> — ${verdict.label}`,
    '━━━━━━━━━━━━',
    clusterLine,
    `${result.mint_authority?.revoked ? '✅' : '⚠️'} Mint authority: ${result.mint_authority?.revoked ? 'revoked' : 'active'}`,
    `${result.freeze_authority?.revoked ? '✅' : '⚠️'} Freeze authority: ${result.freeze_authority?.revoked ? 'revoked' : 'active'}`,
    honeypotLine,
    lpLine,
  ];

  // v1.3: say WHY the score is what it is. A score pinned by a cap
  // (e.g. exactly 40 on several different tokens) looks like a bug
  // unless the reason is on the card. `explanation` comes ready-made
  // from lib/token-risk-core.ts and is present only when a cap fired.
  if (result.explanation) {
    lines.push('', `ℹ️ <i>${escapeHtml(result.explanation)}</i>`);
  }

  if (limit !== null) {
    lines.push('', `Checks used today: ${used}/${limit}`);
  } else {
    lines.push('', 'Plan: unlimited');
  }

  return lines.join('\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// v1.1: on the FIRST-ever check of a mint, lib/token-risk-core.ts's
// insider-cluster detection hasn't run yet (it's a background job — see
// lib/risk-api-cache.ts's stale-while-revalidate flow), so the initial
// reply above shows "still scanning" AND — this is the part that matters,
// not just cosmetics — the safety_score itself was computed with a
// neutral placeholder (lib/scoring.ts: insiderScore = 12 while pending)
// instead of the real insider-cluster penalty. So the FIRST score shown
// for a never-before-scanned mint can be wrong, not just incomplete.
//
// This polls the (cheap, no RPC calls) cluster cache a couple of times
// after replying, and once the background job finishes, re-runs the full
// fetchTokenRisk (now backed by a warm cache) and sends the corrected
// result as a follow-up message — same used/limit numbers as the
// original call, since this is a free correction, not a second /check.
// Gives up silently if the background job is unusually slow; the user
// can always /check again manually.
async function followUpClusterScan(
  chatId: number,
  messageId: number | null,
  mint: string,
  used: number,
  limit: number | null,
): Promise<void> {
  const POLL_DELAYS_MS = [12000, 15000]; // ~12s, then ~27s total

  // v1.2: update the ORIGINAL card in place; only if that's impossible
  // (no message id, or the edit failed) fall back to a fresh message.
  const deliver = async (text: string) => {
    if (messageId !== null && (await editMessage(chatId, messageId, text))) return;
    await sendMessage(chatId, text);
  };

  for (const delay of POLL_DELAYS_MS) {
    await sleep(delay);
    try {
      const { row } = await getClusterCache(mint);
      if (!row || row.status === 'pending') continue;

      const updated = await fetchTokenRisk(mint);
      await deliver(formatCheckResult(updated, used, limit));
      return;
    } catch (err) {
      console.error('[telegram-bot] followUpClusterScan error:', err instanceof Error ? err.message : err);
      return;
    }
  }

  // Still pending after ~27s — background job is unusually slow or
  // crashed. Edit the card so it doesn't sit on "scanning…" forever.
  try {
    const latest = await fetchTokenRisk(mint);
    await deliver(formatCheckResult(latest, used, limit, true));
  } catch (err) {
    console.error('[telegram-bot] followUpClusterScan timeout-edit error:', err instanceof Error ? err.message : err);
  }
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
      const sentId = await sendMessage(
        chatId,
        formatCheckResult(result, limitResult.used, limitResult.limit),
      );

      // v1.1/v1.2: cluster analysis still running for a never-before-
      // scanned mint — see followUpClusterScan's header. It edits the
      // message we just sent (sentId) once the scan is done. Only fires
      // for a successful lookup; a failed/invalid-mint result has no
      // mint to poll the cache for.
      if (result.ok && result.cluster_analysis === 'pending' && result.mint) {
        waitUntil(followUpClusterScan(chatId, sentId, result.mint, limitResult.used, limitResult.limit));
      }

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
