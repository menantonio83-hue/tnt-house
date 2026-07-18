// Version 2.4 — app/api/v1/admin/keys/route.ts
//
// Temporary, admin-only endpoint to mint Risk-Data API keys — until
// Stage 5 ships a public signup form/landing page. NOT linked anywhere
// on the site. Protected by a shared secret read from an environment
// variable, never hardcoded.
//
// Required env var (set in Vercel project settings, not committed):
//   RISK_API_ADMIN_SECRET=<a long random string you choose>
//
// Usage:
//   curl -X POST https://tnt-audit.com/api/v1/admin/keys \
//     -H "X-Admin-Secret: <RISK_API_ADMIN_SECRET>" \
//     -H "Content-Type: application/json" \
//     -d '{"owner_label":"my test bot","tier":"free"}'
//
// The raw key is returned ONCE in the response and is never stored or
// retrievable again — only its hash lives in Supabase. Losing it means
// generating a new one.

import { NextRequest, NextResponse } from 'next/server';
import { generateApiKey } from '@/lib/api-key';
import { insertApiKey, type ApiKeyTier } from '@/lib/api-key-store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const adminSecret = request.headers.get('x-admin-secret');
    const expectedSecret = process.env.RISK_API_ADMIN_SECRET;

    if (!expectedSecret || adminSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const ownerLabel: string =
      typeof body.owner_label === 'string' && body.owner_label.trim()
        ? body.owner_label.trim().slice(0, 200)
        : 'unlabeled';
    const tier: ApiKeyTier = body.tier === 'paid' ? 'paid' : 'free';

    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const record = await insertApiKey(keyHash, keyPrefix, ownerLabel, tier);

    if (!record) {
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
    }

    return NextResponse.json({
      api_key: rawKey,
      key_prefix: keyPrefix,
      tier: record.tier,
      owner_label: record.owner_label,
      created_at: record.created_at,
      warning: 'This key is shown once and cannot be retrieved again. Store it securely.',
    });
  } catch (error: any) {
    console.error('[admin/keys] error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error.message },
      { status: 500 },
    );
  }
}
