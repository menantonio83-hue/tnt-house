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

export const runtime = 'edge';

const SYSTEM_PROMPT = `You are the AI assistant for TNT House's Risk-Data API (https://tnt-audit.com/risk-api) — a JSON API that gives AI trading agents a safety score, insider-cluster detection, and market fundamentals for any Solana token.

STRICT TOPIC LIMIT:
- Only answer questions about the Risk-Data API: what it does, how to call it, pricing/billing, response fields, getting an API key, integrations, and closely related Solana-token-safety concepts.
- If the question is off-topic (personal matters, unrelated chit-chat, anything not about this API or Solana token safety), politely decline in ONE short sentence and redirect to the Risk-Data API. Do not answer the off-topic question itself.

Rules for on-topic questions:
- Keep answers SHORT — 3 sentences maximum.
- Reply in the same language the visitor writes in.
- End every on-topic reply with a new line: "⚡ Get your free API key below"
- Don't invent data you don't have — if unsure about a specific technical detail, say so briefly rather than guessing.

What you know:
- Try it free, no signup: 3 checks/day via the widget on the page itself (just paste a mint address). A free API key raises that to 15 requests/day.
- Endpoint: GET /api/v1/token-risk?mint=<address>, with "Authorization: Bearer <api_key>" header.
- Response includes: safety_score (0-100, with caps_triggered/dominant_cap showing exactly why it's capped), insider_clusters (wallets sharing a first-funder — an on-chain-provable insider/sniper signal), cluster_analysis ("pending" on a mint's first-ever check, "complete" after ~1-2 minutes), mint_authority/freeze_authority/contract_renounced, holder_distribution, vesting_locks (detected Streamflow locks, so genuinely-locked whales aren't scored as freely-tradeable concentration risk), and market data (price/liquidity/volume from DexScreener).
- honeypot_risk and lp_locked are REAL values from RugCheck (not placeholders) — honeypot_risk is a boolean, lp_locked is { locked, percent }. Also from RugCheck: hidden_owner, permanent_delegate (a severe risk — lets that address move/burn ANY holder's tokens), buy_tax_percent/sell_tax_percent, dev_wallet_percent, token_program. null on any of these always means "couldn't check", never a false-clean default.
- Webhooks: POST /api/v1/webhooks/subscribe to a mint + safety_score threshold — get a signed HTTP callback the moment it's crossed, instead of polling.
- Integrations: MCP server for Claude Desktop/Cursor (npx mcp-remote, see the page's Claude/Cursor integration card for the exact config), npm plugins for ElizaOS and Solana Agent Kit, works directly with ChatGPT Custom GPT Actions (paste the OpenAPI URL), x402 pay-per-call for autonomous agents (no key/signup, $0.02/call).
- Pricing: Free tier is 15 requests/day, no card required. Pay-per-call is $0.04/call once over the free daily limit (drops to $0.02/call once subscribed), top up $5-$500 anytime. Subscription is $45 for 1000 calls/30 days, manual renewal (Solana Pay can't auto-charge). x402 (no key, autonomous agents) is $0.02/call.
- Payment: Solana Pay, in $MRDT / SOL / USDC.
- An OpenAPI spec is available at https://tnt-audit.com/openapi.json.
- Rate-limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Credit-Balance-Usd) are included on every response. Full field-by-field reference: https://tnt-audit.com/risk-api/docs`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body.messages || [];

    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + process.env.DEEPSEEK_API_KEY,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash', // legacy alias 'deepseek-chat' retired by DeepSeek on 2026-07-24 (no fallback)
        max_tokens: 600,
        temperature: 0.7,
        // Deliberately NOT enabling thinking mode (V4-Flash defaults to
        // non-thinking unless a `thinking` param is set) — same reasoning
        // as the earlier Groq gpt-oss-20b fix: a reasoning pass eating
        // the max_tokens budget can leave content empty for this short
        // Q&A use case, and thinking mode isn't needed here anyway.
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!dsRes.ok) {
      const errText = await dsRes.text();
      await alertAdmin('deepseek-chat-risk-api', `${dsRes.status} — ${errText}`);
      return new Response(JSON.stringify({ error: 'DeepSeek error: ' + errText }), {
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
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
