// Version 6.7 — app/api/v1/signup/route.ts
//
// v6.7: switched the duplicate-email lookup to the service-role Supabase
// client (lib/supabase-admin.ts) — api_keys now has RLS enabled with no
// anon policies. See lib/supabase-admin.ts for why.
//
// Public signup endpoint for the Risk-Data API landing page — no admin
// secret required, unlike app/api/v1/admin/keys (that one stays for
// manually issuing paid-tier keys). Issues a free-tier key per email.
//
// POST /api/v1/signup
// Body: { "email": "you@example.com" }
//
// Abuse handling kept intentionally simple for this stage: one active
// free key per email (checked against `owner_label`, case-insensitive).
// No IP-based rate limiting yet — the API's own per-key daily cap (see
// lib/rate-limit.ts) already bounds how much damage one signup can do.
// Revisit if signup spam becomes an actual problem.
//
// The raw key is returned ONCE and never stored — only its hash lives in
// Supabase (see lib/api-key.ts / lib/api-key-store.ts, same as the admin
// key-issuing flow from Stage 2).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { generateApiKey } from '@/lib/api-key';
import { insertApiKey } from '@/lib/api-key-store';

export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';

    if (!rawEmail || !EMAIL_REGEX.test(rawEmail) || rawEmail.length > 200) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }

    const email = rawEmail.toLowerCase();

    const { data: existing, error: lookupError } = await supabase
      .from('api_keys')
      .select('id')
      .eq('owner_label', email)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error('[signup] lookup error:', lookupError.message);
      return NextResponse.json({ error: 'Internal error, please try again' }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json(
        {
          error: 'This email already has an active API key',
          note: 'Keys are only shown once at creation and cannot be retrieved again. If you lost yours, contact us to have it reissued.',
        },
        { status: 409 },
      );
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const record = await insertApiKey(keyHash, keyPrefix, email, 'free');

    if (!record) {
      return NextResponse.json({ error: 'Failed to create API key, please try again' }, { status: 500 });
    }

    return NextResponse.json({
      api_key: rawKey,
      key_prefix: keyPrefix,
      tier: record.tier,
      daily_limit: 100,
      created_at: record.created_at,
      warning: 'This key is shown once and cannot be retrieved again. Store it securely.',
    });
  } catch (error: any) {
    console.error('[signup] error:', error);
    return NextResponse.json({ error: 'Internal error', details: error.message }, { status: 500 });
  }
}
