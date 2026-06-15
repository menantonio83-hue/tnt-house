import { createClient } from '@supabase/supabase-js';
import { performFullAudit } from '@/lib/helius-client';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const ADMIN_WALLET = 'AZyzUySu6HP9ocJYhZECG5syycYNV6ubTQKyfB2mDWgG';
const MRDT_MINT = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
const BURN_ADDRESS = 'aaaay5rKt5GVdja2XJ83jnf8KPTxzsSoDhZwSKKKKEY';

const PRICING = { free: 0, basic: 10, 'fast-track': 40, vip: 120 };
let freeSubmissionsCount = 0;

export async function POST(request) {
  try {
    const body = await request.json();
    const { ca, projectName, description, creatorWallet, tier = 'basic', burnAmount } = body;

    if (!ca || !projectName || !description || !creatorWallet) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: existing } = await supabase.from('verified_tokens').select('id').eq('ca', ca).single();

    if (existing) {
      return Response.json({ error: 'Этот токен уже в нашей базе!' }, { status: 409 });
    }

    let price = PRICING[tier] || PRICING.basic;

    if (tier === 'free' || freeSubmissionsCount < 3) {
      price = 0;
      if (price === 0) freeSubmissionsCount++;
    }

    if (burnAmount && burnAmount > 0) {
      console.log(`🔥 BURN LOG: ${burnAmount} MRDT burned to ${BURN_ADDRESS}`);
      console.log(`📊 50% of ${tier} tier ($${price}) listing fee burned`);
      
      await supabase.from('burn_logs').insert([{
        burn_amount: burnAmount,
        tier: tier,
        submission_ca: ca,
        creator_wallet: creatorWallet,
        burn_address: BURN_ADDRESS,
        created_at: new Date().toISOString()
      }]).catch(err => console.log('Burn log error'));
    }

    const { data: submission, error: submitError } = await supabase.from('submissions').insert([{
      ca, project_name: projectName, description, creator_wallet: creatorWallet, tier, payment_amount: price, status: price === 0 ? 'auditing' : 'pending_payment'
    }]).select();

    if (submitError) {
      console.error('Submit error:', submitError);
      return Response.json({ error: 'Ошибка при создании заявки' }, { status: 500 });
    }

    const submissionId = submission[0].id;

    if (price === 0) {
      console.log(`🔍 Начинаем бесплатный аудит для: ${ca}`);
      performFullAudit(ca).then(auditResult => {
        supabase.from('submissions').update({
          security_score: auditResult.securityScore,
          audit_report: auditResult,
          status: 'pending_admin_review'
        }).eq('id', submissionId).then(() => {
          console.log(`✅ Аудит завершён для ${ca}`);
        });
      });
    }

    return Response.json({
      success: true,
      submissionId,
      projectName,
      tier,
      price,
      burnAmount,
      paymentRequired: price > 0,
      solanaPayUri: price > 0 ? generateSolanaPayUri(price, submissionId) : null,
      message: price === 0 ? 'Ваша заявка принята! Начинается проверка... 🔥 50% of future listings will be burned!' : `Требуется оплата: ${price} MRDT (50% будет сожжено). Отсканируйте QR или отправьте платёж.`
    });
  } catch (error) {
    console.error('POST /api/submit-audit Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get('submissionId');

    if (!submissionId) {
      return Response.json({ error: 'submissionId required' }, { status: 400 });
    }

    const { data, error } = await supabase.from('submissions').select('*').eq('id', submissionId).single();

    if (error) {
      return Response.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    return Response.json({
      success: true,
      submission: {
        id: data.id,
        projectName: data.project_name,
        status: data.status,
        securityScore: data.security_score,
        auditReport: data.audit_report,
        createdAt: data.created_at,
        approvedAt: data.approved_at
      }
    });
  } catch (error) {
    console.error('GET /api/submit-audit Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function generateSolanaPayUri(priceUsd, submissionId) {
  const mrdt_per_usd = 83333;
  const mrdt_amount = priceUsd * mrdt_per_usd;
  const uri = `solana:${ADMIN_WALLET}?amount=${mrdt_amount}&spl-token=${MRDT_MINT}&reference=${submissionId}&label=TNT%20House%20Listing`;
  return uri;
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { submissionId, transactionSignature } = body;

    if (!submissionId || !transactionSignature) {
      return Response.json({ error: 'submissionId and transactionSignature required' }, { status: 400 });
    }

    const { data: submission } = await supabase.from('submissions').select('*').eq('id', submissionId).single();

    if (!submission) {
      return Response.json({ error: 'Submission not found' }, { status: 404 });
    }

    const { error: updateError } = await supabase.from('submissions').update({
      payment_verified: true,
      payment_signature: transactionSignature,
      status: 'auditing'
    }).eq('id', submissionId);

    if (updateError) {
      return Response.json({ error: 'Failed to update submission' }, { status: 500 });
    }

    console.log(`🔍 Платёж подтвержден! Начинаем аудит для: ${submission.ca}`);
    performFullAudit(submission.ca).then(auditResult => {
      supabase.from('submissions').update({
        security_score: auditResult.securityScore,
        audit_report: auditResult,
        status: 'pending_admin_review'
      }).eq('id', submissionId);
    });

    return Response.json({ success: true, message: 'Платёж подтвержден! Начинается проверка...', submissionId });
  } catch (error) {
    console.error('PUT /api/submit-audit Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
