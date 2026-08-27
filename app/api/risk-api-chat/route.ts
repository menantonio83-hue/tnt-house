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

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + process.env.GROQ_API_KEY,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b', // free, fast — Groq's recommended replacement for the deprecated llama-3.1-8b-instant
        max_tokens: 600, // was 200 — too low for a reasoning model, see reasoning_effort note below
        temperature: 0.7,
        // gpt-oss-20b is a reasoning model — it spends tokens on an
        // internal "reasoning" field before the actual answer, and
        // defaults to reasoning_effort "medium" if unset. With a small
        // max_tokens budget that reasoning could consume the entire
        // budget, leaving message.content empty (confirmed real-world
        // 2026-08-27: a visitor got "Could not get a response" — see
        // community.groq.com/t/gpt-oss-browser-response-empty-assistant-content).
        // 'low' minimizes reasoning-token spend for this short,
        // non-complex Q&A use case.
        reasoning_effort: 'low',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      await alertAdmin('groq-chat-risk-api', `${groqRes.status} — ${errText}`);
      return new Response(JSON.stringify({ error: 'Groq error: ' + errText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await groqRes.json();
    const reply =
      data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
        ? data.choices[0].message.content
        : 'Could not get a response. Please try again.';

    if (reply === 'Could not get a response. Please try again.') {
      // Groq returned 200 OK but no usable content — e.g. the reasoning
      // model spent its whole token budget "thinking" and left content
      // empty. Not caught by the !groqRes.ok branch above since the
      // HTTP call itself succeeded; alert separately so this class of
      // failure doesn't go unnoticed the same way the deprecated-model
      // issue did.
      await alertAdmin('groq-chat-risk-api-empty-content', JSON.stringify(data).slice(0, 500));
    }

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
