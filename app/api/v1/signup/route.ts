// Version 7.2 — app/api/v1/signup/route.ts
//
// v7.2: logic moved to lib/free-key-signup.ts, shared with the MCP
// get_free_api_key tool; behaviour unchanged.
//
// Version 7.1 — app/api/v1/signup/route.ts
//
// v7.1: added IP + global daily rate limiting on the signup attempt
// itself (lib/signup-limit.ts) — this endpoint deliberately has no
// email verification (self-serve, no human required), which meant the
// only thing stopping a script from minting many free keys/minute with
// fake emails was the per-email dedup check below, which does nothing
// against an attacker who controls the email string. Checked before
// any Supabase work. Does not touch the no-verification signup design
// itself, the per-email dedup logic, or the email-delivery flow.
//
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
import { issueFreeApiKey } from '@/lib/free-key-signup';

export const dynamic = 'force-dynamic';

// Same pattern as app/api/v1/token-risk/route.ts's route-local helper —
// a two-line concern not worth a shared module.
function extractClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await issueFreeApiKey({
      email: body.email,
      lang: body.lang,
      ref: body.ref,
      clientIp: extractClientIp(request),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error: any) {
    console.error('[signup] error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
