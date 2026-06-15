import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export async function GET(request) {
  try {
    const { data, error } = await supabase.from('submissions').select('*').eq('status', 'pending_admin_review').order('created_at', { ascending: false });

    if (error) throw error;

    return Response.json({ success: true, submissions: data || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const url = new URL(request.url);
  
  if (url.pathname.includes('/approve')) {
    try {
      const body = await request.json();
      const { submissionId, adminWallet, auditData } = body;

      const ADMIN_WALLET = 'AZyzUySu6HP9ocJYhZECG5syycYNV6ubTQKyfB2mDWgG';
      if (adminWallet !== ADMIN_WALLET) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data: submission } = await supabase.from('submissions').select('*').eq('id', submissionId).single();

      if (!submission) {
        return Response.json({ error: 'Submission not found' }, { status: 404 });
      }

      const { error: insertError } = await supabase.from('verified_tokens').insert([{
        name: submission.project_name,
        symbol: submission.ca.slice(0, 4).toUpperCase(),
        ca: submission.ca,
        security_score: submission.security_score,
        audit_report: auditData,
        status: 'approved',
        mint_authority: auditData?.checks?.mintAuthority?.revoked ? null : 'active',
        freeze_authority: auditData?.checks?.freezeAuthority?.revoked ? null : 'active',
        top_holders: auditData?.checks?.holderDistribution?.topHolders
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
  
  return Response.json({ error: 'Not found' }, { status: 404 });
}

export async function PUT(request) {
  const url = new URL(request.url);
  
  if (url.pathname.includes('/reject')) {
    try {
      const body = await request.json();
      const { submissionId, adminWallet, reason } = body;

      const ADMIN_WALLET = 'AZyzUySu6HP9ocJYhZECG5syycYNV6ubTQKyfB2mDWgG';
      if (adminWallet !== ADMIN_WALLET) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data: submission } = await supabase.from('submissions').select('*').eq('id', submissionId).single();

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

  return Response.json({ error: 'Not found' }, { status: 404 });
}