// Version 5.4 — app/risk-api/page.tsx
//
// Public landing + docs page for the Risk-Data API at /risk-api.
// New route, doesn't touch app/page.js or any existing page. Visual
// language deliberately matches the rest of TNT House exactly (purple →
// emerald gradient on black, font-mono, glowing terminal panels) rather
// than inventing a new direction — this is a feature of the same
// product, not a separate brand.

import type { Metadata } from 'next';
import { Bot, Shield, Terminal, Database, Lock, Zap, CheckCircle2 } from 'lucide-react';
import CopyButton from './CopyButton';
import RiskApiSignupForm from './RiskApiSignupForm';

export const metadata: Metadata = {
  title: 'Risk-Data API — TNT House',
  description:
    'Insider-cluster detection and Solana token risk scoring as a JSON API, built for AI trading agents.',
};

const CURL_EXAMPLE = `curl "https://tnt-audit.com/api/v1/token-risk?mint=<MINT_ADDRESS>" \\
  -H "Authorization: Bearer tnt_sk_your_key_here"`;

const EXAMPLE_RESPONSE = {
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  safety_score: 78,
  cluster_analysis: 'complete',
  insider_clusters: [{ funder: '9xQe...k2Pd', wallets: ['7uF3...aZ1', '3mN8...qR2'] }],
  mint_authority: { revoked: true, address: null },
  freeze_authority: { revoked: true, address: null },
  honeypot_risk: null,
  lp_locked: null,
  holder_distribution: {
    risk_level: 'LOW',
    largest_holder_percent: 4.2,
    top10_percent: 22.7,
    holder_count: 20,
  },
  market: {
    price_usd: 0.0000412,
    liquidity_usd: 84210,
    volume_24h_usd: 512300,
    price_change_24h_percent: 12.4,
    age_days: 3,
  },
  note: 'honeypot_risk and lp_locked detection are on the roadmap and not yet implemented.',
  checked_at: '2026-07-18T12:00:00.000Z',
};

const RESPONSE_FIELDS: Array<{ field: string; desc: string }> = [
  { field: 'safety_score', desc: '0–100. Weighted from authorities, holder concentration, liquidity, volume, and real insider-cluster penalties.' },
  { field: 'insider_clusters', desc: 'Wallets that share a first-funder — an on-chain-provable insider/sniper signal, not a guess.' },
  { field: 'cluster_analysis', desc: '"pending" on a token\'s first-ever check (cluster trace runs in the background), "complete" after ~1–2 minutes.' },
  { field: 'mint_authority / freeze_authority', desc: 'Whether each authority is revoked, and its address if still active.' },
  { field: 'honeypot_risk / lp_locked', desc: 'On the roadmap — currently always null.' },
  { field: 'holder_distribution', desc: 'Largest holder %, top-10 %, risk level, and holder_count — the number of accounts in Solana\u2019s top-20-largest-holders response (a real RPC limit, not a full holder count for widely-held tokens like BONK or USDC).' },
  { field: 'market', desc: 'Live price, liquidity, 24h volume, 24h change, and token age from DexScreener.' },
];

export default function RiskApiPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden">
      {/* Ambient glow — same signature as the TNT House homepage */}
      <div
        className="absolute -top-24 -left-24 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'rgba(147,51,234,0.12)', filter: 'blur(120px)' }}
      />
      <div
        className="absolute top-1/3 -right-24 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'rgba(16,185,129,0.1)', filter: 'blur(120px)' }}
      />

      <header className="border-b border-purple-500/30 backdrop-blur-lg bg-slate-950/60 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <a href="/" className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 tracking-wide">
            TNT HOUSE
          </a>
          <span className="text-[10px] sm:text-xs font-bold text-purple-300 border border-purple-500/30 rounded-full px-2.5 py-1">
            RISK-DATA API
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 relative">
        {/* Hero */}
        <section className="pt-14 pb-10 sm:pt-20 sm:pb-14">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1 mb-5">
            <Bot size={12} />
            BUILT FOR AI TRADING AGENTS
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-4">
            Know what a token is hiding{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">
              before your bot buys it.
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mb-8 leading-relaxed">
            One GET request returns a safety score, live insider-cluster detection, and on-chain
            fundamentals for any Solana mint — the same engine behind TNT House audits, exposed as
            clean JSON for bots instead of a dashboard for humans.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#get-key"
              className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-5 py-3 rounded text-sm transition shadow-[0_0_15px_rgba(153,69,255,0.4)]"
            >
              Get a free API key
            </a>
            <a
              href="#docs"
              className="border border-purple-500/40 hover:border-purple-400 text-purple-300 hover:text-white font-bold px-5 py-3 rounded text-sm transition"
            >
              Read the docs
            </a>
          </div>
        </section>

        {/* Signature element: live terminal preview of a real response shape */}
        <section id="docs" className="pb-14">
          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-lg shadow-[0_0_20px_rgba(153,69,255,0.15)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-purple-500/20 px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
                <Terminal size={13} />
                GET /api/v1/token-risk
              </div>
              <span className="text-[10px] text-slate-500 hidden sm:block">application/json</span>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <pre className="text-[11px] sm:text-xs text-emerald-400 overflow-x-auto flex-1 leading-relaxed">
                  {CURL_EXAMPLE}
                </pre>
                <CopyButton text={CURL_EXAMPLE} label="Copy curl" />
              </div>

              <div className="border-t border-purple-500/10 pt-3">
                <pre className="text-[10px] sm:text-[11px] text-slate-300 overflow-x-auto leading-relaxed max-h-96">
                  {JSON.stringify(EXAMPLE_RESPONSE, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* How it works — a real 3-step sequence, so numbering earns its place */}
        <section className="pb-14">
          <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-6">
            How it works
          </h2>
          <div className="space-y-4">
            {[
              { icon: Zap, title: 'Get a key', desc: 'Enter your email below. No credit card, no approval wait — the key is issued instantly.' },
              { icon: Terminal, title: 'Call the endpoint', desc: 'GET /api/v1/token-risk?mint=<address> with your key in the Authorization header. Typical response time: well under a second.' },
              { icon: Shield, title: 'Act on the score', desc: 'First-ever check on a mint returns cluster_analysis: "pending" while the insider trace runs in the background — re-check in a minute or two for the full picture.' },
            ].map((step, i) => (
              <div key={step.title} className="flex gap-4 border-l-4 border-purple-500 pl-5 py-1">
                <div className="text-2xl font-black text-purple-500/40 leading-none w-8 shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-sm text-white mb-1">
                    <step.icon size={14} className="text-emerald-400" />
                    {step.title}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Response fields reference */}
        <section className="pb-14">
          <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-6">
            Response fields
          </h2>
          <div className="border border-purple-500/20 rounded-lg overflow-hidden divide-y divide-purple-500/10">
            {RESPONSE_FIELDS.map((row) => (
              <div key={row.field} className="p-3.5 sm:flex sm:gap-4 bg-slate-900/40">
                <code className="text-[11px] sm:text-xs text-emerald-400 font-bold sm:w-56 shrink-0 block mb-1 sm:mb-0">
                  {row.field}
                </code>
                <p className="text-xs text-slate-400 leading-relaxed">{row.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="pb-14 scroll-mt-20">
          <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-6">
            Limits &amp; pricing
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border border-purple-500/30 rounded-lg p-5 bg-slate-900/40">
              <div className="text-[11px] font-bold text-purple-400 tracking-widest mb-1">FREE</div>
              <div className="text-2xl font-black mb-3">100 req/day</div>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> Full response schema
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> Insider-cluster detection
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> No credit card
                </li>
              </ul>
            </div>
            <div className="border border-emerald-500/30 rounded-lg p-5 bg-slate-900/40">
              <div className="text-[11px] font-bold text-emerald-400 tracking-widest mb-1">PAID</div>
              <div className="text-2xl font-black mb-3">Unlimited</div>
              <ul className="space-y-2 text-xs text-slate-400 mb-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> No daily cap
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> Priority support
                </li>
              </ul>
              <p className="text-[11px] text-slate-500">
                Self-serve billing is on the way — for now, reach out and we&apos;ll set you up manually.
              </p>
            </div>
          </div>
        </section>

        {/* Signup */}
        <section id="get-key" className="pb-20 scroll-mt-20">
          <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-5 sm:p-8 backdrop-blur-md">
            <div className="flex items-center gap-2 text-lg font-black mb-1">
              <Lock size={16} className="text-emerald-400" />
              Get your API key
            </div>
            <p className="text-xs text-slate-400 mb-5">Instant, free, no card required.</p>
            <RiskApiSignupForm />
          </div>
        </section>

        <footer className="border-t border-purple-500/20 py-8 text-center">
          <a href="/" className="text-xs text-slate-500 hover:text-purple-300 transition inline-flex items-center gap-1.5">
            <Database size={12} />
            Back to TNT House
          </a>
        </footer>
      </main>
    </div>
  );
}
