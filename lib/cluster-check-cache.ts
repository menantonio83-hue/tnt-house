// Version 1.2 — lib/cluster-check-cache.ts
//
// Cache + spend control for /api/cluster-check (the First Funder Trace).
//
// WHY: one call to that endpoint fans out to as many as 41 upstream
// requests — 10 holders x up to 3 getSignaturesForAddress pages of 1000,
// plus a getParsedTransaction each, plus one RugCheck report. It had no
// auth, no rate limit and no cache, so a single unauthenticated GET loop
// could burn the Helius quota that the ENTIRE site runs on.
//
// Caching does most of the work here, not the rate limit. A wallet's
// first funder is a historical fact — who funded an address three months
// ago cannot change. Only the top-holder set drifts, and slowly. So a
// 12-hour cache is cheap correctness-wise and removes nearly all repeat
// cost, including for legitimate users, who get an instant answer.
//
// The rate limit therefore applies ONLY to cache misses, i.e. only to
// requests that would actually spend RPC credits. Someone re-checking
// popular tokens never touches it; someone enumerating fresh mints hits
// it on the tenth trace of the hour.
//
// DEGRADED MODE: if Redis is unreachable this module fails OPEN — the
// cluster check keeps working and the limit is skipped. That is a
// deliberate trade: this is site functionality, not an unrepleneshable
// resource, and losing it to an Upstash blip is worse than an occasional
// overspend. The residual risk (no cache AND no limit at the same time)
// is real, so degradation raises a Telegram alert rather than passing
// quietly — the whole point is that the owner finds out within minutes
// instead of via a Helius invoice.

import { Redis } from '@upstash/redis';
import { alertAdmin } from './telegram-alert';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

const CACHE_TTL_SECONDS = 12 * 60 * 60; // 12 hours

// Miss budgets. Cache HITS are never counted — they cost nothing.
const MISSES_PER_IP_PER_HOUR = 10;
const MISSES_PER_IP_PER_DAY = 20;
const MISSES_GLOBAL_PER_DAY = 200;

// Bumped whenever the cached response shape changes, so a deploy can
// never serve a payload the current code doesn't understand.
//
// v1.2: bumped for the new `unconfirmed` field (see CachedTrace) so
// every cached entry reflects the new signal from the start, rather
// than mixing pre-v1.9-route entries (no field, silently reads as "none
// unconfirmed") with post-fix ones for up to 12h.
const CACHE_VERSION = 'v2';

const ALERT_KEY_DEGRADED = 'cluster-check-redis-degraded';

export interface CachedTrace {
  checked: number;
  clusters: Array<{ funder: string; holders: string[] }>;
  clusterCount: number;
  // v1.2: holders whose true first transaction could not be confirmed
  // within the RPC page budget (see findOldestSignature in
  // app/api/cluster-check/route.js). Optional so cache entries written
  // before this field existed still parse.
  unconfirmed?: string[];
}

export interface MissAllowance {
  allowed: boolean;
  // 'degraded' means Redis was unreachable and we let the request through.
  reason: 'ok' | 'per_ip_hour' | 'per_ip_day' | 'global_day' | 'degraded';
  message: string | null;
}

// Vercel overwrites x-forwarded-for with the real client IP and does not
// forward externally supplied values, so the first entry is trustworthy.
export function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}

function hourKey(): string {
  return new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function reportDegraded(context: string, detail: string): void {
  console.error(`[cluster-check-cache] DEGRADED (${context}): ${detail}`);
  // Fire-and-forget; alertAdmin never throws and self-throttles to one
  // message per hour per key.
  void alertAdmin(
    ALERT_KEY_DEGRADED,
    'Redis is unreachable for /api/cluster-check, so BOTH the 12h result cache and the ' +
      'RPC spend limit are currently bypassed. The cluster tracer still works, but every ' +
      'call now costs full Helius credits with no ceiling. Helius backs the whole site, ' +
      `not just this endpoint — check Upstash. Context: ${context}. Detail: ${detail}`,
  );
}

/**
 * Return a previously traced result for this mint, or null on a miss.
 * Never throws — a cache read failure is reported as a miss.
 */
export async function readClusterCache(ca: string): Promise<CachedTrace | null> {
  if (!redis) {
    reportDegraded('read', 'KV_REST_API_URL / KV_REST_API_TOKEN not configured');
    return null;
  }
  try {
    const raw = await redis.get<CachedTrace>(`cluster:${CACHE_VERSION}:${ca}`);
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.clusters)) return null;
    return raw;
  } catch (e) {
    reportDegraded('read', (e as Error).message);
    return null;
  }
}

/**
 * Store a completed trace. Only successful traces should be cached —
 * caching an upstream failure would pin the error in place for 12 hours.
 */
export async function writeClusterCache(ca: string, value: CachedTrace): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`cluster:${CACHE_VERSION}:${ca}`, value, { ex: CACHE_TTL_SECONDS });
  } catch (e) {
    // Non-fatal: the caller already has a correct answer to return. The
    // only cost is that the next identical request pays for RPC again.
    console.error('[cluster-check-cache] cache write failed:', (e as Error).message);
  }
}

/**
 * Decide whether this client may pay for a fresh trace. Call ONLY after a
 * cache miss — every call consumes budget.
 */
export async function allowExpensiveClusterCheck(ip: string): Promise<MissAllowance> {
  if (!redis) {
    reportDegraded('limit', 'KV_REST_API_URL / KV_REST_API_TOKEN not configured');
    return { allowed: true, reason: 'degraded', message: null };
  }

  const hour = hourKey();
  const day = dayKey();

  try {
    const ipHourKey = `cluster:miss:ip:${ip}:${hour}`;
    const ipDayKey = `cluster:miss:ipd:${ip}:${day}`;
    const globalDayKey = `cluster:miss:global:${day}`;

    const [ipHour, ipDay, globalDay] = await Promise.all([
      redis.incr(ipHourKey),
      redis.incr(ipDayKey),
      redis.incr(globalDayKey),
    ]);

    // Set expiries only on first increment so a busy key can't have its
    // window silently extended on every request.
    await Promise.all([
      ipHour === 1 ? redis.expire(ipHourKey, 3600) : Promise.resolve(),
      ipDay === 1 ? redis.expire(ipDayKey, 86400) : Promise.resolve(),
      globalDay === 1 ? redis.expire(globalDayKey, 86400) : Promise.resolve(),
    ]);

    if (globalDay > MISSES_GLOBAL_PER_DAY) {
      return {
        allowed: false,
        reason: 'global_day',
        message:
          'Cluster tracing is at capacity for today and will reset tomorrow. ' +
          'Everything else in this audit is unaffected.',
      };
    }

    if (ipHour > MISSES_PER_IP_PER_HOUR) {
      return {
        allowed: false,
        reason: 'per_ip_hour',
        message:
          'You have run a lot of new cluster traces in the last hour, so this one is ' +
          'paused to keep the tracer available for everyone. Try again in an hour — ' +
          'tokens traced recently still load instantly.',
      };
    }

    if (ipDay > MISSES_PER_IP_PER_DAY) {
      return {
        allowed: false,
        reason: 'per_ip_day',
        message:
          'You have reached today\u2019s limit for new cluster traces. It resets at ' +
          '00:00 UTC — tokens traced recently still load instantly.',
      };
    }

    return { allowed: true, reason: 'ok', message: null };
  } catch (e) {
    // Fail OPEN, loudly. See the DEGRADED MODE note at the top.
    reportDegraded('limit', (e as Error).message);
    return { allowed: true, reason: 'degraded', message: null };
  }
}
