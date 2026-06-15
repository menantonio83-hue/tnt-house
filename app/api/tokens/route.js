import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'newest';
    const limit = parseInt(searchParams.get('limit')) || 50;

    let query = supabase.from('verified_tokens').select('*').eq('status', 'approved');

    switch (sort) {
      case 'security':
        query = query.order('security_score', { ascending: false });
        break;
      case 'volume':
        query = query.order('volume24h', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
    }

    query = query.limit(limit);
    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return Response.json({ error: 'Ошибка получения токенов' }, { status: 500 });
    }

    const enrichedTokens = (data || []).map(token => {
      let statusColor = 'red';
      let statusLabel = '🔴 High Risk';

      if (token.security_score >= 75) {
        statusColor = 'green';
        statusLabel = '🟢 Safe';
      } else if (token.security_score >= 50) {
        statusColor = 'gold';
        statusLabel = '🟡 Caution';
      }

      return { ...token, statusColor, statusLabel };
    });

    const mrdt = enrichedTokens.find(t => t.symbol === 'MRDT');
    if (mrdt) {
      enrichedTokens.sort((a, b) => {
        if (a.symbol === 'MRDT') return -1;
        if (b.symbol === 'MRDT') return 1;
        return 0;
      });
    }

    return Response.json({ success: true, count: enrichedTokens.length, tokens: enrichedTokens, mrdt: mrdt || null });
  } catch (error) {
    console.error('/api/tokens Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, symbol, ca, price, liquidity, volume24h, priceChange24h, security_score, audit_report, adminWallet } = body;

    const ADMIN_WALLET = 'AZyzUySu6HP9ocJYhZECG5syycYNV6ubTQKyfB2mDWgG';
    if (adminWallet !== ADMIN_WALLET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!name || !symbol || !ca || security_score === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase.from('verified_tokens').insert([{
      name, symbol, ca, price, liquidity, volume24h, priceChange24h, security_score, audit_report, status: 'approved'
    }]).select();

    if (error) {
      console.error('Insert error:', error);
      return Response.json({ error: 'Ошибка при добавлении токена' }, { status: 500 });
    }

    return Response.json({ success: true, token: data[0] });
  } catch (error) {
    console.error('POST /api/tokens Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}