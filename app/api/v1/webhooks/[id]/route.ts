// Version 1.0 — app/api/v1/webhooks/[id]/route.ts
//
// DELETE /api/v1/webhooks/{id} — disable a webhook subscription.
// Soft-delete only (sets active = false) — same convention as other
// boolean flags in this schema (is_free, active on api_keys). The row
// and its history (last_triggered_at etc.) stay; it just stops being
// picked up by the next /webhooks/check sweep.
//
// Ownership check: the subscription's api_key_id must match the
// authenticated caller's own key. Returns 404 (not 403) for a
// subscription that exists but belongs to someone else — doesn't leak
// which IDs exist to a caller who doesn't own them.

import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-auth';
import { getSubscriptionById, deactivateSubscription } from '@/lib/webhook-store';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireApiKey(request, CORS_HEADERS);
    if (!auth.ok || !auth.key) {
      return auth.response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
    }

    const subscription = await getSubscriptionById(params.id);
    if (!subscription || subscription.api_key_id !== auth.key.id) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const ok = await deactivateSubscription(params.id);
    if (!ok) {
      return NextResponse.json({ error: 'Failed to disable subscription' }, { status: 500, headers: CORS_HEADERS });
    }

    return NextResponse.json({ success: true, id: params.id, active: false }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[webhooks/id] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
