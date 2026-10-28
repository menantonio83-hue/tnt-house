// Version 1.0 — lib/free-key-signup.ts
//
// Shared by POST /api/v1/signup and the MCP get_free_api_key tool so
// both share the same per-email dedup and the same IP/global signup cap
// from lib/signup-limit.ts.

import { waitUntil } from '@vercel/functions';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { generateApiKey } from '@/lib/api-key';
import { insertApiKey } from '@/lib/api-key-store';
import { FREE_DAILY_LIMIT } from '@/lib/billing-pricing';
import { sendApiKeyEmail } from '@/lib/send-email';
import { checkSignupLimit } from '@/lib/signup-limit';
import type { LangCode } from '@/app/risk-api/i18n';

export interface FreeKeySignupInput { email: unknown; lang?: unknown; ref?: unknown; clientIp: string }
export interface FreeKeySignupResult { status: number; body: Record<string, any> }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_LANGS: LangCode[] = ['en', 'es', 'fr', 'el', 'ru', 'it', 'zh'];

// Known referral partners for revenue-share arrangements. Whitelisted
// on purpose — this drives real payouts, so it must never accept
// arbitrary client-supplied text. Add a new entry here (lowercase) when
// onboarding a new partner; nothing else needs to change.
const KNOWN_REFERRAL_CODES = ['lumo', 'demo_public'];

export async function issueFreeApiKey(input: FreeKeySignupInput): Promise<FreeKeySignupResult> {
  try {
    const rawEmail = typeof input.email === 'string' ? input.email.trim() : '';
    const lang = VALID_LANGS.includes(input.lang as LangCode) ? (input.lang as LangCode) : undefined;
    const rawRef = typeof input.ref === 'string' ? input.ref.trim().toLowerCase() : '';
    const ref = KNOWN_REFERRAL_CODES.includes(rawRef) ? rawRef : null;

    if (!rawEmail || !EMAIL_REGEX.test(rawEmail) || rawEmail.length > 200) {
      return { status: 400, body: { error: 'Enter a valid email address' } };
    }

    // v7.1: IP + global daily cap on signups themselves — closes a real
    // abuse path (see lib/signup-limit.ts header): this endpoint has no
    // email verification by design, so nothing else stopped a script
    // from minting many keys/minute with fake emails. Checked before
    // any Supabase work, right after cheap format validation.
    const signupLimit = await checkSignupLimit(input.clientIp);
    if (!signupLimit.allowed) {
      const isGlobalLimit = signupLimit.reason === 'global';
      const message = isGlobalLimit
        ? `Free-key signups are at capacity for today (${signupLimit.used}/${signupLimit.limit} issued globally) — try again after UTC midnight.`
        : `Too many signups from this IP today (${signupLimit.used}/${signupLimit.limit}) — try again after UTC midnight, or use x402 (no signup at all): GET /api/v1/token-risk/x402.`;
      const body = isGlobalLimit
        ? { error: message, error_code: 'signup_global_limit', used: signupLimit.used, limit: signupLimit.limit }
        : { error: message, error_code: 'signup_ip_limit', used: signupLimit.used, limit: signupLimit.limit };
      return { status: 429, body };
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
      return { status: 500, body: { error: 'Internal error, please try again' } };
    }

    if (existing) {
      return {
        status: 409,
        body: {
          error: 'This email already has an active API key',
          error_code: 'email_exists',
          note: 'Keys are only shown once at creation and cannot be retrieved again. If you lost yours, contact us to have it reissued.',
        },
      };
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const record = await insertApiKey(keyHash, keyPrefix, email, 'free', ref);

    if (!record) {
      return { status: 500, body: { error: 'Failed to create API key, please try again' } };
    }

    // Fire-and-forget — never blocks or fails this response, see
    // lib/send-email.ts's header for why.
    waitUntil(sendApiKeyEmail({ to: email, apiKey: rawKey, dailyLimit: FREE_DAILY_LIMIT, lang }));

    return {
      status: 200,
      body: {
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
      },
    };
  } catch (error: any) {
    console.error('[signup] error:', error);
    return { status: 500, body: { error: 'Internal error' } };
  }
}
