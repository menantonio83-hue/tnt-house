// Version 1.0 — app/risk-api/DemoPublicKeyWidget.tsx
//
// Live counter for the public-demo-key experiment (see
// lib/demo-public-key-limit.ts / app/api/demo-public-status/route.ts).
// Polls the read-only status endpoint every 15s — cheap (no auth, no
// slot consumed) and turns the shared 300-call budget into visible,
// live content on the page instead of a static number that goes stale
// the moment anyone else calls the key.
//
// Renders nothing (returns null) once the experiment is over and no
// DEMO_PUBLIC_KEY env var is configured server-side — status.alive
// stays permanently false in that case (calls_remaining starts at 0),
// so this widget quietly disappears instead of showing a dead "0/300"
// banner forever after the experiment concludes and the env var is
// removed.

'use client';

import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { useRiskApiLang } from './LangContext';

interface DemoStatus {
  calls_used: number;
  calls_remaining: number;
  calls_total: number;
  alive: boolean;
}

const POLL_INTERVAL_MS = 15000;

export default function DemoPublicKeyWidget({ demoKey }: { demoKey: string | null }) {
  const { t } = useRiskApiLang();
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/demo-public-status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        // Silent — a failed poll just leaves the last-known state on
        // screen (or nothing, on the very first attempt). Not worth
        // surfacing an error for a decorative live counter.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Nothing to show yet (still loading) or the experiment was never
  // configured / already fully torn down — render nothing rather than
  // a placeholder that flashes in on every page load.
  if (!status || !demoKey || status.calls_used === 0 && !status.alive) {
    return null;
  }

  const pct = status.calls_remaining / status.calls_total;
  const dotColor = !status.alive ? 'bg-red-500' : pct < 0.15 ? 'bg-amber-400' : 'bg-emerald-400';

  function handleCopy() {
    if (!demoKey) return;
    navigator.clipboard.writeText(demoKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="border border-purple-500/20 rounded-lg bg-slate-900/40 p-4 mb-8">
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-block w-2 h-2 rounded-full ${dotColor} ${status.alive ? 'animate-pulse' : ''}`} />
        <span className="text-xs font-bold text-white">{t.demoPublicKeyTitle}</span>
      </div>

      {status.alive ? (
        <>
          <p className="text-xs text-slate-400 mb-3">
            {t.demoPublicKeyRemaining.replace('{remaining}', String(status.calls_remaining)).replace('{total}', String(status.calls_total))}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] text-emerald-400 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">
              {demoKey}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-purple-300 hover:text-white border border-purple-500/30 hover:border-purple-400 rounded px-2 py-1.5 transition"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? t.copyLabel : t.demoPublicKeyCopy}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">{t.demoPublicKeyNote}</p>
        </>
      ) : (
        <p className="text-xs text-red-400">{t.demoPublicKeyDead}</p>
      )}
    </div>
  );
}
