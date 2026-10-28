// Version 1.0 — app/api/v1/billing/handoff/[token]/route.ts
//
// v1.0: public read/poll endpoint for an owner handoff token. Never returns the key_id and only resolves a random token stored in Redis. The verify=1 flag performs an on-chain verification at most once per VERIFY_POLL_MIN_INTERVAL_SECONDS.

import { NextRequest, NextResponse } from 'next/server';
import { getPaymentById } from '@/lib/billing-store';
import { verifyPaymentForKeyId } from '@/lib/billing-actions';
import { resolveHandoffToken, claimVerifySlot, toHandoffView } from '@/lib/owner-handoff';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const rec = await resolveHandoffToken(params.token);
    if (!rec) {
      return NextResponse.json(
        { error: 'Unknown or expired payment link' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    let p = await getPaymentById(rec.payment_id);
    if (!p || p.key_id !== rec.key_id) {
      return NextResponse.json(
        { error: 'Unknown or expired payment link' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    let detail: string | null = null;
    if (
      request.nextUrl.searchParams.get('verify') === '1' &&
      p.status === 'pending' &&
      (await claimVerifySlot(p.id))
    ) {
      const v = await verifyPaymentForKeyId(rec.key_id, p.id);
      detail = typeof v.body.reason === 'string' && !v.body.verified ? v.body.reason : null;
      p = (await getPaymentById(p.id)) ?? p;
    }

    return NextResponse.json({ ...toHandoffView(p), detail }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
