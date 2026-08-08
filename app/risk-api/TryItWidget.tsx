// Version 1.3 — app/risk-api/TryItWidget.tsx
//
// v1.3: card now shows all 18 fields the API actually returns, not
// just the original 10 — added hidden owner, permanent delegate,
// buy/sell tax, dev wallet %, token program, and contract renounced
// (the 6 new fields from token-risk-core.ts v1.5 / rugcheck-client.ts
// v1.3), plus a human-readable "Score capped by: ..." strip driven by
// the API's new dominant_cap field. This widget is the free-trial
// showcase for the paid API — it should demonstrate the full depth of
// what a real API key gets you, not a trimmed-down subset.
//
// Version 1.2 — app/risk-api/TryItWidget.tsx
//
// v1.2: Liquidity/24h volume rows now show muted "—" (not green) plus a
// one-line "no DEX pool data found for this mint" note when both are
// null, instead of a bare dash that reads like a loading/error state.
// null here means DexScreener has no pool for this mint (new/illiquid
// token, or genuinely no pair) — distinct from $0, which would mean a
// real pool with zero liquidity.
//
// Version 1.1 — app/risk-api/TryItWidget.tsx
//
// v1.1: result card redesigned to match Бро's reference layout — a
// branded "RISK-DATA API / tnt-audit.com" score card (big score +
// progress bar, then a row-by-row stat list: insider clusters, mint/
// freeze authority, honeypot, LP locked, top holder %, top-10 %,
// liquidity, 24h volume, 24h change), replacing the earlier compact
// 4-item grid — that version only surfaced 4 fields, this surfaces up
// to 10 whenever the underlying fetchTokenRisk() result has them.
// New StatRow helper renders each line; fields silently omitted when
// the API result doesn't include them (e.g. holder_distribution/market
// can be absent on a fetch partial-failure) rather than showing a
// placeholder for data we don't have.
//
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
import { Loader2, Sparkles, Lock } from 'lucide-react';
import { useRiskApiLang } from './LangContext';

const FINGERPRINT_STORAGE_KEY = 'tnt_trial_fp';
const MINT_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // base58, Solana mint length range

type Status = 'idle' | 'loading' | 'success' | 'error' | 'limit';

interface TrialResult {
  mint: string;
  safety_score: number;
  dominant_cap: string | null;
  insider_clusters: unknown[];
  mint_authority: { revoked: boolean; address: string | null } | null;
  freeze_authority: { revoked: boolean; address: string | null } | null;
  contract_renounced: boolean;
  honeypot_risk: boolean | null;
  lp_locked: { locked: boolean; percent: number } | null;
  rugged: boolean | null;
  jup_verified: boolean | null;
  hidden_owner: boolean | null;
  permanent_delegate: boolean | null;
  buy_tax_percent: number | null;
  sell_tax_percent: number | null;
  dev_wallet_percent: number | null;
  token_program: 'standard' | 'nonstandard' | null;
  holder_distribution?: {
    risk_level: string;
    largest_holder_percent: number;
    top10_percent: number;
    holder_count: number;
  };
  market?: {
    price_usd: number | null;
    liquidity_usd: number | null;
    volume_24h_usd: number | null;
    price_change_24h_percent: number | null;
    age_days: number | null;
  };
  trial_calls_used: number;
  trial_calls_remaining: number;
}

// Compact number formatting for market figures ($1.2K / $3.4M) — same
// spirit as the rest of the site's compact-currency displays, kept
// local here since this is the only place in this component that needs it.
function formatUsdCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

// Maps the API's dominant_cap reason codes (see lib/token-risk-core.ts
// v1.5's capsTriggered list) to short human-readable labels for the
// widget's "why is this score low" strip.
function formatDominantCap(reason: string): string {
  const labels: Record<string, string> = {
    rugged_confirmed: 'confirmed rug (RugCheck)',
    permanent_delegate: 'permanent delegate enabled',
    hidden_owner: 'hidden owner/proxy detected',
    high_tax: 'transfer tax > 10%',
    low_liquidity: 'liquidity under $500',
    top10_gt_90: 'top-10 holders > 90%',
    dev_wallet_gt_30: 'dev wallet > 30%',
    nonstandard_token_program: 'non-standard token program',
    top10_gt_80: 'top-10 holders > 80%',
    dev_wallet_gt_15: 'dev wallet > 15%',
    moderate_tax: 'transfer tax > 3%',
    holders_lt_20: 'fewer than 20 holders',
    dev_wallet_gt_5: 'dev wallet > 5%',
    age_lt_1d: 'token under 1 day old',
    age_lt_7d_thin_holders: 'token under 7 days old, few holders',
    age_lt_7d: 'token under 7 days old',
  };
  return labels[reason] ?? reason;
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
            <div className="border-2 border-purple-500/30 rounded-lg bg-slate-950 overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20 bg-slate-900/40">
                <span className="text-xs font-black text-purple-300 tracking-widest">RISK-DATA API</span>
                <span className="text-[10px] text-slate-500 font-mono">tnt-audit.com</span>
              </div>

              {/* Score */}
              <div className="px-4 pt-5 pb-4 text-center border-b border-purple-500/10">
                <div className="text-[10px] text-slate-500 tracking-widest mb-1">SAFETY SCORE</div>
                <div
                  className={
                    'text-5xl font-black mb-3 ' +
                    (result.safety_score >= 70
                      ? 'text-emerald-400'
                      : result.safety_score >= 40
                        ? 'text-amber-400'
                        : 'text-red-400')
                  }
                >
                  {result.safety_score}
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={
                      'h-full rounded-full ' +
                      (result.safety_score >= 70
                        ? 'bg-emerald-400'
                        : result.safety_score >= 40
                          ? 'bg-amber-400'
                          : 'bg-red-400')
                    }
                    style={{ width: `${Math.max(0, Math.min(100, result.safety_score))}%` }}
                  />
                </div>
              </div>

              {/* Row-by-row stats */}
              <div className="divide-y divide-purple-500/10 text-xs">
                <StatRow
                  label="Insider clusters"
                  value={result.insider_clusters?.length ?? 0}
                  valueClassName={(result.insider_clusters?.length ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'}
                  suffix={(result.insider_clusters?.length ?? 0) > 0 ? ' found' : ''}
                />
                <StatRow
                  label="Mint authority"
                  value={result.mint_authority?.revoked ? 'revoked ✓' : 'active ⚠️'}
                  valueClassName={result.mint_authority?.revoked ? 'text-emerald-400' : 'text-amber-400'}
                />
                <StatRow
                  label="Freeze authority"
                  value={result.freeze_authority?.revoked ? 'revoked ✓' : 'active ⚠️'}
                  valueClassName={result.freeze_authority?.revoked ? 'text-emerald-400' : 'text-amber-400'}
                />
                <StatRow
                  label="Honeypot"
                  value={result.honeypot_risk === null ? '—' : result.honeypot_risk ? 'risk ⚠️' : 'clear ✓'}
                  valueClassName={result.honeypot_risk ? 'text-red-400' : 'text-emerald-400'}
                />
                <StatRow
                  label="LP locked"
                  value={
                    result.lp_locked === null
                      ? '—'
                      : result.lp_locked.locked
                        ? `${result.lp_locked.percent.toFixed(0)}% ✓`
                        : 'no ⚠️'
                  }
                  valueClassName={result.lp_locked?.locked ? 'text-emerald-400' : 'text-amber-400'}
                />
                <StatRow
                  label="Hidden owner"
                  value={result.hidden_owner === null ? '—' : result.hidden_owner ? 'yes ⚠️' : 'no ✓'}
                  valueClassName={
                    result.hidden_owner === null
                      ? 'text-slate-500'
                      : result.hidden_owner
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                  }
                />
                <StatRow
                  label="Permanent delegate"
                  value={result.permanent_delegate === null ? '—' : result.permanent_delegate ? 'yes 🚨' : 'no ✓'}
                  valueClassName={
                    result.permanent_delegate === null
                      ? 'text-slate-500'
                      : result.permanent_delegate
                        ? 'text-red-400'
                        : 'text-emerald-400'
                  }
                />
                <StatRow
                  label="Buy/sell tax"
                  value={
                    result.buy_tax_percent === null && result.sell_tax_percent === null
                      ? '—'
                      : `${(result.buy_tax_percent ?? 0).toFixed(1)}% / ${(result.sell_tax_percent ?? 0).toFixed(1)}%`
                  }
                  valueClassName={
                    result.buy_tax_percent !== null && result.buy_tax_percent > 10
                      ? 'text-red-400'
                      : result.buy_tax_percent !== null && result.buy_tax_percent > 3
                        ? 'text-amber-400'
                        : 'text-slate-500'
                  }
                />
                <StatRow
                  label="Dev wallet"
                  value={result.dev_wallet_percent === null ? '—' : `${result.dev_wallet_percent.toFixed(1)}%`}
                  valueClassName={
                    result.dev_wallet_percent === null
                      ? 'text-slate-500'
                      : result.dev_wallet_percent > 15
                        ? 'text-red-400'
                        : result.dev_wallet_percent > 5
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                  }
                />
                <StatRow
                  label="Token program"
                  value={result.token_program === null ? '—' : result.token_program === 'standard' ? 'standard ✓' : 'nonstandard ⚠️'}
                  valueClassName={
                    result.token_program === 'standard'
                      ? 'text-emerald-400'
                      : result.token_program === 'nonstandard'
                        ? 'text-amber-400'
                        : 'text-slate-500'
                  }
                />
                <StatRow
                  label="Contract renounced"
                  value={result.contract_renounced ? 'yes ✓' : 'no ⚠️'}
                  valueClassName={result.contract_renounced ? 'text-emerald-400' : 'text-amber-400'}
                />
                {result.holder_distribution && (
                  <>
                    <StatRow label="Top holder" value={`${result.holder_distribution.largest_holder_percent.toFixed(1)}%`} />
                    <StatRow label="Top-10 holders" value={`${result.holder_distribution.top10_percent.toFixed(1)}%`} />
                  </>
                )}
                {result.market && (
                  <>
                    <StatRow
                      label="Liquidity"
                      value={formatUsdCompact(result.market.liquidity_usd)}
                      valueClassName={result.market.liquidity_usd === null ? 'text-slate-500' : 'text-emerald-400'}
                    />
                    <StatRow
                      label="24h volume"
                      value={formatUsdCompact(result.market.volume_24h_usd)}
                      valueClassName={result.market.volume_24h_usd === null ? 'text-slate-500' : 'text-emerald-400'}
                    />
                    {result.market.liquidity_usd === null && result.market.volume_24h_usd === null && (
                      <div className="px-4 py-2 text-[10px] text-slate-500 text-center">
                        no DEX pool data found for this mint
                      </div>
                    )}
                    {result.market.price_change_24h_percent !== null && (
                      <StatRow
                        label="24h change"
                        value={`${result.market.price_change_24h_percent >= 0 ? '+' : ''}${result.market.price_change_24h_percent.toFixed(1)}%`}
                        valueClassName={result.market.price_change_24h_percent >= 0 ? 'text-emerald-400' : 'text-red-400'}
                      />
                    )}
                  </>
                )}
              </div>

              {result.dominant_cap && (
                <div className="px-4 py-2.5 border-t border-amber-500/20 bg-amber-500/5">
                  <span className="text-[10px] text-amber-300">
                    ⚠️ Score capped by: {formatDominantCap(result.dominant_cap)}
                  </span>
                </div>
              )}

              <div className="px-4 py-2.5 text-center border-t border-purple-500/10">
                <span className="text-[10px] text-slate-600 font-mono">tnt-audit.com/risk-api</span>
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

// Single label/value line in the score card's stat list — small,
// reusable, and keeps the JSX above readable given how many rows the
// v1.1 layout now renders. suffix lets a row append e.g. " found"
// without forcing the caller to pre-format the whole string.
function StatRow({
  label,
  value,
  valueClassName = 'text-white',
  suffix = '',
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-slate-400">{label}</span>
      <span className={`font-bold ${valueClassName}`}>
        {value}
        {suffix}
      </span>
    </div>
  );
}
