// Version 1.1 — lib/free-key-signup.ts
//
// v1.1: if the email does not actually send, the response says so and
// still shows the new key. A repeat signup for an email that already has
// an active key gets 409 email_exists, same as before, and never touches
// any existing key. Two fast signups for one email cannot both stay active.
//
// Version 1.0 — lib/free-key-signup.ts
//
// Shared by POST /api/v1/signup and the MCP get_free_api_key tool so
// both share the same per-email dedup and the same IP/global signup cap
// from lib/signup-limit.ts.

import { generateApiKey, hashApiKey } from '@/lib/api-key';
import { insertApiKeyRow, listActiveKeysByOwner, setApiKeyActive } from '@/lib/api-key-store';
import { FREE_DAILY_LIMIT } from '@/lib/billing-pricing';
import { sendApiKeyEmail } from '@/lib/send-email';
import { checkSignupLimit } from '@/lib/signup-limit';
import { Redis } from '@upstash/redis';
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
const EMAIL_NOT_SENT = 'Your key was created, but the email could not be sent — copy the key now.';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : null;

async function withEmailLock(email: string, work: () => Promise<FreeKeySignupResult>): Promise<FreeKeySignupResult> {
  if (!redis) return work();
  const lockKey = `signup-lock:${hashApiKey(email)}`;
  try {
    const acquired = await redis.set(lockKey, '1', { nx: true, ex: 30 });
    if (acquired !== 'OK') {
      return {
        status: 429,
        body: {
          error: 'A signup for this email is already in progress. Wait a moment and try again.',
          error_code: 'signup_in_progress',
        },
      };
    }
  } catch (error) {
    console.error('[signup] lock error:', (error as Error).message);
    return work();
  }
  try {
    return await work();
  } finally {
    try {
      await redis.del(lockKey);
    } catch {
      // The lock expires on its own after 30 seconds.
    }
  }
}

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
    return await withEmailLock(email, () => issueForEmail(email, lang, ref));
  } catch (error: any) {
    console.error('[signup] error:', error);
    return { status: 500, body: { error: 'Internal error' } };
  }
}

async function issueForEmail(email: string, lang: LangCode | undefined, ref: string | null): Promise<FreeKeySignupResult> {
  const active = await listActiveKeysByOwner(email);
  if (active === null) {
    return { status: 500, body: { error: 'Internal error, please try again' } };
  }
  if (active.length > 0) {
    return emailExists();
  }
  return createFirstKey(email, lang, ref);
}

// Same status and body as before v1.1, so bots and the site form see no change.
function emailExists(): FreeKeySignupResult {
  return {
    status: 409,
    body: {
      error: 'This email already has an active API key',
      error_code: 'email_exists',
      note: 'Keys are only shown once at creation and cannot be retrieved again. If you lost yours, contact us to have it reissued.',
    },
  };
}

async function createFirstKey(email: string, lang: LangCode | undefined, ref: string | null): Promise<FreeKeySignupResult> {
  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  const inserted = await insertApiKeyRow(keyHash, keyPrefix, email, 'free', ref, true);
  if (!inserted.record) {
    if (inserted.duplicate) {
      return emailExists();
    }
    return { status: 500, body: { error: 'Failed to create API key, please try again' } };
  }

  const rows = await listActiveKeysByOwner(email);
  if (rows && rows.length > 1) {
    const oldestFirst = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    if (oldestFirst[0].id !== inserted.record.id) {
      await setApiKeyActive(inserted.record.id, false);
      return emailExists();
    }
    for (const extra of oldestFirst.slice(1)) {
      await setApiKeyActive(extra.id, false);
    }
  }

  const emailResult = await sendApiKeyEmail({ to: email, apiKey: rawKey, dailyLimit: FREE_DAILY_LIMIT, lang });
  return {
    status: 200,
    body: {
      api_key: rawKey,
      key_prefix: keyPrefix,
      tier: inserted.record.tier,
      daily_limit: FREE_DAILY_LIMIT,
      created_at: inserted.record.created_at,
      warning: 'This key is shown once and cannot be retrieved again. Store it securely.',
      email_sent: emailResult.sent,
      ...(emailResult.sent ? {} : { email_notice: EMAIL_NOT_SENT }),
    },
  };
}
