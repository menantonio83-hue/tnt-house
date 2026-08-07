// Version 1.0 — app/risk-api/TryItWidget.tsx
//
// Landing-page "try it now" widget for the Risk-Data API — the anon
// trial step of the funnel: fingerprint (no email) -> 3 free checks ->
// upsell to the existing RiskApiSignupForm (email -> real 15/day key).
//
// Fingerprint strategy (explicit product decision, Бро 2026-08-08):
// browser fingerprint + localStorage, NOT IP-based. Built from a handful
// of stable navigator/screen properties, hashed client-side with
// crypto.subtle (SHA-256, built into every modern browser — no extra
// dependency like FingerprintJS needed for this friction-reduction use
// case, where the fingerprint is not a hard security boundary anyway,
// see app/api/v1/trial/check/route.ts's header). The resulting hash is
// cached in localStorage so it's stable across sessions/reloads even if
// a recomputation would drift slightly (e.g. a minor OS/browser update
// changing the UA string mid-trial) — first value wins for the life of
// that browser profile.
//
// Server is still the source of truth for the counter (Supabase
// anon_trials table via /api/v1/trial/check) — localStorage only carries
// the fingerprint itself, never the call count, so clearing/editing
// localStorage's counter can't be used to reset the quota (an attacker
// would have to get a fresh fingerprint hash past the server, not just
// edit a number).

'use client';

import { useState, useEffect } from 'react';
import { Loader2, Sparkles, ShieldAlert, ShieldCheck, ShieldX, Lock } from 'lucide-react';
import { useRiskApiLang } from './LangContext';

const FINGERPRINT_STORAGE_KEY = 'tnt_trial_fp';
const MINT_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // base58, Solana mint length range

type Status = 'idle' | 'loading' | 'success' | 'error' | 'limit';

interface TrialResult {
  mint: string;
  safety_score: number;
  insider_clusters: unknown[];
  mint_authority: string | null;
  freeze_authority: string | null;
  honeypot_risk: boolean | null;
  lp_locked: boolean | null;
  trial_calls_used: number;
  trial_calls_remaining: number;
}

// Stable-ish browser fingerprint, hashed client-side. Not a security
// boundary — a friction-reduction device only, see file header.
async function computeFingerprint(): Promise<string> {
  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    String(navigator.hardwareConcurrency || ''),
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  ].join('||');

  const encoded = new TextEncoder().encode(parts);
  const digest = await crypto.subtle.digest('SHA-256', encoded as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getFingerprint(): Promise<string> {
  const cached = typeof window !== 'undefined' ? localStorage.getItem(FINGERPRINT_STORAGE_KEY) : null;
  if (cached) return cached;

  const fresh = await computeFingerprint();
  try {
    localStorage.setItem(FINGERPRINT_STORAGE_KEY, fresh);
  } catch {
    // localStorage unavailable (private mode edge cases) — fingerprint
    // still works for this single request, just won't persist.
  }
  return fresh;
}

export default function TryItWidget() {
  const { t } = useRiskApiLang();
  const [mint, setMint] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<TrialResult | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  // Warm the fingerprint (and localStorage cache) on mount so the first
  // real click doesn't pay the crypto.subtle latency inline.
  useEffect(() => {
    getFingerprint().catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmed = mint.trim();
    if (!MINT_REGEX.test(trimmed)) {
      setErrorMsg(t.tryItInvalidMint);
      setStatus('error');
      return;
    }

    setStatus('loading');

    try {
      const fingerprint = await getFingerprint();
      const res = await fetch('/api/v1/trial/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint, mint: trimmed }),
      });
      const data = await res.json();

      if (res.status === 403 && typeof data.trial_calls_remaining === 'number') {
        setRemaining(0);
        setStatus('limit');
        return;
      }

      if (!res.ok) {
        setErrorMsg(data.error || t.tryItErrorGeneric);
        setStatus('error');
        return;
      }

      setResult(data as TrialResult);
      setRemaining(data.trial_calls_remaining ?? null);
      setStatus('success');
    } catch {
      setErrorMsg(t.tryItErrorGeneric);
      setStatus('error');
    }
  };

  const scrollToSignup = () => {
    document.getElementById('get-key')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="border-2 border-emerald-500/30 rounded-lg bg-slate-900/40 p-5 sm:p-6 backdrop-blur-md">
      <div className="flex items-center gap-2 text-base sm:text-lg font-black mb-1">
        <Sparkles size={16} className="text-emerald-400" />
        {t.tryItTitle}
      </div>
      <p className="text-xs text-slate-400 mb-4">{t.tryItSubtitle}</p>

      {status === 'limit' ? (
        <div className="border border-amber-500/30 rounded-lg bg-amber-500/5 p-4 flex items-start gap-3">
          <Lock size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-300 mb-1">{t.tryItLimitTitle}</p>
            <p className="text-xs text-slate-300 mb-3">{t.tryItLimitBody}</p>
            <button
              onClick={scrollToSignup}
              className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-4 py-2 rounded text-xs transition shadow-[0_0_15px_rgba(153,69,255,0.4)]"
            >
              {t.getFreeKeyBtn}
            </button>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              type="text"
              required
              value={mint}
              onChange={(e) => setMint(e.target.value)}
              placeholder={t.tryItPlaceholder}
              className="flex-1 bg-slate-950 border-2 border-emerald-500/30 rounded px-3 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none font-mono transition-colors"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-60 text-slate-950 font-black px-5 py-3 rounded text-sm transition shrink-0"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t.tryItLoading}
                </>
              ) : (
                t.tryItButton
              )}
            </button>
          </form>

          {status === 'error' && (
            <div className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-3 py-2 mb-3">
              {errorMsg}
            </div>
          )}

          {status === 'success' && result && (
            <div className="border border-purple-500/30 rounded-lg bg-black/40 p-4 space-y-2">
              <div className="flex items-center gap-2">
                {result.safety_score >= 70 ? (
                  <ShieldCheck size={18} className="text-emerald-400" />
                ) : result.safety_score >= 40 ? (
                  <ShieldAlert size={18} className="text-amber-400" />
                ) : (
                  <ShieldX size={18} className="text-red-400" />
                )}
                <span className="text-lg font-black text-white">{result.safety_score}/100</span>
                <span className="text-[11px] text-slate-400 font-mono truncate">{result.mint}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div>
                  Honeypot:{' '}
                  <span className="font-bold">
                    {result.honeypot_risk === null ? '—' : result.honeypot_risk ? '⚠️' : '✅'}
                  </span>
                </div>
                <div>
                  LP locked:{' '}
                  <span className="font-bold">
                    {result.lp_locked === null ? '—' : result.lp_locked ? '✅' : '⚠️'}
                  </span>
                </div>
                <div>
                  Insider clusters: <span className="font-bold">{result.insider_clusters?.length ?? 0}</span>
                </div>
                <div>
                  Mint authority:{' '}
                  <span className="font-bold">{result.mint_authority ? '⚠️' : '✅'}</span>
                </div>
              </div>
            </div>
          )}

          {remaining !== null && status !== 'error' && (
            <p className="text-[11px] text-slate-400 mt-3">{t.tryItRemaining.replace('{n}', String(remaining))}</p>
          )}
        </>
      )}
    </div>
  );
}
