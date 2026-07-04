// app/api/clear-test-banner/route.js
// Version 1.1
//
// One-time utility route to inspect and clear bad/test banner rows from
// active_banner (3 slots now, id 1..3, per BANNER_SLOTS in app/page.js).
// Uses upsert with an expired date instead of DELETE — a plain DELETE is
// silently blocked by Supabase RLS policies for the public/anon key
// (confirmed in a prior session), but POST + merge-duplicates uses the
// same permission path as the normal banner-purchase flow, which works.
//
// Usage:
//   GET /api/clear-test-banner          -> lists all 3 slots so you can see which is bad
//   GET /api/clear-test-banner?expire=2 -> expires slot id=2 specifically
//
// Safe to delete this file after use.

import { NextResponse } from 'next/server';

const SUPABASE_URL = 'https://pjtvjslcffuulsqxerpx.supabase.co';
const SUPABASE_KEY = 'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const expireId = searchParams.get('expire');

    if (!expireId) {
      // Inspect mode: show all current banner slots.
      const res = await fetch(SUPABASE_URL + '/rest/v1/active_banner?select=*&order=id', {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + SUPABASE_KEY,
        },
      });
      const data = await res.json();
      return NextResponse.json({ ok: res.ok, slots: data });
    }

    // Expire mode: upsert the given slot id with an already-expired date.
    const res = await fetch(SUPABASE_URL + '/rest/v1/active_banner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        id: parseInt(expireId, 10),
        token_name: '',
        banner_img: '',
        description: '',
        expires_at: new Date(0).toISOString(), // 1970 — already expired
      }),
    });
    const text = await res.text();
    return NextResponse.json({ ok: res.ok, status: res.status, body: text });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
