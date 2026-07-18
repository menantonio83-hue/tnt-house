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
import { findApiKeyByHash, touchApiKeyUsage, type ApiKeyRecord } from '@/lib/api-key-store';

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
  const record = await findApiKeyByHash(keyHash);

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
