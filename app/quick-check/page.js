'use client';

// Version 1.3 — app/quick-check/page.js
//
// v1.3 (2026-09-12): the engine behind this page was upgraded
// (lib/helius-client.js v1.3) — Quick Check now REALLY checks honeypot,
// LP lock, dev-wallet % and tax (one RugCheck /report call) plus holder
// concentration through the same robust path as the paid API. The result
// card shows those signals. The ONLY thing Quick Check still doesn't do
// is insider-cluster tracing, which stays 'pending' server-side — the
// tagline and the in-card note below now say exactly that.
//
// v1.2 (2026-09-12): the tagline claimed "Same audit engine TNT House
// uses" — false at the time. Quick Check had no RugCheck call and no
// cluster trace (see lib/helius-client.js's own comment on this), so
// honeypot, LP-lock, insider-cluster, dev-wallet and tax signals were
// all absent here, unlike the main site/API/MCP/trial surfaces which all
// call lib/token-risk-core.ts's fetchTokenRisk(). That's a legitimate
// speed/cost trade-off — RugCheck + cluster tracing is the slow, paid
// part of a full audit, and Quick Check exists specifically to be the
// instant, cheap alternative competitors' free scanners offer. The
// trade-off itself isn't the problem; claiming parity with the deeper
// engine while selling this one for credits was. Replaced the tagline
// and added an explicit "not checked" line next to the score itself,
// not just at the top of the page. (v1.3 narrows that "not checked"
// list down to insider clusters only.)
//
// v1.1 (2026-09-11): the purchase flow no longer computes its own
// amount or calls the deleted app/api/quick-check/credits/route.js.
// That route trusted a browser-supplied expectedAmount with a 5%
// tolerance and recorded no signature, so the same payment could be
// replayed to mint credits without limit — and this page fed it that
// amount from mrdtPrice/solPrice, client-side numbers a fresh page
// load or a stale price tick could get wrong even honestly.
//
// Now: POST /api/site-orders/create { kind: 'credits', packageId,
// currency } gets back a server-decided, salted payAmount and an
// orderId; the wallet is opened with THAT amount; polling asks
// /api/verify-payment for that orderId only, never restating an amount.
// Same pattern app/page.js already uses for listings and banners.
//
// Payment still reuses the EXISTING generic wallet-payment page
// (app/pay/page.js) as-is — that page already handles Phantom/Solflare
// connect + build + sign for SOL/MRDT/USDC against the same
// RECIPIENT_WALLET used everywhere else on the site.
//
// Version 1.0 — new standalone product: paste any Solana CA, get an
// instant safety report. Separate from the existing Listing flow — this
// page never writes to `submissions` / `verified_tokens`, nothing here
// appears in the public Listing table (app/page.js).

import { useState, useEffect, useRef } from 'react';

const PACKAGES = [
  { id: '5', checks: 5, usd: 1 },
  { id: '25', checks: 25, usd: 4 },
  { id: '100', checks: 100, usd: 10 },
];

export default function QuickCheckPage() {
  const [ca, setCa] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [quota, setQuota] = useState(null); // { usedFreeToday, freeLimit, creditsRemaining }
  const [paywall, setPaywall] = useState(null); // set to server 402 payload when blocked
  const [payingPackage, setPayingPackage] = useState(null);
  const [payStatus, setPayStatus] = useState(null); // 'waiting' | 'success' | 'failed'
  const pollRef = useRef(null);

  useEffect(() => {
    // Load current quota status without consuming a slot.
    (async () => {
      try {
        const res = await fetch('/api/quick-check', { method: 'POST' });
        const data = await res.json();
        setQuota(data);
      } catch (e) { /* non-critical */ }
    })();
  }, []);

  async function handleCheck(e) {
    e.preventDefault();
    if (!ca.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPaywall(null);
    try {
      const res = await fetch(`/api/quick-check?ca=${encodeURIComponent(ca.trim())}`);
      const data = await res.json();
      if (res.status === 402) {
        setPaywall(data);
        setQuota(data);
      } else if (!res.ok) {
        // data.message carries the "your check was NOT used" refund notice.
        setError(data.message || data.error || 'Something went wrong');
      } else {
        setResult(data.auditResult);
        setQuota(data.quota);
      }
    } catch (e) {
      setError('Network error, try again');
    } finally {
      setLoading(false);
    }
  }

  // Terminal verifier answers — see app/page.js's TERMINAL_VERIFY_REASONS
  // for the same list. Polling past one of these can never resolve.
  const TERMINAL_VERIFY_REASONS = [
    'invalid_json',
    'invalid_order_id',
    'order_not_found',
    'order_expired',
    'signature_already_used',
  ];

  async function buyPackage(pkg, method, wallet) {
    setPayingPackage(pkg.id);
    setPayStatus('waiting');

    let order;
    try {
      const res = await fetch('/api/site-orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'credits', packageId: pkg.id, currency: method }),
      });
      order = await res.json();
    } catch (e) {
      order = { ok: false };
    }

    if (!order.ok) {
      setPayStatus('failed');
      return;
    }

    const label = `Quick Check ${pkg.checks} audits`;
    const payUrl = `/pay?amount=${order.payAmount}&method=${method}&label=${encodeURIComponent(label)}&wallet=${wallet}`;
    window.open(payUrl, '_blank');
    pollForCredits(order.orderId);
  }

  function pollForCredits(orderId) {
    let attempts = 0;
    const maxAttempts = 30;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });
        const data = await res.json();
        if (data.verified) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setPayStatus('success');
          setPaywall(null);
          // The server does not echo the new balance here — refresh it
          // the same way the page loads it initially.
          try {
            const statusRes = await fetch('/api/quick-check', { method: 'POST' });
            setQuota(await statusRes.json());
          } catch (e) { /* non-critical */ }
          return;
        }
        if (!data.verified && TERMINAL_VERIFY_REASONS.indexOf(data.reason) !== -1) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setPayStatus('failed');
        }
      } catch (e) { /* keep polling */ }
      if (attempts >= maxAttempts) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setPayStatus('failed');
      }
    }, 3000);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-10">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-black text-purple-400 mb-1">⚡ Quick Check</h1>
        <p className="text-slate-400 text-sm mb-1">
          Paste any Solana token CA for an instant scan — no listing, no submission.
        </p>
        {/* v1.3: engine upgraded (lib/helius-client.js v1.3) — honeypot,
            LP lock, tax and holder concentration are now really checked
            via RugCheck + the same robust holder path as the paid API.
            The only thing Quick Check still doesn't do is insider-cluster
            tracing — for that, use the full audit on the main site or
            the Risk-Data API. */}
        <p className="text-slate-500 text-xs mb-6">
          Fast scan: mint/freeze authority, liquidity, holder concentration,
          honeypot, LP lock and tax. Doesn't check insider clusters — for
          those, use the full audit on the main site or the Risk-Data API.
        </p>

        {quota && (
          <div className="mb-4 text-xs text-slate-400">
            {quota.usedFreeToday}/{quota.freeLimit} free checks used today
            {quota.creditsRemaining > 0 ? ` · ${quota.creditsRemaining} paid credits left` : ''}
          </div>
        )}

        <form onSubmit={handleCheck} className="flex gap-2 mb-6">
          <input
            type="text"
            value={ca}
            onChange={(e) => setCa(e.target.value)}
            placeholder="Token CA (Solana)"
            className="flex-1 bg-slate-900 border-2 border-purple-500/30 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-500 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            {loading ? 'Scanning...' : 'Check'}
          </button>
        </form>

        {error && <div className="text-red-400 text-sm mb-4">{error}</div>}

        {result && (
          <div className="bg-slate-900/60 border-2 border-purple-500/30 rounded-lg p-4 text-sm space-y-1">
            <div className="text-3xl font-black text-emerald-400">{result.securityScore}/100</div>
            <div className="text-xs text-slate-400">{result.verdict}</div>
            <div>Mint authority revoked: {String(result.checks?.mintAuthority?.revoked ?? '—')}</div>
            <div>Freeze authority revoked: {String(result.checks?.freezeAuthority?.revoked ?? '—')}</div>
            <div>Holder risk: {result.checks?.holderDistribution?.riskLevel ?? '—'}</div>
            <div>
              Top 10 holders:{' '}
              {result.checks?.holderDistribution?.top10Percent != null
                ? result.checks.holderDistribution.top10Percent.toFixed(1) + '%'
                : '—'}
            </div>
            <div>
              Honeypot risk:{' '}
              {result.checks?.honeypotRisk === true
                ? '🚨 Yes'
                : result.checks?.honeypotRisk === false
                  ? '✅ No'
                  : '—'}
            </div>
            <div>
              LP locked:{' '}
              {result.checks?.lpLock?.percent != null ? result.checks.lpLock.percent + '%' : '—'}
            </div>
            <div>
              Jupiter verified:{' '}
              {result.checks?.jupiterVerified === true
                ? '✅ Yes'
                : result.checks?.jupiterVerified === false
                  ? 'No'
                  : '—'}
            </div>
            <div>Liquidity: {result.liquidity != null ? `$${result.liquidity}` : '—'}</div>
            {result.capsTriggered?.length > 0 && (
              <div className="text-xs text-amber-400/80 pt-1">
                Capped by: {result.capsTriggered.map((c) => c.reason).join(', ')}
              </div>
            )}
            {/* v1.3: only insider clusters remain outside Quick Check's
                scope — honeypot, LP lock, tax and holders are now real
                checks (see lib/helius-client.js v1.3). */}
            <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-700/60">
              Quick Check scans: mint/freeze authority, holder concentration, liquidity, honeypot risk,
              LP lock and taxes (RugCheck + live RPC). Insider-cluster tracing is NOT included — for that
              use the full Risk-Data API.
            </div>
          </div>
        )}

        {paywall && (
          <div id="buy-credits" className="bg-slate-900/60 border-2 border-amber-500/40 rounded-lg p-4">
            <div className="font-bold text-amber-400 mb-2">You've used your {paywall.freeLimit} free checks today.</div>
            <div className="text-slate-400 text-xs mb-4">Keep checking tokens — no subscription, just credits.</div>
            <div className="grid grid-cols-3 gap-2">
              {PACKAGES.map((pkg) => (
                <div key={pkg.id} className="border border-purple-500/30 rounded-lg p-2 text-center">
                  <div className="font-black">{pkg.checks}</div>
                  <div className="text-xs text-slate-400 mb-2">checks</div>
                  <div className="font-bold text-emerald-400 mb-2">${pkg.usd}</div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => buyPackage(pkg, 'MRDT', 'Phantom')} className="text-[10px] bg-purple-600 rounded px-1 py-1">MRDT</button>
                    <button onClick={() => buyPackage(pkg, 'SOL', 'Phantom')} className="text-[10px] bg-purple-600 rounded px-1 py-1">SOL</button>
                    <button onClick={() => buyPackage(pkg, 'USDC', 'Phantom')} className="text-[10px] bg-purple-600 rounded px-1 py-1">USDC</button>
                  </div>
                </div>
              ))}
            </div>
            {payingPackage && payStatus === 'waiting' && (
              <div className="text-xs text-slate-400 mt-3">Waiting for payment confirmation...</div>
            )}
            {payStatus === 'success' && (
              <div className="text-xs text-emerald-400 mt-3">✅ Credits added — check again above.</div>
            )}
            {payStatus === 'failed' && (
              <div className="text-xs text-red-400 mt-3">Didn't detect the payment yet — if you paid, wait a bit and try Check again.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
