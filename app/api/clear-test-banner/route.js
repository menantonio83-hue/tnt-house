import { NextResponse } from 'next/server';

// One-time utility route: deletes the current active_banner row (id=1)
// so a test/placeholder banner can be cleared without touching Supabase
// directly. Safe to delete this file after use.

const SUPABASE_URL = 'https://pjtvjslcffuulsqxerpx.supabase.co';
const SUPABASE_KEY = 'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU';

export async function GET() {
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/active_banner?id=eq.1', {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        Prefer: 'return=representation',
      },
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
