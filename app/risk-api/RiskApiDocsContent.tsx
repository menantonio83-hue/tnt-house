// Version 1.0 — app/risk-api/RiskApiDocsContent.tsx
//
// New file, split out of RiskApiPageContent.tsx (which was v1.11, 758
// lines mixing landing + full technical reference on one page — see
// RiskApiPageContent.tsx's own header for the "lendingi doki v odnoy
// stranitse" problem this fixes, per Kimi's audit + product owner's
// call on 2026-08-27, logged in project memory).
//
// Moved here verbatim, same i18n keys, zero translation changes:
// full doc terminal (code tabs + complete EXAMPLE_RESPONSE JSON),
// Response fields reference table, Rate Limiting, Webhooks, Versioning
// & Changelog (all 16 entries), full 4-tier Pricing grid + x402
// how-to-connect card, and the Billing panel. This is intentionally a
// pure content move, not a rewrite — RiskApiPageContent.tsx keeps a
// condensed/visual JSON preview and a "View full schema" link pointing
// to /risk-api/docs (this page) instead of duplicating this content.

'use client';

import { useState } from 'react';
import { Terminal, Database, CreditCard } from 'lucide-react';
import CopyButton from './CopyButton';
import BillingPanel from './BillingPanel';
import LangSwitcher from './LangSwitcher';
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

type CodeTab = 'curl' | 'python' | 'typescript';

const CODE_EXAMPLES: Record<CodeTab, { label: string; code: string }> = {
  curl: { label: 'curl', code: CURL_EXAMPLE },
  python: { label: 'Python', code: PYTHON_EXAMPLE },
  typescript: { label: 'TypeScript', code: TYPESCRIPT_EXAMPLE },
};

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

export default function RiskApiDocsContent() {
  const { t } = useRiskApiLang();
  const [codeTab, setCodeTab] = useState<CodeTab>('curl');

  const responseFields: Array<{ field: string; desc: string }> = [
    { field: 'safety_score', desc: t.fieldSafetyScore },
    { field: 'insider_clusters', desc: t.fieldInsiderClusters },
    { field: 'cluster_analysis', desc: t.fieldClusterAnalysis },
    { field: 'mint_authority / freeze_authority', desc: t.fieldAuthorities },
    { field: 'honeypot_risk / lp_locked', desc: t.fieldHoneypotLpLocked },
    { field: 'holder_distribution', desc: t.fieldHolderDistribution },
    { field: 'market', desc: t.fieldMarket },
    { field: 'hidden_owner / permanent_delegate', desc: t.fieldOwnerDelegate },
    { field: 'buy_tax_percent / sell_tax_percent', desc: t.fieldTax },
    { field: 'dev_wallet_percent', desc: t.fieldDevWallet },
    { field: 'token_program / contract_renounced', desc: t.fieldProgramRenounced },
    { field: 'caps_triggered / dominant_cap', desc: t.fieldCapsTriggered },
    { field: 'vesting_locks', desc: t.fieldVestingLocks },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-mono relative overflow-hidden">
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
          <a href="/risk-api" className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 tracking-wide shrink-0">
            TNT HOUSE — RISK-DATA API DOCS
          </a>
          <div className="flex items-center gap-3">
            <LangSwitcher />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 relative">
        {/* Full doc terminal — code tabs + complete response shape */}
        <section id="reference" className="pt-8 pb-14 scroll-mt-20">
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
                <pre className="text-[10px] sm:text-[11px] text-slate-300 overflow-x-auto leading-relaxed max-h-96">
                  {JSON.stringify(EXAMPLE_RESPONSE, null, 2)}
                </pre>
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed border-t border-purple-500/10 pt-3">
                {t.openApiUsageNote}
              </p>
            </div>
          </div>
        </section>

        {/* Response fields reference */}
        <section className="pb-14 scroll-mt-20">
          <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-6">
            {t.responseFieldsTitle}
          </h2>
          <div className="border border-purple-500/20 rounded-lg overflow-hidden divide-y divide-purple-500/10">
            {responseFields.map((row) => (
              <div key={row.field} className="p-3.5 sm:flex sm:gap-4 bg-slate-900/40">
                <code className="text-[11px] sm:text-xs text-emerald-400 font-bold sm:w-56 shrink-0 block mb-1 sm:mb-0">
                  {row.field}
                </code>
                <p className="text-xs text-slate-400 leading-relaxed">{row.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-4">{t.rateLimitHeadersNote}</p>
          <p className="text-[11px] text-slate-500 mt-1.5">{t.webhooksRoadmapNote}</p>
        </section>

        {/* Rate limiting */}
        <section id="rate-limiting" className="pb-14 scroll-mt-20">
          <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-4">
            {t.rateLimitingTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
            {t.rateLimitingIntro}
          </p>

          <div className="border border-purple-500/20 rounded-lg overflow-hidden divide-y divide-purple-500/10 mb-6">
            {[
              { label: t.rateLimitHeaderLimitLabel, desc: t.rateLimitHeaderLimitDesc },
              { label: t.rateLimitHeaderRemainingLabel, desc: t.rateLimitHeaderRemainingDesc },
              { label: t.rateLimitHeaderResetLabel, desc: t.rateLimitHeaderResetDesc },
              { label: t.rateLimitHeaderCreditLabel, desc: t.rateLimitHeaderCreditDesc },
            ].map((row) => (
              <div key={row.label} className="p-3.5 sm:flex sm:gap-4 bg-slate-900/40">
                <code className="text-[11px] sm:text-xs text-emerald-400 font-bold sm:w-56 shrink-0 block mb-1 sm:mb-0">
                  {row.label}
                </code>
                <p className="text-xs text-slate-400 leading-relaxed">{row.desc}</p>
              </div>
            ))}
          </div>

          <div className="border border-red-500/20 rounded-lg bg-slate-900/40 p-4 sm:p-5">
            <div className="text-xs sm:text-sm font-bold text-red-400 mb-2">{t.rateLimitExceededTitle}</div>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">{t.rateLimitExceededDesc}</p>
            <pre className="text-[10px] sm:text-[11px] text-slate-300 overflow-x-auto leading-relaxed bg-black/30 rounded p-3">
{`HTTP/1.1 402 Payment Required
X-RateLimit-Limit: 15
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2026-07-24T00:00:00.000Z

{
  "error": "Daily free-tier limit reached and call-credit balance is empty",
  "limit": 15,
  "used": 16,
  "reset_at": "2026-07-24T00:00:00.000Z",
  "overage_rate_usd": 0.04,
  "upgrade_url": "https://tnt-audit.com/risk-api#billing",
  "note": "Top up call credits or subscribe on the upgrade_url page — overage is billed at $0.04/call once you have a balance."
}`}
            </pre>
          </div>

          <p className="text-[11px] text-slate-500 mt-4">{t.rateLimitBestPractice}</p>
        </section>

        {/* Webhooks — push notifications instead of polling */}
        <section id="webhooks" className="pb-14 scroll-mt-20">
          <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-4">
            {t.webhooksDocsTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
            {t.webhooksDocsIntro}
          </p>

          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-lg shadow-[0_0_20px_rgba(153,69,255,0.15)] overflow-hidden mb-4">
            <div className="flex items-center justify-between border-b border-purple-500/20 px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
                <Terminal size={13} />
                POST /api/v1/webhooks/subscribe
              </div>
              <span className="text-[10px] text-slate-500">{t.webhooksSubscribeLabel}</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <pre className="text-[11px] sm:text-xs text-emerald-400 overflow-x-auto flex-1 leading-relaxed">
                  {WEBHOOK_SUBSCRIBE_EXAMPLE}
                </pre>
                <CopyButton text={WEBHOOK_SUBSCRIBE_EXAMPLE} label={t.copyLabel} />
              </div>

              <div className="border-t border-purple-500/10 pt-3">
                <div className="text-[10px] text-slate-500 mb-1.5">{t.webhooksResponseLabel} — 201</div>
                <pre className="text-[10px] sm:text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
                  {JSON.stringify(WEBHOOK_SUBSCRIBE_RESPONSE, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 border-2 border-purple-500/40 rounded-lg shadow-[0_0_20px_rgba(153,69,255,0.15)] overflow-hidden mb-4">
            <div className="flex items-center justify-between border-b border-purple-500/20 px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
                <Terminal size={13} />
                POST {'<your callback_url>'}
              </div>
              <span className="text-[10px] text-slate-500">{t.webhooksPayloadLabel}</span>
            </div>
            <div className="p-4 space-y-2">
              <div className="text-[10px] text-slate-500">
                X-Webhook-Signature: <span className="text-emerald-400">hmac-sha256(...)</span>
              </div>
              <pre className="text-[10px] sm:text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
                {JSON.stringify(WEBHOOK_PAYLOAD_EXAMPLE, null, 2)}
              </pre>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">{t.webhooksUnsubscribeNote}</p>
        </section>

        {/* Changelog & versioning */}
        <section id="changelog" className="pb-14 scroll-mt-20">
          <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-4">
            {t.versioningTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">{t.versioningIntro}</p>

          <div className="text-xs sm:text-sm font-bold text-white mb-3">{t.changelogTitle}</div>
          <div className="bg-slate-950 border border-purple-500/30 rounded-lg mb-4 max-h-80 sm:max-h-96 overflow-y-auto overflow-x-hidden p-4">
            <div className="space-y-3">
              {t.changelogEntries.map((entry) => (
                <div key={entry.version} className="border-l-4 border-purple-500/40 pl-4 py-0.5">
                  <div className="flex items-baseline gap-2 mb-1">
                    <code className="text-[11px] sm:text-xs text-emerald-400 font-bold">{entry.version}</code>
                    <span className="text-[10px] text-slate-500">{entry.date}</span>
                  </div>
                  <ul className="space-y-1">
                    {entry.changes.map((change) => (
                      <li key={change} className="text-xs text-slate-400 leading-relaxed">
                        • {change}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-500">{t.changelogNote}</p>
        </section>

        {/* Pricing — full 4-tier grid, moved verbatim from the landing page */}
        <section id="pricing" className="pb-14 scroll-mt-20">
          <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-6">
            {t.pricingTitle}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border border-purple-500/30 rounded-lg p-5 bg-slate-900/40">
              <div className="text-[11px] font-bold text-purple-400 tracking-widest mb-1">{t.tierFree}</div>
              <div className="text-2xl font-black mb-3">{t.tierFreeAmount}</div>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>{t.freeFeature1}</li>
                <li>{t.freeFeature2}</li>
                <li>{t.freeFeature3}</li>
              </ul>
            </div>
            <div className="border border-emerald-500/30 rounded-lg p-5 bg-slate-900/40">
              <div className="text-[11px] font-bold text-emerald-400 tracking-widest mb-1">{t.tierPayPerCall}</div>
              <div className="text-2xl font-black mb-3">$0.04<span className="text-sm text-slate-400">/call</span></div>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>{t.payPerCallFeature1}</li>
                <li>{t.payPerCallFeature2}</li>
                <li>{t.payPerCallFeature3}</li>
              </ul>
            </div>
            <div className="border border-purple-500/30 rounded-lg p-5 bg-slate-900/40">
              <div className="text-[11px] font-bold text-purple-400 tracking-widest mb-1">{t.tierSubscription}</div>
              <div className="text-2xl font-black mb-3">$45<span className="text-sm text-slate-400">/30 days</span></div>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>{t.subFeature1}</li>
                <li>{t.subFeature2}</li>
                <li>{t.subFeature3}</li>
              </ul>
            </div>
            <div className="border border-emerald-500/30 rounded-lg p-5 bg-slate-900/40">
              <div className="text-[11px] font-bold text-emerald-400 tracking-widest mb-1">{t.tierX402}</div>
              <div className="text-2xl font-black mb-3">
                $0.02<span className="text-sm text-slate-400">/call</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>{t.x402Feature1}</li>
                <li>{t.x402Feature2}</li>
                <li>{t.x402Feature3}</li>
              </ul>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-4">{t.pricingNote}</p>

          <div className="mt-6 bg-slate-950 border-2 border-emerald-500/30 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.1)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-emerald-500/20 px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                <Terminal size={13} />
                GET /api/v1/token-risk/x402
              </div>
              <span className="text-[10px] text-slate-500">{t.x402HowToLabel}</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">{t.x402HowToIntro}</p>
              <ol className="space-y-2 text-xs text-slate-400 list-decimal list-inside">
                <li>{t.x402Step1}</li>
                <li>{t.x402Step2}</li>
                <li>{t.x402Step3}</li>
              </ol>
              <div className="border-t border-emerald-500/10 pt-3">
                <pre className="text-[11px] sm:text-xs text-emerald-400 overflow-x-auto leading-relaxed">
{`curl "https://tnt-audit.com/api/v1/token-risk/x402?mint=<MINT_ADDRESS>"
# -> 402 Payment Required, PAYMENT-REQUIRED header has the challenge

# sign + pay with an x402-compatible client, then retry with:
curl "https://tnt-audit.com/api/v1/token-risk/x402?mint=<MINT_ADDRESS>" \\
  -H "X-PAYMENT: <base64 signed payment>"`}
                </pre>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed border-t border-emerald-500/10 pt-3">{t.x402HowToNote}</p>
            </div>
          </div>
        </section>

        {/* Billing */}
        <section id="billing" className="pb-20 scroll-mt-20">
          <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 mb-6 flex items-center gap-2">
            <CreditCard size={20} className="text-emerald-400" />
            {t.manageBillingTitle}
          </h2>
          <BillingPanel />
        </section>

        <footer className="border-t border-purple-500/20 py-8 text-center space-y-4">
          <a href="/risk-api" className="text-xs text-slate-500 hover:text-purple-300 transition inline-flex items-center gap-1.5">
            <Database size={12} />
            {t.backToTnt}
          </a>
        </footer>
      </main>
    </div>
  );
}
