// Version 1.1 — app/api/banners/claim/route.ts
//
// The only remaining writer of active_banner outside a payment claim.
// (The paid path writes inside /api/verify-payment's claimed branch —
// see that file's v1.3 note. This route covers the two paths that never
// touch a wallet: the free giveaway and a VIP purchase's bundled credit.)
//
// WHAT THIS REPLACES: app/page.js's saveBannerToSupabase() and
// claimFreeBanner() posted directly to Supabase with the publishable
// key. Whether a slot could be written was governed entirely by
// active_banner's RLS policies, which were "public insert" / "public
// update" with check: true — anyone holding that key, which is visible
// in every page load, could overwrite or delete any banner slot with
// arbitrary content, paid or not, without ever touching this site's own
// UI. See migrations/2026-09-11-banner-lockdown.sql for the RLS fix this
// route depends on and the atomic claim functions it calls.
//
// Both branches below call a SECURITY DEFINER function that performs the
// eligibility check AND the active_banner write in one transaction —
// there is no window where a credit is spent without its banner
// appearing, or a banner appears without the spend being recorded.
//
// POST /api/banners/claim
//   { mode: 'free', slot, tokenName, bannerImg, description, targetLink, days }
//   { mode: 'vip_credit', orderId, slot, tokenName, bannerImg, description, targetLink }
//
// 200 { ok: true, freeUsed?, freeLimit? }
// 400 { ok: false, error }
// 404 { ok: false, error: 'order_not_found' }
// 409 { ok: false, error: 'already_claimed' | 'exhausted' | 'not_eligible' }
// 502 { ok: false, error: 'claim_failed' }

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { BANNER_SLOTS } from '@/lib/site-pricing';

export const dynamic = 'force-dynamic';

// FREE_BANNER_DAYS mirrors the values app/page.js's banner form already
// offers ('1', '2', '6') — the free giveaway can pick any of them, same
// as before this fix. Kept as an allowlist for the same reason
// site-pricing.ts's tier tables are allowlists, not defaults: an
// unrecognised value is rejected, not quietly rounded to the cheapest.
const FREE_BANNER_DAYS: Record<string, number> = { '1': 1, '2': 2, '6': 6 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Flat result rather than a discriminated union: this repo builds with
// `strict: false`, under which the union does not narrow on `if
// (!content.ok)` below — the same issue already hit and fixed the same
// way in lib/chat-limit.ts's SanitizeResult.
interface BannerContentResult {
  ok: boolean;
  slot: number;
  tokenName: string;
  bannerImg: string;
  description: string;
  targetLink: string;
  error: string | null;
}

// Shared by both modes — the content fields and their validation are
// identical regardless of which credential is paying for the slot.
function readBannerContent(input: any): BannerContentResult {
  const slot = Number(input?.slot);
  if (!Number.isInteger(slot) || slot < 1 || slot > BANNER_SLOTS) {
    return { ok: false, slot: 0, tokenName: '', bannerImg: '', description: '', targetLink: '', error: 'invalid_slot' };
  }
  const tokenName = typeof input?.tokenName === 'string' ? input.tokenName.trim() : '';
  const description = typeof input?.description === 'string' ? input.description.trim() : '';
  const targetLink = typeof input?.targetLink === 'string' ? input.targetLink.trim() : '';
  if (!tokenName || !description) {
    return { ok: false, slot, tokenName: '', bannerImg: '', description: '', targetLink: '', error: 'invalid_banner_content' };
  }
  if (!isValidHttpUrl(targetLink)) {
    return { ok: false, slot, tokenName: '', bannerImg: '', description: '', targetLink: '', error: 'invalid_target_link' };
  }
  const bannerImg = typeof input?.bannerImg === 'string' ? input.bannerImg.trim() : '';
  return { ok: true, slot, tokenName: tokenName.toUpperCase(), bannerImg, description, targetLink, error: null };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const input = body as { mode?: unknown };
  const content = readBannerContent(body);
  if (!content.ok) {
    return NextResponse.json({ ok: false, error: content.error }, { status: 400 });
  }

  if (input?.mode === 'free') {
    const daysKey = typeof (body as any)?.days === 'string' ? (body as any).days : String((body as any)?.days ?? '');
    const days = FREE_BANNER_DAYS[daysKey];
    if (!days) {
      return NextResponse.json({ ok: false, error: 'invalid_duration' }, { status: 400 });
    }
    const expiresAt = new Date(Date.now() + days * 86400 * 1000).toISOString();

    const claim = await supabaseAdmin.rpc('claim_free_banner_slot', {
      p_slot: content.slot,
      p_token_name: content.tokenName,
      p_banner_img: content.bannerImg,
      p_description: content.description,
      p_target_link: content.targetLink,
      p_expires_at: expiresAt,
    });

    if (claim.error) {
      console.error('[banners/claim] free claim failed:', claim.error.message);
      return NextResponse.json({ ok: false, error: 'claim_failed' }, { status: 502 });
    }

    const row = Array.isArray(claim.data) ? claim.data[0] : undefined;
    if (row?.decision === 'granted') {
      return NextResponse.json({ ok: true, freeUsed: row.free_used, freeLimit: row.free_limit });
    }
    if (row?.decision === 'exhausted') {
      return NextResponse.json(
        { ok: false, error: 'exhausted', freeUsed: row.free_used, freeLimit: row.free_limit },
        { status: 409 },
      );
    }
    console.error('[banners/claim] unexpected free-claim decision:', row?.decision);
    return NextResponse.json({ ok: false, error: 'claim_failed' }, { status: 502 });
  }

  if (input?.mode === 'vip_credit') {
    const orderId = (body as any)?.orderId;
    if (typeof orderId !== 'string' || !UUID_RE.test(orderId.trim())) {
      return NextResponse.json({ ok: false, error: 'invalid_order_id' }, { status: 400 });
    }

    const claim = await supabaseAdmin.rpc('claim_vip_banner_credit', {
      p_order_id: orderId.trim(),
      p_slot: content.slot,
      p_token_name: content.tokenName,
      p_banner_img: content.bannerImg,
      p_description: content.description,
      p_target_link: content.targetLink,
    });

    if (claim.error) {
      console.error('[banners/claim] vip claim failed:', claim.error.message);
      return NextResponse.json({ ok: false, error: 'claim_failed' }, { status: 502 });
    }

    const row = Array.isArray(claim.data) ? claim.data[0] : undefined;
    if (row?.decision === 'granted') {
      return NextResponse.json({ ok: true });
    }
    if (row?.decision === 'not_found') {
      return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 404 });
    }
    if (row?.decision === 'already_claimed' || row?.decision === 'not_eligible') {
      return NextResponse.json({ ok: false, error: row.decision }, { status: 409 });
    }
    console.error('[banners/claim] unexpected vip-claim decision:', row?.decision);
    return NextResponse.json({ ok: false, error: 'claim_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: false, error: 'invalid_mode' }, { status: 400 });
}
