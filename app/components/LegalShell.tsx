// Version 1.0 — app/components/LegalShell.tsx
//
// Shared header/nav/footer for the three legal pages (Disclaimer, Terms,
// Privacy). Plain server component — no client JS needed for a
// three-link nav — kept as one file so heading style, spacing and the
// dark purple->emerald theme stay identical across all three instead of
// drifting as each gets edited separately over time.

import Link from 'next/link';
import type { ReactNode } from 'react';

const PAGES = [
  { href: '/disclaimer', label: 'Disclaimer' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
] as const;

export default function LegalShell({
  active,
  title,
  updated,
  children,
}: {
  active: '/disclaimer' | '/terms' | '/privacy';
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-purple-500/30 backdrop-blur-lg bg-slate-950/60 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-purple-400 font-black text-sm tracking-widest hover:text-purple-300 transition-colors"
          >
            ← TNT HOUSE
          </Link>
          <span className="text-slate-600 text-[10px] font-mono">tnt-audit.com</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <nav className="flex flex-wrap gap-2 mb-8">
          {PAGES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className={
                'text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors ' +
                (p.href === active
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200')
              }
            >
              {p.label}
            </Link>
          ))}
        </nav>

        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-1">
          {title}
        </h1>
        <p className="text-slate-500 text-xs font-mono mb-8">Last updated: {updated}</p>

        <div className="space-y-6 text-sm leading-relaxed text-slate-300">{children}</div>

        <div className="mt-12 pt-6 border-t border-slate-800 text-xs text-slate-500">
          Questions? Reach us on Telegram:{' '}
          <a
            href="https://t.me/tnt_house2026"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            t.me/tnt_house2026
          </a>
        </div>
      </main>
    </div>
  );
}
