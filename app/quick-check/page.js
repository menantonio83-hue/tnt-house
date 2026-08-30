'use client';

// Version 1.0 — app/quick-check/page.js
//
// New standalone product: paste any Solana CA, get an instant safety
// report. Separate from the existing Listing flow — this page never
// writes to `submissions` / `verified_tokens`, nothing here appears in
// the public Listing table (app/page.js).
//
// Payment reuses the EXISTING generic wallet-payment page (app/pay/page.js)
// as-is — that page already handles Phantom/Solflare connect + build +
// sign for SOL/MRDT/USDC against the same RECIPIENT_WALLET used
// everywhere else on the site. No new payment UI was built; this page
// only computes the amount, opens /pay with it, and polls
// /api/quick-check/credits (which internally reuses the same Helius
// verification approach as /api/verify-payment) until confirmed.

import { useState, useEffect, useRef } from 'react';

const MRDT_CA = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

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
  const [mrdtPrice, setMrdtPrice] = useState(0.000013);
  const [solPrice, setSolPrice] = useState(85);
  const [payingPackage, setPayingPackage] = useState(null);
  const [payStatus, setPayStatus] = useState(null); // 'waiting' | 'success' | 'failed'
  const pollRef = useRef(null);

  // Same public Jupiter Price API v3 call app/page.js already uses —
  // no backend proxy needed, no new dependency.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${MRDT_CA},${SOL_MINT}`);
        const data = await res.json();
        if (data?.[MRDT_CA]?.usdPrice) setMrdtPrice(parseFloat(data[MRDT_CA].usdPrice));
        if (data?.[SOL_MINT]?.usdPrice) setSolPrice(parseFloat(data[SOL_MINT].usdPrice));
      } catch (e) { /* fall back to defaults above */ }
    })();

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
        setError(data.error || 'Something went wrong');
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

  function amountFor(pkg, method) {
    if (method === 'USDC') return pkg.usd;
    if (method === 'SOL') return +(pkg.usd / (solPrice || 85)).toFixed(6);
    return Math.round(pkg.usd / (mrdtPrice || 0.000013)); // MRDT
  }

  function buyPackage(pkg, method, wallet) {
    const amount = amountFor(pkg, method);
    const startTime = Date.now();
    const label = `Quick Check ${pkg.checks} audits`;
    const payUrl = `/pay?amount=${amount}&method=${method}&label=${encodeURIComponent(label)}&wallet=${wallet}`;
    window.open(payUrl, '_blank');
    setPayingPackage(pkg.id);
    setPayStatus('waiting');
    pollForCredits(pkg.id, amount, method, startTime);
  }

  function pollForCredits(packageId, expectedAmount, method, since) {
    let attempts = 0;
    const maxAttempts = 30;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/api/quick-check/credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageId, expectedAmount, since, method }),
        });
        const data = await res.json();
        if (data.verified && data.creditsAdded) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setPayStatus('success');
          setPaywall(null);
          setQuota((q) => ({ ...(q || {}), creditsRemaining: data.newBalance }));
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
        <p className="text-slate-400 text-sm mb-6">
          Paste any Solana token CA. Same audit engine TNT House uses — no listing, no submission.
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
            <div>Mint authority revoked: {String(result.mintAuthRevoked ?? '—')}</div>
            <div>Freeze authority revoked: {String(result.freezeAuthRevoked ?? '—')}</div>
            <div>Holder risk: {result.holderRisk?.riskLevel ?? '—'}</div>
            <div>Liquidity: {result.liquidity != null ? `$${result.liquidity}` : '—'}</div>
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
