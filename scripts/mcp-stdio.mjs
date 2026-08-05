#!/usr/bin/env node
// Version 1.1 — scripts/mcp-stdio.mjs
//
// Stdio <-> HTTP bridge for the TNT House Risk-Data API MCP server.
//
// Why this file exists:
// The real MCP server is remote and HTTP-only — POST /api/mcp on
// www.tnt-audit.com (see app/api/mcp/route.ts). Some MCP directories and
// clients can only launch a *local stdio* process: they run a command and
// speak newline-delimited JSON-RPC over its stdin/stdout. Glama's build
// test is one of these — it wraps the configured CMD in `mcp-proxy`, which
// as of v6.4.3 has no remote-URL mode and only supports
// `mcp-proxy -- <command>`. Pointing it at `next start` made it spawn the
// web server and then wait forever for JSON-RPC on stdout that a Next.js
// process never writes, failing with MCP error -32001 after 60s.
//
// This bridge is the missing adapter: it reads JSON-RPC from stdin,
// forwards each message verbatim to the production endpoint over HTTPS,
// and writes the response back to stdout. No protocol translation, no
// business logic — the remote server remains the single source of truth
// for auth, rate limiting, billing, and tool behavior.
//
// Auth: optional TNT_API_KEY env var, forwarded as `Authorization: Bearer`,
// exactly like the REST endpoints. Without it, `initialize` and
// `tools/list` still work (see the v1.1 note in app/api/mcp/route.ts), so
// directory scanners can discover the tools with no credentials. Only
// `tools/call` needs a real key.
//
// Zero dependencies — Node 18+ built-ins only (global fetch).

const ENDPOINT = process.env.TNT_MCP_ENDPOINT || 'https://www.tnt-audit.com/api/mcp';
const API_KEY = process.env.TNT_API_KEY || '';

// Anything written to stdout must be valid JSON-RPC, or the host will
// treat it as protocol garbage. All diagnostics go to stderr instead.
function logError(message) {
  process.stderr.write(`[mcp-stdio] ${message}\n`);
}

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

// The remote transport may answer either with a plain JSON body or with an
// SSE stream (it negotiates on Accept). Handle both so this bridge does not
// silently drop replies if that negotiation ever changes.
function extractPayloads(contentType, body) {
  if (contentType.includes('text/event-stream')) {
    const payloads = [];
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        payloads.push(JSON.parse(data));
      } catch {
        logError(`could not parse SSE data frame: ${data.slice(0, 200)}`);
      }
    }
    return payloads;
  }

  const trimmed = body.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    logError(`could not parse JSON response: ${trimmed.slice(0, 200)}`);
    return [];
  }
}

async function forward(request) {
  const headers = {
    'Content-Type': 'application/json',
    // Accept both so the server can pick either transport shape.
    Accept: 'application/json, text/event-stream',
  };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  // 202 Accepted with no body is the correct answer to a notification.
  if (response.status === 202) return [];

  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  const payloads = extractPayloads(contentType, body);

  // An HTTP-level failure with no JSON-RPC body still needs an answer, or a
  // request-scoped client would hang until its own timeout fires.
  if (payloads.length === 0 && !response.ok && request.id !== undefined) {
    return [
      {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: `Upstream HTTP ${response.status}: ${body.slice(0, 200) || response.statusText}`,
        },
      },
    ];
  }

  return payloads;
}

async function handleLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request;
  try {
    request = JSON.parse(trimmed);
  } catch {
    logError(`ignoring non-JSON stdin line: ${trimmed.slice(0, 200)}`);
    return;
  }

  try {
    const responses = await forward(request);
    for (const response of responses) writeMessage(response);
  } catch (error) {
    logError(`request failed: ${error?.message || error}`);
    // Notifications carry no id and must never receive a reply.
    if (request.id !== undefined) {
      writeMessage({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: `Bridge could not reach ${ENDPOINT}: ${error?.message || error}`,
        },
      });
    }
  }
}

// Messages are processed strictly in arrival order. MCP allows concurrent
// in-flight requests, but serializing keeps the bridge trivially correct and
// the per-call cost here is a single HTTPS round trip.
let queue = Promise.resolve();
let buffer = '';

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  // A single chunk may hold several messages, or half of one.
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    queue = queue.then(() => handleLine(line));
  }
});

process.stdin.on('end', () => {
  queue = queue.then(() => handleLine(buffer)).then(() => process.exit(0));
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
