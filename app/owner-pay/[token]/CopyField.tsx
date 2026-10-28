// Version 1.0 — app/owner-pay/[token]/CopyField.tsx
//
// v1.0: tiny client component for copying the exact payment amount or wallet address from the owner-pay page.

'use client';

import { useState } from 'react';

export default function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable on insecure origins; nothing to do.
    }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2 rounded border border-neutral-800 bg-neutral-950 px-3 py-2">
        <code className="min-w-0 flex-1 break-all text-sm text-neutral-200">{value}</code>
        <button
          onClick={copy}
          className="shrink-0 rounded bg-neutral-200 px-2 py-1 text-xs font-medium text-black hover:bg-white"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
