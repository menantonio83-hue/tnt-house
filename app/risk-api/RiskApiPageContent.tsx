// v1.12: CLAUDE_MCP_CONFIG used to show
// "Authorization: Bearer tnt_sk_your_key_here" as if a key were
// required just to connect — outdated since app/api/mcp/route.ts v1.6
// added a dedicated 5/day anonymous quota (no key needed at all for a
// first try). Simplified to the bare-minimum config that actually works
// with zero setup, matching the README's own example; the key/x402
// upgrade paths are covered by the new mcpFreeTierNote line just above
// the snippet instead of being baked into the "required" config.
//
// Version 1.11 — app/risk-api/RiskApiPageContent.tsx
//
// v1.11: hero CTA order fixed. The only button used to be btnGetKey
// linking to #get-key (the EMAIL signup form) — a visitor clicked the
// one button they saw and landed on an email form, never noticing
// TryItWidget (3 free checks, no email, just paste a mint/CA) sitting
// in the very next section on the same page. Now the primary
// (gradient) button is btnTryFree -> #try-it (new id added to that
// section), with btnGetKey demoted to a secondary outlined button
// alongside btnReadDocs. See i18n.ts v1.8 for the new copy key.
//
// Version 1.10 — app/risk-api/RiskApiPageContent.tsx
//
// v1.10 price cut (4-model consensus: self + Kimi + DeepSeek + Gemini,
// see lib/billing-pricing.ts v8.5 for the full reasoning): pay-per-call
// $0.07 -> $0.04, subscription $49 -> $45, x402 $0.07 -> $0.02.
// v8.5 (2026-08-28): subscription quota 1000 -> 5000 calls, subscribed
// overage $0.02 -> $0.015/call — see lib/billing-pricing.ts. Updated
// both pricing-card numbers and the 402 example JSON's
// overage_rate_usd/note to match — those were hardcoded display values,
// not pulled from the actual constants, so they needed a manual edit
// alongside the code-side price change.
//
// Version 1.9 — app/risk-api/RiskApiPageContent.tsx
//
// v1.9: docs updated for the new vesting_locks[] field
// (token-risk-core.ts v1.6) — EXAMPLE_RESPONSE now shows the field
// (empty array, with a comment documenting the populated shape since
// the example mint has no vesting locks), and a new row in the
// response fields table.
//
// Version 1.8 — app/risk-api/RiskApiPageContent.tsx
//
// v1.8: added the missing 4th pricing card (X402 — pay per call, no
// key) to the Limits & pricing grid (3-col -> 4-col), sourced from the
// real values in app/api/v1/token-risk/x402/route.ts ($0.07/call =
// PRICE_USDC_ATOMIC 70000, USDC on Solana mainnet). Also added a
// dedicated "how to connect" card right below the pricing grid with
// the actual 402 -> sign -> retry flow and a real curl example —
// x402 pricing existed on x402scan.com since v1.8 of the changelog but
// had zero visibility or connect instructions on this page itself.
//
// Version 1.7 — app/risk-api/RiskApiPageContent.tsx
//
// v1.7: docs updated for the 6 new API fields + contractRiskCap tier
// (token-risk-core.ts v1.5) — EXAMPLE_RESPONSE now shows all new
// fields with realistic values, and 5 new rows added to the response
// fields table (responseFields array).
//
// Version 1.6 — app/risk-api/RiskApiPageContent.tsx
//
// v1.6: inserted TryItWidget right after the hero section — the anon
// trial funnel step (fingerprint, no email, 3 free checks) that used to
// not exist on the landing page at all (email-gate was the very first
// friction point a visitor hit). See TryItWidget.tsx and
// app/api/v1/trial/check/route.ts for the full funnel:
// fingerprint (3 free) -> email (existing RiskApiSignupForm, 15/day) ->
// paid.
//
// Version 1.5 — app/risk-api/RiskApiPageContent.tsx
//
// v1.5: new "Webhooks" docs section (between Rate Limiting and
// Versioning & Changelog) — subscribe request example, the 201
// subscription-created response (with webhook_secret), and the actual
// risk_score.threshold_crossed payload shape delivered to callback_url,
// copied verbatim from the deployed app/api/v1/webhooks/subscribe and
// app/api/v1/webhooks/check route handlers (v1.9 changelog entry).
// Endpoint paths, JSON field names, and HTTP header names stay in
// English in every locale, same convention as the rest of this file —
// only the surrounding prose (t.webhooksDocsIntro/*Label/*Note) is
// localized via i18n.ts.
//
// Version 1.4 — app/risk-api/RiskApiPageContent.tsx
//
// v1.4: changelog now renders t.changelogEntries (i18n.ts v1.3) instead
// of a hardcoded English-only CHANGELOG constant — reversed the earlier
// "technical/log content stays English" call after the product owner
// found it untranslated on the live Russian page and asked for a real
// fix, not a re-justification.
//
// Version 1.3 — app/risk-api/RiskApiPageContent.tsx
//
// v1.3: new "Versioning & Changelog" section (between Rate Limiting and
// Pricing) — versioning policy paragraph plus a real changelog (v1.0
// through v1.5) built from actual git history, not invented dates. The
// CHANGELOG constant's version numbers/dates/text are technical/log
// content and stay in English in every locale (see i18n.ts v1.2 note).
//
// Version 1.2 — app/risk-api/RiskApiPageContent.tsx
//
// v1.2: new standalone "Rate Limiting" section (between Response Fields
// and Pricing) — dedicated header reference table (X-RateLimit-Limit/
// Remaining/Reset, X-Credit-Balance-Usd), a real 402 example matching
// lib/rate-limit.ts's actual buildLimitReachedResponse() body, and a
// one-line best-practice tip. The existing one-liner rate-limit note
// further up (t.rateLimitHeadersNote, in the Response Fields section)
// is unchanged — this is a fuller, separate section, not a replacement.
//
// Version 1.1 — app/risk-api/RiskApiPageContent.tsx
//
// v1.1: docs terminal now has curl/Python/TypeScript tabs (Gemini
// suggestion #1) instead of just curl. Both new snippets verified with
// real compilers before committing — Python via ast.parse(), TypeScript
// via an isolated tsc run — not just "looks right". Copy button label
// switched from the curl-specific t.copyCurl to the generic t.copyLabel
// since it now copies whichever language tab is active.
//
// Version 1.0 — app/risk-api/RiskApiPageContent.tsx
//
// The actual page body, split out from page.tsx (which stays a server
// component so `export const metadata` keeps working) so it can be a
// client component and consume useRiskApiLang(). Same content/layout as
// the original single-file page.tsx, just with static English strings
// swapped for t.xxx lookups. Technical/API-literal content stays as-is
// in every language (see i18n.ts's header comment for why): the curl
// example, the JSON response example, field names like safety_score,
// and currency codes like SOL/USDC/MRDT.

'use client';

import { useState, Suspense } from 'react';
import { Bot, Shield, Terminal, Database, Lock, Zap, CheckCircle2, Puzzle, MessageCircle, Users, ShieldCheck, CreditCard } from 'lucide-react';
import CopyButton from './CopyButton';
import RiskApiSignupForm from './RiskApiSignupForm';
import TryItWidget from './TryItWidget';
import BillingPanel from './BillingPanel';
import LangSwitcher from './LangSwitcher';
import ChatWidget from './ChatWidget';
import InsiderClusterGraph from './InsiderClusterGraph';
import { useRiskApiLang } from './LangContext';

const CURL_EXAMPLE = `curl "https://tnt-audit.com/api/v1/token-risk?mint=<MINT_ADDRESS>" \\
  -H "Authorization: Bearer tnt_sk_your_key_here"`;

const PYTHON_EXAMPLE = `import requests

API_KEY = "tnt_sk_your_key_here"
MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

response = requests.get(
    "https://tnt-audit.com/api/v1/token-risk",
    params={"mint": MINT_ADDRESS},
    headers={"Authorization": f"Bearer {API_KEY}"},
)
data = response.json()

if data["safety_score"] < 50:
    print("Risky — skipping buy")
elif data["insider_clusters"]:
    print(f"{len(data['insider_clusters'])} insider cluster(s) found")
else:
    print("Looks clean")`;

const TYPESCRIPT_EXAMPLE = `async function checkTokenRisk(mint: string, apiKey: string) {
  const res = await fetch(
    \`https://tnt-audit.com/api/v1/token-risk?mint=\${mint}\`,
    { headers: { Authorization: \`Bearer \${apiKey}\` } },
  );

  if (!res.ok) throw new Error(\`API error: \${res.status}\`);
  return res.json();
}`;

const WEBHOOK_SUBSCRIBE_EXAMPLE = `curl -X POST "https://tnt-audit.com/api/v1/webhooks/subscribe" \\
  -H "Authorization: Bearer tnt_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "threshold": 50,
    "condition": "below",
    "callback_url": "https://yourbot.example.com/webhooks/tnt"
  }'`;

const WEBHOOK_SUBSCRIBE_RESPONSE = {
  id: '8f2a1c3e-4b6d-4a1e-9c2f-1a2b3c4d5e6f',
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  threshold: 50,
  condition: 'below',
  callback_url: 'https://yourbot.example.com/webhooks/tnt',
  active: true,
  created_at: '2026-08-03T12:00:00.000Z',
  webhook_secret: 'whsec_9f8e7d6c5b4a3f2e1d0c...',
  note: 'Save webhook_secret now — it is shown only once and is required to verify the X-Webhook-Signature header on every delivery.',
};

const WEBHOOK_PAYLOAD_EXAMPLE = {
  id: 'evt_19a2b3c4d5e6f7',
  object: 'webhook_event',
  api_version: 'v1',
  created: 1785845700,
  type: 'risk_score.threshold_crossed',
  data: {
    object: {
      subscription_id: '8f2a1c3e-4b6d-4a1e-9c2f-1a2b3c4d5e6f',
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      previous_score: 62,
      current_score: 48,
      threshold: 50,
      condition: 'below',
      crossed_at: '2026-08-03T12:15:00.000Z',
    },
  },
};

// v1.1: CHANGELOG used to be a hardcoded English-only constant here
// ("technical/log content, same convention as curl/JSON examples").
// Reversed per explicit product-owner instruction after seeing the
// live page: the changes[] text is now translated per-language via
// t.changelogEntries (app/risk-api/i18n.ts) — version numbers, dates,
// and inline field/header names inside the translated text still stay
// in English (those genuinely are technical literals), only the
// descriptive prose is localized.

type CodeTab = 'curl' | 'python' | 'typescript';

const CODE_EXAMPLES: Record<CodeTab, { label: string; code: string }> = {
  curl: { label: 'curl', code: CURL_EXAMPLE },
  python: { label: 'Python', code: PYTHON_EXAMPLE },
  typescript: { label: 'TypeScript', code: TYPESCRIPT_EXAMPLE },
};

type IntegrationId = 'claude' | 'chatgpt' | 'elizaos' | 'rest';

const CLAUDE_MCP_CONFIG = `{
  "mcpServers": {
    "tnt-risk-data-api": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://tnt-audit.com/api/mcp"]
    }
  }
}`;

const CHATGPT_ACTION_URL = 'https://tnt-audit.com/openapi.json';

const ELIZAOS_INSTALL = `npm install eliza-plugin-tnt-risk-api`;

const INTEGRATIONS: Array<{
  id: IntegrationId;
  label: string;
  snippetLabel: string;
  snippet: string;
}> = [
  { id: 'claude', label: 'Claude / Cursor', snippetLabel: 'claude_desktop_config.json (MCP)', snippet: CLAUDE_MCP_CONFIG },
  { id: 'chatgpt', label: 'ChatGPT', snippetLabel: 'Custom GPT Action — Import from URL', snippet: CHATGPT_ACTION_URL },
  { id: 'elizaos', label: 'ElizaOS', snippetLabel: 'npm install', snippet: ELIZAOS_INSTALL },
  { id: 'rest', label: 'Custom REST', snippetLabel: 'curl', snippet: CURL_EXAMPLE },
];

const EXAMPLE_RESPONSE = {
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  safety_score: 78,
  maturity_capped: false,
  market_health_capped: false,
  contract_risk_capped: false,
  rugged_capped: false,
  caps_triggered: [],
  dominant_cap: null,
  cluster_analysis: 'complete',
  insider_clusters: [{ funder: '9xQe...k2Pd', wallets: ['7uF3...aZ1', '3mN8...qR2'] }],
  insider_holder_count: 2,
  mint_authority: { revoked: true, address: null },
  freeze_authority: { revoked: true, address: null },
  contract_renounced: true,
  honeypot_risk: false,
  lp_locked: { locked: true, percent: 100 },
  rugged: false,
  jup_verified: true,
  deployer_address: '9xQe...k2Pd',
  hidden_owner: false,
  permanent_delegate: false,
  buy_tax_percent: null,
  sell_tax_percent: null,
  dev_wallet_percent: 1.8,
  token_program: 'standard',
  // No vesting/lock contract detected among top holders for this mint.
  // When one is found (Streamflow, v1), each entry looks like:
  // { protocol: "streamflow", holder_address, percent_of_supply,
  //   unlocked_now_percent, unlocks_within_30d_percent,
  //   next_unlock_at, fully_unlocked_at, cancelable_by_sender }
  vesting_locks: [],
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
  checked_at: '2026-07-18T12:00:00.000Z',
};

export default function RiskApiPageContent({ requestsServed }: { requestsServed: number | null }) {
  const { t } = useRiskApiLang();
  const [codeTab, setCodeTab] = useState<CodeTab>('curl');
  const [activeIntegration, setActiveIntegration] = useState<IntegrationId | null>(null);

  const steps = [
    { icon: Zap, title: t.step1Title, desc: t.step1Desc },
    { icon: Terminal, title: t.step2Title, desc: t.step2Desc },
    { icon: Shield, title: t.step3Title, desc: t.step3Desc },
  ];

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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <a href="/" className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 tracking-wide shrink-0">
            TNT HOUSE
          </a>
          <div className="flex items-center gap-3">
            <LangSwitcher />
            <span className="text-[10px] sm:text-xs font-bold text-purple-300 border border-purple-500/30 rounded-full px-2.5 py-1 whitespace-nowrap">
              {t.headerBadge}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 relative">
        {/* Illustrates insider_clusters — the actual killer feature —
            instead of a generic banner. Pure inline SVG, see
            InsiderClusterGraph.tsx. */}
        <section className="pt-8 pb-2 sm:pt-12">
          <InsiderClusterGraph />
        </section>

        {/* Hero */}
        <section className="pt-4 pb-10 sm:pt-6 sm:pb-14">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1 mb-5">
            <Bot size={12} />
            {t.heroEyebrow}
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-4">
            {t.heroTitle1}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">
              {t.heroTitle2}
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mb-8 leading-relaxed">
            {t.heroSub}
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <a
              href="#try-it"
              className="flex items-center justify-center text-center bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-400 hover:to-emerald-300 text-slate-950 font-black px-4 py-3 rounded text-sm transition shadow-[0_0_15px_rgba(153,69,255,0.4)]"
            >
              {t.btnTryFree}
            </a>
            <a
              href="#get-key"
              className="flex items-center justify-center text-center bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold px-4 py-3 rounded text-sm transition shadow-[0_0_15px_rgba(99,102,241,0.35)]"
            >
              {t.btnGetKey}
            </a>
            <a
              href="/risk-api/docs"
              className="flex items-center justify-center text-center bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold px-4 py-3 rounded text-sm transition shadow-[0_0_15px_rgba(16,185,129,0.35)]"
            >
              {t.btnReadDocs}
            </a>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('open-risk-api-chat'))}
              className="flex items-center justify-center gap-1.5 text-center bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold px-4 py-3 rounded text-sm transition shadow-[0_0_15px_rgba(6,182,212,0.35)]"
            >
              <MessageCircle size={15} />
              {t.btnSiteAssistant}
            </button>
          </div>

          {requestsServed !== null && requestsServed > 0 && (
            <p className="text-[11px] text-slate-500 mt-5 tracking-wide">
              {t.statsLine.replace('{n}', String(requestsServed))}
            </p>
          )}
        </section>

        {/* Anon trial widget — no signup, 3 free checks via browser fingerprint.
            id="try-it" is the target of the hero's primary CTA (v1.7) — this
            used to be reachable only by scrolling past the hero unprompted. */}
        <section id="try-it" className="pb-14 scroll-mt-20">
          <TryItWidget />
        </section>

        {/* 3 value cards — plain-language "what this gets you", added per
            Kimi's audit (2026-08-27): the JSON demo shows the fields, but
            nothing translated them into "why this matters" before this.
            Deliberately just 3 cards, not a field-by-field walkthrough —
            that's what /risk-api/docs is for. */}
        <section className="pb-14">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="border border-purple-500/20 rounded-lg p-5 bg-slate-900/40">
              <Zap size={20} className="text-emerald-400 mb-3" />
              <div className="text-sm font-bold text-white mb-1.5">{t.valueCard1Title}</div>
              <p className="text-xs text-slate-400 leading-relaxed">{t.valueCard1Desc}</p>
            </div>
            <div className="border border-purple-500/20 rounded-lg p-5 bg-slate-900/40">
              <Users size={20} className="text-emerald-400 mb-3" />
              <div className="text-sm font-bold text-white mb-1.5">{t.valueCard2Title}</div>
              <p className="text-xs text-slate-400 leading-relaxed">{t.valueCard2Desc}</p>
            </div>
            <div className="border border-purple-500/20 rounded-lg p-5 bg-slate-900/40">
              <ShieldCheck size={20} className="text-emerald-400 mb-3" />
              <div className="text-sm font-bold text-white mb-1.5">{t.valueCard3Title}</div>
              <p className="text-xs text-slate-400 leading-relaxed">{t.valueCard3Desc}</p>
            </div>
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
              <span className="text-[10px] text-slate-500 hidden sm:flex items-center gap-2">
                application/json
                <a href="/openapi.json" className="underline hover:text-purple-300 transition">openapi.json</a>
                <CopyButton text="https://tnt-audit.com/openapi.json" label={t.copyOpenApiUrl} />
              </span>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-1">
                {(Object.keys(CODE_EXAMPLES) as CodeTab[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setCodeTab(key)}
                    className={
                      'text-[11px] font-bold px-2.5 py-1 rounded transition ' +
                      (codeTab === key
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : 'text-slate-500 hover:text-slate-300 border border-transparent')
                    }
                  >
                    {CODE_EXAMPLES[key].label}
                  </button>
                ))}
              </div>

              <div className="flex items-start justify-between gap-2">
                <pre className="text-[11px] sm:text-xs text-emerald-400 overflow-x-auto flex-1 leading-relaxed">
                  {CODE_EXAMPLES[codeTab].code}
                </pre>
                <CopyButton text={CODE_EXAMPLES[codeTab].code} label={t.copyLabel} />
              </div>

              <div className="border-t border-purple-500/10 pt-3">
                {/* Condensed JSON as a visual, not a reference table — per
                    Kimi's landing/docs audit (2026-08-27): a demo should
                    show what you get, not explain every field. safety_score
                    and insider_clusters (the two fields the hero copy
                    actually promises) are pulled straight/highlighted,
                    everything else collapses behind "...". Full field-by-
                    field descriptions live at /risk-api/docs#reference. */}
                <pre className="text-[10px] sm:text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
{'{\n  "safety_score": '}<span className={
                    EXAMPLE_RESPONSE.safety_score >= 70
                      ? 'text-emerald-400 font-bold'
                      : EXAMPLE_RESPONSE.safety_score >= 40
                        ? 'text-amber-400 font-bold'
                        : 'text-red-400 font-bold'
                  }>{EXAMPLE_RESPONSE.safety_score}</span>{',\n  "insider_clusters": '}<span className={
                    EXAMPLE_RESPONSE.insider_clusters.length > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'
                  }>{JSON.stringify(EXAMPLE_RESPONSE.insider_clusters)}</span>{',\n  "honeypot_risk": '}<span className={EXAMPLE_RESPONSE.honeypot_risk ? 'text-red-400' : 'text-emerald-400'}>{String(EXAMPLE_RESPONSE.honeypot_risk)}</span>{',\n  "lp_locked": '}<span className={EXAMPLE_RESPONSE.lp_locked.locked ? 'text-emerald-400' : 'text-amber-400'}>{JSON.stringify(EXAMPLE_RESPONSE.lp_locked)}</span>{',\n  ...\n}'}
                </pre>
              </div>

              <a
                href="/risk-api/docs#reference"
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-purple-300 hover:text-white transition border-t border-purple-500/10 pt-3 w-full"
              >
                {t.btnReadDocs} →
              </a>
            </div>
          </div>
        </section>

        {/* Integrations — cards, not prose. Per Kimi's audit: "Where are
            the buttons? Where's Add to ChatGPT, Add to Claude, Install
            ElizaOS plugin?" Click a card, snippet expands below it. */}
        <section className="pb-14">
          <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-1.5">
            {t.integrationsTitle}
          </h2>
          <p className="text-xs text-slate-400 mb-1.5">{t.integrationsHint}</p>
          <p className="text-xs text-emerald-400 font-semibold mb-5">{t.mcpFreeTierNote}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {INTEGRATIONS.map((integration) => (
              <button
                key={integration.id}
                onClick={() => setActiveIntegration(activeIntegration === integration.id ? null : integration.id)}
                className={
                  'flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center transition ' +
                  (activeIntegration === integration.id
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : 'border-purple-500/30 bg-slate-900/40 hover:border-purple-400')
                }
              >
                <Puzzle size={18} className={activeIntegration === integration.id ? 'text-emerald-400' : 'text-purple-400'} />
                <span className="text-xs font-bold text-white">{integration.label}</span>
              </button>
            ))}
          </div>

          {activeIntegration && (
            <div className="mt-4 bg-slate-950 border-2 border-emerald-500/30 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.1)] overflow-hidden">
              <div className="flex items-center justify-between border-b border-emerald-500/20 px-4 py-2.5">
                <span className="text-[11px] text-slate-500">
                  {INTEGRATIONS.find((i) => i.id === activeIntegration)?.snippetLabel}
                </span>
              </div>
              <div className="p-4 flex items-start justify-between gap-2">
                <pre className="text-[11px] sm:text-xs text-emerald-400 overflow-x-auto flex-1 leading-relaxed whitespace-pre-wrap">
                  {INTEGRATIONS.find((i) => i.id === activeIntegration)?.snippet}
                </pre>
                <CopyButton
                  text={INTEGRATIONS.find((i) => i.id === activeIntegration)?.snippet ?? ''}
                  label={t.copyLabel}
                />
              </div>
            </div>
          )}
        </section>

        {/* How it works — a real 3-step sequence, so numbering earns its place */}
        <section className="pb-14">
          <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-6">
            {t.howItWorksTitle}
          </h2>
          <div className="space-y-4">
            {steps.map((step, i) => (
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

        {/* Pricing — all 4 tiers on the landing page (product-owner
            decision 2026-08-28: hiding pay-per-call and x402 behind a docs
            link felt like withholding options, not simplifying — a new
            user weighing a first $45 subscription against an unfamiliar
            product specifically wants the $0.02/call trial-first option
            visible here, not one click away). Card markup/copy mirrors
            RiskApiDocsContent.tsx's grid exactly (same t.* i18n keys,
            already existed there) — docs keeps the extra x402 curl/HTTP
            402 walkthrough below its grid for the deeper technical read. */}
        <section id="pricing" className="pb-14 scroll-mt-20">
          <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-6">
            {t.pricingTitle}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border border-purple-500/30 rounded-lg p-5 bg-slate-900/40">
              <div className="text-[11px] font-bold text-purple-400 tracking-widest mb-1">{t.tierFree}</div>
              <div className="text-2xl font-black mb-3">{t.tierFreeAmount}</div>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> {t.freeFeature1}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> {t.freeFeature2}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> {t.freeFeature3}
                </li>
              </ul>
            </div>
            <div className="border border-emerald-500/30 rounded-lg p-5 bg-slate-900/40">
              <div className="text-[11px] font-bold text-emerald-400 tracking-widest mb-1">{t.tierPayPerCall}</div>
              <div className="text-2xl font-black mb-3">$0.02<span className="text-sm text-slate-400">/call</span></div>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> {t.payPerCallFeature1}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> {t.payPerCallFeature2}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> {t.payPerCallFeature3}
                </li>
              </ul>
            </div>
            <div className="border border-purple-500/30 rounded-lg p-5 bg-slate-900/40">
              <div className="text-[11px] font-bold text-purple-400 tracking-widest mb-1">{t.tierSubscription}</div>
              <div className="text-2xl font-black mb-3">$45<span className="text-sm text-slate-400">/30 days</span></div>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> {t.subFeature1}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> {t.subFeature2}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> {t.subFeature3}
                </li>
              </ul>
            </div>
            <div className="border border-emerald-500/30 rounded-lg p-5 bg-slate-900/40">
              <div className="text-[11px] font-bold text-emerald-400 tracking-widest mb-1">{t.tierX402}</div>
              <div className="text-2xl font-black mb-3">$0.02<span className="text-sm text-slate-400">/call</span></div>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> {t.x402Feature1}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> {t.x402Feature2}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> {t.x402Feature3}
                </li>
              </ul>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-4">{t.pricingNote}</p>

          <a
            href="/risk-api/docs#pricing"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-300 hover:text-white transition mt-3"
          >
            {t.btnReadDocs} →
          </a>
        </section>

        {/* Signup */}
        <section id="get-key" className="pb-14 scroll-mt-20">
          <div className="border-2 border-purple-500/30 rounded-lg bg-slate-900/40 p-5 sm:p-8 backdrop-blur-md">
            <div className="flex items-center gap-2 text-lg font-black mb-1">
              <Lock size={16} className="text-emerald-400" />
              {t.getKeyTitle}
            </div>
            <p className="text-xs text-slate-400 mb-5">{t.getKeySub}</p>
            <Suspense fallback={null}>
              <RiskApiSignupForm />
            </Suspense>
          </div>
        </section>

        {/* Billing — moved here from /risk-api/docs per product-owner
            decision 2026-08-27, right under the free-key signup so an
            existing user with a key doesn't have to hunt for it in the
            docs. Also fixes a mismatch: lib/rate-limit.ts's 402
            upgrade_url has always pointed to /risk-api#billing (this
            exact anchor), which was a broken/wrong link while the panel
            lived at /risk-api/docs#billing instead. */}
        <section id="billing" className="pb-20 scroll-mt-20">
          <div className="flex items-center gap-2 text-lg font-black mb-1">
            <CreditCard size={16} className="text-emerald-400" />
            {t.manageBillingTitle}
          </div>
          <BillingPanel />
        </section>

        <footer className="border-t border-purple-500/20 py-8 text-center space-y-4">
          <div className="flex items-center justify-center gap-6">
            <a
              href="https://x.com/RiskDataApiSol"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
              title="X / Twitter"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://t.me/tnt_house2026"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-blue-400 transition-colors"
              title="Telegram"
            >
              <span className="text-xl">✈️</span>
            </a>
          </div>
          <a href="/risk-api/docs" className="text-xs text-slate-500 hover:text-purple-300 transition inline-flex items-center gap-1.5">
            <Database size={12} />
            {t.btnReadDocs}
          </a>
          <a href="/" className="text-xs text-slate-500 hover:text-purple-300 transition inline-flex items-center gap-1.5">
            <Database size={12} />
            {t.backToTnt}
          </a>
        </footer>
      </main>

      <ChatWidget />
    </div>
  );
}
