import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pjtvjslcffuulsqxerpx.supabase.co',
  'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU'
);

// POST /api/admin/approve
// Moved here from app/api/admin/route.js (v1.0) — that file only ever
// matched the exact path /api/admin, so the frontend's
// fetch('/api/admin/approve') was 404ing before the url.pathname.includes('/approve')
// check inside the old handler could ever run. Same logic, correct location.
export async function POST(request) {
  try {
    const body = await request.json();
    const { submissionId, adminWallet, auditData } = body;

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

    // auditData is the audit_report produced by performFullAudit(). Its
    // dbFields object already matches verified_tokens column names — spread
    // it directly instead of hand-picking a few fields.
    const dbFields = auditData?.dbFields || {};

    const { error: insertError } = await supabase.from('verified_tokens').insert([{
      name: submission.project_name,
      symbol: submission.ca.slice(0, 4).toUpperCase(),
      ca: submission.ca,
      security_score: submission.security_score,
      audit_report: auditData,
      status: 'approved',
      top_holders: auditData?.checks?.holderDistribution?.topHolders,
      ...dbFields,
    }]);

    if (insertError && !insertError.message.includes('duplicate')) {
      throw insertError;
    }

    await supabase.from('submissions').update({
      status: 'approved',
      approved_at: new Date().toISOString()
    }).eq('id', submissionId);

    await supabase.from('admin_logs').insert([{
      admin_wallet: adminWallet,
      action: 'approve',
      submission_id: submissionId,
      token_ca: submission.ca,
      old_status: 'pending_admin_review',
      new_status: 'approved'
    }]);

    return Response.json({ success: true, message: 'Token approved and published' });
  } catch (error) {
    console.error('Approve error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
