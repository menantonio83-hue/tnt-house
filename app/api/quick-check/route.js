// Version 1.0 — app/api/quick-check/route.js
//
// New, standalone product: "Quick Check" — paste any Solana token CA,
// get the same audit engine result TNT House already uses, no listing,
// no submission, nothing written to `submissions` / `verified_tokens`.
// Completely separate from the existing Listing flow (app/page.js
// FREE_TOTAL=60, app/api/submit-audit) — that flow is untouched.
//
// Rate limiting: 3 free checks / 24h per identity (IP + a random
// httpOnly fingerprint cookie set below), then falls back to paid
// credits if the identity has any (see lib/quick-check-limit.ts and
// app/api/quick-check/credits/route.js for how credits are purchased).
//
// Reuses the existing, already-battle-tested audit engine
// (performFullAudit from lib/helius-client.js) — same function the
// Listing flow calls, just without persisting anything to Supabase.
// RiskDataApi (app/risk-api/*, app/api/v1/*) is untouched by this file.

import { performFullAudit } from '@/lib/helius-client';
import { consumeQuickCheck, getQuickCheckStatus, CREDIT_PACKAGES } from '@/lib/quick-check-limit';
import { randomUUID } from 'crypto';

const FP_COOKIE = 'tnt_qc_fp';
const FP_MAX_AGE = 60 * 60 * 24 * 365; // 1 year — identity persists across sessions

function extractClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}

function getOrCreateFingerprint(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${FP_COOKIE}=([^;]+)`));
  if (match) return { fp: match[1], isNew: false };
  return { fp: randomUUID(), isNew: true };
}

function withFingerprintCookie(response, fp, isNew) {
  if (isNew) {
    response.headers.append(
      'Set-Cookie',
      `${FP_COOKIE}=${fp}; Path=/; Max-Age=${FP_MAX_AGE}; HttpOnly; SameSite=Lax; Secure`
    );
  }
  return response;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ca = (searchParams.get('ca') || '').trim();

    if (!ca) {
      return Response.json({ error: 'Token CA (mint address) required' }, { status: 400 });
    }

    const ip = extractClientIp(request);
    const { fp, isNew } = getOrCreateFingerprint(request);
    const identity = `${ip}:${fp}`;

    const decision = await consumeQuickCheck(identity);

    if (!decision.allowed) {
      const res = Response.json(
        {
          error: 'Free daily limit reached',
          usedFreeToday: decision.usedFreeToday,
          freeLimit: decision.freeLimit,
          creditsRemaining: decision.creditsRemaining,
          packages: CREDIT_PACKAGES,
          upgradeUrl: '/quick-check#buy-credits',
        },
        { status: 402 }
      );
      return withFingerprintCookie(res, fp, isNew);
    }

    console.log(`🔍 Quick Check for ${ca} (source: ${decision.source})`);
    const auditResult = await performFullAudit(ca);

    const res = Response.json({
      success: true,
      ca,
      auditResult,
      quota: {
        usedFreeToday: decision.usedFreeToday,
        freeLimit: decision.freeLimit,
        creditsRemaining: decision.creditsRemaining,
        chargedTo: decision.source, // 'free' or 'credit'
      },
    });
    return withFingerprintCookie(res, fp, isNew);
  } catch (error) {
    console.error('GET /api/quick-check Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Lets the frontend show "2/3 free left today" + credit balance before
// the user even submits a CA, without consuming a slot.
export async function POST(request) {
  // Status check only — does not consume a free slot or credit.
  try {
    const ip = extractClientIp(request);
    const { fp, isNew } = getOrCreateFingerprint(request);
    const identity = `${ip}:${fp}`;
    const status = await getQuickCheckStatus(identity);
    const res = Response.json({ ...status, packages: CREDIT_PACKAGES });
    return withFingerprintCookie(res, fp, isNew);
  } catch (error) {
    console.error('POST /api/quick-check (status) Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
