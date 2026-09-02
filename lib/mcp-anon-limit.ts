// Version 1.0 — lib/mcp-anon-limit.ts
//
// Dedicated quota for anonymous MCP tool calls (check_token_risk with no
// Authorization header, called via Glama/Cursor/Claude Desktop/MCP
// Inspector etc.) — 5 successful calls/day, completely separate from:
//   - the website's no-email trial (lib/demo-limit.ts, 3/fingerprint,
//     plus its own 100/day GLOBAL pool shared across all web visitors)
//   - a real API key's 15/day quota (lib/rate-limit.ts)
// Decided explicitly: these three surfaces must never share a counter —
// see app/api/mcp/route.ts v1.6 for how this plugs in.
//
// Bucket key = hash(IP + User-Agent), not IP alone. Reasoning: Glama (and
// similar directories) proxy MCP Inspector calls through shared
// infrastructure IPs — keying on IP alone would mean one Glama-hosted
// visitor exhausting the 5 calls for every other visitor going through
// the same infra IP that day. Folding the User-Agent into the bucket key
// splits that shared IP back out per distinct client, while still giving
// each individual IP+UA pair a real 5/day ceiling (not unlimited) even
// when it happens to be Glama's own inspector.
//
// Only a SUCCESSFUL check_token_risk call burns the quota — the caller
// (app/api/mcp/route.ts) checks remaining quota with peekMcpAnonUsage()
// BEFORE calling fetchTokenRisk(), then only calls recordMcpAnonSuccess()
// after confirming result.ok. An invalid mint / upstream failure never
// costs the visitor one of their 5 free calls.
//
// Key is bucketed by UTC calendar day (so it naturally rotates once a
// day) with a 48h Redis TTL as a safety margin (self-cleans even if the
// key is never touched again, doesn't rely on a cron sweep).
//
// Same Redis database as lib/demo-limit.ts (KV_REST_API_URL /
// KV_REST_API_TOKEN), separate key namespace ("mcp-anon:") so the two
// counters can never collide or double-count the same call.
//
// FAIL-CLOSED, same reasoning as lib/demo-limit.ts: an unmetered
// anonymous surface is the wrong place to fail open if Redis is down. A
// real API key is completely unaffected either way — enforceRateLimit()
// is a separate, untouched code path.

import { createHash } from 'crypto';
import { Redis } from '@upstash/redis';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

const MCP_ANON_DAILY_LIMIT = 5;

// Safety-margin TTL, not the reset schedule itself — the key naturally
// rotates once a day because the date is baked into the key string (see
// bucketKey below). 48h just guarantees Redis cleans up an old key even
// if that IP+UA pair never comes back to roll it over naturally.
const KEY_TTL_SECONDS = 48 * 60 * 60;

function bucketKey(ip: string, userAgent: string): string {
  const hash = createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').slice(0, 16);
  const today = new Date().toISOString().slice(0, 10);
  return `mcp-anon:${hash}:${today}`;
}

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export interface McpAnonUsage {
  used: number;
  limit: number;
  resetAt: number; // unix seconds, UTC midnight — messaging only, not the actual Redis TTL
}

// Read-only check — call BEFORE doing the expensive upstream work, so a
// visitor who's already out of quota never triggers a real
// Helius/DexScreener call at all.
export async function peekMcpAnonUsage(ip: string, userAgent: string): Promise<McpAnonUsage> {
  const resetAt = Math.floor(Date.now() / 1000) + secondsUntilUtcMidnight();
  if (!redis) {
    console.error('[mcp-anon-limit] Redis not configured, failing closed on anonymous MCP calls.');
    return { used: MCP_ANON_DAILY_LIMIT, limit: MCP_ANON_DAILY_LIMIT, resetAt };
  }
  try {
    const raw = await redis.get<number>(bucketKey(ip, userAgent));
    return { used: raw ?? 0, limit: MCP_ANON_DAILY_LIMIT, resetAt };
  } catch (e) {
    console.error('[mcp-anon-limit] Redis error reading usage:', (e as Error).message);
    return { used: MCP_ANON_DAILY_LIMIT, limit: MCP_ANON_DAILY_LIMIT, resetAt };
  }
}

// Call AFTER confirming the tool call actually succeeded — see file
// header. Fire-and-forget from the caller's perspective (wrap in
// waitUntil()), same convention as logApiRequest() elsewhere in this
// codebase.
export async function recordMcpAnonSuccess(ip: string, userAgent: string): Promise<void> {
  if (!redis) return;
  const key = bucketKey(ip, userAgent);
  try {
    const used = await redis.incr(key);
    if (used === 1) {
      await redis.expire(key, KEY_TTL_SECONDS);
    }
  } catch (e) {
    console.error('[mcp-anon-limit] Redis error recording success:', (e as Error).message);
  }
}
