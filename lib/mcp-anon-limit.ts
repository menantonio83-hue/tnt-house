// Version 1.3 — lib/mcp-anon-limit.ts
//
// v1.3: adds two more SUCCESS-only identity buckets, same 5/day ceiling:
//   - subnet+UA: subnetOf(ip) + User-Agent, so a client that rotates its
//     IP inside one /24 (IPv4) or /64 (IPv6) with the same User-Agent no
//     longer gets a fresh 5/day on every new address (seen live: our own
//     test box rotating across one /24 always got "call 1/5").
//   - optional session: Mcp-Session-Id header (if the client sends one),
//     normalized and capped to 256 chars before hashing. No header -> no
//     session bucket, behaviour identical to before for that client.
// A call is refused when ANY identity bucket has reached 5.
// These are READ (redis.get) in checkMcpAnonLimit and only INCRed in
// recordMcpAnonSuccess, exactly like the original IP+UA identity bucket.
// The existing global/per_subnet/per_ip ATTEMPT counters are unchanged
// and still INCRed on every check. identityUsed now = max(IP+UA,
// subnet+UA, session-if-present), and the final 'identity' refusal uses
// that value. Existing counter key formats are preserved so today's
// counts carry over.
//
// Version 1.2 — lib/mcp-anon-limit.ts
//
// v1.2: per-subnet daily ATTEMPTS cap (MCP_ANON_DAILY_LIMIT_PER_SUBNET)
// keyed by the caller's /24 (IPv4) or /64 (IPv6) — see subnetOf(). Bounds
// rotation through many addresses in one range, which the per-IP cap alone
// can't. Same fail-closed try/catch as the other counters.
//
// v1.1 (M-1 fix): two additional layers on top of the per-identity
// (IP+UA) bucket — both the IP and the User-Agent are client-controlled,
// and rotating the UA string per call used to mint a fresh 5/day bucket
// indefinitely:
//
//   1. Per-IP daily cap (MCP_ANON_DAILY_LIMIT_PER_IP) — keyed by IP
//      ALONE, so rotating the User-Agent can never escape it.
//   2. Global daily cap (MCP_ANON_DAILY_LIMIT_GLOBAL) — the backstop
//      for real IP rotation (VPN / mobile NAT / cloud instances): bounds
//      the total anonymous upstream cost for the whole service.
//
// The original IP+UA identity bucket stays (5 successful calls/day),
// because visitors arriving through shared proxy infrastructure (Glama
// and similar directories) would otherwise exhaust one another's quota.
//
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
// Only a SUCCESSFUL check_token_risk call burns the IDENTITY quota — the
// caller (app/api/mcp/route.ts) checks the full quota stack with
// checkMcpAnonLimit() BEFORE calling fetchTokenRisk(), then only calls
// recordMcpAnonSuccess() after confirming result.ok. An invalid mint /
// upstream failure never costs the visitor one of their 5 identity calls
// (the per-IP and global attempt counters move regardless, same
// convention as lib/demo-limit.ts).
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

// v1.1: rotation-proof per-IP daily cap (keyed by IP alone) and the
// global daily backstop — see the v1.1 header note.
const MCP_ANON_DAILY_LIMIT_PER_IP = 20;
// 3x per-IP so shared NAT/proxy ranges like Glama infra aren't starved; still bounds /24 rotation.
const MCP_ANON_DAILY_LIMIT_PER_SUBNET = 60;
const MCP_ANON_DAILY_LIMIT_GLOBAL = 300;

// Safety-margin TTL, not the reset schedule itself — the key naturally
// rotates once a day because the date is baked into the key string (see
// bucketKey below). 48h just guarantees Redis cleans up an old key even
// if that IP+UA pair never comes back to roll it over naturally.
const KEY_TTL_SECONDS = 48 * 60 * 60;

// v1.1: shared 16-hex hash for anonymous bucket keys.
function hashIdentity(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function bucketKey(ip: string, userAgent: string): string {
  const hash = hashIdentity(`${ip}:${userAgent}`);
  const today = new Date().toISOString().slice(0, 10);
  return `mcp-anon:${hash}:${today}`;
}

// v1.3: second identity bucket (subnet + UA) and optional session bucket.
function subnetUaKey(ip: string, userAgent: string, today: string): string {
  return `mcp-anon:netua:${hashIdentity(`${subnetOf(ip)}:${userAgent}`)}:${today}`;
}

function sessionKey(sessionId: string, today: string): string {
  return `mcp-anon:sess:${hashIdentity(`sess:${sessionId}`)}:${today}`;
}

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export function subnetOf(ip: string): string {
  const original = ip;
  let value = ip.trim();

  if (value.toLowerCase().startsWith('::ffff:')) {
    const candidate = value.slice(7);
    if (isDottedIPv4(candidate)) {
      return ipv4Subnet(candidate);
    }
  }

  if (isDottedIPv4(value)) {
    return ipv4Subnet(value);
  }

  if (value.includes(':')) {
    const zoneIndex = value.indexOf('%');
    if (zoneIndex !== -1) {
      value = value.slice(0, zoneIndex);
    }

    const groups = expandIPv6(value);
    if (groups) {
      if (groups.length !== 8 || groups.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) {
        return `other:${original}`;
      }
      const h = groups.map((g) => parseInt(g, 16).toString(16));
      return `${h[0]}:${h[1]}:${h[2]}:${h[3]}::/64`;
    }
  }

  return `other:${original}`;
}

function isDottedIPv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

function ipv4Subnet(value: string): string {
  const [a, b, c] = value.split('.');
  return `${a}.${b}.${c}.0/24`;
}

function expandIPv6(value: string): string[] | null {
  const doubleColon = value.indexOf('::');
  if (doubleColon === -1) {
    const groups = value.split(':');
    return groups.length === 8 ? groups : null;
  }

  if (value.indexOf('::', doubleColon + 2) !== -1) return null;

  const left = value.slice(0, doubleColon).split(':').filter(Boolean);
  const right = value.slice(doubleColon + 2).split(':').filter(Boolean);
  const missing = 8 - left.length - right.length;

  if (missing < 1) return null;

  const groups = [...left, ...Array(missing).fill('0'), ...right];
  return groups.length === 8 ? groups : null;
}

export function normalizeSessionId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 256);
}

export function anonIdentityUsed(ipUa: number | null, subnetUa: number | null, session: number | null): number {
  return Math.max(ipUa ?? 0, subnetUa ?? 0, session ?? 0);
}

export interface McpAnonDecision {
  allowed: boolean;
  used: number;
  limit: number;
  // Which counter decided the call: 'identity' (max of the IP+UA,
  // subnet+UA and optional session success buckets — v1.3),
  // 'per_ip'/'per_subnet'/'global' when blocked, 'infra' when Redis is
  // unavailable (fail closed), 'ok' when allowed.
  reason: 'ok' | 'identity' | 'per_ip' | 'per_subnet' | 'global' | 'infra';
  resetAt: number; // unix seconds, UTC midnight — messaging only, not the actual Redis TTL
}

// v1.1: the single gate for anonymous MCP calls. Checks the identity
// bucket (IP+UA, read-only — only SUCCESSFUL calls burn it, see
// recordMcpAnonSuccess), the per-IP bucket and the global bucket (both
// INCR — attempts count, same "counters increment regardless of what
// happens after" convention as lib/demo-limit.ts). Call BEFORE doing the
// expensive upstream work, so a blocked visitor never triggers a real
// Helius/DexScreener call.
export async function checkMcpAnonLimit(ip: string, userAgent: string, sessionId?: string | null): Promise<McpAnonDecision> {
  const resetAt = Math.floor(Date.now() / 1000) + secondsUntilUtcMidnight();
  if (!redis) {
    console.error('[mcp-anon-limit] Redis not configured, failing closed on anonymous MCP calls.');
    return { allowed: false, used: 0, limit: MCP_ANON_DAILY_LIMIT, reason: 'infra', resetAt };
  }

  const today = new Date().toISOString().slice(0, 10);
  const perIpKey = `mcp-anon:ip:${hashIdentity(ip)}:${today}`;
  const perSubnetKey = `mcp-anon:net:${hashIdentity(subnetOf(ip))}:${today}`;
  const globalKey = `mcp-anon:global:${today}`;

  const ipUaKey = bucketKey(ip, userAgent);
  const netUaKey = subnetUaKey(ip, userAgent, today);
  const normalizedSessionId = normalizeSessionId(sessionId);
  const sessionReadKey = normalizedSessionId ? sessionKey(normalizedSessionId, today) : null;

  try {
    const [identityRaw, subnetUaRaw, sessionRaw, perIpUsed, perSubnetUsed, globalUsed] = await Promise.all([
      redis.get<number>(ipUaKey),
      redis.get<number>(netUaKey),
      sessionReadKey ? redis.get<number>(sessionReadKey) : Promise.resolve(null),
      redis.incr(perIpKey),
      redis.incr(perSubnetKey),
      redis.incr(globalKey),
    ]);

    await Promise.all([
      perIpUsed === 1 ? redis.expire(perIpKey, secondsUntilUtcMidnight()) : Promise.resolve(),
      perSubnetUsed === 1 ? redis.expire(perSubnetKey, secondsUntilUtcMidnight()) : Promise.resolve(),
      globalUsed === 1 ? redis.expire(globalKey, secondsUntilUtcMidnight()) : Promise.resolve(),
    ]);

    const ipUaValue = identityRaw ?? null;
    const subnetUaValue = subnetUaRaw ?? null;
    const sessionValue = sessionReadKey ? sessionRaw ?? null : null;
    const identityUsed = anonIdentityUsed(ipUaValue, subnetUaValue, sessionValue);

    if (globalUsed > MCP_ANON_DAILY_LIMIT_GLOBAL) {
      return { allowed: false, used: globalUsed, limit: MCP_ANON_DAILY_LIMIT_GLOBAL, reason: 'global', resetAt };
    }
    if (perSubnetUsed > MCP_ANON_DAILY_LIMIT_PER_SUBNET) {
      return { allowed: false, used: perSubnetUsed, limit: MCP_ANON_DAILY_LIMIT_PER_SUBNET, reason: 'per_subnet', resetAt };
    }
    if (perIpUsed > MCP_ANON_DAILY_LIMIT_PER_IP) {
      return { allowed: false, used: perIpUsed, limit: MCP_ANON_DAILY_LIMIT_PER_IP, reason: 'per_ip', resetAt };
    }
    if (identityUsed >= MCP_ANON_DAILY_LIMIT) {
      return { allowed: false, used: identityUsed, limit: MCP_ANON_DAILY_LIMIT, reason: 'identity', resetAt };
    }
    return { allowed: true, used: identityUsed, limit: MCP_ANON_DAILY_LIMIT, reason: 'ok', resetAt };
  } catch (e) {
    console.error('[mcp-anon-limit] Redis error checking anonymous MCP quota:', (e as Error).message);
    return { allowed: false, used: 0, limit: MCP_ANON_DAILY_LIMIT, reason: 'infra', resetAt };
  }
}

// Call AFTER confirming the tool call actually succeeded — see file
// header. Fire-and-forget from the caller's perspective (wrap in
// waitUntil()), same convention as logApiRequest() elsewhere in this
// codebase.
export async function recordMcpAnonSuccess(ip: string, userAgent: string, sessionId?: string | null): Promise<void> {
  if (!redis) return;
  const client = redis;
  const today = new Date().toISOString().slice(0, 10);
  const normalizedSessionId = normalizeSessionId(sessionId);

  const keys = [bucketKey(ip, userAgent), subnetUaKey(ip, userAgent, today)];
  if (normalizedSessionId) {
    keys.push(sessionKey(normalizedSessionId, today));
  }

  try {
    await Promise.all(
      keys.map(async (key) => {
        const used = await client.incr(key);
        if (used === 1) {
          await client.expire(key, KEY_TTL_SECONDS);
        }
      }),
    );
  } catch (e) {
    console.error('[mcp-anon-limit] Redis error recording success:', (e as Error).message);
  }
}
