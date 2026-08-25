import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pjtvjslcffuulsqxerpx.supabase.co',
  'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU'
);

// GET /api/admin/pending
// Moved here from app/api/admin/route.js (v1.0) — that file only ever
// matched the exact path /api/admin, so the frontend's fetch('/api/admin/pending')
// was 404ing before this handler could ever run. Same logic, correct location.
export async function GET(request) {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('status', 'pending_admin_review')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return Response.json({ success: true, submissions: data || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
