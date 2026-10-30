// v1.18: a keyed check validates the mint before quota or credit is
// spent. When the anonymous 5/day quota is used up, the reply stays an
// HTTP 200 tool error (as before) and now says when the quota resets.
//
// Version 1.17 — app/api/mcp/route.ts
//
// v1.17: an Authorization header that does not match a live key is a
// 401. It is not treated as an anonymous caller and does not spend the
// 5/day anonymous quota. No header at all still allows the anonymous
// tools. The api_key argument is unchanged.
//
// Version 1.16 — app/api/mcp/route.ts
//
// v1.16: check_payment is throttled via lib/verify-throttle.ts (1 per 5 s per payment_id; after 30 checks/hour per key, 1 per minute per payment_id); a throttled call returns error_code verify_rate_limited + retry_after without calling Helius or Supabase, fails open if Redis is down, and never counts against call quotas.
//
// Version 1.15 — app/api/mcp/route.ts
//
// v1.15: quota/credit refusals now attach owner handoff info via lib/owner-handoff — keyed blocks can carry a one-time $5 USDC top-up link for the key owner, anonymous blocks get owner_message + owner_pay_url pointing to https://www.tnt-audit.com/agent-access.
//
// v1.14: all public URLs in tool notes/instructions use the canonical https://www.tnt-audit.com origin.
//
// Version 1.13 — app/api/mcp/route.ts
//
// v1.13: added create_topup_invoice and check_payment self-authenticating billing tools; both reuse lib/billing-actions.ts (the exact REST billing logic) and never log the API key.
//
// Version 1.12 — app/api/mcp/route.ts
//
// v1.12: updated onboarding metadata — server instructions, check_token_risk/check_token_risk_batch descriptions, and public/.well-known/mcp/server-card.json now point agents at get_free_api_key / x402 / refusal options. No logic changes.
//
// Version 1.11 — app/api/mcp/route.ts
//
// v1.11: structured, machine-readable refusals for quota/credit blocks — anonymous and keyed check_token_risk (and keyed batch) now carry error_code/message/options from lib/refusal-options.ts, so an AI agent can continue automatically (free key, x402, or top up).
// Version 1.10 — app/api/mcp/route.ts
//
// v1.10: callers can pass their API key as an optional api_key
// argument on check_token_risk and check_token_risk_batch, for MCP
// hosts that cannot set HTTP headers. Authorization header still wins
// when both are present; invalid explicit keys never fall back to the
// anonymous quota.
//
// Version 1.9 — app/api/mcp/route.ts
//
// v1.9: new get_free_api_key tool that reuses the exact web signup logic
// (lib/free-key-signup.ts) so the MCP path shares per-email dedup and the
// IP/global signup cap; works with no Authorization header and does not
// consume the 5/day anonymous check quota.
//
// Version 1.8 — app/api/mcp/route.ts
//
// v1.8: anonymous check_token_risk now also counts subnet+UA and
// optional Mcp-Session-Id identity buckets (lib/mcp-anon-limit.ts v1.3);
// keyed calls untouched.
//
// Version 1.7 — app/api/mcp/route.ts
//
// v1.7: serverInfo name/version now read from
// public/.well-known/mcp/server-card.json (was hard-coded '1.0.0' here vs
// '1.2.0' in the card) — one source of truth.
//
// v1.6: replaces the v1.2 anonymous check_token_risk path (which shared
// lib/demo-limit.ts's counter with the WEBSITE's no-email trial, 3/IP
// plus a 100/day GLOBAL pool shared across every anonymous visitor on
// either surface) with a dedicated, independent counter —
// lib/mcp-anon-limit.ts, 5 successful calls/day, bucketed on
// hash(IP + User-Agent) so a directory's shared infra IP (Glama etc.)
// doesn't exhaust one pool for every visitor going through it. Decided
// explicitly: the website's 3/day trial, a real key's 15/day, and this
// MCP-anonymous 5/day must never share a counter. Only a call where
// fetchTokenRisk() actually succeeds burns the quota — an invalid mint
// or upstream failure doesn't cost the visitor one of their 5.
// check_token_risk_batch remains fully key/x402-only for anonymous
// callers (unchanged), now with an explicit short error instead of the
// generic Unauthorized message. get_token_risk_history is now allowed
// with no key at all — it's already free/uncounted for a real key (pure
// read from stored history, no live upstream call), so there's no
// reason to gate it behind auth just for an anonymous caller.
//
// Version 1.3 — app/api/mcp/route.ts
//
// v1.3: demo error message now distinguishes which limit blocked the
// call — lib/demo-limit.ts v1.2 added a global daily cap (100/day
// across ALL anonymous callers) on top of the existing per-IP cap
// (3/day), since Vercel prevents x-forwarded-for spoofing but not
// legitimate IP rotation (VPN, mobile NAT). See that file's header for
// the full reasoning. No change to the demo-eligibility logic itself.
//
// Version 1.2 — app/api/mcp/route.ts
//
// v1.2: added a zero-key anonymous demo path for check_token_risk ONLY
// (not the batch or history tools). Context: Glama analytics showed 411
// search impressions / 471 profile views / 0 tool calls over 30 days —
// people were reaching the listing but nobody had a real API key handy
// to actually invoke the tool from a directory's built-in
// inspector/playground, so the very first "does this thing work" call
// never happened. Fix: if "tools/call" arrives with NO Authorization
// header AND the tool being called is check_token_risk, don't 401 at
// the POST() gate — let it through with apiKey = null, and the tool
// handler itself enforces a small per-IP daily cap via
// checkDemoLimit() (lib/demo-limit.ts, DEMO_DAILY_LIMIT_PER_IP = 3,
// Upstash Redis). Every other method/tool combination is completely
// unchanged from v1.1 — batch and history still require a real key,
// same as before. Demo calls are logged with keyId: null so they never
// touch a real key's billing/quota rows.
//
// Version 1.1 — app/api/mcp/route.ts
//
// POST /api/mcp — remote MCP server for the Risk-Data API, "simple path"
// per the explicit decision: API-key auth (same Authorization: Bearer
// header as the REST endpoints), no OAuth 2.1 yet. Published to the
// open MCP registry (punkpeye/awesome-mcp-servers, Smithery, Glama) —
// NOT submitted to Anthropic's reviewed Connectors Directory, which
// requires OAuth 2.1 + PKCE and a privacy policy page we don't have
// yet. That's a deliberate later step, not an oversight.
//
// v1.1 change: auth is no longer enforced on the whole POST handler.
// Automated MCP health-checkers/directory scanners (Glama, Smithery,
// etc.) connect with NO Authorization header to run "initialize" and
// discover tools via "tools/list" — that's normal MCP client behavior,
// not a bypass attempt. Per the MCP spec, auth applies to the session
// / tool invocation, not to capability negotiation. Blocking
// "initialize" behind an API key meant every unauthenticated scanner
// got a 401 before the server even responded, which Glama's connector
// directory reported as "Unhealthy" — a false negative, not a real
// outage. Fix: peek at the JSON-RPC "method" in the request body
// first. "initialize" / "notifications/initialized" / "ping" /
// "tools/list" are allowed with no key (nothing paid or private is
// exposed — the tool schemas are already public in
// public/.well-known/mcp/server-card.json). Every other method
// (importantly "tools/call", where the actual paid work happens)
// still goes through requireApiKey() exactly as before — EXCEPT the
// v1.2 demo carve-out for check_token_risk specifically, see above.
//
// Architecture: this does NOT proxy HTTP calls to our own
// /api/v1/token-risk endpoints. It calls the same underlying library
// functions directly (fetchTokenRisk, enforceRateLimit,
// getMintRiskHistory) — avoids a pointless extra network hop within
// our own infra and guarantees the MCP tools and the REST API can
// never drift out of sync in behavior, since they're the literal same
// code path.
//
// Auth: exactly the existing requireApiKey() (lib/api-auth.ts) — same
// Bearer token, same key hash lookup, same table. A person's existing
// tnt_sk_... API key works here unchanged; no separate MCP-specific
// credential to issue or manage. Now scoped to auth-requiring methods
// only (see v1.1 note above), not the whole handler.
//
// Rate limiting / billing: exactly the existing enforceRateLimit() /
// enforceRateLimitBatch() (lib/rate-limit.ts) — an MCP tool call is
// charged and capped identically to the equivalent REST call. There is
// no separate "MCP tier" or bypass for a real key. The v1.2 anonymous
// path is a SEPARATE, much smaller limiter (checkDemoLimit()) that
// never touches enforceRateLimit() or any api_keys row.
//
// Transport: WebStandardStreamableHttp, STATELESS mode
// (sessionIdGenerator: undefined). Deliberate, not a default left
// alone: Vercel serverless functions don't persist in-memory state
// between invocations, so a stateful MCP session (which the SDK would
// otherwise track in-process) would randomly break the moment two
// calls in the same "session" land on different function instances.
// Stateless mode means every request re-authenticates and rebuilds the
// server from scratch — slightly more per-call overhead, correctness
// over cleverness on serverless.

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import serverCard from '@/public/.well-known/mcp/server-card.json';
import { authenticateRawApiKey, requireApiKey } from '@/lib/api-auth';
import { enforceRateLimit, enforceRateLimitBatch } from '@/lib/rate-limit';
import { fetchTokenRisk, isValidSolanaMint } from '@/lib/token-risk-core';
import { getMintRiskHistory } from '@/lib/mint-risk-history-store';
import { issueFreeApiKey } from '@/lib/free-key-signup';
import { logApiRequest } from '@/lib/request-logger';
import { checkMcpAnonLimit, normalizeSessionId, recordMcpAnonSuccess } from '@/lib/mcp-anon-limit';
import { buildRefusalBody, freeKeyOption, x402Option } from '@/lib/refusal-options';
import { attachOwnerHandoff, attachAnonOwnerInfo } from '@/lib/owner-handoff';
import { createInvoiceForKey, verifyPaymentForKey } from '@/lib/billing-actions';
import { checkVerifyThrottle, throttledBody } from '@/lib/verify-throttle';
import { MIN_TOPUP_USD, MAX_TOPUP_USD } from '@/lib/billing-pricing';
import type { ApiKeyRecord } from '@/lib/api-key-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Same cap as app/api/v1/token-risk/batch/route.ts — kept as a literal
// duplicate rather than a shared import, since MAX_BATCH_SIZE there is
// intentionally not exported (Next.js route files only allow specific
// exports — see that file's own note). If that cap ever changes,
// update both.
const MAX_BATCH_SIZE = 25;

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

function mintProblem(mint: string | null | undefined): string | null {
  if (!mint || !mint.trim()) return 'Missing required parameter: mint';
  if (!isValidSolanaMint(mint)) return `Invalid mint address: ${mint}`;
  return null;
}

// JSON-RPC methods that never touch paid/private data — safe to allow
// with no Authorization header so directory health-checkers and new
// clients can discover this server before a person has an API key.
const PUBLIC_METHODS = new Set(['initialize', 'notifications/initialized', 'ping', 'tools/list']);

// Tools an unauthenticated "tools/call" is allowed to reach.
// check_token_risk: gated by its own dedicated quota stack inside the
// tool handler (lib/mcp-anon-limit.ts): 5 successful calls/day per
// identity (IP+UA), a rotation-proof per-IP daily cap, and a global
// daily backstop.
// get_token_risk_history: no quota at all — already free/uncounted for
// a real key (pure read from stored history), so there's no cost reason
// to gate an anonymous caller either.
// get_free_api_key: works with no key; does NOT consume the 5/day
// anonymous check quota — abuse protection is the signup IP/global cap
// inside issueFreeApiKey (lib/free-key-signup.ts).
// Deliberately NOT check_token_risk_batch: it can burn up to
// MAX_BATCH_SIZE upstream calls in one shot — key or x402 only.
const ANON_ALLOWED_TOOLS = new Set(['check_token_risk', 'get_token_risk_history', 'get_free_api_key']);

// Tools that authenticate inside the handler via header key or api_key
// argument, never anonymous. They require the caller's own API key.
const SELF_AUTH_TOOLS = new Set(['create_topup_invoice', 'check_payment']);

// Tools that accept an api_key argument when the MCP host cannot send
// an Authorization header. The header still wins if both are present.
const KEY_ARG_TOOLS = new Set(['check_token_risk', 'check_token_risk_batch']);

function jsonResult(data: unknown, isError = false) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }], isError };
}

const NEED_KEY_RESULT = jsonResult({ error: 'This tool needs your API key: send Authorization: Bearer <api_key> or pass the api_key argument. No key yet? Call get_free_api_key first.', error_code: 'missing_api_key' }, true);

const API_KEY_ARG_DESCRIPTION = 'Optional. Your RiskDataApi key, for MCP hosts that cannot send an Authorization header. If both are present, the Authorization header wins.';

type CallKeyResolution = { key: ApiKeyRecord | null; error: ReturnType<typeof jsonResult> | null };

async function resolveCallKey(headerKey: ApiKeyRecord | null, argKey: unknown): Promise<CallKeyResolution> {
  if (headerKey) return { key: headerKey, error: null };
  if (argKey === undefined || argKey === null) return { key: null, error: null };
  if (typeof argKey === 'string' && argKey.trim() === '') return { key: null, error: null };

  const record = await authenticateRawApiKey(argKey);
  if (record) return { key: record, error: null };
  return { key: null, error: jsonResult({ error: 'Invalid or revoked API key in the api_key argument.', error_code: 'invalid_api_key' }, true) };
}

// Best-effort client IP for the anonymous demo limiter ONLY — never
// used for auth or billing of a real key. Vercel sets x-forwarded-for;
// first entry is the original client. Falls back to a constant bucket
// key if the header is somehow missing (rare on Vercel), which just
// means every header-less anonymous caller shares one small daily
// pool instead of getting an individual one — an acceptable, safe
// degradation, not an open door.
function extractClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}

// Folded into the anonymous-MCP bucket key alongside IP — see
// lib/mcp-anon-limit.ts header for why (shared directory infra IPs).
function extractUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') ?? 'unknown';
}

// Optional MCP session id, passed through normalizeSessionId. Used only
// for the anonymous check_token_risk identity quota (lib/mcp-anon-limit.ts
// v1.3); keyed calls never touch it.
function extractSessionId(request: NextRequest): string | null {
  return normalizeSessionId(request.headers.get('mcp-session-id'));
}

// A server instance built with no ApiKeyRecord — reached for
// PUBLIC_METHODS (initialize/tools list/ping) AND, as of v1.2, for an
// unauthenticated "tools/call" of check_token_risk specifically (the
// demo path). clientIp is only meaningful in that second case; it's
// unused by every other tool.
function buildServer(apiKey: ApiKeyRecord | null, clientIp: string, userAgent: string, sessionId: string | null): McpServer {
  const server = new McpServer(
    { name: serverCard.serverInfo.name, version: serverCard.serverInfo.version },
    {
      // v1.5 FIX: instructions belongs in the SECOND constructor arg
      // (ServerOptions), not merged into the first (Implementation) —
      // the v1.4 attempt put it in the wrong object, which compiles
      // fine in plain JS but fails TypeScript's type check on `next
      // build` (Implementation has no `instructions` field). Confirmed
      // against the actual @modelcontextprotocol/sdk .d.ts: constructor(
      // serverInfo: Implementation, options?: ServerOptions), with
      // instructions?: string living on ServerOptions.
      //
      // v1.4: MCP's initialize response supports an `instructions` field
      // that clients/inspectors (Glama, Smithery, Claude Desktop) often
      // surface directly on connect — this is the one place a first-time
      // visitor reliably sees BEFORE they're asked for a key, unlike
      // README.md or server-card.json which not every client reads.
      instructions:
        'check_token_risk works with no signup: 5 free anonymous calls/day — just call the tool directly. On a quota refusal, read error_code + options[] and follow one to continue (free key, x402, or top up). get_free_api_key(email) issues a free key for 15 calls/day; pass it via the Authorization: Bearer header or the api_key argument (header wins). Pay per call with x402: GET https://www.tnt-audit.com/api/v1/token-risk/x402?mint=<mint> ($0.02 USDC on Solana, no account). check_token_risk_batch (max 25 mints) needs a key or x402; N mints = N calls, all-or-nothing. get_token_risk_history is free/unmetered.',
    },
  );

  server.registerTool(
    'check_token_risk',
    {
      title: 'Check Solana token risk',
      description:
        'Returns a 0-100 safety score, on-chain insider wallet clusters (wallets sharing a first funder), mint/freeze authority status, holder concentration, and live price/liquidity/volume for a single Solana token mint. Use before recommending or executing a trade on any Solana token. 5 free anonymous calls/day, no signup. Then call get_free_api_key (15/day) or pay per call via x402; pass a key via the Authorization header or the api_key argument. Quota refusals return error_code + options[] with the exact next step.',
      inputSchema: {
        mint: z.string().describe('The Solana token mint address to check'),
        api_key: z.string().max(200).optional().describe(API_KEY_ARG_DESCRIPTION),
      },
    },
    async ({ mint, api_key }) => {
      const resolved = await resolveCallKey(apiKey, api_key);
      if (resolved.error) return resolved.error;
      const callKey = resolved.key;
      // v1.6: dedicated anonymous-MCP quota (lib/mcp-anon-limit.ts) —
      // completely separate from the website's no-email trial and from
      // a real key's 15/day. Peek BEFORE calling upstream, so a visitor
      // who's already out of quota never triggers a real
      // Helius/DexScreener call. Only recorded as used if the call
      // actually succeeds — an invalid mint / upstream failure doesn't
      // cost one of the 5.
      if (!callKey) {
        const startedAt = Date.now();
        const gate = await checkMcpAnonLimit(clientIp, userAgent, sessionId);
        if (!gate.allowed) {
          const message =
            gate.reason === 'global'
              ? `Anonymous MCP calls are at capacity for today (${gate.used}/${gate.limit} globally). Get a free email key (15/day) at https://www.tnt-audit.com/risk-api or pay per call via x402 GET /api/v1/token-risk/x402 ($0.02).`
              : gate.reason === 'per_ip'
                ? `Too many anonymous MCP calls from this IP today (${gate.used}/${gate.limit}). Get a free email key (15/day) at https://www.tnt-audit.com/risk-api or pay per call via x402 GET /api/v1/token-risk/x402 ($0.02).`
                : gate.reason === 'per_subnet'
                  ? `Too many anonymous MCP calls from this network today (${gate.used}/${gate.limit}). Get a free email key (15/day) at https://www.tnt-audit.com/risk-api or pay per call via x402 GET /api/v1/token-risk/x402 ($0.02).`
                : gate.reason === 'infra'
                  ? 'Anonymous MCP access is temporarily unavailable. Please try again shortly, or use a free API key (15/day) from https://www.tnt-audit.com/risk-api.'
                  : `Anonymous MCP quota used (${gate.used}/${gate.limit} today). Get a free email key (15/day) at https://www.tnt-audit.com/risk-api or pay per call via x402 GET /api/v1/token-risk/x402 ($0.02).`;
          const resetHint =
            gate.reason === 'infra'
              ? ''
              : ` Free quota resets at 00:00 UTC (in ${Math.ceil(secondsUntilUtcMidnight() / 60)} min).`;
          const anonRefusal = buildRefusalBody(
            gate.reason === 'infra' ? 'anon_unavailable' : 'anon_limit_reached',
            message + resetHint,
            [freeKeyOption(), x402Option()],
            { used: gate.used, limit: gate.limit },
          );
          // Owner info only for a real quota block — an infra outage is not
          // "your agent used its free calls".
          const anonBody = gate.reason === 'infra' ? anonRefusal : attachAnonOwnerInfo(anonRefusal);
          return jsonResult(anonBody, true);
        }
        const result = await fetchTokenRisk(mint);
        if (result.ok) {
          waitUntil(recordMcpAnonSuccess(clientIp, userAgent, sessionId));
        }
        waitUntil(
          logApiRequest({
            keyId: null,
            mint,
            statusCode: result.ok ? 200 : result.status ?? 502,
            safetyScore: result.ok ? result.safety_score ?? null : null,
            clusterAnalysis: result.ok ? result.cluster_analysis ?? null : null,
            responseTimeMs: Date.now() - startedAt,
            error: result.ok ? null : result.error ?? 'unknown_error',
          }),
        );
        const usedNow = result.ok ? gate.used + 1 : gate.used;
        return jsonResult(
          {
            ...result,
            _mcp_anon: {
              used: usedNow,
              limit: gate.limit,
              note: `Anonymous MCP call ${usedNow}/${gate.limit} today, no signup. Get a free key for 15/day — self-serve (no human needed): POST {"email":"you@example.com"} to https://www.tnt-audit.com/api/v1/signup, response includes api_key directly. Human form: https://www.tnt-audit.com/risk-api`,
            },
          },
          !result.ok,
        );
      }

      const startedAt = Date.now();
      const problem = mintProblem(mint);
      if (problem) {
        return jsonResult({ error: problem }, true);
      }
      const rateLimit = await enforceRateLimit(callKey, {});
      if (!rateLimit.allowed) {
        waitUntil(
          logApiRequest({ keyId: callKey.id, mint, statusCode: 402, responseTimeMs: Date.now() - startedAt, error: 'rate_limited' }),
        );
        const refusal = rateLimit.response ? await rateLimit.response.clone().json().catch(() => null) : null;
        const withHandoff = await attachOwnerHandoff(refusal, callKey);
        return jsonResult(
          withHandoff ?? { error: 'Rate limit or credit balance exceeded.', error_code: 'rate_limited' },
          true,
        );
      }

      const result = await fetchTokenRisk(mint);
      waitUntil(
        logApiRequest({
          keyId: callKey.id,
          mint,
          statusCode: result.ok ? 200 : result.status ?? 502,
          safetyScore: result.ok ? result.safety_score ?? null : null,
          clusterAnalysis: result.ok ? result.cluster_analysis ?? null : null,
          responseTimeMs: Date.now() - startedAt,
          error: result.ok ? null : result.error ?? 'unknown_error',
        }),
      );
      return jsonResult(result, !result.ok);
    },
  );

  server.registerTool(
    'check_token_risk_batch',
    {
      title: 'Check risk for multiple Solana tokens at once',
      description: `Same as check_token_risk but for up to ${MAX_BATCH_SIZE} mints in one call — N mints charged as N calls, same per-call economics as check_token_risk, no bulk discount. All-or-nothing: if the batch can't be fully covered by remaining quota/credit, the whole batch is rejected rather than partially processed. Needs an API key (Authorization header or api_key argument) or x402 — no anonymous batch calls.`,
      inputSchema: {
        mints: z.array(z.string()).min(1).max(MAX_BATCH_SIZE).describe(`1-${MAX_BATCH_SIZE} Solana token mint addresses`),
        api_key: z.string().max(200).optional().describe(API_KEY_ARG_DESCRIPTION),
      },
    },
    async ({ mints, api_key }) => {
      const resolved = await resolveCallKey(apiKey, api_key);
      if (resolved.error) return resolved.error;
      const callKey = resolved.key;
      if (!callKey) {
        return jsonResult(
          attachAnonOwnerInfo(
            buildRefusalBody(
              'anon_limit_reached',
              'Batch needs an API key or x402 — anonymous batch calls are not supported. Free key (15/day): https://www.tnt-audit.com/risk-api. x402: GET /api/v1/token-risk/x402 ($0.02/call).',
              [freeKeyOption(), x402Option()],
            ),
          ),
          true,
        );
      }
      const startedAt = Date.now();
      for (const one of mints) {
        const problem = mintProblem(one);
        if (problem) {
          return jsonResult({ error: problem }, true);
        }
      }
      const rateLimit = await enforceRateLimitBatch(callKey, mints.length, {});
      if (!rateLimit.allowed) {
        waitUntil(
          logApiRequest({
            keyId: callKey.id,
            mint: `batch:${mints.length}`,
            statusCode: 402,
            responseTimeMs: Date.now() - startedAt,
            error: 'rate_limited',
          }),
        );
        const refusal = rateLimit.response ? await rateLimit.response.clone().json().catch(() => null) : null;
        const withHandoff = await attachOwnerHandoff(refusal, callKey);
        return jsonResult(
          withHandoff ?? {
            error: 'Rate limit or credit balance exceeded for this batch.',
            error_code: 'rate_limited',
          },
          true,
        );
      }

      const results = await Promise.all(mints.map((mint) => fetchTokenRisk(mint)));
      for (const result of results) {
        waitUntil(
          logApiRequest({
            keyId: callKey.id,
            mint: result.mint,
            statusCode: result.ok ? 200 : result.status ?? 502,
            safetyScore: result.ok ? result.safety_score ?? null : null,
            clusterAnalysis: result.ok ? result.cluster_analysis ?? null : null,
            responseTimeMs: Date.now() - startedAt,
            error: result.ok ? null : result.error ?? 'unknown_error',
          }),
        );
      }
      return jsonResult({ results, batch_size: mints.length, charged_calls: mints.length });
    },
  );

  server.registerTool(
    'get_free_api_key',
    {
      title: 'Get a free API key',
      description:
        'Issues a free RiskDataApi key for an email address (15 checks/day instead of 5 anonymous calls/day). No email verification. One active key per email; the key is returned once and also emailed. Use it when you hit the anonymous daily limit.',
      inputSchema: { email: z.string().max(200).describe('Email address to register the free key to') },
    },
    async ({ email }) => {
      const result = await issueFreeApiKey({ email, clientIp });
      if (result.status === 200) {
        return jsonResult({
          ...result.body,
          usage: {
            mcp: 'Send the key as an HTTP header on every MCP request: Authorization: Bearer <api_key> (MCP endpoint https://www.tnt-audit.com/api/mcp), or pass it as the api_key argument of check_token_risk / check_token_risk_batch if your host cannot set headers.',
            rest: 'GET https://www.tnt-audit.com/api/v1/token-risk?mint=<mint> with the same Authorization header.',
            daily_limit: result.body.daily_limit,
            note: 'Store the key securely; it cannot be shown again.',
          },
        });
      }
      return jsonResult(result.body, true);
    },
  );

  server.registerTool(
    'create_topup_invoice',
    {
      title: 'Create a top-up or subscription invoice',
      description: `Creates a Solana payment invoice for your API key: kind "topup" adds call credit ($${MIN_TOPUP_USD}-$${MAX_TOPUP_USD}, usd_amount, default $${MIN_TOPUP_USD}); kind "subscription" buys 30 days. Returns payment_id, the exact pay_amount and wallet_address. Send exactly pay_amount, then call check_payment. Max 3 pending invoices per key.`,
      inputSchema: {
        api_key: z.string().max(200).optional().describe(API_KEY_ARG_DESCRIPTION),
        kind: z.enum(['topup','subscription']).optional().describe('topup (default) or subscription'),
        currency: z.enum(['USDC','SOL','MRDT']).optional().describe('Payment currency (default USDC)'),
        usd_amount: z.number().optional().describe(`Top-up amount in USD, ${MIN_TOPUP_USD}-${MAX_TOPUP_USD} (default ${MIN_TOPUP_USD}); ignored for subscription`),
      },
    },
    async ({ api_key, kind, currency, usd_amount }) => {
      const resolved = await resolveCallKey(apiKey, api_key);
      if (resolved.error) return resolved.error;
      if (!resolved.key) return NEED_KEY_RESULT;
      const kindValue = kind ?? 'topup';
      const result = await createInvoiceForKey(resolved.key, {
        kind: kindValue,
        currency: currency ?? 'USDC',
        usd_amount: kindValue === 'topup' ? (usd_amount ?? MIN_TOPUP_USD) : undefined,
      });
      if (result.status === 200) {
        return jsonResult({
          ...result.body,
          next_step: `Send exactly pay_amount_formatted (${result.body.currency}) to wallet_address in ONE transaction within 45 minutes, then call check_payment with this payment_id until verified is true.`,
        });
      }
      return jsonResult(result.body, true);
    },
  );

  server.registerTool(
    'check_payment',
    {
      title: 'Check an invoice payment',
      description: 'Checks on-chain whether an invoice from create_topup_invoice has been paid and, if so, credits your key. Safe to call repeatedly (idempotent), at most once every 5 seconds per payment_id (after 30 checks per hour per key, once a minute); if throttled it returns error_code verify_rate_limited with retry_after seconds. Returns verified true/false with a reason.',
      inputSchema: {
        api_key: z.string().max(200).optional().describe(API_KEY_ARG_DESCRIPTION),
        payment_id: z.string().max(100).describe('payment_id returned by create_topup_invoice'),
      },
    },
    async ({ api_key, payment_id }) => {
      const resolved = await resolveCallKey(apiKey, api_key);
      if (resolved.error) return resolved.error;
      if (!resolved.key) return NEED_KEY_RESULT;
      const gate = await checkVerifyThrottle(resolved.key.id, payment_id);
      if (gate.allowed === false) return jsonResult(throttledBody(gate), true);
      const result = await verifyPaymentForKey(resolved.key, payment_id);
      return jsonResult(result.body, result.status >= 400);
    },
  );

  server.registerTool(
    'get_token_risk_history',
    {
      title: 'Get historical risk trend for a Solana token',
      description:
        'Returns hourly historical data points (safety_score, insider_cluster_count, holder_count, price, liquidity, volume) for a mint over the last N days (max 90). Free and unmetered — no quota, works with or without an API key — pure read from stored history, no live upstream call.',
      inputSchema: {
        mint: z.string().describe('The Solana token mint address'),
        days: z.number().min(1).max(90).optional().describe('How many days of history to return (default 30, max 90)'),
      },
    },
    async ({ mint, days }) => {
      // v1.6: no longer gated behind an API key — this was already
      // free/uncounted for a real key (pure read from stored history,
      // no live upstream call), so there's no cost reason to 401 an
      // anonymous caller here. keyId is null for anonymous reads, same
      // as the check_token_risk anonymous path.
      const startedAt = Date.now();
      const rows = await getMintRiskHistory(mint, days ?? 30);
      waitUntil(
        logApiRequest({
          keyId: apiKey?.id ?? null,
          mint,
          statusCode: rows === null ? 502 : 200,
          responseTimeMs: Date.now() - startedAt,
          error: rows === null ? 'history_read_failed' : null,
        }),
      );
      if (rows === null) {
        return jsonResult({ error: 'Internal error reading history' }, true);
      }
      return jsonResult({
        mint,
        days_requested: days ?? 30,
        points: rows.map((row) => ({
          hour: row.hour_bucket,
          safety_score: row.safety_score,
          insider_cluster_count: row.insider_cluster_count,
          holder_count: row.holder_count,
          top10_percent: row.top10_percent,
          price_usd: row.price_usd,
          liquidity_usd: row.liquidity_usd,
          volume_24h_usd: row.volume_24h_usd,
          price_change_24h_percent: row.price_change_24h_percent,
        })),
      });
    },
  );

  return server;
}

export async function POST(request: NextRequest) {
  // Peek at the JSON-RPC method (and, for tools/call, the tool name)
  // without consuming the request body, so it can still be read
  // normally by transport.handleRequest() below. NextRequest bodies
  // are streams — clone() gives us a throwaway copy to inspect.
  let method: string | undefined;
  let toolName: string | undefined;
  let hasApiKeyArg = false;
  try {
    const peek = await request.clone().json();
    method = typeof peek?.method === 'string' ? peek.method : undefined;
    toolName = typeof peek?.params?.name === 'string' ? peek.params.name : undefined;
    const toolArgs = peek?.params?.arguments;
    hasApiKeyArg = typeof toolArgs?.api_key === 'string' && toolArgs.api_key.trim() !== '';
  } catch {
    // Not valid JSON, or a batch array — fall through to requiring
    // auth, same as before. Malformed/unrecognized bodies never get
    // the public-method or demo pass.
  }

  const isPublic = method !== undefined && PUBLIC_METHODS.has(method);
  const isAnonAllowedCall = method === 'tools/call' && toolName !== undefined && ANON_ALLOWED_TOOLS.has(toolName);
  const isKeyArgCall = method === 'tools/call' && toolName !== undefined && KEY_ARG_TOOLS.has(toolName) && hasApiKeyArg;
  const isSelfAuthCall = method === 'tools/call' && toolName !== undefined && SELF_AUTH_TOOLS.has(toolName);

  let apiKey: ApiKeyRecord | null = null;
  if (!isPublic) {
    const auth = await requireApiKey(request, {});
    if (!auth.ok || !auth.key) {
      // A key counts as sent only for "Bearer <non-empty value>". A blank
      // Bearer or another scheme is treated as no key. The public demo
      // key is not in the api_keys table and stays a guest here, as before.
      const bearer = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
      const bearerToken = bearer ? bearer[1].trim() : '';
      const isDemoPublicKey = !!process.env.DEMO_PUBLIC_KEY && bearerToken === process.env.DEMO_PUBLIC_KEY;
      if (auth.lookupFailed && !isDemoPublicKey) {
        return NextResponse.json(
          { error: 'Temporary error, please try again later' },
          { status: 503, headers: { 'Retry-After': '5' } },
        );
      }
      const presentedCredential = bearerToken.length > 0 && !isDemoPublicKey;
      if (presentedCredential) {
        return NextResponse.json({ error: 'API key not found or invalid' }, { status: 401 });
      }
      // No header at all. Anonymous tools keep their own 5/day quota.
      // A tool that also accepts an api_key argument still reaches its
      // handler, which rejects a bad argument without spending that quota.
      if (!isAnonAllowedCall && !isKeyArgCall && !isSelfAuthCall) {
        return auth.response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      apiKey = auth.key;
    }
  }

  const server = buildServer(apiKey, extractClientIp(request), extractUserAgent(request), extractSessionId(request));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}

// Stateless mode has no standalone GET/SSE stream (no session to
// resume) and no DELETE session to terminate — both are meaningless
// without a session ID. Respond plainly rather than pretending to
// support either.
export async function GET() {
  return NextResponse.json(
    { error: 'This MCP server is stateless — GET (SSE stream) is not supported. Use POST for JSON-RPC calls.' },
    { status: 405 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'This MCP server is stateless — there is no session to terminate.' },
    { status: 405 },
  );
}
