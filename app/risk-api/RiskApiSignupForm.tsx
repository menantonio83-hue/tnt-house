// Version 5.5 — app/risk-api/RiskApiSignupForm.tsx
//
// v5.5: wired up for the 7-language i18n system (see app/risk-api/
// i18n.ts, LangContext.tsx) — static UI copy now comes from
// useRiskApiLang()'s `t` object. Server-generated error messages (from
// /api/v1/signup responses) stay in English, untranslated — same scope
// limitation as the rest of this pass.
//
// v5.4: fixed stale "100 requests/day" copy under the signup button —
// the free tier limit was lowered to 15/day earlier the same day
// (lib/billing-pricing.ts's FREE_DAILY_LIMIT), but this string wasn't
// updated at the time, creating a mismatch with the correct "15 req/day"
// already shown above in the Limits & pricing section on the same page.

'use client';

import { useState } from 'react';
import { Loader2, KeyRound, AlertTriangle } from 'lucide-react';
import CopyButton from './CopyButton';
import { useRiskApiLang } from './LangContext';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface IssuedKey {
  api_key: string;
  daily_limit: number;
}

export default function RiskApiSignupForm() {
  const { t } = useRiskApiLang();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [issuedKey, setIssuedKey] = useState<IssuedKey | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/v1/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong. Try again.');
        setStatus('error');
        return;
      }

      setIssuedKey({ api_key: data.api_key, daily_limit: data.daily_limit });
      setStatus('success');
    } catch {
      setErrorMsg('Network error — check your connection and try again.');
      setStatus('error');
    }
  };

  if (status === 'success' && issuedKey) {
    return (
      <div className="border-2 border-emerald-500/40 rounded-lg bg-slate-950 p-4 sm:p-5 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-3">
          <KeyRound size={16} />
          {t.signupReadyTitle}
        </div>

        <div className="flex items-center gap-2 bg-black border border-purple-500/30 rounded px-3 py-2.5 mb-3">
          <code className="text-[11px] sm:text-xs text-purple-300 break-all flex-1 font-mono">
            {issuedKey.api_key}
          </code>
          <CopyButton text={issuedKey.api_key} label={t.copyLabel} />
        </div>

        <div className="flex items-start gap-2 text-[11px] text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded px-3 py-2">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>
            {t.signupWarningPrefix} {issuedKey.daily_limit} {t.signupWarningSuffix}
          </span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          className="flex-1 bg-slate-950 border-2 border-purple-500/40 rounded px-3 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none font-mono shadow-[0_0_15px_rgba(153,69,255,0.15)] transition-colors"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 disabled:opacity-60 text-slate-950 font-black px-5 py-3 rounded text-sm transition shadow-[0_0_15px_rgba(153,69,255,0.4)] shrink-0"
        >
          {status === 'loading' ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t.generatingText}
            </>
          ) : (
            t.getFreeKeyBtn
          )}
        </button>
      </div>

      {status === 'error' && (
        <div className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-3 py-2">
          {errorMsg}
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        {t.freeTierNote}
      </p>
    </form>
  );
}
