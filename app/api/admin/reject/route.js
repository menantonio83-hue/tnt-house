import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pjtvjslcffuulsqxerpx.supabase.co',
  'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU'
);

// PUT /api/admin/reject
// Moved here from app/api/admin/route.js (v1.0) — that file only ever
// matched the exact path /api/admin, so the frontend's
// fetch('/api/admin/reject') was 404ing before the url.pathname.includes('/reject')
// check inside the old handler could ever run. Same logic, correct location.
export async function PUT(request) {
  try {
    const body = await request.json();
    const { submissionId, adminWallet, reason } = body;

    const ADMIN_WALLET = 'AZyzUySu6HP9ocJYhZECG5syycYNV6ubTQKyfB2mDWgG';
    if (adminWallet !== ADMIN_WALLET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: submission } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (!submission) {
      return Response.json({ error: 'Submission not found' }, { status: 404 });
    }

    await supabase.from('submissions').update({
      status: 'rejected',
      rejection_reason: reason
    }).eq('id', submissionId);

    await supabase.from('admin_logs').insert([{
      admin_wallet: adminWallet,
      action: 'reject',
      submission_id: submissionId,
      token_ca: submission.ca,
      old_status: 'pending_admin_review',
      new_status: 'rejected',
      notes: reason
    }]);

    return Response.json({ success: true, message: 'Token rejected' });
  } catch (error) {
    console.error('Reject error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
