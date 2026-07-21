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

export const runtime = 'edge';

const SYSTEM_PROMPT = `You are the AI assistant for TNT House's Risk-Data API (https://tnt-audit.com/risk-api) — a JSON API that gives AI trading agents a safety score, insider-cluster detection, and market fundamentals for any Solana token.

STRICT TOPIC LIMIT:
- Only answer questions about the Risk-Data API: what it does, how to call it, pricing/billing, response fields, getting an API key, and closely related Solana-token-safety concepts.
- If the question is off-topic (personal matters, unrelated chit-chat, anything not about this API or Solana token safety), politely decline in ONE short sentence and redirect to the Risk-Data API. Do not answer the off-topic question itself.

Rules for on-topic questions:
- Keep answers SHORT — 3 sentences maximum.
- Reply in the same language the visitor writes in.
- End every on-topic reply with a new line: "⚡ Get your free API key below"
- Don't invent data you don't have — if unsure about a specific technical detail, say so briefly rather than guessing.

What you know:
- Endpoint: GET /api/v1/token-risk?mint=<address>, with "Authorization: Bearer <api_key>" header.
- Response includes: safety_score (0-100), insider_clusters (wallets sharing a first-funder), cluster_analysis ("pending" on a mint's first-ever check, "complete" after ~1-2 minutes), mint_authority/freeze_authority status, holder_distribution, and market data (price/liquidity/volume from DexScreener). honeypot_risk and lp_locked are on the roadmap, currently always null.
- Pricing: Free tier is 15 requests/day, no card required. Pay-per-call is $0.07/call once over the free daily limit (drops to $0.03/call once subscribed), top up $5-$500 anytime. Subscription is $49 for 1000 calls/30 days, manual renewal (Solana Pay can't auto-charge).
- Payment: Solana Pay, in $MRDT / SOL / USDC.
- An OpenAPI spec is available at https://tnt-audit.com/openapi.json — works directly with ChatGPT Custom GPT Actions; Claude/Gemini/LangChain-style frameworks need a small adapter using it as a schema source.
- Rate-limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Credit-Balance-Usd) are included on every response.`;

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
        model: 'llama-3.1-8b-instant', // free, very fast — same model the main site's chat already uses
        max_tokens: 200,
        temperature: 0.7,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
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
