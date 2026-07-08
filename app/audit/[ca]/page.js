// app/audit/[ca]/page.js
// Version 1.0
//
// WHY THIS EXISTS: the "Copy widget code" button in the audit success
// modal generates an embeddable badge that links to
// https://tnt-audit.com/audit/{CA} — this is that destination. Also the
// href baked into the downloadable branded logo isn't needed (the image
// itself has no link), but the widget's <a href> and any manual sharing
// of a token's audit both land here.
//
// Server component on purpose: renders straight from Supabase with no
// client JS needed, so it works as a real link preview when shared on
// Telegram/X (see generateMetadata below), and loads instantly.

export const dynamic = 'force-dynamic';

const SUPABASE_URL = 'https://pjtvjslcffuulsqxerpx.supabase.co';
const SUPABASE_KEY = 'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU';

async function getToken(ca) {
  try {
    const res = await fetch(
      SUPABASE_URL +
        '/rest/v1/listed_tokens?select=*&ca=eq.' +
        encodeURIComponent(ca) +
        '&order=created_at.desc&limit=1',
      {
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data && data[0] ? data[0] : null;
  } catch (e) {
    return null;
  }
}

function getScoreStyle(score) {
  if (score >= 90) {
    return {
      text: 'text-emerald-400',
      border: 'border-emerald-500/50',
      glow: 'shadow-[0_0_40px_rgba(16,185,129,0.5)]',
    };
  }
  if (score >= 50) {
    return {
      text: 'text-yellow-400',
      border: 'border-yellow-500/50',
      glow: 'shadow-[0_0_40px_rgba(234,179,8,0.4)]',
    };
  }
  return {
    text: 'text-red-400',
    border: 'border-red-500/50',
    glow: 'shadow-[0_0_40px_rgba(239,68,68,0.5)]',
  };
}

export async function generateMetadata({ params }) {
  const token = await getToken(params.ca);
  if (!token) {
    return { title: 'Audit Not Found — TNT House' };
  }
  const title = '$' + token.symbol + ' — TNT House Audit Report';
  const description =
    token.name + ' scored ' + token.score + '/100 on the TNT House AI security audit.';
  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      images: token.logo_url ? [token.logo_url] : [],
    },
  };
}

export default async function AuditReportPage({ params }) {
  const token = await getToken(params.ca);

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-mono flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-xl font-black text-purple-400 mb-2">Audit Not Found</h1>
          <p className="text-slate-400 text-sm mb-6">
            This contract address hasn't been audited by TNT House yet.
          </p>
          <a
            href="/"
            className="inline-block bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-6 py-3 rounded text-sm transition"
          >
            ← Back to TNT House
          </a>
        </div>
      </div>
    );
  }

  const style = getScoreStyle(token.score || 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono p-6 flex items-center justify-center">
      <div className="max-w-md w-full border-2 border-purple-500/40 rounded-2xl bg-slate-900/40 backdrop-blur-md p-8 text-center shadow-[0_0_30px_rgba(153,69,255,0.2)]">
        <a
          href="/"
          className="inline-flex items-center gap-2 mb-6 text-purple-400 font-black text-sm"
        >
          🧨 TNT HOUSE
        </a>

        {token.logo_url && (
          <img
            src={token.logo_url}
            alt={token.name}
            className="w-20 h-20 rounded-full mx-auto mb-4 object-cover border-2 border-purple-500/40"
          />
        )}

        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-1">
          ${token.symbol}
        </h1>
        <p className="text-slate-400 text-xs mb-6">{token.name}</p>

        <div
          className={
            'inline-flex flex-col items-center justify-center w-32 h-32 rounded-full border-4 mb-6 ' +
            style.border +
            ' ' +
            style.glow
          }
        >
          <div className={'text-4xl font-black ' + style.text}>{token.score}</div>
          <div className="text-[10px] text-slate-400 tracking-widest">/ 100</div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-left text-xs mb-6">
          <div className="bg-slate-950 border border-purple-500/20 rounded p-2">
            <div className="text-slate-500 text-[10px]">Mint Authority</div>
            <div
              className={
                token.mint_authority && token.mint_authority.indexOf('✓') !== -1
                  ? 'text-emerald-400'
                  : 'text-slate-300'
              }
            >
              {token.mint_authority || '—'}
            </div>
          </div>
          <div className="bg-slate-950 border border-purple-500/20 rounded p-2">
            <div className="text-slate-500 text-[10px]">Freeze Authority</div>
            <div
              className={
                token.freeze_authority && token.freeze_authority.indexOf('✓') !== -1
                  ? 'text-emerald-400'
                  : 'text-slate-300'
              }
            >
              {token.freeze_authority || '—'}
            </div>
          </div>
          <div className="bg-slate-950 border border-purple-500/20 rounded p-2">
            <div className="text-slate-500 text-[10px]">Honeypot</div>
            <div className="text-slate-300">{token.is_honeypot || '—'}</div>
          </div>
          <div className="bg-slate-950 border border-purple-500/20 rounded p-2">
            <div className="text-slate-500 text-[10px]">Holders</div>
            <div className="text-slate-300">
              {token.holder_count !== null && token.holder_count !== undefined
                ? token.holder_count
                : '—'}
            </div>
          </div>
        </div>

        <p className="text-slate-500 text-[10px] mb-4 break-all">CA: {token.ca}</p>

        <div className="flex gap-2">
          <a
            href={token.dex_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2.5 rounded transition"
          >
            View on DexScreener
          </a>
          <a
            href="/"
            className="flex-1 bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 text-xs font-black py-2.5 rounded transition"
          >
            Audit Your Token →
          </a>
        </div>
      </div>
    </div>
  );
}
