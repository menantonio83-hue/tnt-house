// Version 1.0 — app/api/v1/webhooks/subscribe/route.ts
//
// POST /api/v1/webhooks/subscribe — register a threshold-crossing
// webhook subscription for a mint. GET (same path) — list the caller's
// own subscriptions (API-only, no UI, but cheap to add and genuinely
// useful without one).
//
// Body (POST): { mint, threshold (0-100), condition ('below'|'above'), callback_url }
// Header: Authorization: Bearer <api_key>   (same auth as token-risk)
//
// Response includes `webhook_secret` — shown ONCE, here, never again.
// The caller needs it to verify the X-Webhook-Signature header on every
// delivery (see lib/webhook-signature.ts).
//
// Design decisions:
// - Ownership is api_key_id (auth.key.id), not a free-text owner field
//   — matches how the rest of this API ties data to a key.
// - Subscription cap by tier (lib/billing-pricing.ts
//   WEBHOOK_SUBSCRIPTION_LIMITS) — counts ACTIVE subscriptions only, so
//   disabling old ones frees up room without deleting history.
// - callback_url must be https and must not resolve to a private/
//   loopback/link-local address — see lib/webhook-ssrf-guard.ts. Checked
//   once here at subscribe time, not re-checked per delivery (QStash
//   makes the actual delivery request, not this repo).
// - Does NOT count against the per-call rate limit (enforceRateLimit) —
//   creating a subscription isn't a token-risk call. Its own defense is
//   the active-subscription cap above.

import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-auth';
import { WEBHOOK_SUBSCRIPTION_LIMITS } from '@/lib/billing-pricing';
import { generateWebhookSecret } from '@/lib/webhook-signature';
import { createSubscription, countActiveSubscriptions, listSubscriptionsForKey, type WebhookCondition } from '@/lib/webhook-store';
import { isCallbackUrlSafe } from '@/lib/webhook-ssrf-guard';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Same base58 mint-address format check already used in app/page.js.
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiKey(request, CORS_HEADERS);
    if (!auth.ok || !auth.key) {
      return auth.response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS_HEADERS });
    }

    const { mint, threshold, condition, callback_url: callbackUrl } = body;

    if (!mint || typeof mint !== 'string' || !MINT_RE.test(mint)) {
      return NextResponse.json({ error: 'Invalid or missing mint address' }, { status: 400, headers: CORS_HEADERS });
    }
    if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
      return NextResponse.json(
        { error: 'threshold must be a number between 0 and 100' },
        { status: 400, headers: CORS_HEADERS },
      );
    }
    if (condition !== 'below' && condition !== 'above') {
      return NextResponse.json({ error: "condition must be 'below' or 'above'" }, { status: 400, headers: CORS_HEADERS });
    }
    if (!callbackUrl || typeof callbackUrl !== 'string') {
      return NextResponse.json({ error: 'Missing callback_url' }, { status: 400, headers: CORS_HEADERS });
    }

    const ssrfCheck = await isCallbackUrlSafe(callbackUrl);
    if (!ssrfCheck.safe) {
      return NextResponse.json(
        { error: `callback_url rejected: ${ssrfCheck.reason}` },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const limit = WEBHOOK_SUBSCRIPTION_LIMITS[auth.key.tier] ?? WEBHOOK_SUBSCRIPTION_LIMITS.free;
    const activeCount = await countActiveSubscriptions(auth.key.id);
    if (activeCount >= limit) {
      return NextResponse.json(
        {
          error: `Active subscription limit reached (${limit} for ${auth.key.tier} tier). Disable an existing subscription first.`,
          limit,
          active: activeCount,
        },
        { status: 429, headers: CORS_HEADERS },
      );
    }

    const webhookSecret = generateWebhookSecret();
    const created = await createSubscription({
      apiKeyId: auth.key.id,
      mint,
      threshold,
      condition: condition as WebhookCondition,
      callbackUrl,
      webhookSecret,
    });

    if (!created) {
      return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500, headers: CORS_HEADERS });
    }

    return NextResponse.json(
      {
        id: created.id,
        mint: created.mint,
        threshold: created.threshold,
        condition: created.condition,
        callback_url: created.callback_url,
        active: created.active,
        created_at: created.created_at,
        webhook_secret: webhookSecret,
        note: 'Save webhook_secret now — it is shown only once and is required to verify the X-Webhook-Signature header on every delivery.',
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (error: any) {
    console.error('[webhooks/subscribe] POST error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiKey(request, CORS_HEADERS);
    if (!auth.ok || !auth.key) {
      return auth.response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
    }

    const subscriptions = await listSubscriptionsForKey(auth.key.id);
    return NextResponse.json({ subscriptions }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[webhooks/subscribe] GET error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
