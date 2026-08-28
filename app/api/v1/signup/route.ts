// Version 7.0 — app/api/v1/signup/route.ts
//
// v7.0: accepts an optional `ref` field for referral-partner tracking
// (revenue-share arrangements, e.g. lumo — see conversation 2026-08-28).
// Whitelisted against KNOWN_REFERRAL_CODES rather than trusted as
// free text: an unrecognized code is silently dropped (referred_by
// stays null) instead of erroring the whole signup, since a bad/typo'd
// ref shouldn't block someone from getting their key. Add new partners
// here as they're onboarded — no schema change needed, just this list.
//
// Version 6.9 — app/api/v1/signup/route.ts
//
// v6.9: accepts an optional `lang` field in the request body and
// threads it through to sendApiKeyEmail() — see lib/send-email.ts v1.5
// / lib/email-translations.ts for why (email content is now translated
// into all 7 site languages, but needs to know which one to use).
// Validated against the same LangCode union the rest of the site uses
// rather than trusted blindly — an unrecognized or missing value falls
// straight through as undefined, and send-email.ts's own fallback
// already handles that by defaulting to English. Doesn't touch the
// duplicate-email / reissue logic below at all.
//
// Version 6.8 — app/api/v1/signup/route.ts
//
// v6.8: fire-and-forget email delivery of the key (lib/send-email.ts)
// on top of the existing on-screen display — see that file's header
// for the "clipboard can fail silently, key is shown once, email is
// the recovery path" reasoning. Deliberately does NOT touch the
// existing one-key-per-email / 409-on-duplicate logic below (explicit
// decision, Бро 2026-08-07: keep the reissue behavior exactly as-is,
// simplify by adding email delivery only — no account model, no
// reissue-with-carried-over-quota, no magic-link dashboard).
// sendApiKeyEmail() is fail-soft by design (see its own header) — a
// Resend outage or missing RESEND_API_KEY never blocks or degrades
// this response; the key is still returned and shown on screen exactly
// as before this version.
//
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
import { waitUntil } from '@vercel/functions';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { generateApiKey } from '@/lib/api-key';
import { insertApiKey } from '@/lib/api-key-store';
import { FREE_DAILY_LIMIT } from '@/lib/billing-pricing';
import { sendApiKeyEmail } from '@/lib/send-email';
import type { LangCode } from '@/app/risk-api/i18n';

export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_LANGS: LangCode[] = ['en', 'es', 'fr', 'el', 'ru', 'it', 'zh'];

// Known referral partners for revenue-share arrangements. Whitelisted
// on purpose — this drives real payouts, so it must never accept
// arbitrary client-supplied text. Add a new entry here (lowercase) when
// onboarding a new partner; nothing else needs to change.
const KNOWN_REFERRAL_CODES = ['lumo'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
    const lang = VALID_LANGS.includes(body.lang) ? (body.lang as LangCode) : undefined;
    const rawRef = typeof body.ref === 'string' ? body.ref.trim().toLowerCase() : '';
    const ref = KNOWN_REFERRAL_CODES.includes(rawRef) ? rawRef : null;

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
    const record = await insertApiKey(keyHash, keyPrefix, email, 'free', ref);

    if (!record) {
      return NextResponse.json({ error: 'Failed to create API key, please try again' }, { status: 500 });
    }

    // Fire-and-forget — never blocks or fails this response, see
    // lib/send-email.ts's header for why.
    waitUntil(sendApiKeyEmail({ to: email, apiKey: rawKey, dailyLimit: FREE_DAILY_LIMIT, lang }));

    return NextResponse.json({
      api_key: rawKey,
      key_prefix: keyPrefix,
      tier: record.tier,
      // FIX: was hardcoded 100 -- stale from before the pricing finalized
      // at 15/day (see lib/rate-limit.ts FREE_DAILY_LIMIT, which was
      // already correctly enforcing 15). This response text told every
      // new signup a wrong, 6.6x-too-generous number while the real
      // limit silently kicked in at 15. Now reads the same constant the
      // rate limiter actually enforces, so the two can't drift apart again.
      daily_limit: FREE_DAILY_LIMIT,
      created_at: record.created_at,
      warning: 'This key is shown once and cannot be retrieved again. Store it securely.',
    });
  } catch (error: any) {
    console.error('[signup] error:', error);
    return NextResponse.json({ error: 'Internal error', details: error.message }, { status: 500 });
  }
}
