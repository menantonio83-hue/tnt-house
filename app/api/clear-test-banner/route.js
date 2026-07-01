import { NextResponse } from 'next/server';

// One-time utility route: expires the current active_banner row (id=1)
// so a test/placeholder banner stops showing. Uses the same upsert path
// (POST + merge-duplicates) that the site's normal banner-purchase flow
// already uses successfully, since a plain DELETE is silently blocked by
// Supabase RLS policies for the public/anon key. Safe to delete this file
// after use.

const SUPABASE_URL = 'https://pjtvjslcffuulsqxerpx.supabase.co';
const SUPABASE_KEY = 'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU';

export async function GET() {
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/active_banner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        id: 1,
        token_name: '',
        banner_img: '',
        description: '',
        expires_at: new Date(0).toISOString(), // 1970 — already expired
      }),
    });
    const text = await res.text();
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      body: text,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
