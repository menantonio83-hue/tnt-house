import { performFullAudit } from '@/lib/helius-client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export async function POST(request) {
  try {
    const body = await request.json();
    const { ca, submissionId, projectName, description, tier } = body;

    if (!ca) {
      return Response.json({ error: 'Contract Address (CA) требуется' }, { status: 400 });
    }

    console.log(`🔍 Начинаем аудит для: ${ca}`);
    const auditResult = await performFullAudit(ca);

    if (auditResult.securityScore !== undefined) {
      if (submissionId) {
        await supabase.from('submissions').update({
          security_score: auditResult.securityScore,
          audit_report: auditResult,
          status: 'pending_admin_review'
        }).eq('id', submissionId);
      }

      console.log(`✅ Аудит завершён. Score: ${auditResult.securityScore}`);
      return Response.json({ success: true, auditResult, savedToDatabase: !!submissionId });
    } else {
      return Response.json({ error: 'Ошибка при выполнении аудита', details: auditResult }, { status: 500 });
    }
  } catch (error) {
    console.error('API Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ca = searchParams.get('ca');

    if (!ca) {
      return Response.json({ error: 'CA параметр требуется' }, { status: 400 });
    }

    const { data: existing } = await supabase.from('audit_results').select('*').eq('ca', ca).single();

    if (existing) {
      return Response.json({ cached: true, auditResult: existing });
    }

    const auditResult = await performFullAudit(ca);
    return Response.json({ cached: false, auditResult });
  } catch (error) {
    console.error('GET /api/audit Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}