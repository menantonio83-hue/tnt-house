// Version 1.1 — lib/chat-limit.ts
//
// Server-side quota for the two anonymous chat widgets. Until now the
// only limit on either was a counter in React state — which is to say,
// no limit at all. Anyone could POST /api/chat in a loop and every
// request became a paid DeepSeek call on our account. The widgets are
// free marketing surfaces with no key, no signup and no billing, so
// there was nothing between a script and the balance.
//
// THE NUMBERS ARE NOT NEW. 30 messages per 10 minutes is exactly what
// both widgets already enforce in the browser (app/page.js
// handleSendChat, and ChatWidget.tsx on the Risk-API page). The server
// now enforces the promise the UI was already making, rather than
// inventing a stricter one nobody has been told about.
//
// What DOES change for a legitimate visitor: the browser counter resets
// on reload, this one does not. Someone who reloads the page to keep
// chatting past 30 will now be held to the window. That is the point of
// the change, but it is a visible behaviour change, not a silent one.
//
// SEPARATE COUNTERS PER SURFACE. 'site' and 'risk-api' never share a
// bucket — same rule the other anonymous surfaces in this repo already
// follow (lib/mcp-anon-limit.ts, lib/demo-limit.ts). Someone using the
// main site's chat must not use up the Risk-API page's chat.
//
// BUCKET KEY = hash(IP + User-Agent), not IP alone — same reasoning as
// lib/mcp-anon-limit.ts: visitors arriving through shared proxy
// infrastructure would otherwise exhaust one another's quota.
//
// FAIL-CLOSED. If Redis is unreachable the request is refused. An
// unmetered anonymous surface that spends real money per call is the
// wrong place to fail open, and this repo already made that call twice
// (see lib/demo-limit.ts and lib/mcp-anon-limit.ts). The visible cost is
// that a Redis outage takes the chat widgets down; the alternative is a
// Redis outage turning them into an open faucet.
//
// EDGE-SAFE. Both routes run on the edge runtime, so this file uses Web
// Crypto (crypto.subtle) rather than node's createHash — the reason it
// does not simply import the hashing helper from lib/mcp-anon-limit.ts,
// which is node-only.

import { Redis } from '@upstash/redis';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

// Mirrors the browser-side counters. Change these and the widgets'
// own copies together, or the UI starts promising something the server
// will not honour.
export const CHAT_WINDOW_MINUTES = 10;
export const CHAT_WINDOW_LIMIT = 30;

// Input guards. The routes forwarded body.messages to DeepSeek
// unbounded: max_tokens caps what comes back, nothing capped what goes
// up. A single request could carry megabytes of history and we pay for
// every token of it. These are defensive ceilings, well clear of any
// real conversation the widgets can produce — a widget turn is a couple
// of sentences and the visible history is short.
export const MAX_HISTORY_MESSAGES = 20;
export const MAX_CHARS_PER_MESSAGE = 2000;
export const MAX_TOTAL_CHARS = 8000;

const WINDOW_SECONDS = CHAT_WINDOW_MINUTES * 60;
// One window of slack past expiry, so a key self-cleans even if that
// visitor never returns.
const KEY_TTL_SECONDS = WINDOW_SECONDS * 2;

export type ChatSurface = 'site' | 'risk-api';

export interface ChatLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  retryAfterSeconds: number;
  reason: 'ok' | 'limit_reached' | 'unavailable';
}

async function sha256Short(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

// Fixed window rather than a rolling one: it is what the browser
// counters already do, it costs a single INCR, and the failure mode of
// a fixed window (a visitor getting up to two windows' worth across a
// boundary) is irrelevant at these volumes.
function windowIndex(): number {
  return Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
}

function secondsLeftInWindow(): number {
  const elapsed = Math.floor(Date.now() / 1000) % WINDOW_SECONDS;
  return Math.max(1, WINDOW_SECONDS - elapsed);
}

// Vercel overwrites x-forwarded-for with the real client IP and does not
// forward externally supplied values, so the first entry is trustworthy.
// Same helper shape as app/api/site-orders/create/route.ts.
export function extractClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}

export async function consumeChatQuota(
  surface: ChatSurface,
  ip: string,
  userAgent: string,
): Promise<ChatLimitResult> {
  const retryAfterSeconds = secondsLeftInWindow();

  if (!redis) {
    console.error('[chat-limit] Redis not configured — refusing anonymous chat (fail-closed).');
    return {
      allowed: false,
      used: CHAT_WINDOW_LIMIT,
      limit: CHAT_WINDOW_LIMIT,
      retryAfterSeconds,
      reason: 'unavailable',
    };
  }

  const hash = await sha256Short(`${ip}:${userAgent}`);
  const key = `chat:${surface}:${hash}:${windowIndex()}`;

  try {
    const used = await redis.incr(key);
    if (used === 1) {
      await redis.expire(key, KEY_TTL_SECONDS);
    }
    if (used > CHAT_WINDOW_LIMIT) {
      return {
        allowed: false,
        used,
        limit: CHAT_WINDOW_LIMIT,
        retryAfterSeconds,
        reason: 'limit_reached',
      };
    }
    return { allowed: true, used, limit: CHAT_WINDOW_LIMIT, retryAfterSeconds, reason: 'ok' };
  } catch (e) {
    console.error('[chat-limit] Redis error, refusing:', (e as Error).message);
    return {
      allowed: false,
      used: CHAT_WINDOW_LIMIT,
      limit: CHAT_WINDOW_LIMIT,
      retryAfterSeconds,
      reason: 'unavailable',
    };
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Flat result rather than a discriminated union: this repo builds with
// `strict: false`, under which the union's narrowing does not hold, and
// lib/site-pricing.ts's PriceLookup already established this shape.
export interface SanitizeResult {
  ok: boolean;
  messages: ChatMessage[];
  error: string | null;
}

// Rebuilds the conversation from scratch instead of trusting what
// arrived. Anything not recognised is dropped rather than forwarded:
// the upstream call is paid for by us, so an unexpected field is not
// worth the benefit of the doubt. A 'system' role from the client is
// deliberately NOT accepted — the route supplies its own system prompt,
// and letting a caller inject a second one is how a scoped widget turns
// into somebody's free general-purpose chatbot.
export function sanitizeMessages(raw: unknown): SanitizeResult {
  if (!Array.isArray(raw)) {
    return { ok: false, messages: [], error: 'messages must be an array' };
  }

  const cleaned: ChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string') continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_CHARS_PER_MESSAGE) {
      return { ok: false, messages: [], error: 'a message is too long' };
    }
    cleaned.push({ role, content: trimmed });
  }

  if (cleaned.length === 0) {
    return { ok: false, messages: [], error: 'no usable messages' };
  }

  // Keep the most recent turns — the tail is the conversation, the head
  // is history the model barely needs and we would pay for.
  const trimmedHistory = cleaned.slice(-MAX_HISTORY_MESSAGES);

  const totalChars = trimmedHistory.reduce((sum, m) => sum + m.content.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return { ok: false, messages: [], error: 'conversation is too long' };
  }

  return { ok: true, messages: trimmedHistory, error: null };
}
