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
import { requireApiKey } from '@/lib/api-auth';
import { enforceRateLimit, enforceRateLimitBatch } from '@/lib/rate-limit';
import { fetchTokenRisk } from '@/lib/token-risk-core';
import { getMintRiskHistory } from '@/lib/mint-risk-history-store';
import { logApiRequest } from '@/lib/request-logger';
import { checkDemoLimit } from '@/lib/demo-limit';
import type { ApiKeyRecord } from '@/lib/api-key-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Same cap as app/api/v1/token-risk/batch/route.ts — kept as a literal
// duplicate rather than a shared import, since MAX_BATCH_SIZE there is
// intentionally not exported (Next.js route files only allow specific
// exports — see that file's own note). If that cap ever changes,
// update both.
const MAX_BATCH_SIZE = 25;

// JSON-RPC methods that never touch paid/private data — safe to allow
// with no Authorization header so directory health-checkers and new
// clients can discover this server before a person has an API key.
const PUBLIC_METHODS = new Set(['initialize', 'notifications/initialized', 'ping', 'tools/list']);

// The ONLY tool an unauthenticated "tools/call" is allowed to reach —
// see v1.2 note above. Deliberately not batch or history: batch can
// burn up to MAX_BATCH_SIZE upstream calls in one shot, and history
// has no natural per-call cost signal to rate-limit against.
const DEMO_ELIGIBLE_TOOL = 'check_token_risk';

function jsonResult(data: unknown, isError = false) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }], isError };
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

// A server instance built with no ApiKeyRecord — reached for
// PUBLIC_METHODS (initialize/tools list/ping) AND, as of v1.2, for an
// unauthenticated "tools/call" of check_token_risk specifically (the
// demo path). clientIp is only meaningful in that second case; it's
// unused by every other tool.
function buildServer(apiKey: ApiKeyRecord | null, clientIp: string): McpServer {
  const server = new McpServer({ name: 'tnt-house-risk-data-api', version: '1.0.0' });

  server.registerTool(
    'check_token_risk',
    {
      title: 'Check Solana token risk',
      description:
        'Returns a 0-100 safety score, on-chain insider wallet clusters (wallets sharing a first funder), mint/freeze authority status, holder concentration, and live price/liquidity/volume for a single Solana token mint. Use before recommending or executing a trade on any Solana token.',
      inputSchema: { mint: z.string().describe('The Solana token mint address to check') },
    },
    async ({ mint }) => {
      // v1.2: no key — try the small anonymous demo allowance instead
      // of an immediate Unauthorized, so a first-time visitor testing
      // straight from a directory's inspector gets ONE real response
      // with zero setup.
      if (!apiKey) {
        const startedAt = Date.now();
        const demo = await checkDemoLimit(clientIp);
        if (!demo.allowed) {
          return jsonResult(
            {
              error: `Demo limit reached (${demo.limit} free calls/day without a key). Get a free API key with a real 15/day quota at https://tnt-audit.com/risk-api`,
            },
            true,
          );
        }
        const result = await fetchTokenRisk(mint);
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
        return jsonResult(
          {
            ...result,
            _demo: {
              used: demo.used,
              limit: demo.limit,
              note: `Anonymous demo call ${demo.used}/${demo.limit} today. Get a free key for a real 15/day quota: https://tnt-audit.com/risk-api`,
            },
          },
          !result.ok,
        );
      }

      const startedAt = Date.now();
      const rateLimit = await enforceRateLimit(apiKey, {});
      if (!rateLimit.allowed) {
        waitUntil(
          logApiRequest({ keyId: apiKey.id, mint, statusCode: 402, responseTimeMs: Date.now() - startedAt, error: 'rate_limited' }),
        );
        return jsonResult(
          { error: 'Rate limit or credit balance exceeded. Top up or subscribe at https://tnt-audit.com/risk-api#billing' },
          true,
        );
      }

      const result = await fetchTokenRisk(mint);
      waitUntil(
        logApiRequest({
          keyId: apiKey.id,
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
      description: `Same as check_token_risk but for up to ${MAX_BATCH_SIZE} mints in one call — N mints charged as N calls, same per-call economics as check_token_risk, no bulk discount. All-or-nothing: if the batch can't be fully covered by remaining quota/credit, the whole batch is rejected rather than partially processed.`,
      inputSchema: {
        mints: z.array(z.string()).min(1).max(MAX_BATCH_SIZE).describe(`1-${MAX_BATCH_SIZE} Solana token mint addresses`),
      },
    },
    async ({ mints }) => {
      if (!apiKey) {
        return jsonResult({ error: 'Unauthorized — provide an Authorization: Bearer <api_key> header. Get a free key at https://tnt-audit.com/risk-api' }, true);
      }
      const startedAt = Date.now();
      const rateLimit = await enforceRateLimitBatch(apiKey, mints.length, {});
      if (!rateLimit.allowed) {
        waitUntil(
          logApiRequest({
            keyId: apiKey.id,
            mint: `batch:${mints.length}`,
            statusCode: 402,
            responseTimeMs: Date.now() - startedAt,
            error: 'rate_limited',
          }),
        );
        return jsonResult(
          { error: 'Rate limit or credit balance exceeded for this batch. Top up or subscribe at https://tnt-audit.com/risk-api#billing' },
          true,
        );
      }

      const results = await Promise.all(mints.map((mint) => fetchTokenRisk(mint)));
      for (const result of results) {
        waitUntil(
          logApiRequest({
            keyId: apiKey.id,
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
    'get_token_risk_history',
    {
      title: 'Get historical risk trend for a Solana token',
      description:
        'Returns hourly historical data points (safety_score, insider_cluster_count, holder_count, price, liquidity, volume) for a mint over the last N days (max 90). Does not count against the free/subscription call quota — pure read from stored history, no live upstream call.',
      inputSchema: {
        mint: z.string().describe('The Solana token mint address'),
        days: z.number().min(1).max(90).optional().describe('How many days of history to return (default 30, max 90)'),
      },
    },
    async ({ mint, days }) => {
      if (!apiKey) {
        return jsonResult({ error: 'Unauthorized — provide an Authorization: Bearer <api_key> header. Get a free key at https://tnt-audit.com/risk-api' }, true);
      }
      const startedAt = Date.now();
      const rows = await getMintRiskHistory(mint, days ?? 30);
      waitUntil(
        logApiRequest({
          keyId: apiKey.id,
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
  try {
    const peek = await request.clone().json();
    method = typeof peek?.method === 'string' ? peek.method : undefined;
    toolName = typeof peek?.params?.name === 'string' ? peek.params.name : undefined;
  } catch {
    // Not valid JSON, or a batch array — fall through to requiring
    // auth, same as before. Malformed/unrecognized bodies never get
    // the public-method or demo pass.
  }

  const isPublic = method !== undefined && PUBLIC_METHODS.has(method);
  const isDemoEligibleCall = method === 'tools/call' && toolName === DEMO_ELIGIBLE_TOOL;

  let apiKey: ApiKeyRecord | null = null;
  if (!isPublic) {
    const auth = await requireApiKey(request, {});
    if (!auth.ok || !auth.key) {
      // v1.2: a missing/invalid key on tools/call no longer hard-blocks
      // here IF this specific call is the demo-eligible tool — let it
      // through with apiKey = null, and the tool handler's own
      // checkDemoLimit() decides. Every other unauthenticated
      // tools/call (batch, history) still 401s here exactly as before.
      if (!isDemoEligibleCall) {
        return auth.response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      apiKey = auth.key;
    }
  }

  const server = buildServer(apiKey, extractClientIp(request));
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
