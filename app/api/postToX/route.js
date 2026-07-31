// app/api/postToX/route.js
// Version 1.0
//
// v1.112: auto-post audit results to X (Twitter) for paid Priority/VIP
// tier audits — mirrors the existing sendTelegram route's structure and
// error-handling style. Uses OAuth 1.0a (API Key/Secret + Access
// Token/Secret) via the twitter-api-v2 package, the standard
// server-side way to post on behalf of a specific X account without a
// full per-request OAuth2 user consent flow.
//
// NOTE: as of Feb 2026, X API v2 write access is pay-per-use, not free
// — $0.015/post, $0.20/post if it contains a link (this route always
// includes one, linking to the token's audit page). Requires env vars:
// TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN,
// TWITTER_ACCESS_SECRET — set in Vercel project settings, never
// committed to the repo.

import { TwitterApi } from 'twitter-api-v2';

function truncate(value, max) {
  var str = String(value);
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export async function POST(request) {
  const { TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET } =
    process.env;

  if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    console.error('[postToX] Twitter API credentials not fully set');
    return new Response(JSON.stringify({ error: 'Twitter API credentials not set' }), {
      status: 500,
    });
  }

  const data = await request.json();
  const { tokenName, symbol, score, mintAuthority, freezeAuthority, top10Percent, dexUrl } = data;

  // 280-char hard limit on X. Keep the token name/symbol short so the
  // fixed scaffolding (score, authorities, link) always fits — a very
  // long submitted name gets truncated rather than silently failing
  // the post.
  const safeName = truncate(tokenName || 'Unknown', 40);
  const safeSymbol = truncate(symbol || '???', 15);
  const safeScore = typeof score === 'number' ? score : 'N/A';
  const safeTop10 = top10Percent != null && top10Percent !== 'N/A' ? top10Percent + '%' : 'N/A';

  const text =
    `🔍 New token audited: ${safeName} ($${safeSymbol})\n\n` +
    `Safety Score: ${safeScore}/100\n` +
    `Mint Authority: ${mintAuthority || 'Unknown'}\n` +
    `Freeze Authority: ${freezeAuthority || 'Unknown'}\n` +
    `Top-10 Holders: ${safeTop10}\n\n` +
    `👉 ${dexUrl || 'https://tnt-audit.com'}\n\n` +
    `#Solana #TNTHouse`;

  try {
    const client = new TwitterApi({
      appKey: TWITTER_API_KEY,
      appSecret: TWITTER_API_SECRET,
      accessToken: TWITTER_ACCESS_TOKEN,
      accessSecret: TWITTER_ACCESS_SECRET,
    });

    const result = await client.v2.tweet(text);
    return new Response(JSON.stringify({ ok: true, id: result.data.id }), { status: 200 });
  } catch (err) {
    console.error('[postToX] X API error:', err);
    return new Response(JSON.stringify({ error: err.message || 'X API error' }), {
      status: 500,
    });
  }
}
