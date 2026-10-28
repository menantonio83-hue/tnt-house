// Version 1.5 — app/api/risk-api-chat/route.ts
//
// v1.5 (2026-10-28): the assistant gave wrong/outdated answers (bare
// tnt-audit.com URLs, no MCP / 5 free anonymous calls, ElizaOS/Solana
// Agent Kit pushed as ready plugins, a hard-coded English
// "⚡ Get your free API key below" tail on non-English replies, a
// token from the main site used in the payment line). System prompt
// rewritten from facts verified in code: www URLs, MCP-first
// recommendation (6 tools, 5 free/day), free key 15/day + shared
// 100/day pool, x402 $0.02 USDC on Solana, real response field names,
// whole reply in the visitor's language, localized optional CTA.
// Model deepseek-v4-flash -> deepseek-v4-pro (thinking disabled,
// temperature 0.7 -> 0.3), key DEEPSEEK_API_KEY_NEW with fallback to
// DEEPSEEK_API_KEY. Rate limit and input guards unchanged.
//
// Version 1.4 — app/api/risk-api-chat/route.ts
//
// v1.4 (2026-09-11): server-side rate limit and input guard, same as
// app/api/chat/route.js v1.3. The v1.0 note below called a server-side
// counter unnecessary because this is "a low-stakes, free-tier marketing
// chat widget, not billing-critical". The first half is true and the
// conclusion still does not follow: every request is a paid DeepSeek
// call, the widget needs no key or signup, and a counter in React state
// stops nobody who is not using the widget. 30 messages / 10 minutes per
// IP+User-Agent in Redis — the same numbers ChatWidget.tsx already
// enforced in the browser — and the incoming history is rebuilt rather
// than forwarded. See lib/chat-limit.ts.
//
// Version 1.3 — app/api/risk-api-chat/route.ts
//
// v1.3: switched from Groq (openai/gpt-oss-20b) to DeepSeek
// (deepseek-v4-flash) per product-owner decision 2026-08-27 — they
// have an existing funded DeepSeek account ($7.85 balance, ~$0.0015/
// request based on live usage) that was going unused. Also sidesteps
// Groq's gpt-oss-20b reasoning-token issue fixed in v1.2 below —
// V4-Flash defaults to non-thinking mode, no reasoning_effort param
// needed. Verified deepseek-v4-flash is the current model ID before
// switching: the legacy 'deepseek-chat' alias (used by the old, unused
// app/api/deepseek-chat/route.js in this repo) was retired by DeepSeek
// on 2026-07-24 with no fallback — would have repeated the exact same
// silent-breakage pattern as the Groq deprecation below if migrated to
// blindly. Same alertAdmin() wiring, updated service-name strings
// (deepseek-chat-risk-api / deepseek-chat-risk-api-empty-content).
//
// Version 1.2 — app/api/risk-api-chat/route.ts
//
// v1.2: gpt-oss-20b returning empty content — see git history for
// the full fix (reasoning_effort, max_tokens, empty-content alert).
// Superseded by the DeepSeek switch above, kept for history.
//
// Version 1.1 — app/api/risk-api-chat/route.ts
//
// v1.1: Groq deprecated llama-3.1-8b-instant (shutdown Aug 16, 2026 —
// see console.groq.com/docs/deprecations); every chat request had been
// failing with a 500 "model does not exist" error since then, silently
// breaking the widget on the live /risk-api page (caught 2026-08-27 via
// a real visitor screenshot, not monitoring — nothing alerts on this).
// Migrated to openai/gpt-oss-20b, Groq's own recommended replacement
// for llama-3.1-8b-instant (same free tier, faster inference per
// Groq's docs). Same fix applied to app/api/chat/route.js.
//
// Version 1.0 — app/api/risk-api-chat/route.ts
//
// Separate from app/api/chat/route.js (existing file, not modified —
// that one is scoped to the main site's audit/$MRDT product and its own
// Russian-only system prompt). Same underlying approach (Groq's free
// llama-3.1-8b-instant, same GROQ_API_KEY env var — no new secret
// needed), own system prompt scoped to the Risk-Data API product, and
// answers in whichever language the visitor writes in rather than a
// single hardcoded language, since /risk-api itself is the multi-
// language page (see app/risk-api/i18n.ts).
//
// Client-side rate limiting (30 messages / 10 minutes) lives in
// ChatWidget.tsx, mirroring the main site's chat widget's own
// client-side counter — this is a low-stakes, free-tier marketing chat
// widget, not billing-critical, so the same lightweight approach is
// appropriate rather than building a server-side counter.

import { alertAdmin } from '../../../lib/telegram-alert';
import { checkDeepSeekBalanceIfDue } from '../../../lib/deepseek-balance';
import {
  consumeChatQuota,
  extractClientIp,
  sanitizeMessages,
} from '../../../lib/chat-limit';

export const runtime = 'edge';

const SYSTEM_PROMPT = `You are the assistant for TNT House's Risk-Data API (https://www.tnt-audit.com/risk-api): a JSON API that gives trading bots and AI agents a 0-100 safety score, on-chain insider-cluster detection and market data for any Solana token mint.

TOPIC LIMIT:
- Only answer questions about this API: what it does, how to connect it, limits, pricing, response fields, keys, integrations, and closely related Solana token-safety concepts.
- Off-topic: decline politely in ONE short sentence in the visitor's language and steer back to the API.

STYLE:
- Write the WHOLE reply in the visitor's language (the language of their last message). Never add English sentences or English taglines. Code, URLs, header names and field names stay as they are.
- Short: 2-5 sentences, or a few short bullet lines. Plain text, no markdown headings or tables.
- Use only the facts below. Every URL must start with https://www.tnt-audit.com (never the bare domain without www). Use <MINT> as the mint placeholder; never use any real token or project token as an example.
- If something is not covered below, say you are not sure and point to https://www.tnt-audit.com/risk-api/docs. Never invent endpoints, fields, limits, prices or integrations.
- You may end with one short line, in the visitor's language, saying the free API key can be taken in a minute at https://www.tnt-audit.com/risk-api. Only when it fits; not on off-topic or decline replies.

HOW TO CONNECT. When someone asks how to connect, integrate or start (trading bot, AI agent, script) or what is cheapest, ALWAYS list these options briefly in this order: MCP first (5 free calls/day, no signup), then the free API key, then x402. Keep each option to one or two lines:
1. MCP server (best for AI agents): https://www.tnt-audit.com/api/mcp (Streamable HTTP). Claude Desktop / Cursor: npx mcp-remote https://www.tnt-audit.com/api/mcp. The check_token_risk tool works with no key and no signup: 5 free calls/day. Six tools: check_token_risk, check_token_risk_batch (up to 25 mints, needs an API key), get_free_api_key (email -> free key), create_topup_invoice and check_payment (need a key), get_token_risk_history (free).
2. Free API key (best for a regular bot calling REST): get it by email with the form at https://www.tnt-audit.com/risk-api (or the get_free_api_key MCP tool). 15 requests/day, no card. Call: GET https://www.tnt-audit.com/api/v1/token-risk?mint=<MINT> with header Authorization: Bearer <api_key>. Always use the www host: the bare domain redirects and many HTTP clients drop the Authorization header on that redirect. Free keys also share a site-wide pool of 100 free calls/day; if it is used up the API returns error_code free_pool_capacity (paid calls are not affected).
3. x402 pay-per-call (no account, no key): GET https://www.tnt-audit.com/api/v1/token-risk/x402?mint=<MINT>, $0.02 in USDC on Solana per call. The first request returns HTTP 402 with payment requirements; the official x402 SDK (Python: pip install "x402[svm,httpx]") pays and retries automatically with the PAYMENT-SIGNATURE header.
Also: the check widget at https://www.tnt-audit.com/risk-api gives 3 free checks/day without signup. ChatGPT Custom GPT Actions can import the OpenAPI spec: https://www.tnt-audit.com/openapi.json. Webhooks (with an API key): POST https://www.tnt-audit.com/api/v1/webhooks/subscribe with mint, threshold (0-100), condition ('below' or 'above') and callback_url to get a signed callback when safety_score crosses the threshold, instead of polling.
Community npm packages eliza-plugin-tnt-risk-api (ElizaOS) and solana-agent-kit-plugin-risk-api (Solana Agent Kit) exist, but do not present them as the recommended way; for a new bot recommend MCP or the REST endpoint above.

PRICING:
- Free: 15 requests/day with a free key; 5/day anonymous via MCP; 3/day in the site check widget.
- Over the free daily limit: $0.02 per call from a prepaid balance (top up $5-$500 anytime).
- Subscription: $45 per 30 days for 5,000 calls, renewed manually (Solana Pay cannot auto-charge); over quota while subscribed: $0.015 per call.
- x402: $0.02 per call in USDC on Solana, no account.
- Payment for top-ups and subscriptions: Solana Pay (for example SOL or USDC).

RESPONSE FIELDS (real names):
- safety_score (0-100); caps_triggered (every cap that fired, with reason and cap value), dominant_cap (the tightest cap) and explanation (plain-text reason); reliefs_triggered; *_capped booleans such as maturity_capped, honeypot_capped, mint_authority_capped.
- insider_clusters (wallets sharing a first funder; each cluster has funder_class, funder_label, funder_confidence, false_positive_likely), cluster_supply_pct, cluster_wallet_count, largest_cluster_pct, cluster_analysis ("pending" on a mint's first check, "complete" once the trace finishes), flags, data_confidence.
- mint_authority and freeze_authority ({ revoked, address }), contract_renounced, honeypot_risk (boolean), lp_locked ({ locked, percent }), lp_burned, hidden_owner, permanent_delegate (severe: that address can move or burn any holder's tokens), buy_tax_percent, sell_tax_percent, dev_wallet_percent, token_program, rugged, jup_verified. These RugCheck-based values are real; null means "could not check", never "clean".
- vesting_locks and locked_supply_pct (detected Streamflow locks), holder_distribution (risk_level, largest_holder_percent, holder_count, freely_tradeable_largest_holder_percent), market (price_usd, liquidity_usd, volume_24h_usd, age_days, age_hours), checked_at.
- Every response carries X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset and X-Credit-Balance-Usd headers. Full reference: https://www.tnt-audit.com/risk-api/docs`;

export async function POST(request: Request) {
  try {
    // Quota first — before parsing a body or spending anything upstream.
    const ip = extractClientIp(request.headers);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const quota = await consumeChatQuota('risk-api', ip, userAgent);

    if (!quota.allowed) {
      const quotaMessage =
        quota.reason === 'unavailable'
          ? 'Chat is temporarily unavailable. Please try again shortly.'
          : 'Too many messages. Please wait a few minutes before continuing.';
      return new Response(
        JSON.stringify({ error: quotaMessage, retry_after_seconds: quota.retryAfterSeconds }),
        {
          status: quota.reason === 'unavailable' ? 503 : 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(quota.retryAfterSeconds),
          },
        },
      );
    }

    const body = await request.json();
    const sanitized = sanitizeMessages(body.messages || []);
    if (!sanitized.ok) {
      return new Response(JSON.stringify({ error: sanitized.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const messages = sanitized.messages;

    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // DEEPSEEK_API_KEY_NEW is the current key; falls back to the old
        // DEEPSEEK_API_KEY so the widget keeps working if NEW isn't set in an env.
        Authorization: 'Bearer ' + (process.env.DEEPSEEK_API_KEY_NEW || process.env.DEEPSEEK_API_KEY),
      },
      body: JSON.stringify({
        model: 'deepseek-v4-pro', // legacy alias 'deepseek-chat' retired by DeepSeek on 2026-07-24 (no fallback)
        max_tokens: 600,
        temperature: 0.3, // factual product Q&A: low temperature keeps it on the prompt's facts
        // Thinking explicitly disabled: a reasoning pass could eat the
        // max_tokens budget and leave content empty for this short Q&A
        // use case (same reasoning as the earlier Groq gpt-oss-20b fix).
        thinking: { type: 'disabled' },
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!dsRes.ok) {
      const errText = await dsRes.text();
      await alertAdmin('deepseek-chat-risk-api', `${dsRes.status} — ${errText}`);
      return new Response(JSON.stringify({ error: 'Chat service unavailable right now. Please try again shortly.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await dsRes.json();
    const reply =
      data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
        ? data.choices[0].message.content
        : 'Could not get a response. Please try again.';

    if (reply === 'Could not get a response. Please try again.') {
      // DeepSeek returned 200 OK but no usable content. Not caught by
      // the !dsRes.ok branch above since the HTTP call itself succeeded;
      // alert separately so this class of failure doesn't go unnoticed
      // the same way the deprecated-model issue did.
      await alertAdmin('deepseek-chat-risk-api-empty-content', JSON.stringify(data).slice(0, 500));
    }

    void checkDeepSeekBalanceIfDue(); // fire-and-forget, cooldown-throttled — see lib/deepseek-balance.ts

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
