// Version 1.0 — app/owner-pay/[token]/HandoffStatus.tsx
//
// v1.0: client polling widget for the owner-pay page. Polls /api/v1/billing/handoff/[token]?verify=1 every 10 seconds while pending; stops on confirmed, expired, 404, or after 50 minutes.

'use client';

import { useEffect, useState } from 'react';

type HandoffStatusState = 'pending' | 'confirmed' | 'expired';

export default function HandoffStatus({
  token,
  initialStatus,
}: {
  token: string;
  initialStatus: HandoffStatusState;
}) {
  const [status, setStatus] = useState<HandoffStatusState>(initialStatus);
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'pending') return;

    let cancelled = false;
    const startedAt = Date.now();
    const MAX_POLL_MS = 50 * 60 * 1000;

    async function poll() {
      if (cancelled) return;

      if (Date.now() - startedAt > MAX_POLL_MS) {
        setDetail('This link has taken too long to confirm. Ask your agent to retry for a fresh link.');
        setStatus('expired');
        return;
      }

      try {
        const res = await fetch(`/api/v1/billing/handoff/${encodeURIComponent(token)}?verify=1`, {
          cache: 'no-store',
        });

        if (!cancelled && res.status === 404) {
          setStatus('expired');
          setDetail('This link is no longer valid.');
          return;
        }

        const data = await res.json();
        if (!cancelled) {
          if (data.status === 'confirmed' || data.status === 'expired') {
            setStatus(data.status);
          }
          if (typeof data.detail === 'string') setDetail(data.detail);
        }
      } catch {
        if (!cancelled) {
          setDetail('Could not check payment status right now. Will retry automatically.');
        }
      }
    }

    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, status]);

  if (status === 'confirmed') {
    return (
      <div className="mt-8 rounded border border-green-700 bg-green-950/50 px-4 py-3 text-center">
        <p className="text-lg font-bold text-green-400">✅ Paid — your agent can continue.</p>
        <p className="mt-1 text-sm text-green-200/70">You can close this page.</p>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="mt-8 rounded border border-red-800 bg-red-950/50 px-4 py-3 text-center">
        <p className="text-sm text-red-300">
          This link has expired. Ask your agent to retry for a fresh link.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded border border-neutral-800 bg-neutral-950 px-4 py-3 text-center">
      <p className="text-sm text-neutral-200">
        Waiting for your payment… <span className="text-neutral-400">(checking automatically)</span>
      </p>
      {detail ? <p className="mt-2 text-xs text-neutral-400">{detail}</p> : null}
    </div>
  );
}
