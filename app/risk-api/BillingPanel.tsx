// Version 8.9 — app/risk-api/BillingPanel.tsx
//
// v8.9: Phantom's link switched from a bare https universal link to an
// explicit Android intent:// URI — root cause confirmed via controlled
// real-device A/B testing (same link, same device, worked in a
// Chromium-based in-app browser, failed in Samsung Internet). See the
// full writeup in openWalletInAppBrowser's comment below.
//
// Version 8.8 — app/risk-api/BillingPanel.tsx
//
// v8.8: found the actual remaining divergence from app/page.js after
// v8.7's "verbatim copy" of openWalletInAppBrowser turned out to still
// not fix the reported issue — traced through the ENTIRE flow (not just
// that one function) and found handlePayNow started polling
// verify-payment (its own fetch()) in the same tick as the wallet
// navigation, with no gap. app/page.js's equivalent has a multi-second
// gap here for free (it awaits a real audit computation before its own
// polling starts). Added PRE_POLL_DELAY_MS to reproduce that same
// breathing room instead of racing our own outgoing request against the
// pending navigation. See the constant's comment and handlePayNow below.
//
// Version 8.7 — app/risk-api/BillingPanel.tsx
//
// v8.7: after two independent attempts at "fixing" Phantom's link here
// (v8.5's undocumented native scheme, v8.6's docs-required-but-
// unproven `ref` param) both diverged from app/page.js's own
// openWalletInAppBrowser — the one version of this logic with an
// actual (if imperfect) production track record on this exact site —
// openWalletInAppBrowser is now a verbatim copy of that function
// (lines 2472-2483 there) instead of a third independent
// reimplementation. See its comment below for the full reasoning.
// Verified the two functions now produce byte-identical output for
// both wallets via an isolated test.
//
// Version 8.6 — app/risk-api/BillingPanel.tsx
//
// v8.6: v8.5's phantom:// native-scheme attempt made things WORSE in
// practice — user report showed it launching Phantom to its normal
// home screen (balance/token list) instead of navigating anywhere,
// because that scheme/path isn't a documented Phantom route (see
// openWalletInAppBrowser's updated comment below for the full story,
// backed by Phantom's official docs this time instead of another
// guess). Reverted the native scheme; the actual fix is a missing
// required `ref` query param on the https link.
//
// Version 8.5 — app/risk-api/BillingPanel.tsx
//
// v8.5: fixed a reported bug — "Pay Now" for Phantom sometimes opened
// phantom.com/download (Phantom's marketing page) instead of the app,
// even with Phantom installed. Same historically-reproducible failure
// this project's own git history already recorded for the bare
// https://phantom.app/ul/browse/ universal link (see openWalletInAppBrowser's
// comment below for the full history). Fixed by applying the exact
// native-scheme-first pattern already proven for the identical Solflare
// issue — no new/untested approach.
//
// Version 8.4 — app/risk-api/BillingPanel.tsx
//
// v8.4: create-invoice can now return 503 with currency_unavailable
// (see lib/billing-pricing.ts's version note — this is the fix for a
// real MRDT overcharge bug). That specific failure sends the user back
// to the currency picker with an inline explanation instead of the
// generic error screen, which would otherwise force re-entering the
// API key for a problem that has nothing to do with the key.
//
// v7.17: startPolling now sends `api_key` alongside `payment_id` on
// every verify-payment poll — that route started requiring it (see its
// own version note) so only the invoice's owner can trigger/observe its
// confirmation status.
//
// Reuses the SAME payment execution page (app/pay/page.js, unmodified)
// and the SAME visual language for currency/wallet selection as the
// site's existing audit/banner payment modals in app/page.js — the
// small inline SVGs below (SOL logo, Solflare "S" mark) are copied from
// there verbatim for visual consistency, since the existing code
// doesn't factor them out into an importable component.
//
// This does NOT reuse app/page.js's handleConfirmPayment/
// startPaymentVerification functions directly (they're closures tied to
// audit/banner-specific state, not exported) — instead it calls this
// feature's own app/api/v1/billing/* endpoints, which follow the exact
// same pattern (create invoice -> open /pay -> poll for confirmation).
//
// Flow: enter API key -> pick subscription or top-up -> pick currency
// -> pick wallet -> confirm invoice -> /pay opens inside the wallet's
// in-app browser and signs/sends -> poll for confirmation -> show result.

'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, KeyRound, CreditCard, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

type Step = 'enter-key' | 'pick-tier' | 'pick-currency' | 'pick-wallet' | 'invoice' | 'paying' | 'verifying' | 'success' | 'error';
type Kind = 'subscription' | 'topup';
type Currency = 'MRDT' | 'SOL' | 'USDC';
type Wallet = 'Phantom' | 'Solflare';

interface InvoiceResponse {
  payment_id: string;
  kind: Kind;
  currency: Currency;
  usd_amount: number;
  pay_amount: number;
  pay_amount_formatted: string;
  wallet_address: string;
  label: string;
}

interface StatusResponse {
  tier: string;
  credit_balance_usd: number;
  subscription: { active: boolean; expires_at?: string; calls_used_this_cycle?: number; monthly_quota?: number };
  free_tier_daily_limit: number;
}

const SITE_URL = 'https://tnt-audit.com';
const VERIFY_TIMEOUT_MS = 15 * 60 * 1000;
const POLL_INTERVAL_MS = 4000;
// Real, traced timing divergence from app/page.js's equivalent flow
// (not a guess): there, openWalletInAppBrowser is immediately followed
// by `await runAuditAndSave(...)` — a genuinely slow async operation —
// and its own verification polling (startPaymentVerification) only
// starts AFTER that resolves, several seconds later. That gives the
// browser an uncontested window to hand off to the wallet app's
// Intent/universal-link resolution before the page fires off any more
// network activity of its own. This file had no such gap: startPolling()
// (and its immediate fetch()) used to run in the same tick as
// openWalletInAppBrowser(), with nothing in between. Delaying the first
// poll (in handlePayNow, below) reproduces the same breathing room
// app/page.js gets for free, instead of racing our own outgoing request
// against the pending navigation.
const PRE_POLL_DELAY_MS = 2000;

// Version 8.10 — app/risk-api/BillingPanel.tsx
//
// v8.10: Solflare's link switched from an undocumented
// `solflare://v1/browse/` native-scheme attempt to the same intent://
// mechanism just proven for Phantom — that native scheme was never
// actually documented by Solflare for the Browse method (confirmed via
// their official docs), the same mistake already found and fixed for
// Phantom in v8.9. Reported symptom: with Phantom fully closed
// beforehand (controlled test), tapping Solflare still opened Phantom
// instead. Phantom's own branch is completely untouched. See
// openWalletInAppBrowser's comment below for the full writeup.
//
// Version 8.9 — app/risk-api/BillingPanel.tsx (this comment block)
//
// v8.9: found the actual root cause of the Phantom "opens download page
// / opens home screen" failures via controlled real-device testing —
// it's the BROWSER, not this code. The exact same bare
// https://phantom.app/ul/browse/<url> link (byte-identical to
// app/page.js's proven version, verified) failed in Samsung Internet
// but succeeded in a Chromium-based in-app browser (Twitter's), on the
// SAME device, SAME wallet, SAME main site — a controlled A/B the
// person ran directly. https universal links depend on the BROWSER
// correctly querying/honoring Android's Digital Asset Link verification
// for phantom.app; that's a heuristic, and it demonstrably varies
// across Android browsers.
//
// Fix: Phantom's branch now uses an explicit Android `intent://` URI
// instead of a bare https link — a fundamentally different mechanism,
// not another guess at a URL format. intent:// is a direct instruction
// to Android ("launch package app.phantom for this https URL, no
// heuristics involved"), parsed natively by the Chromium engine itself
// (which Samsung Internet is also built on) rather than depending on
// browser-specific App Link verification behavior. Falls back to the
// EXACT SAME bare https link (unchanged) via `S.browser_fallback_url`
// if intent:// somehow isn't parsed — zero regression risk on browsers
// where the old link already worked. Phantom's Android package ID
// (app.phantom) confirmed via an independent source (AppBrain's app
// catalog), not assumed.
//
// Solflare's branch is untouched — its native `solflare://v1/browse/`
// scheme-first attempt is architecturally already the same category of
// fix (asking Android directly via a scheme, not relying on https App
// Link heuristics), and there's no confirmed failure report for it to
// justify touching working code again.
//
// --- prior history (v8.7's verbatim-copy rationale) ---
// This function was, until this version, a verbatim copy of
// app/page.js's openWalletInAppBrowser (lines 2472-2483 there) for
// Phantom, after two earlier independent "fixes" here (an undocumented
// native scheme, then a docs-required `ref` param) both diverged from
// the one version with an actual (if imperfect) production track
// record. That verbatim copy was the right call at the time — it
// proved the code itself wasn't the problem, which is exactly what let
// this round correctly diagnose the real cause as browser-level instead
// of chasing a fourth independent guess at the URL/link format itself.
//
// This file does NOT modify app/page.js — if the same intent:// fix is
// wanted there too (now that the root cause is confirmed, not guessed),
// that's a decision to make separately for that shared file.
function openWalletInAppBrowser(payUrl: string, wallet: Wallet) {
  const encoded = encodeURIComponent(payUrl);
  const ref = encodeURIComponent(SITE_URL);
  if (wallet === 'Solflare') {
    // The prior `solflare://v1/browse/` attempt was the same category of
    // mistake already found and corrected for Phantom: Solflare's own
    // official Browse docs (docs.solflare.com/solflare/technical/
    // deeplinks/other-methods/browse) document ONLY the https universal
    // link for this method — no native-scheme equivalent — same as
    // Phantom's Browse docs. Reported symptom (fully-closed-Phantom
    // controlled test, still opened Phantom instead of Solflare when
    // Solflare was tapped) is consistent with that undocumented scheme
    // resolving somewhere unintended rather than doing nothing safely.
    // Switched to the same intent:// mechanism just confirmed working
    // for Phantom via real-device testing, using Solflare's Android
    // package (com.solflare.mobile, confirmed via Google Play's own
    // URL). Base path + params match the documented https URL structure
    // exactly (https://solflare.com/ul/v1/browse/<url>?ref=<ref>).
    const httpsFallback = 'https://solflare.com/ul/v1/browse/' + encoded + '?ref=' + ref;
    window.location.href =
      'intent://solflare.com/ul/v1/browse/' + encoded + '?ref=' + ref +
      '#Intent;scheme=https;package=com.solflare.mobile;S.browser_fallback_url=' +
      encodeURIComponent(httpsFallback) + ';end;';
  } else {
    // Phantom — untouched, confirmed working via real-device testing.
    const httpsFallback = 'https://phantom.app/ul/browse/' + encoded;
    window.location.href =
      'intent://phantom.app/ul/browse/' + encoded +
      '#Intent;scheme=https;package=app.phantom;S.browser_fallback_url=' +
      encodeURIComponent(httpsFallback) + ';end;';
  }
}

export default function BillingPanel() {
  const [apiKey, setApiKey] = useState('');
  const [step, setStep] = useState<Step>('enter-key');
  const [kind, setKind] = useState<Kind>('subscription');
  const [topupAmount, setTopupAmount] = useState('10');
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [invoice, setInvoice] = useState<InvoiceResponse | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successResult, setSuccessResult] = useState<any>(null);
  const [verifyAttempts, setVerifyAttempts] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const fetchStatus = async (key: string) => {
    try {
      const res = await fetch('/api/v1/billing/status', {
        headers: { Authorization: 'Bearer ' + key },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Invalid API key');
        setStep('error');
        return;
      }
      setStatus(data);
      setStep('pick-tier');
    } catch {
      setErrorMsg('Network error — check your connection and try again.');
      setStep('error');
    }
  };

  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    fetchStatus(apiKey.trim());
  };

  const handlePickTier = (k: Kind) => {
    setKind(k);
    setStep('pick-currency');
  };

  const handlePickCurrency = (c: Currency) => {
    setCurrency(c);
    setErrorMsg('');
    setStep('pick-wallet');
  };

  const handlePickWallet = async (w: Wallet) => {
    setWallet(w);
    setErrorMsg('');
    try {
      const body: Record<string, unknown> = { api_key: apiKey.trim(), kind, currency };
      if (kind === 'topup') body.usd_amount = parseFloat(topupAmount);

      const res = await fetch('/api/v1/billing/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.currency_unavailable) {
          // Don't dead-end into the generic error screen (which resets
          // to re-entering the API key) — send the user straight back
          // to picking a different currency, with the reason visible.
          setErrorMsg(data.error || `${currency} is temporarily unavailable`);
          setStep('pick-currency');
          return;
        }
        setErrorMsg(data.error || 'Could not create invoice');
        setStep('error');
        return;
      }
      setInvoice(data);
      setStep('invoice');
    } catch {
      setErrorMsg('Network error — check your connection and try again.');
      setStep('error');
    }
  };

  const handlePayNow = () => {
    if (!invoice || !wallet) return;
    const payUrl =
      window.location.origin +
      '/pay?amount=' + encodeURIComponent(invoice.pay_amount) +
      '&method=' + encodeURIComponent(invoice.currency) +
      '&label=' + encodeURIComponent(invoice.label) +
      '&wallet=' + encodeURIComponent(wallet);

    openWalletInAppBrowser(payUrl, wallet);
    setStep('verifying');
    startedAtRef.current = Date.now();
    setVerifyAttempts(0);
    setTimeout(() => {
      startPolling(invoice.payment_id);
    }, PRE_POLL_DELAY_MS);
  };

  const startPolling = (paymentId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    const attempt = async () => {
      setVerifyAttempts((n) => n + 1);
      try {
        const res = await fetch('/api/v1/billing/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_id: paymentId, api_key: apiKey.trim() }),
        });
        const data = await res.json();
        if (data.verified) {
          if (pollRef.current) clearInterval(pollRef.current);
          setSuccessResult(data);
          setStep('success');
          return;
        }
        if (data.expired) {
          if (pollRef.current) clearInterval(pollRef.current);
          setErrorMsg(data.reason || 'This invoice expired before payment was detected. Please create a new one.');
          setStep('error');
          return;
        }
      } catch {
        // transient network error during polling — next tick retries
      }
      if (Date.now() - startedAtRef.current > VERIFY_TIMEOUT_MS) {
        if (pollRef.current) clearInterval(pollRef.current);
        setErrorMsg('Payment not detected within 15 minutes. If you paid, contact us in Telegram with your tx signature.');
        setStep('error');
      }
    };

    attempt();
    pollRef.current = setInterval(attempt, POLL_INTERVAL_MS);
  };

  const reset = () => {
    setStep('pick-tier');
    setCurrency(null);
    setWallet(null);
    setInvoice(null);
    setErrorMsg('');
    setSuccessResult(null);
  };

  const buttonBase =
    'rounded-xl p-4 text-center transition group border-2';

  return (
    <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-5 sm:p-8 backdrop-blur-md">
      <div className="flex items-center gap-2 text-lg font-black mb-1">
        <CreditCard size={16} className="text-emerald-400" />
        Billing
      </div>
      <p className="text-xs text-slate-400 mb-5">
        Subscribe for 1000 calls/30 days, or top up pay-per-call credits. Paid in $MRDT / SOL / USDC via
        Solana Pay — same flow as the rest of TNT House.
      </p>

      {step === 'enter-key' && (
        <form onSubmit={handleKeySubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="tnt_sk_your_key_here"
              className="flex-1 bg-slate-950 border-2 border-purple-500/40 rounded px-3 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none font-mono shadow-[0_0_15px_rgba(153,69,255,0.15)]"
            />
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-5 py-3 rounded text-sm transition shadow-[0_0_15px_rgba(153,69,255,0.4)] shrink-0"
            >
              <KeyRound size={14} />
              Continue
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Don&apos;t have a key yet? Get one free above first.
          </p>
        </form>
      )}

      {step === 'pick-tier' && status && (
        <div className="space-y-4">
          <div className="text-[11px] text-slate-400 bg-slate-950 border border-purple-500/20 rounded p-3">
            Current tier: <span className="text-emerald-400 font-bold">{status.tier}</span>
            {status.subscription.active && (
              <>
                {' '}
                · {status.subscription.calls_used_this_cycle}/{status.subscription.monthly_quota} calls used ·
                renews {status.subscription.expires_at ? new Date(status.subscription.expires_at).toLocaleDateString() : ''}
              </>
            )}
            {' '}
            · Credit balance: <span className="text-emerald-400 font-bold">${status.credit_balance_usd.toFixed(4)}</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={() => handlePickTier('subscription')}
              className={buttonBase + ' bg-purple-500/10 border-purple-500/30 hover:border-purple-500'}
            >
              <Zap size={20} className="mx-auto mb-2 text-purple-400 group-hover:text-white transition" />
              <div className="font-bold text-purple-400 group-hover:text-white transition text-sm">Subscribe — $49</div>
              <div className="text-[10px] text-slate-500 mt-1">1000 calls / 30 days</div>
            </button>
            <button
              onClick={() => handlePickTier('topup')}
              className={buttonBase + ' bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500'}
            >
              <CreditCard size={20} className="mx-auto mb-2 text-emerald-400 group-hover:text-white transition" />
              <div className="font-bold text-emerald-400 group-hover:text-white transition text-sm">Top up credits</div>
              <div className="text-[10px] text-slate-500 mt-1">Pay-per-call, $5–$500</div>
            </button>
          </div>

          {kind === 'topup' && (
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-sm">$</span>
              <input
                type="number"
                min={5}
                max={500}
                step={1}
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className="w-28 bg-slate-950 border border-purple-500/30 rounded px-2 py-1.5 text-sm text-white font-mono focus:border-emerald-400 focus:outline-none"
              />
              <button
                onClick={() => setStep('pick-currency')}
                className="text-xs font-bold text-purple-300 hover:text-white border border-purple-500/40 rounded px-3 py-1.5 transition"
              >
                Continue with top-up →
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'pick-currency' && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-purple-400">Choose payment currency</h4>
          {errorMsg && (
            <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
              {errorMsg}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handlePickCurrency('MRDT')}
              className={buttonBase + ' bg-purple-500/10 border-purple-500/30 hover:border-purple-500'}
            >
              <div className="text-2xl mb-1">⚽️</div>
              <div className="font-bold text-purple-400 group-hover:text-white transition text-sm">$MRDT</div>
            </button>
            <button
              onClick={() => handlePickCurrency('SOL')}
              className={buttonBase + ' bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500'}
            >
              <div className="flex justify-center mb-1">
                <svg width="22" height="22" viewBox="0 0 397 311" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="url(#bp_sol_a)" />
                  <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1L333.1 73.8c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="url(#bp_sol_b)" />
                  <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="url(#bp_sol_c)" />
                  <defs>
                    <linearGradient id="bp_sol_a" x1="360.9" y1="351.4" x2="141.2" y2="-69.2" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#00FFA3" /><stop offset="1" stopColor="#DC1FFF" />
                    </linearGradient>
                    <linearGradient id="bp_sol_b" x1="264.8" y1="351.4" x2="45.2" y2="-69.2" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#00FFA3" /><stop offset="1" stopColor="#DC1FFF" />
                    </linearGradient>
                    <linearGradient id="bp_sol_c" x1="312.5" y1="351.4" x2="92.9" y2="-69.2" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#00FFA3" /><stop offset="1" stopColor="#DC1FFF" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="font-bold text-emerald-400 group-hover:text-white transition text-sm">SOL</div>
            </button>
            <button
              onClick={() => handlePickCurrency('USDC')}
              className={buttonBase + ' bg-blue-500/10 border-blue-500/30 hover:border-blue-500'}
            >
              <div className="text-2xl mb-1">💵</div>
              <div className="font-bold text-blue-400 group-hover:text-white transition text-sm">USDC</div>
            </button>
          </div>
          <button onClick={() => setStep('pick-tier')} className="text-xs text-slate-400 hover:text-white">
            ← Back
          </button>
        </div>
      )}

      {step === 'pick-wallet' && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-purple-400">Choose wallet</h4>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handlePickWallet('Phantom')}
              className={buttonBase + ' bg-purple-500/10 border-purple-500/30 hover:border-purple-500'}
            >
              <div className="text-2xl mb-1">👻</div>
              <div className="font-bold text-purple-400 group-hover:text-white transition text-sm">Phantom</div>
            </button>
            <button
              onClick={() => handlePickWallet('Solflare')}
              className={buttonBase + ' bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-400'}
            >
              <div className="flex justify-center mb-1">
                <svg width="28" height="28" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="128" height="128" rx="24" fill="#FBBF24" />
                  <text x="64" y="95" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="82" fill="#1a0a00" fontStyle="italic">S</text>
                </svg>
              </div>
              <div className="font-bold text-yellow-400 group-hover:text-white transition text-sm">Solflare</div>
            </button>
          </div>
          <button onClick={() => setStep('pick-currency')} className="text-xs text-slate-400 hover:text-white">
            ← Back
          </button>
        </div>
      )}

      {step === 'invoice' && invoice && (
        <div className="space-y-4">
          <div className="bg-slate-950 border border-purple-500/20 rounded-xl p-5 text-center space-y-3">
            <div className="text-xs text-purple-400 font-bold">{wallet} · {invoice.currency}</div>
            <div className="text-2xl font-black text-emerald-400">
              {invoice.pay_amount_formatted} {invoice.currency}
            </div>
            <div className="text-sm text-slate-300">≈ ${invoice.usd_amount.toFixed(2)} USD</div>
            <div className="text-xs text-slate-400">{invoice.label}</div>
            <div className="text-[10px] text-slate-500 font-mono break-all">
              Wallet: {invoice.wallet_address.slice(0, 8)}...{invoice.wallet_address.slice(-8)}
            </div>
          </div>
          <div className="p-2 bg-purple-950/30 border border-purple-500/20 rounded-lg text-[10px] text-purple-300 text-center">
            Tapping will open our payment page inside {wallet}&apos;s app browser. Pay the exact amount shown —
            you may see a &quot;domain not yet reviewed&quot; warning, this is expected.
          </div>
          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 px-5 py-2.5 text-sm rounded-lg border border-purple-500/40 hover:bg-purple-500/10 transition text-slate-300">
              Cancel
            </button>
            <button
              onClick={handlePayNow}
              className="flex-1 px-5 py-2.5 text-sm rounded-lg bg-gradient-to-r from-purple-500 to-emerald-400 text-slate-950 font-black hover:from-purple-400 hover:to-emerald-300 transition"
            >
              Pay Now
            </button>
          </div>
        </div>
      )}

      {step === 'verifying' && (
        <div className="text-center py-6 space-y-3">
          <Loader2 className="animate-spin mx-auto text-purple-400" size={28} />
          <div className="text-sm text-purple-300">Checking blockchain for your payment...</div>
          <div className="text-[11px] text-slate-500">Attempt {verifyAttempts} — this can take a minute or two.</div>
        </div>
      )}

      {step === 'success' && successResult && (
        <div className="text-center py-6 space-y-3">
          <CheckCircle2 className="mx-auto text-emerald-400" size={32} />
          <div className="text-emerald-400 font-bold">Payment confirmed!</div>
          {successResult.kind === 'subscription' ? (
            <div className="text-xs text-slate-300">
              Subscription active until{' '}
              {successResult.subscription_expires_at
                ? new Date(successResult.subscription_expires_at).toLocaleDateString()
                : 'now +30 days'}
              .
            </div>
          ) : (
            <div className="text-xs text-slate-300">
              New credit balance: ${Number(successResult.credit_balance_usd ?? 0).toFixed(4)}
            </div>
          )}
          <button onClick={() => { setApiKey(apiKey); fetchStatus(apiKey); }} className="text-xs text-purple-300 hover:text-white underline">
            Refresh status
          </button>
        </div>
      )}

      {step === 'error' && (
        <div className="text-center py-6 space-y-3">
          <AlertTriangle className="mx-auto text-red-400" size={28} />
          <div className="text-sm text-red-300">{errorMsg}</div>
          <button
            onClick={() => setStep('enter-key')}
            className="text-xs font-bold text-purple-300 hover:text-white border border-purple-500/40 rounded px-3 py-1.5 transition"
          >
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
