// Version 2.4 — lib/api-auth.ts
//
// v2.4: added authenticateRawApiKey() for MCP hosts that cannot send
// HTTP headers and pass their API key as an optional tool argument.
//
// Version 2.3 — lib/api-auth.ts
//
// Explicit auth check for Risk-Data API routes. Deliberately NOT a global
// Next.js middleware.ts — that would apply site-wide and risk affecting
// existing TNT House routes. Instead, each protected route calls
// requireApiKey(request) itself as the very first thing it does.
//
// Usage inside a route handler:
//
//   const auth = await requireApiKey(request, CORS_HEADERS);
//   if (!auth.ok) return auth.response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   // auth.key is the validated ApiKeyRecord from here on

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { hashApiKey, isValidKeyFormat } from '@/lib/api-key';
import { findApiKeyByHash, lookupApiKeyByHash, touchApiKeyUsage, type ApiKeyRecord } from '@/lib/api-key-store';

// NOTE: deliberately a flat interface, NOT a discriminated union
// ({ ok: true; key } | { ok: false; response }). This project's
// tsconfig.json has "strict": false (strictNullChecks off), and under
// that setting TS's control-flow narrowing on boolean-literal
// discriminants is unreliable even for this exact textbook pattern —
// confirmed by direct repro. A flat interface with nullable fields
// sidesteps the issue entirely and is just as safe to consume.
export interface ApiKeyAuthResult {
  ok: boolean;
  key: ApiKeyRecord | null;
  response: NextResponse | null;
  // true when the key lookup itself failed (database error), not when
  // the key is simply unknown. Callers must not treat it as "no key".
  lookupFailed?: boolean;
}

// v2.4: authenticate a raw API key string. Returns the matching record
// for a valid, non-revoked key; otherwise returns null. Shared with the
// MCP api_key argument path so callers whose MCP host cannot send an
// Authorization header still get the exact same key validation and
// usage-stamp as the header path. Never logs the key.
export async function authenticateRawApiKey(rawKey: unknown): Promise<ApiKeyRecord | null> {
  if (typeof rawKey !== 'string') return null;
  const trimmed = rawKey.trim();
  if (!isValidKeyFormat(trimmed)) return null;

  const record = await findApiKeyByHash(hashApiKey(trimmed));
  if (!record) return null;

  // Fire-and-forget usage stamp — same as requireApiKey.
  waitUntil(touchApiKeyUsage(record.id, record.request_count));

  return record;
}

export async function requireApiKey(
  request: NextRequest,
  extraHeaders: HeadersInit = {},
): Promise<ApiKeyAuthResult> {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return {
      ok: false,
      key: null,
      response: NextResponse.json(
        { error: 'Missing API key. Send it as: Authorization: Bearer <your_api_key>' },
        { status: 401, headers: extraHeaders },
      ),
    };
  }

  const rawKey = match[1].trim();

  if (!isValidKeyFormat(rawKey)) {
    return {
      ok: false,
      key: null,
      response: NextResponse.json(
        { error: 'Malformed API key' },
        { status: 401, headers: extraHeaders },
      ),
    };
  }

  const keyHash = hashApiKey(rawKey);
  const lookup = await lookupApiKeyByHash(keyHash);
  const record = lookup.record;

  if (lookup.failed) {
    return {
      ok: false,
      key: null,
      lookupFailed: true,
      response: NextResponse.json(
        { error: 'Temporary error, please try again later' },
        { status: 503, headers: { 'Retry-After': '5', ...(extraHeaders as Record<string, string>) } },
      ),
    };
  }

  if (!record) {
    return {
      ok: false,
      key: null,
      response: NextResponse.json(
        { error: 'Invalid or revoked API key' },
        { status: 401, headers: extraHeaders },
      ),
    };
  }

  // Fire-and-forget usage stamp — never slow down or fail the real
  // request because of it. Real per-call logging is Stage 4.
  waitUntil(touchApiKeyUsage(record.id, record.request_count));

  return { ok: true, key: record, response: null };
}
