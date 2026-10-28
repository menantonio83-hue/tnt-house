// Version 1.11 — app/risk-api/i18n.ts
//
// v1.11: docs-audit fixes (2026-10-28), x 7 languages: new MCP section
// keys (mcp*), new response-field keys (fieldCapFlags, fieldClusterSupply,
// fieldFlags, fieldDataConfidence, fieldLockedSupply, fieldRugcheckExtra),
// exampleIllustrativeNote, rateLimit402TrimmedNote, perCallSuffix /
// per30DaysSuffix. Updated fieldInsiderClusters / fieldHolderDistribution /
// fieldMarket / rateLimitingIntro (shared free pool) / rateLimitExceededDesc
// / x402Step3 (PAYMENT-SIGNATURE) / x402PythonLabel / changelogNote (no
// footer social links exist). Changelog: new v1.21; v1.19 no longer names
// openlibx402; v1.15 PR #380 marked merged (2026-08-31, verified on
// GitHub). RU: "звонок" -> "запрос", tier labels translated. pricingNote /
// billingSub intentionally untouched. Translations drafted with
// DeepSeek and reviewed.
//
// Version 1.10
//
// v1.10: demoPublicKeyTitle/Remaining/Copy/Note/Dead x 7 languages —
// the public-demo-key experiment's live counter widget
// (DemoPublicKeyWidget.tsx). See lib/demo-public-key-limit.ts for the
// full design; {remaining} and {total} are replaced client-side, same
// convention as statsLine's {n}.
//
// Version 1.9 — app/risk-api/i18n.ts
//
// v1.9: mcpFreeTierNote key x 7 languages. Context: the new dedicated
// 5/day anonymous MCP quota (lib/mcp-anon-limit.ts, app/api/mcp/route.ts
// v1.6) shipped with zero mention of it anywhere on the site — a
// visitor had no way to learn it exists short of reading the MCP
// server's own `instructions` field inside a client like Claude
// Desktop. Rendered next to the integrations cards
// (RiskApiPageContent.tsx) and in the docs page's rate-limiting section
// (RiskApiDocsContent.tsx), both per product owner's explicit request.
//
// Version 1.8 — app/risk-api/i18n.ts
//
// v1.8: new btnTryFree key x 7 languages. Context: the hero's only CTA
// (btnGetKey, "Get a free API key") linked straight to #get-key — the
// EMAIL signup form — even though the zero-friction, no-email TryItWidget
// (3 free checks via browser fingerprint, just paste a mint/CA) sits in
// the very next section on the same page. A visitor scanning the hero
// saw one button, clicked it, and landed on an email form without ever
// noticing the actually-free-right-now widget one scroll below. This
// key powers a new primary button (RiskApiPageContent.tsx v1.7) linking
// to #try-it instead, with btnGetKey demoted to secondary.
//
// Version 1.7 — app/risk-api/i18n.ts
//
// v1.7: fieldVestingLocks description key x 7 languages, plus a v1.12
// changelog entry x 7 languages covering the new vesting_locks[] field
// and the "freely tradeable" top10% concentration-scoring adjustment
// from token-risk-core.ts v1.6 / lib/vesting-lock-detector.ts.
//
// Version 1.6 — app/risk-api/i18n.ts
//
// v1.6: x402 pricing block — tierX402/x402Feature1-3 (4th pricing card)
// plus x402HowToLabel/Intro/Step1-3/Note (the new "how to connect"
// card below the pricing grid) x 7 languages. Pricing was already live
// on x402scan.com (v1.8 changelog entry) but had no card on the
// pricing section itself and no connect instructions anywhere on the
// page — this closes that gap.
//
// Version 1.5 — app/risk-api/i18n.ts
//
// v1.5: 5 new response-fields-table description keys (fieldOwnerDelegate,
// fieldTax, fieldDevWallet, fieldProgramRenounced, fieldCapsTriggered)
// x 7 languages, plus a v1.11 changelog entry x 7 languages, covering
// the 6 new API fields + contractRiskCap scoring tier from
// token-risk-core.ts v1.5 / rugcheck-client.ts v1.3.
//
// Version 1.4 — app/risk-api/i18n.ts
//
// v1.4: added tryIt* keys (10 strings x 7 languages) for the new
// TryItWidget.tsx anon trial funnel step — see that component and
// app/api/v1/trial/check/route.ts. tryItRemaining uses a {n} template
// placeholder replaced client-side (same convention as the rest of
// this file having no built-in i18n interpolation library).
//
// Version 1.3 — app/risk-api/i18n.ts
//
// v1.3: REVERSED the v1.2 decision to leave changelog entries in
// English for every locale. Found live on the deployed page by the
// product owner (screenshot: Russian UI, changelog text still in
// English) and reported as a bug — the "technical/log content" framing
// from v1.2 was my call, not something the owner had signed off on
// specifically for this content, and once they saw it live they wanted
// it translated like everything else on the page. Added ChangelogEntry
// type + changelogEntries: ChangelogEntry[] per language — version
// numbers/dates and inline technical terms (header names, field names,
// HTTP codes) inside the translated text still stay in English, only
// the descriptive prose is now localized.
//
// Version 1.2 — app/risk-api/i18n.ts
//
// v1.2: added Changelog & Versioning section keys (versioning*/
// changelogTitle/changelogNote). The changelog log entries themselves
// are NOT translated — same technical-content convention as the rest
// of this file (dates, version numbers like v1.4, endpoint paths, and
// field names read the same in every language, like the curl example
// or the JSON response sample elsewhere on this page).
//
// Version 1.1 — app/risk-api/i18n.ts
//
// v1.1: added a dedicated Rate Limiting section (rateLimiting*/rateLimit*
// keys) — previously only a single one-line note about rate-limit headers
// existed (rateLimitHeadersNote, kept as-is). Translated across all 7
// languages, following the same technical-content rule as everywhere else
// in this file: header names (X-RateLimit-Limit etc.) and JSON field names
// (limit, used, reset_at, overage_rate_usd, upgrade_url) stay in English
// in every locale.
//
// Version 1.0 — app/risk-api/i18n.ts
//
// Same architecture as app/page.js's TRANSLATIONS object (existing file,
// not modified): a plain object keyed by language code, each holding a
// flat set of UI strings. Reuses the exact same 7 languages (en, es, fr,
// el, ru, it, zh) and the exact same localStorage key ('tnt_lang') so a
// language picked on the main site carries over to /risk-api and vice
// versa — one site-wide preference, not a separate one per page.
//
// Scope: all static UI copy across app/risk-api/page.tsx,
// BillingPanel.tsx, and RiskApiSignupForm.tsx. NOT translated, by
// design: technical/API-literal content (JSON field names like
// safety_score, HTTP method names, the curl example, currency codes
// like SOL/USDC/MRDT) — these are identifiers a developer or bot reads
// the same way regardless of language, exactly like the main site keeps
// "$MRDT / SOL / USDC" untranslated in every locale. Server-generated
// error messages (from API responses) also stay in English — localizing
// those would mean localizing the backend's error strings too, out of
// scope for this pass.

export type LangCode = 'en' | 'es' | 'fr' | 'el' | 'ru' | 'it' | 'zh';

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export interface RiskApiTranslations {
  flag: string;
  name: string;

  // Header
  headerBadge: string;

  // Hero
  heroEyebrow: string;
  statsLine: string;
  heroTitle1: string;
  heroTitle2: string;
  heroSub: string;
  valueCard1Title: string;
  valueCard1Desc: string;
  valueCard2Title: string;
  valueCard2Desc: string;
  valueCard3Title: string;
  valueCard3Desc: string;
  btnTryFree: string;
  btnGetKey: string;
  btnReadDocs: string;
  btnSiteAssistant: string;

  // Docs terminal
  copyCurl: string;

  // How it works
  howItWorksTitle: string;
  integrationsTitle: string;
  integrationsHint: string;
  mcpFreeTierNote: string;
  demoPublicKeyTitle: string;
  demoPublicKeyRemaining: string;
  demoPublicKeyCopy: string;
  demoPublicKeyNote: string;
  demoPublicKeyDead: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;

  // Response fields
  responseFieldsTitle: string;
  fieldSafetyScore: string;
  fieldInsiderClusters: string;
  fieldClusterAnalysis: string;
  fieldAuthorities: string;
  fieldHoneypotLpLocked: string;
  fieldHolderDistribution: string;
  fieldMarket: string;
  fieldOwnerDelegate: string;
  fieldTax: string;
  fieldDevWallet: string;
  fieldProgramRenounced: string;
  fieldCapsTriggered: string;
  fieldVestingLocks: string;
  rateLimitHeadersNote: string;
  openApiUsageNote: string;
  chatBubbleLabel: string;
  chatTitle: string;
  chatWelcome: string;
  chatPlaceholder: string;
  chatLimitReached: string;
  chatConnectionError: string;
  copyOpenApiUrl: string;
  webhooksRoadmapNote: string;

  // Webhooks docs section (v1.9)
  webhooksDocsTitle: string;
  webhooksDocsIntro: string;
  webhooksSubscribeLabel: string;
  webhooksResponseLabel: string;
  webhooksPayloadLabel: string;
  webhooksUnsubscribeNote: string;
  webhooksDeliveryTitle: string;
  webhooksDeliveryText: string;

  // Rate limiting section
  rateLimitingTitle: string;
  rateLimitingIntro: string;
  rateLimitHeaderLimitLabel: string;
  rateLimitHeaderLimitDesc: string;
  rateLimitHeaderRemainingLabel: string;
  rateLimitHeaderRemainingDesc: string;
  rateLimitHeaderResetLabel: string;
  rateLimitHeaderResetDesc: string;
  rateLimitHeaderCreditLabel: string;
  rateLimitHeaderCreditDesc: string;
  rateLimitExceededTitle: string;
  rateLimitExceededDesc: string;
  rateLimitBestPractice: string;

  // Changelog & versioning
  versioningTitle: string;
  versioningIntro: string;
  changelogTitle: string;
  changelogNote: string;
  changelogEntries: ChangelogEntry[];

  // Pricing
  pricingTitle: string;
  tierFree: string;
  tierFreeAmount: string;
  freeFeature1: string;
  freeFeature2: string;
  freeFeature3: string;
  tierPayPerCall: string;
  payPerCallFeature1: string;
  payPerCallFeature2: string;
  payPerCallFeature3: string;
  tierSubscription: string;
  subFeature1: string;
  subFeature2: string;
  subFeature3: string;
  tierX402: string;
  x402Feature1: string;
  x402Feature2: string;
  x402Feature3: string;
  x402HowToLabel: string;
  x402PythonLabel: string;
  x402HowToIntro: string;
  x402Step1: string;
  x402Step2: string;
  x402Step3: string;
  x402HowToNote: string;
  pricingNote: string;

  // Section headers
  manageBillingTitle: string;
  getKeyTitle: string;
  getKeySub: string;
  backToTnt: string;

  // BillingPanel
  billingTitle: string;
  billingSub: string;
  continueBtn: string;
  noKeyYet: string;
  currentTierLabel: string;
  callsUsedLabel: string;
  renewsLabel: string;
  creditBalanceLabel: string;
  subscribeCardTitle: string;
  subscribeCardSub: string;
  topupCardTitle: string;
  topupCardSub: string;
  continueTopup: string;
  chooseCurrencyTitle: string;
  backBtn: string;
  chooseWalletTitle: string;
  invoiceTapNote: string;
  cancelBtn: string;
  payNowBtn: string;
  manualPayTitle: string;
  sendToLabel: string;
  exactAmountLabel: string;
  manualPayNote: string;
  copyLabel: string;
  verifyingText: string;
  verifyingAttemptPrefix: string;
  verifyingAttemptSuffix: string;
  paymentConfirmed: string;
  subActiveUntil: string;
  newCreditBalance: string;
  refreshStatus: string;
  startOver: string;

  // Signup form
  signupReadyTitle: string;
  signupWarningPrefix: string;
  signupWarningSuffix: string;
  signupQuickStartLabel: string;
  signupQuickStartHint: string;
  generatingText: string;
  getFreeKeyBtn: string;
  freeTierNote: string;
  emailPlaceholder: string;
  signupHint: string;
  signupErrEmailExists?: string;
  signupErrIpLimit?: string;
  signupErrGlobalLimit?: string;

  // Try-it-now anon trial widget (no signup)
  tryItTitle: string;
  tryItSubtitle: string;
  tryItFreeToday: string;
  tryItQuickTryLabel: string;
  tryItPlaceholder: string;
  tryItButton: string;
  tryItLoading: string;
  tryItRemaining: string;
  tryItLimitTitle: string;
  tryItLimitBody: string;
  tryItInvalidMint: string;
  tryItErrorGeneric: string;

  // v1.21 docs audit (2026-10-28) — RiskApiDocsContent.tsx v1.4
  mcpTitle: string;
  mcpIntro: string;
  mcpEndpointLabel: string;
  mcpConfigLabel: string;
  mcpConfigNote: string;
  mcpToolsTitle: string;
  mcpNoKeyBadge: string;
  mcpKeyBadge: string;
  mcpToolCheckTokenRisk: string;
  mcpToolBatch: string;
  mcpToolFreeKey: string;
  mcpToolTopup: string;
  mcpToolCheckPayment: string;
  mcpToolHistory: string;
  mcpAuthNote: string;
  exampleIllustrativeNote: string;
  fieldCapFlags: string;
  fieldClusterSupply: string;
  fieldFlags: string;
  fieldDataConfidence: string;
  fieldLockedSupply: string;
  fieldRugcheckExtra: string;
  rateLimit402TrimmedNote: string;
  perCallSuffix: string;
  per30DaysSuffix: string;
}

export const RISK_API_TRANSLATIONS: Record<LangCode, RiskApiTranslations> = {
  en: {
    flag: '🇬🇧',
    name: 'EN',
    headerBadge: 'RISK-DATA API',
    heroEyebrow: 'BUILT FOR AI TRADING AGENTS',
    statsLine: '{n}+ risk checks performed · live on Solana mainnet · sub-1s response',
    heroTitle1: 'Know what a token is hiding',
    heroTitle2: 'before your bot buys it.',
    heroSub: 'One GET request returns a safety score, live insider-cluster detection, and on-chain fundamentals for any Solana mint — the same engine behind TNT House audits, exposed as clean JSON for bots instead of a dashboard for humans.',
    valueCard1Title: 'Safety Score',
    valueCard1Desc: 'One number, 0–100, that sums up mint/freeze authority, honeypot risk, liquidity lock, and holder concentration — instant go/no-go for your bot.',
    valueCard2Title: 'Insider Clusters',
    valueCard2Desc: 'When 20 wallets all trace back to the same first funder, that\'s not 20 separate buyers — it\'s one wallet ready to dump on you.',
    valueCard3Title: 'Honeypot + LP Lock',
    valueCard3Desc: 'Real checks on whether the contract lets you sell, and whether the liquidity can be pulled out from under you.',
    btnTryFree: 'Try it free — no email',
    btnGetKey: 'Get a free API key',
    btnReadDocs: 'Read the docs',
    btnSiteAssistant: 'Site Assistant',
    copyCurl: 'Copy curl',
    howItWorksTitle: 'How it works',
    integrationsTitle: 'Connect your bot or agent',
    integrationsHint: 'Tap a platform to get a ready-to-copy snippet.',
    mcpFreeTierNote: '5 free MCP calls/day, no signup — built for bots & AI agents. Then a free key (15/day) or x402 pay-per-call.',
    demoPublicKeyTitle: 'Public Demo Key — Live Experiment',
    demoPublicKeyRemaining: '{remaining}/{total} calls left. Shared by everyone. Dies forever when it hits 0.',
    demoPublicKeyCopy: 'Copy key',
    demoPublicKeyNote: 'No signup — paste it straight into your bot right now. When it dies, get your own free key below.',
    demoPublicKeyDead: '💀 Public demo key is dead — all calls used, permanently. Get your own free key (15/day, no card) below.',
    step1Title: 'Get a key',
    step1Desc: 'Enter your email below. No credit card, no approval wait — the key is issued instantly.',
    step2Title: 'Call the endpoint',
    step2Desc: 'GET /api/v1/token-risk?mint=<address> with your key in the Authorization header. Typical response time: well under a second.',
    step3Title: 'Act on the score',
    step3Desc: 'Your bot gets a score instantly — act on it or skip the trade.',
    responseFieldsTitle: 'Response fields',
    fieldSafetyScore: '0–100. Weighted from authorities, holder concentration, liquidity, volume, and real insider-cluster penalties.',
    fieldInsiderClusters: "Wallets that share a first-funder: an on-chain-provable insider/sniper signal, not a guess. Each cluster also carries funder_class, funder_label, funder_confidence, and false_positive_likely: known CEX/bridge hot wallets and confirmed high-fan-out infra funders stay visible here but no longer count toward the insider penalty in safety_score. supply_pct is the cluster's share of supply, funder_path the traced funding chain, deployer_linked whether that chain reaches the deployer, exchange_source the exchange that funded the root (each null when unknown).",
    fieldClusterAnalysis: '"pending" on a token\'s first-ever check (cluster trace runs in the background), "complete" once the trace finishes.',
    fieldAuthorities: 'Whether each authority is revoked, and its address if still active.',
    fieldHoneypotLpLocked: 'honeypot_risk (boolean) and lp_locked ({ locked, percent }) from RugCheck. null means it could not be checked, not "safe."',
    fieldHolderDistribution: "Raw largest holder %, top-10 %, risk_level, and holder_count: the deduplicated holder-wallet count when available, otherwise the number of accounts in Solana's top-20-largest-holders RPC response (a real RPC limit). freely_tradeable_top10_percent, freely_tradeable_largest_holder_percent and scoring_risk_level are the figures scoring actually uses (supply locked in vesting contracts subtracted). holder_data_stale / holder_data_age_seconds show when the last good holder snapshot was served instead of a live read.",
    fieldMarket: "Live price, liquidity, 24h volume, 24h change, and token age (age_days, plus age_hours) from DexScreener. If DexScreener has no liquidity figure, it may come from RugCheck (flag liquidity_from_rugcheck).",
    fieldOwnerDelegate: 'hidden_owner and permanent_delegate (booleans) from RugCheck\'s risk list. permanent_delegate is a Token-2022 extension letting that address move or burn ANY holder\'s tokens without permission — a severe risk. null means not checked, never a false "safe".',
    fieldTax: 'buy_tax_percent / sell_tax_percent — Token-2022 transfer-fee extension. Solana\'s transfer fee is symmetric, so both carry the same value. null means the mint has no such extension (not a failed check).',
    fieldDevWallet: 'dev_wallet_percent — the deployer\'s own on-chain holding as % of total supply. A distinct concentration signal from holder_distribution.top10_percent, since the deployer can hold a large stake while sitting outside any top-10 cutoff.',
    fieldProgramRenounced: 'token_program: "standard" if the mint uses one of Solana\'s two canonical token programs, "nonstandard" otherwise. contract_renounced: convenience boolean for mint_authority.revoked && freeze_authority.revoked.',
    fieldCapsTriggered: 'caps_triggered lists every scoring cap that fired for this mint (reason + cap value); dominant_cap is the single tightest one — the actual reason safety_score is what it is, not just a number. explanation gives that same reason as a ready-made sentence.',
    fieldVestingLocks: 'vesting_locks lists known on-chain vesting/lock contracts found among this mint\'s top holders (Streamflow, v1). A large holder genuinely locked for the long term is scored differently from a freely-tradeable whale — the score already accounts for this, holder_distribution.top10_percent stays the raw on-chain figure.',
    rateLimitHeadersNote: 'Every response also includes X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers — plus X-Credit-Balance-Usd once you have a paid tier or credit balance — so your bot can track its quota without ever hitting a 429.',
    openApiUsageNote: 'Works out of the box with ChatGPT Custom GPT Actions (just paste the URL). For Claude, Gemini, or agent frameworks like LangChain/CrewAI, use this spec as the schema source for your own tool integration — most of those need a small adapter, LangChain\'s OpenAPISpec.from_url() being the one that imports it directly.',
    chatBubbleLabel: 'Ask about the API',
    chatTitle: 'Risk-Data API Assistant',
    chatWelcome: 'Hey! Ask me anything about the Risk-Data API — endpoint, pricing, response fields, getting a key.',
    chatPlaceholder: 'Ask a question...',
    chatLimitReached: 'Rate limit reached — try again in a few minutes.',
    chatConnectionError: 'Connection error. ⚡ Get your free API key below.',
    copyOpenApiUrl: 'Copy',
    webhooksRoadmapNote: 'On a token\'s first-ever check, cluster_analysis returns "pending" while the trace runs in the background — re-check the same mint shortly after, or subscribe to a safety_score webhook below to get pushed a notification instead of polling.',
    webhooksDocsTitle: 'Webhooks',
    webhooksDocsIntro: 'Instead of polling token-risk on a schedule, subscribe once to a mint and a safety_score threshold — get a signed HTTP callback the moment it\'s crossed, in either direction.',
    webhooksSubscribeLabel: 'Subscribe',
    webhooksResponseLabel: 'Subscription created',
    webhooksPayloadLabel: 'Delivered to your callback_url',
    webhooksUnsubscribeNote: 'Fires once per crossing, not on every check. Verify each delivery with the X-Webhook-Signature header and the webhook_secret from the subscribe response (shown only once). Call DELETE /api/v1/webhooks/{id} to unsubscribe.',
    webhooksDeliveryTitle: 'Delivery & Retries',
    webhooksDeliveryText: 'Delivered via QStash: on a non-2xx response or timeout, we retry up to 3 times with exponential backoff, then give up. Each event carries a unique id (evt_...) — store it and skip anything you have already processed, since retries resend the identical event. A 200 response marks the event delivered even if your own processing fails afterward, so persist or act on the payload before returning it.',
    rateLimitingTitle: 'Rate Limiting',
    rateLimitingIntro: "Every key gets 15 free requests per calendar day (UTC). Free calls also share a site-wide daily capacity across all free keys: on a busy day you may get a 402 with error_code free_pool_capacity before reaching 15 (your first call of the day always goes through). Calls paid from credit or covered by a subscription never depend on that pool. Go over your quota with no call-credit balance and you get a 402, not a silent block: top up or subscribe and the same key keeps working immediately.",
    rateLimitHeaderLimitLabel: 'X-RateLimit-Limit',
    rateLimitHeaderLimitDesc: 'Your daily quota. Empty on unlimited/admin-issued keys.',
    rateLimitHeaderRemainingLabel: 'X-RateLimit-Remaining',
    rateLimitHeaderRemainingDesc: 'Requests left before the free quota runs out today.',
    rateLimitHeaderResetLabel: 'X-RateLimit-Reset',
    rateLimitHeaderResetDesc: 'ISO timestamp of the next quota reset (next UTC midnight, or your subscription renewal date).',
    rateLimitHeaderCreditLabel: 'X-Credit-Balance-Usd',
    rateLimitHeaderCreditDesc: 'Your current call-credit balance, once you have one.',
    rateLimitExceededTitle: 'What happens over the limit',
    rateLimitExceededDesc: "You get an HTTP 402 with a machine-readable JSON body: error_code, limit, used, reset_at, resets_in, prices, and options[], where each option (top up / subscribe, or x402) carries the exact next step so an agent can continue on its own. No retries needed: as soon as you top up credit or subscribe, the same key starts working again on the very next call.",
    rateLimitBestPractice: 'Check X-RateLimit-Remaining before firing off a batch of calls — reading a header costs nothing, a wasted 402 does not.',
    versioningTitle: 'Versioning & Changelog',
    versioningIntro: "The API is versioned in the URL (/api/v1/...). Within v1, existing fields are never removed, renamed, or repurposed — only added. Integrations should ignore fields they don't recognize rather than fail on them. A genuinely breaking change ships as /api/v2/..., with v1 kept running for a reasonable overlap period — never a silent in-place break.",
    changelogTitle: 'Changelog',
    changelogNote: "No mailing list or announcement feed yet: this page is the place to stay current.",
    changelogEntries: [
      {
        version: 'v1.21',
        date: '2026-10-28',
        changes: [
          "Docs: new MCP server section: endpoint https://www.tnt-audit.com/api/mcp, client config, and all 6 tools (check_token_risk, check_token_risk_batch, get_free_api_key, create_topup_invoice, check_payment, get_token_risk_history), including which ones work without a key.",
          "Docs: the x402 Python example now uses the official x402 SDK (x402[svm,httpx], x402 v2 exact scheme on Solana). The previous openlibx402-client example did not speak x402 v2 and has been removed.",
          "Docs: sample response and field reference brought in line with the live schema (explanation, cluster_supply_pct, flags, data_confidence, cap booleans, locked supply, holder-data freshness, age_hours); the 402 example now shows the full refusal body (error_code, options[]); all example URLs use https://www.tnt-audit.com. No API change.",
        ],
      },
      {
        version: 'v1.20',
        date: '2026-09-15',
        changes: [
          "insider_clusters: each cluster now carries funder_class ('cex' | 'infra' | 'likely_exchange_or_infra' | 'unknown'), funder_label, funder_confidence, and false_positive_likely. A shared first-funder that's a known exchange/bridge hot wallet, or matches a high-fan-out infrastructure pattern (thousands of funded accounts, micro-transfer rent payments, high tx frequency), stays visible in the response for transparency but no longer counts toward the insider penalty in safety_score -- fixes false positives we found live on CEX hot wallets being scored as insider clusters.",
        ],
      },
      {
        version: 'v1.19',
        date: '2026-08-29',
        changes: [
          "Docs: added a runnable Python example for the x402 endpoint alongside the existing curl example (replaced in v1.21 by the official x402 SDK): shows a bot/agent developer the full 402 -> pay -> retry flow in a few lines instead of just the raw HTTP mechanics.",
        ],
      },
      {
        version: 'v1.18',
        date: '2026-08-29',
        changes: [
          "Pay-per-call (unsubscribed PAYG) overage rate: \$0.04 -> \$0.02/call -- lowers the friction of a first trial for a new user who isn't ready to commit to the \$45 subscription yet. As a result PAYG and x402 are now the same rate; x402's pitch was rewritten from \"cheaper than PAYG\" to \"no account or key needed\" -- the accurate differentiator.",
        ],
      },
      {
        version: 'v1.17',
        date: '2026-08-28',
        changes: [
          "Subscription pricing change: monthly quota 1000 -> 5000 calls/30 days, subscribed overage $0.02 -> $0.015/call. Free (15/day), PAYG ($0.04/call unsubscribed), and x402 ($0.02/call) rates are unchanged -- pricing brought below the closest paid competitor (token-rugcheck via x402, $0.02/call for comparable commodity data) after a competitor-research review.",
        ],
      },
      {
        version: 'v1.16',
        date: '2026-08-22',
        changes: [
          "Synced the public OpenAPI spec (openapi.json) with all 5 live API endpoints -- batch, history, webhook subscribe/list, signup, and trial -- previously only the 2 core token-risk endpoints were documented. Also fixed a stale x402 price left over from before the v1.13 cut (spec said $0.07, live price is $0.02).",
          'Added public/llms.txt -- a machine-readable index of the API built for LLM coding agents (Claude Code, Cursor, etc.) to onboard from directly, following the emerging llms.txt convention.',
        ],
      },
      {
        version: 'v1.15',
        date: '2026-08-21',
        changes: [
          'Published an Agent Plugins 1.0 package (plugin.json + mcp.json, agent-plugins.org spec) — lets Agent Plugins-compatible clients discover and connect to the MCP server with no manual setup.',
          "Submitted a Codex-native plugin package to the awesome-codex-plugins directory (hashgraph-online/awesome-codex-plugins, PR #380), HOL Plugin Scanner score 91/100, no critical/high findings, CI passing. Merged on 2026-08-31.",
        ],
      },
      {
        version: 'v1.14',
        date: '2026-08-18',
        changes: [
          'Listed in the DeepSeek Harness (dsh-plugin) ecosystem — the repo now carries the dsh-plugin GitHub topic, making it discoverable by DSH plugin directories and the in-app plugin marketplace.',
          'Submitted a Security skill to the Solana Skills marketplace (sendaifun/skills, feeding solana.com/skills) — pending maintainer review.',
        ],
      },
      {
        version: 'v1.13',
        date: '2026-08-13',
        changes: [
          'Price cut: pay-per-call $0.07 -> $0.04/call, subscribed overage $0.03 -> $0.02/call, subscription $49 -> $45 for 1000 calls/30 days, x402 $0.07 -> $0.02/call — brought in line with comparable market rates after reviewing direct competitors.',
        ],
      },
      {
        version: 'v1.12',
        date: '2026-08-08',
        changes: [
          'New vesting_locks[] field — detects known on-chain vesting/lock contracts (Streamflow, v1) among a mint\'s top holders, so a large holder genuinely locked long-term no longer scores identically to a freely-tradeable whale.',
          'safety_score concentration scoring now uses a "freely tradeable" top10% that subtracts genuinely-locked supply (unless the lock is cancelable by its sender, or unlocking within 30 days) — holder_distribution.top10_percent itself stays the raw, unadjusted on-chain figure.',
        ],
      },
      {
        version: 'v1.11',
        date: '2026-08-08',
        changes: [
          'Six new fields: hidden_owner, permanent_delegate, buy_tax_percent, sell_tax_percent, dev_wallet_percent, token_program, plus contract_renounced — all from the same RugCheck call, zero extra latency.',
          'safety_score now includes a new contractRiskCap tier (permanent_delegate, hidden_owner, tax, non-standard token_program) and a dev-wallet-% axis on the existing market health cap — a token can no longer score high on liquidity/volume alone while carrying a severe contract-level red flag.',
          'New caps_triggered array and dominant_cap field on every response — every scoring cap that fired, plus the single tightest one, so you can see WHY a score is low, not just that it is.',
          'Fixed: rugged, jup_verified, deployer_address, insider_holder_count, and the maturity/market-health/rugged capped booleans were computed since v1.4 but never actually returned by the main, batch, or x402 endpoints — now present on all of them.',
        ],
      },
      {
        version: 'v1.10',
        date: '2026-08-05',
        changes: [
          'honeypot_risk and lp_locked now return real values from RugCheck instead of always null — honeypot_risk is a boolean, lp_locked is { locked, percent }. null still means "could not be checked", never a false-clean default.',
        ],
      },
      {
        version: 'v1.9',
        date: '2026-08-03',
        changes: [
          "Added webhook subscriptions — POST /api/v1/webhooks/subscribe to get pushed a callback when a mint's safety_score crosses a threshold (above/below), instead of polling.",
          "Edge-triggered delivery (fires once per crossing, not repeatedly), HMAC-signed payloads, DELETE /api/v1/webhooks/{id} to unsubscribe.",
        ],
      },
      {
        version: 'v1.8',
        date: '2026-07-27',
        changes: [
          'Added GET /api/v1/token-risk/x402 — pay-per-call access via the x402 protocol (USDC on Solana), no API key required. Same price as the existing pay-per-call rate.',
          'Published as an x402-discoverable resource on x402scan.com, with an OpenAPI x-payment-info schema for automated agent discovery.',
        ],
      },
      {
        version: 'v1.7',
        date: '2026-07-26',
        changes: [
          'Published as an MCP server on Smithery.ai and Glama.ai, alongside the Official MCP Registry — usable directly as a tool by Claude, Cursor, and other MCP-compatible agents.',
          'Published npm plugins for ElizaOS (eliza-plugin-tnt-risk-api) and Solana Agent Kit (solana-agent-kit-plugin-risk-api).',
        ],
      },
      {
        version: 'v1.6',
        date: '2026-07-25',
        changes: ['Published to the Official MCP Registry, mcp.so, RapidAPI, and the Postman Public API Network — more ways to discover and integrate the API.'],
      },
      { version: 'v1.5', date: '2026-07-23', changes: ['Published a ready-to-import Postman collection.'] },
      {
        version: 'v1.4',
        date: '2026-07-21',
        changes: [
          'Published a formal OpenAPI 3.0 spec at /openapi.json.',
          'Rebalanced upstream timeout budget for very large/liquid mints, further reducing false holder_distribution failures.',
        ],
      },
      {
        version: 'v1.3',
        date: '2026-07-19',
        changes: ['Billing security hardening against invoice/payment-matching abuse — no response schema change.'],
      },
      {
        version: 'v1.2',
        date: '2026-07-18',
        changes: [
          'Fixed timeouts on upstream calls that could occasionally return a raw 502 on slower, less-major tokens.',
          'Fixed holder_distribution occasionally reporting holder_count: 0 on high-volume tokens due to a swallowed RPC failure.',
          'Fixed implausible price_change_24h_percent values passed through from upstream market data.',
        ],
      },
      {
        version: 'v1.1',
        date: '2026-07-18',
        changes: ['Added X-RateLimit-Limit / X-RateLimit-Remaining / X-RateLimit-Reset headers, later joined by X-Credit-Balance-Usd.'],
      },
      {
        version: 'v1.0',
        date: '2026-07-18',
        changes: [
          'Public launch: GET /api/v1/token-risk — safety_score, insider_clusters, mint/freeze authority, holder_distribution, market data.',
          'API-key auth, free tier + pay-per-call + subscription billing via Solana Pay.',
        ],
      },
    ],
    pricingTitle: 'Limits & pricing',
    tierFree: 'FREE',
    tierFreeAmount: '15 req/day',
    freeFeature1: 'Full response schema',
    freeFeature2: 'Insider-cluster detection',
    freeFeature3: 'No credit card',
    tierPayPerCall: 'PAY-PER-CALL',
    payPerCallFeature1: 'Top up any amount $5–$500',
    payPerCallFeature2: 'Only charged past the free 15/day',
    payPerCallFeature3: 'Subscribers pay $0.015/call for overage beyond their quota',
    tierSubscription: 'SUBSCRIPTION',
    subFeature1: '5000 calls included',
    subFeature2: '$0.015/call overage after that',
    subFeature3: 'Manual renewal — no auto-charge',
    tierX402: 'X402 (PAY PER CALL, NO KEY)',
    x402Feature1: 'No API key, no signup — pay per request',
    x402Feature2: 'USDC on Solana, settled per call via the x402 protocol',
    x402Feature3: 'Built for autonomous agents that pay their own way',
    x402HowToLabel: 'x402 protocol',
    x402PythonLabel: "Python, official x402 SDK (handles the 402 → pay → retry flow automatically)",
    x402HowToIntro:
      'x402 turns a 402 Payment Required into a working payment flow: call the endpoint with no auth, get a signed payment challenge back, pay it, retry with the receipt.',
    x402Step1: 'GET the endpoint with a mint — no Authorization header needed.',
    x402Step2: 'You get back HTTP 402 with a PAYMENT-REQUIRED header — a signed challenge for $0.02 in USDC on Solana.',
    x402Step3: "Sign the payment with any x402-compatible client (or wallet/agent SDK), then retry the same request with the signed payment in a PAYMENT-SIGNATURE header (what x402 v2 clients send) or an X-PAYMENT header; both are accepted.",
    x402HowToNote:
      'Same $0.02/call rate as the standard pay-per-call tier, but no account or stored key needed — for agents that would rather settle per-request than hold a key. Listed on x402scan.com.',
    pricingNote: 'Paid in $MRDT / SOL / USDC via Solana Pay — same payment flow as the rest of TNT House. Solana Pay can\'t auto-charge, so the subscription is a manual 30-day top-up, not a recurring subscription in the traditional sense.',
    manageBillingTitle: 'Manage billing',
    getKeyTitle: 'Get your API key',
    getKeySub: 'Instant, free, no card required.',
    backToTnt: 'Back to TNT House',
    billingTitle: 'Billing',
    billingSub: 'Subscribe for 5000 calls/30 days, or top up pay-per-call credits. Paid in $MRDT / SOL / USDC via Solana Pay — same flow as the rest of TNT House.',
    continueBtn: 'Continue',
    noKeyYet: 'Don\'t have a key yet? Get one free above first.',
    currentTierLabel: 'Current tier:',
    callsUsedLabel: 'calls used',
    renewsLabel: 'renews',
    creditBalanceLabel: 'Credit balance:',
    subscribeCardTitle: 'Subscribe — $45',
    subscribeCardSub: '5000 calls / 30 days',
    topupCardTitle: 'Top up credits',
    topupCardSub: 'Pay-per-call, $5–$500',
    continueTopup: 'Continue with top-up →',
    chooseCurrencyTitle: 'Choose payment currency',
    backBtn: '← Back',
    chooseWalletTitle: 'Choose wallet',
    invoiceTapNote: 'Tapping will open our payment page inside {wallet}\'s app browser. Pay the exact amount shown — you may see a "domain not yet reviewed" warning, this is expected.',
    cancelBtn: 'Cancel',
    payNowBtn: 'Pay Now',
    manualPayTitle: 'Or pay manually from any wallet',
    sendToLabel: 'Send to',
    exactAmountLabel: 'Exact amount',
    manualPayNote: 'Send exactly this amount from any Solana wallet or exchange. Your credit will be applied automatically once the payment is detected — no need to do anything else after sending.',
    copyLabel: 'Copy',
    verifyingText: 'Checking blockchain for your payment...',
    verifyingAttemptPrefix: 'Attempt',
    verifyingAttemptSuffix: '— this can take a minute or two.',
    paymentConfirmed: 'Payment confirmed!',
    subActiveUntil: 'Subscription active until',
    newCreditBalance: 'New credit balance:',
    refreshStatus: 'Refresh status',
    startOver: 'Start over',
    signupReadyTitle: 'Your API key is ready',
    signupWarningPrefix: 'This key is shown once and can\'t be retrieved again. Copy it now and store it somewhere safe —',
    signupWarningSuffix: 'requests/day, free tier.',
    signupQuickStartLabel: 'Try it now — your key is already in this command:',
    signupQuickStartHint: 'Paste it in a terminal, or drop it into any HTTP client as an Authorization: Bearer header.',
    generatingText: 'Generating...',
    getFreeKeyBtn: 'Get free API key',
    freeTierNote: 'Free tier: 15 requests/day. No credit card. One key per email.',
    signupHint: 'Enter your email, then copy the key that appears — shown once.',
    signupErrEmailExists: 'This email already has an active API key. Keys are shown only once — if you lost yours, contact us to have it reissued.',
    signupErrIpLimit: 'Too many signups from this IP today ({used}/{limit}) — try again after UTC midnight, or use x402 (no signup): GET /api/v1/token-risk/x402.',
    signupErrGlobalLimit: 'Free-key signups are at capacity for today ({used}/{limit}) — try again after UTC midnight.',
    emailPlaceholder: 'Email address',
    tryItTitle: 'Try it now — no signup',
    tryItSubtitle: '3 free checks, no email required',
    tryItFreeToday: 'free today',
    tryItQuickTryLabel: 'or try a well-known token:',
    tryItPlaceholder: 'Paste a Solana mint address',
    tryItButton: 'Check risk',
    tryItLoading: 'Analyzing...',
    tryItRemaining: '{n} free check(s) left',
    tryItLimitTitle: "You've used all 3 free checks",
    tryItLimitBody: 'Get a free API key below — 15 checks/day, no card required.',
    tryItInvalidMint: 'Enter a valid Solana mint address',
    tryItErrorGeneric: 'Something went wrong. Try again.',
    // v1.21 docs audit (2026-10-28): MCP section, response fields, 402 note
    mcpTitle: "MCP server",
    mcpIntro: "Use the API as a tool from Claude, Cursor, and any other MCP-compatible agent: same engine and same JSON as the REST endpoint. Streamable HTTP transport, stateless (JSON-RPC over POST only).",
    mcpEndpointLabel: "Endpoint",
    mcpConfigLabel: "Claude Desktop / Cursor config (no key required)",
    mcpConfigNote: "Clients that support remote MCP servers natively can use the endpoint URL directly instead of mcp-remote.",
    mcpToolsTitle: "Tools",
    mcpNoKeyBadge: "no key",
    mcpKeyBadge: "API key",
    mcpToolCheckTokenRisk: "Safety score, insider clusters, authorities, holder concentration and market data for one mint (the same response as GET /api/v1/token-risk). 5 free calls/day without a key; after that a free key (15/day), call credit, or a subscription.",
    mcpToolBatch: "The same check for up to 25 mints in one call. N mints = N calls, all-or-nothing: the whole batch is rejected if your quota/credit can't cover it.",
    mcpToolFreeKey: "Issues a free API key for an email address (15 checks/day). One active key per email; the key is returned once and also emailed. Signups are capped per IP and per day.",
    mcpToolTopup: "Creates a Solana payment invoice for your key: call-credit top-up ($5–$500) or a 30-day subscription. Returns payment_id, the exact pay_amount and wallet_address.",
    mcpToolCheckPayment: "Checks on-chain whether an invoice from create_topup_invoice has been paid and, if so, credits your key. Safe to repeat; throttled to one check per 5 seconds per payment_id.",
    mcpToolHistory: "Hourly history of safety_score, insider-cluster count, holders, price, liquidity and volume for a mint over the last N days (max 90). Free and not counted against any quota.",
    mcpAuthNote: "Pass a key as an Authorization: Bearer <api_key> header on every MCP request, or as the api_key argument of check_token_risk / check_token_risk_batch if your client can't set headers (the header wins). Quota refusals return error_code and options[] with the exact next step. x402 pay-per-call is a REST endpoint, see Limits & pricing below.",
    exampleIllustrativeNote: "Illustrative response: values are made up for a fictional token, not live data for any real mint. Optional fields such as explanation and note appear only when they apply.",
    fieldCapFlags: "One boolean per scoring cap tier (maturity, market_health, contract_risk, rugged, wash_trading, lp_risk, mint_authority, freeze_authority, honeypot): true only when that cap actually pulled the score down. reliefs_triggered lists mitigations that loosened a cap ({ reason, from, to }), e.g. a burned or locked LP.",
    fieldClusterSupply: "Share of supply (%) held by all counted insider clusters and by the largest one, plus how many wallets they include. Clusters marked false_positive_likely are excluded. null while cluster_analysis is \"pending\" or when a share is unknown. Only top holders are traced, so these are lower bounds.",
    fieldFlags: "Descriptive facts, not verdicts, e.g. young_token, cluster_scan_pending, no_market_data, high_turnover, mint_authority_active, freeze_authority_active, lp_partially_or_not_locked, insider_cluster_detected, shared_cex_or_infra_funder, single_holder_gt_50.",
    fieldDataConfidence: "How complete this answer is: cluster_scan (\"pending\" | \"complete\"), holders_traced, cluster_supply_is_lower_bound, market_data_available, rugcheck_data_available. Use it to tell \"low risk\" apart from \"not enough data\".",
    fieldLockedSupply: "Share of supply (%) currently locked in known non-cancelable vesting/lock contracts, and the part of it that unlocks within the next 30 days. See vesting_locks for the individual contracts.",
    fieldRugcheckExtra: "From RugCheck: rugged (confirmed rug), jup_verified (Jupiter-verified token), lp_burned ({ burned }), deployer_address, and insider_holder_count (rugcheck_insider_holder_count carries the same value). null means it could not be checked.",
    rateLimit402TrimmedNote: "Long text fields (note, options[].next_step) are shortened here; the real response carries the full text.",
    perCallSuffix: "/call",
    per30DaysSuffix: "/30 days",
  },
  es: {
    flag: '🇪🇸',
    name: 'ES',
    headerBadge: 'API DE DATOS DE RIESGO',
    heroEyebrow: 'CREADO PARA AGENTES DE TRADING CON IA',
    statsLine: '{n}+ verificaciones de riesgo realizadas · en vivo en Solana mainnet · respuesta en menos de 1s',
    heroTitle1: 'Descubre qué esconde un token',
    heroTitle2: 'antes de que tu bot lo compre.',
    heroSub: 'Una sola petición GET devuelve una puntuación de seguridad, detección de clústeres de insiders en tiempo real y datos fundamentales on-chain de cualquier mint de Solana — el mismo motor detrás de las auditorías de TNT House, expuesto como JSON limpio para bots en lugar de un panel para humanos.',
    valueCard1Title: 'Safety Score',
    valueCard1Desc: 'Un solo número, 0–100, que resume autoridad de mint/freeze, riesgo de honeypot, bloqueo de liquidez y concentración de holders — go/no-go instantáneo para tu bot.',
    valueCard2Title: 'Clústeres de Insiders',
    valueCard2Desc: 'Cuando 20 wallets se remontan al mismo financiador original, no son 20 compradores distintos — es una sola wallet lista para venderte encima.',
    valueCard3Title: 'Honeypot + Bloqueo LP',
    valueCard3Desc: 'Comprobación real de si el contrato te permite vender, y si la liquidez puede retirarse debajo de ti.',
    btnTryFree: 'Pruébalo gratis — sin email',
    btnGetKey: 'Obtener una API key gratis',
    btnReadDocs: 'Leer la documentación',
    btnSiteAssistant: 'Asistente del sitio',
    copyCurl: 'Copiar curl',
    howItWorksTitle: 'Cómo funciona',
    integrationsTitle: 'Conecta tu bot o agente',
    integrationsHint: 'Toca una plataforma para obtener un snippet listo para copiar.',
    mcpFreeTierNote: '5 llamadas MCP gratis al día, sin registro — pensado para bots y agentes de IA. Después, una clave gratuita (15/día) o x402 por llamada.',
    demoPublicKeyTitle: 'Clave demo pública — Experimento en vivo',
    demoPublicKeyRemaining: 'Quedan {remaining}/{total} llamadas. Compartida por todos. Muere para siempre al llegar a 0.',
    demoPublicKeyCopy: 'Copiar clave',
    demoPublicKeyNote: 'Sin registro — pégala directamente en tu bot ahora mismo. Cuando muera, consigue tu propia clave gratis abajo.',
    demoPublicKeyDead: '💀 La clave demo pública ha muerto — todas las llamadas usadas, para siempre. Consigue tu propia clave gratis (15/día, sin tarjeta) abajo.',
    step1Title: 'Obtén una key',
    step1Desc: 'Introduce tu email abajo. Sin tarjeta de crédito, sin esperar aprobación — la key se emite al instante.',
    step2Title: 'Llama al endpoint',
    step2Desc: 'GET /api/v1/token-risk?mint=<dirección> con tu key en la cabecera Authorization. Tiempo de respuesta típico: bastante menos de un segundo.',
    step3Title: 'Actúa según la puntuación',
    step3Desc: 'Tu bot recibe una puntuación al instante — actúa o descarta el trade.',
    responseFieldsTitle: 'Campos de la respuesta',
    fieldSafetyScore: '0–100. Ponderado según autoridades, concentración de holders, liquidez, volumen y penalizaciones reales por clústeres de insiders.',
    fieldInsiderClusters: "Wallets que comparten un primer financiador: una señal de insider/sniper demostrable on-chain, no una suposición. Cada cluster también lleva funder_class, funder_label, funder_confidence y false_positive_likely: las hot wallets conocidas de CEX/bridge y los funders de infraestructura confirmados de alto fan-out siguen visibles aquí pero ya no cuentan para la penalización de insider en safety_score. supply_pct es la participación del cluster en el suministro, funder_path la cadena de financiación rastreada, deployer_linked si esa cadena llega al deployer, exchange_source el exchange que financió la raíz (cada uno null cuando se desconoce).",
    fieldClusterAnalysis: '"pending" en la primera comprobación de un token (el rastreo de clústeres corre en segundo plano), "complete" cuando termina el rastreo.',
    fieldAuthorities: 'Si cada autoridad está revocada, y su dirección si sigue activa.',
    fieldHoneypotLpLocked: 'honeypot_risk (booleano) y lp_locked ({ locked, percent }) de RugCheck. null significa que no se pudo comprobar, no "seguro".',
    fieldHolderDistribution: "% bruto del mayor holder, % del top-10, risk_level y holder_count: el recuento deduplicado de wallets de holders cuando está disponible; de lo contrario, el número de cuentas en la respuesta RPC de los 20 mayores holders de Solana (un límite real de la RPC). freely_tradeable_top10_percent, freely_tradeable_largest_holder_percent y scoring_risk_level son las cifras que realmente usa la puntuación (suministro bloqueado en contratos de vesting restado). holder_data_stale / holder_data_age_seconds muestran cuándo se sirvió el último snapshot bueno de holders en lugar de una lectura en vivo.",
    fieldMarket: "Precio en vivo, liquidez, volumen 24h, cambio 24h y antigüedad del token (age_days, más age_hours) desde DexScreener. Si DexScreener no tiene cifra de liquidez, puede provenir de RugCheck (flag liquidity_from_rugcheck).",
    fieldOwnerDelegate: 'hidden_owner y permanent_delegate (booleanos) de la lista de riesgos de RugCheck. permanent_delegate es una extensión Token-2022 que permite a esa dirección mover o quemar los tokens de CUALQUIER holder sin permiso — un riesgo severo. null significa que no se comprobó, nunca un falso "seguro".',
    fieldTax: 'buy_tax_percent / sell_tax_percent — extensión de comisión de transferencia de Token-2022. La comisión de Solana es simétrica, así que ambos valores coinciden. null significa que el mint no tiene esa extensión (no un fallo de comprobación).',
    fieldDevWallet: 'dev_wallet_percent — la propia tenencia on-chain del deployer, como % del suministro total. Señal de concentración distinta de holder_distribution.top10_percent, ya que el deployer puede tener una posición grande sin estar en el top-10.',
    fieldProgramRenounced: 'token_program: "standard" si el mint usa uno de los dos programas de token canónicos de Solana, "nonstandard" en caso contrario. contract_renounced: booleano de conveniencia para mint_authority.revoked && freeze_authority.revoked.',
    fieldCapsTriggered: 'caps_triggered lista cada tope de puntuación activado para este mint (motivo + valor del tope); dominant_cap es el más estricto — la razón real del safety_score, no solo un número. explanation da esa misma razón como una frase lista para usar.',
    fieldVestingLocks: 'vesting_locks lista los contratos de vesting/lock on-chain conocidos entre los principales holders de este mint (Streamflow, v1). Un holder grande realmente bloqueado a largo plazo se puntúa de forma distinta a una ballena libremente negociable — el score ya lo tiene en cuenta, holder_distribution.top10_percent sigue siendo la cifra on-chain sin ajustar.',
    rateLimitHeadersNote: 'Cada respuesta también incluye las cabeceras X-RateLimit-Limit, X-RateLimit-Remaining y X-RateLimit-Reset — además de X-Credit-Balance-Usd en cuanto tengas un nivel de pago o saldo de crédito — para que tu bot controle su cuota sin llegar nunca a un 429.',
    openApiUsageNote: 'Funciona directamente con las Actions de Custom GPT de ChatGPT (solo pega la URL). Para Claude, Gemini o frameworks de agentes como LangChain/CrewAI, usa esta spec como fuente del esquema para tu propia integración de herramienta — la mayoría necesita un pequeño adaptador; OpenAPISpec.from_url() de LangChain es el que la importa directamente.',
    chatBubbleLabel: 'Pregunta sobre la API',
    chatTitle: 'Asistente de Risk-Data API',
    chatWelcome: '¡Hola! Pregúntame lo que quieras sobre la Risk-Data API — endpoint, precios, campos de respuesta, cómo conseguir una key.',
    chatPlaceholder: 'Escribe tu pregunta...',
    chatLimitReached: 'Límite alcanzado — inténtalo de nuevo en unos minutos.',
    chatConnectionError: 'Error de conexión. ⚡ Consigue tu API key gratis más abajo.',
    copyOpenApiUrl: 'Copiar',
    webhooksRoadmapNote: 'En la primera verificación de un token, cluster_analysis devuelve "pending" mientras el rastreo se ejecuta en segundo plano — vuelve a comprobar el mismo mint poco después, o suscríbete a un webhook de safety_score más abajo para recibir una notificación en lugar de hacer polling.',
    webhooksDocsTitle: 'Webhooks',
    webhooksDocsIntro: 'En lugar de hacer polling a token-risk según un horario, suscríbete una vez a un mint y un umbral de safety_score — recibe un callback HTTP firmado en el momento en que se cruza, en cualquier dirección.',
    webhooksSubscribeLabel: 'Suscribirse',
    webhooksResponseLabel: 'Suscripción creada',
    webhooksPayloadLabel: 'Entregado a tu callback_url',
    webhooksUnsubscribeNote: 'Se dispara una sola vez por cruce, no en cada verificación. Verifica cada entrega con la cabecera X-Webhook-Signature y el webhook_secret de la respuesta de suscripción (se muestra una sola vez). Llama a DELETE /api/v1/webhooks/{id} para darte de baja.',
    webhooksDeliveryTitle: 'Entrega y reintentos',
    webhooksDeliveryText: 'La entrega se hace a través de QStash: ante una respuesta que no sea 2xx o un timeout, reintentamos hasta 3 veces con backoff exponencial y luego desistimos. Cada evento lleva un id único (evt_...) — guárdalo y omite lo que ya hayas procesado, ya que los reintentos reenvían el mismo evento. Una respuesta 200 marca el evento como entregado aunque tu procesamiento falle después, así que guarda o procesa el payload antes de responder.',
    rateLimitingTitle: 'Límite de solicitudes',
    rateLimitingIntro: "Cada key tiene 15 solicitudes gratuitas por día natural (UTC). Las llamadas gratuitas también comparten una capacidad diaria global del sitio entre todas las claves gratuitas: en un día concurrido puedes recibir un 402 con error_code free_pool_capacity antes de llegar a 15 (tu primera llamada del día siempre pasa). Las llamadas pagadas con crédito o cubiertas por una suscripción nunca dependen de ese pool. Supera tu cuota sin saldo de crédito de llamadas y recibes un 402, no un bloqueo silencioso: recarga o suscríbete y la misma key sigue funcionando de inmediato.",
    rateLimitHeaderLimitLabel: 'X-RateLimit-Limit',
    rateLimitHeaderLimitDesc: 'Tu cuota diaria. Vacío en keys ilimitadas o emitidas por un admin.',
    rateLimitHeaderRemainingLabel: 'X-RateLimit-Remaining',
    rateLimitHeaderRemainingDesc: 'Solicitudes restantes antes de que se agote la cuota gratuita de hoy.',
    rateLimitHeaderResetLabel: 'X-RateLimit-Reset',
    rateLimitHeaderResetDesc: 'Marca de tiempo ISO del próximo reinicio de cuota (medianoche UTC, o la fecha de renovación de tu suscripción).',
    rateLimitHeaderCreditLabel: 'X-Credit-Balance-Usd',
    rateLimitHeaderCreditDesc: 'Tu saldo de crédito actual, en cuanto tengas uno.',
    rateLimitExceededTitle: 'Qué pasa al superar el límite',
    rateLimitExceededDesc: "Recibes un HTTP 402 con un cuerpo JSON legible por máquina: error_code, limit, used, reset_at, resets_in, prices y options[], donde cada opción (recargar / suscribirse, o x402) lleva el siguiente paso exacto para que un agente pueda continuar por su cuenta. No hace falta reintentar: en cuanto recargues crédito o te suscribas, la misma key vuelve a funcionar en la siguiente llamada.",
    rateLimitBestPractice: 'Revisa X-RateLimit-Remaining antes de lanzar un lote de llamadas — leer una cabecera no cuesta nada, un 402 desperdiciado sí.',
    versioningTitle: 'Versionado y registro de cambios',
    versioningIntro: 'La API se versiona en la URL (/api/v1/...). Dentro de v1, los campos existentes nunca se eliminan, renombran ni cambian de propósito — solo se añaden. Las integraciones deberían ignorar los campos que no reconozcan en lugar de fallar por ellos. Un cambio realmente disruptivo se publica como /api/v2/..., manteniendo v1 en funcionamiento durante un periodo de solapamiento razonable — nunca una ruptura silenciosa en el mismo endpoint.',
    changelogTitle: 'Registro de cambios',
    changelogNote: "Todavía no hay lista de correo ni feed de anuncios: esta página es el lugar para mantenerte al día.",
    changelogEntries: [
      {
        version: 'v1.21',
        date: '2026-10-28',
        changes: [
          "Documentación: nueva sección del servidor MCP: endpoint https://www.tnt-audit.com/api/mcp, configuración del cliente y las 6 herramientas (check_token_risk, check_token_risk_batch, get_free_api_key, create_topup_invoice, check_payment, get_token_risk_history), incluyendo cuáles funcionan sin clave.",
          "Documentación: el ejemplo de Python para x402 ahora usa el SDK oficial de x402 (x402[svm,httpx], esquema exacto x402 v2 en Solana). El ejemplo anterior con openlibx402-client no hablaba x402 v2 y se ha eliminado.",
          "Documentación: la respuesta de ejemplo y la referencia de campos se han alineado con el esquema en vivo (explanation, cluster_supply_pct, flags, data_confidence, booleanos de tope, suministro bloqueado, frescura de datos de holders, age_hours); el ejemplo de 402 ahora muestra el cuerpo completo de denegación (error_code, options[]); todas las URLs de ejemplo usan https://www.tnt-audit.com. Sin cambios en la API.",
        ],
      },
      {
        version: 'v1.20',
        date: '2026-09-15',
        changes: [
          "insider_clusters: cada clúster ahora incluye funder_class ('cex' | 'infra' | 'likely_exchange_or_infra' | 'unknown'), funder_label, funder_confidence y false_positive_likely. Un primer financiador compartido que sea una hot wallet conocida de exchange/bridge, o que coincida con un patrón de infraestructura de alta dispersión (miles de cuentas financiadas, pagos de renta por microtransferencias, alta frecuencia de transacciones), permanece visible en la respuesta por motivos de transparencia pero ya no cuenta para la penalización por insider en safety_score -- corrige falsos positivos que encontramos en vivo en hot wallets de CEX que se puntuaban como clústeres insider.",
        ],
      },
      {
        version: 'v1.19',
        date: '2026-08-29',
        changes: [
          "Documentación: se añadió un ejemplo de Python ejecutable para el endpoint x402 junto al ejemplo curl existente (reemplazado en v1.21 por el SDK oficial de x402): muestra a un desarrollador de bots/agentes el flujo completo 402 -> pago -> reintento en unas pocas líneas en lugar de solo la mecánica HTTP cruda.",
        ],
      },
      {
        version: 'v1.18',
        date: '2026-08-29',
        changes: [
          "Tarifa de exceso pay-per-call (PAYG sin suscripción): \$0.04 -> \$0.02/llamada -- reduce la fricción de una primera prueba para un usuario nuevo que aún no está listo para la suscripción de \$45. Como resultado, PAYG y x402 tienen ahora la misma tarifa; el mensaje de x402 se reescribió de \"más barato que PAYG\" a \"sin cuenta ni key necesaria\" -- el diferenciador real.",
        ],
      },
      {
        version: 'v1.17',
        date: '2026-08-28',
        changes: [
          "Cambio de precios de suscripción: cuota mensual 1000 -> 5000 llamadas/30 días, exceso con suscripción $0.02 -> $0.015/llamada. Las tarifas Free (15/día), PAYG ($0.04/llamada sin suscripción) y x402 ($0.02/llamada) no cambian -- precio ajustado por debajo del competidor de pago más cercano (token-rugcheck vía x402, $0.02/llamada por datos comparables) tras una revisión de la competencia.",
        ],
      },
      {
        version: 'v1.16',
        date: '2026-08-22',
        changes: [
          "Se sincronizó la especificación pública OpenAPI (openapi.json) con los 5 endpoints en vivo de la API -- batch, history, webhook subscribe/list, signup y trial -- antes solo estaban documentados los 2 endpoints principales de token-risk. También se corrigió un precio de x402 desactualizado (la especificación decía $0.07, el precio real es $0.02).",
          'Se añadió public/llms.txt -- un índice de la API legible por máquinas, pensado para que agentes de codificación con LLM (Claude Code, Cursor, etc.) se integren directamente, siguiendo la convención emergente llms.txt.',
        ],
      },
      {
        version: 'v1.15',
        date: '2026-08-21',
        changes: [
          'Publicado un paquete Agent Plugins 1.0 (plugin.json + mcp.json, especificación agent-plugins.org) — permite que los clientes compatibles con Agent Plugins descubran y se conecten al servidor MCP sin configuración manual.',
          "Enviado un paquete de plugin nativo de Codex al directorio awesome-codex-plugins (hashgraph-online/awesome-codex-plugins, PR #380), puntuación del HOL Plugin Scanner 91/100, sin hallazgos críticos ni altos, CI en verde. Fusionado el 2026-08-31.",
        ],
      },
      {
        version: 'v1.14',
        date: '2026-08-18',
        changes: [
          'Listado en el ecosistema DeepSeek Harness (dsh-plugin) — el repositorio ahora lleva el topic de GitHub dsh-plugin, haciéndolo descubrible por los directorios de plugins DSH y el marketplace de plugins integrado.',
          'Skill de Seguridad enviado al marketplace Solana Skills (sendaifun/skills, que alimenta solana.com/skills) — pendiente de revisión por los mantenedores.',
        ],
      },
      {
        version: 'v1.13',
        date: '2026-08-13',
        changes: [
          'Bajada de precios: pago por llamada $0.07 -> $0.04/llamada, exceso con suscripción $0.03 -> $0.02/llamada, suscripción $49 -> $45 por 1000 llamadas/30 días, x402 $0.07 -> $0.02/llamada — alineado con tarifas comparables del mercado tras revisar competidores directos.',
        ],
      },
      {
        version: 'v1.12',
        date: '2026-08-08',
        changes: [
          'Nuevo campo vesting_locks[] — detecta contratos de vesting/lock on-chain conocidos (Streamflow, v1) entre los principales holders de un mint, para que un holder grande realmente bloqueado a largo plazo ya no puntúe igual que una ballena libremente negociable.',
          'La puntuación de concentración de safety_score ahora usa un top10% "libremente negociable" que resta el suministro realmente bloqueado (salvo que el lock sea cancelable por su sender, o se desbloquee en los próximos 30 días) — holder_distribution.top10_percent sigue siendo la cifra on-chain sin ajustar.',
        ],
      },
      {
        version: 'v1.11',
        date: '2026-08-08',
        changes: [
          'Seis campos nuevos: hidden_owner, permanent_delegate, buy_tax_percent, sell_tax_percent, dev_wallet_percent, token_program, más contract_renounced — todos de la misma llamada a RugCheck, sin latencia adicional.',
          'safety_score ahora incluye un nuevo nivel contractRiskCap (permanent_delegate, hidden_owner, tax, token_program no estándar) y un eje de dev-wallet-% en el tope de salud de mercado existente — un token ya no puede puntuar alto solo por liquidez/volumen mientras arrastra una señal de alerta grave a nivel de contrato.',
          'Nuevo array caps_triggered y campo dominant_cap en cada respuesta — cada tope de puntuación activado, más el más estricto, para que veas POR QUÉ una puntuación es baja, no solo que lo es.',
          'Corregido: rugged, jup_verified, deployer_address, insider_holder_count y los booleanos capped de maturity/market-health/rugged se calculaban desde v1.4 pero nunca se devolvían realmente en los endpoints principal, batch o x402 — ahora presentes en los tres.',
        ],
      },
      {
        version: 'v1.10',
        date: '2026-08-05',
        changes: [
          'honeypot_risk y lp_locked ahora devuelven valores reales de RugCheck en lugar de siempre null — honeypot_risk es un booleano, lp_locked es { locked, percent }. null sigue significando "no se pudo comprobar", nunca un valor "seguro" falso.',
        ],
      },
      {
        version: 'v1.9',
        date: '2026-08-03',
        changes: [
          "Se añadieron suscripciones a webhooks — POST /api/v1/webhooks/subscribe para recibir un callback cuando el safety_score de un mint cruza un umbral (por encima/por debajo), en lugar de hacer polling.",
          "Entrega basada en el cruce (se dispara una sola vez por cruce, no repetidamente), payloads firmados con HMAC, DELETE /api/v1/webhooks/{id} para darse de baja.",
        ],
      },
      {
        version: 'v1.8',
        date: '2026-07-27',
        changes: [
          'Se añadió GET /api/v1/token-risk/x402 — acceso de pago por llamada mediante el protocolo x402 (USDC en Solana), sin necesidad de clave API. Mismo precio que la tarifa de pago por llamada existente.',
          'Publicado como recurso detectable por x402 en x402scan.com, con un esquema OpenAPI x-payment-info para el descubrimiento automático por agentes.',
        ],
      },
      {
        version: 'v1.7',
        date: '2026-07-26',
        changes: [
          'Publicado como servidor MCP en Smithery.ai y Glama.ai, además del Official MCP Registry — utilizable directamente como herramienta por Claude, Cursor y otros agentes compatibles con MCP.',
          'Publicados plugins de npm para ElizaOS (eliza-plugin-tnt-risk-api) y Solana Agent Kit (solana-agent-kit-plugin-risk-api).',
        ],
      },
      {
        version: 'v1.6',
        date: '2026-07-25',
        changes: ['Publicado en el Official MCP Registry, mcp.so, RapidAPI y el Postman Public API Network — más formas de descubrir e integrar la API.'],
      },
      { version: 'v1.5', date: '2026-07-23', changes: ['Se publicó una colección de Postman lista para importar.'] },
      {
        version: 'v1.4',
        date: '2026-07-21',
        changes: [
          'Se publicó una especificación formal OpenAPI 3.0 en /openapi.json.',
          'Se reequilibró el presupuesto de tiempo de espera para mints muy grandes/líquidos, reduciendo aún más los fallos falsos de holder_distribution.',
        ],
      },
      {
        version: 'v1.3',
        date: '2026-07-19',
        changes: ['Refuerzo de seguridad de facturación contra abusos de coincidencia de invoice/pago — sin cambios en el esquema de respuesta.'],
      },
      {
        version: 'v1.2',
        date: '2026-07-18',
        changes: [
          'Se corrigieron tiempos de espera en llamadas upstream que ocasionalmente devolvían un 502 sin procesar en tokens menos importantes y más lentos.',
          'Se corrigió que holder_distribution reportara ocasionalmente holder_count: 0 en tokens de alto volumen debido a un fallo de RPC silenciado.',
          'Se corrigieron valores implausibles de price_change_24h_percent transmitidos tal cual desde los datos de mercado upstream.',
        ],
      },
      {
        version: 'v1.1',
        date: '2026-07-18',
        changes: ['Se añadieron las cabeceras X-RateLimit-Limit / X-RateLimit-Remaining / X-RateLimit-Reset, a las que luego se unió X-Credit-Balance-Usd.'],
      },
      {
        version: 'v1.0',
        date: '2026-07-18',
        changes: [
          'Lanzamiento público: GET /api/v1/token-risk — safety_score, insider_clusters, mint/freeze authority, holder_distribution, datos de mercado.',
          'Autenticación por API key, facturación free tier + pago por llamada + suscripción vía Solana Pay.',
        ],
      },
    ],
    pricingTitle: 'Límites y precios',
    tierFree: 'GRATIS',
    tierFreeAmount: '15 pet./día',
    freeFeature1: 'Esquema de respuesta completo',
    freeFeature2: 'Detección de clústeres de insiders',
    freeFeature3: 'Sin tarjeta de crédito',
    tierPayPerCall: 'PAGO POR LLAMADA',
    payPerCallFeature1: 'Recarga cualquier importe entre $5 y $500',
    payPerCallFeature2: 'Solo se cobra al superar las 15/día gratis',
    payPerCallFeature3: 'Los suscriptores pagan $0.015/llamada por exceso sobre su cuota',
    tierSubscription: 'SUSCRIPCIÓN',
    subFeature1: '5000 llamadas incluidas',
    subFeature2: '$0.015/llamada de exceso después',
    subFeature3: 'Renovación manual — sin cobro automático',
    tierX402: 'X402 (PAGO POR LLAMADA, SIN KEY)',
    x402Feature1: 'Sin API key, sin registro — pagas por petición',
    x402Feature2: 'USDC en Solana, liquidado por llamada vía el protocolo x402',
    x402Feature3: 'Pensado para agentes autónomos que pagan por sí mismos',
    x402HowToLabel: 'protocolo x402',
    x402PythonLabel: "Python, SDK oficial de x402 (gestiona el flujo 402 → pago → reintento automáticamente)",
    x402HowToIntro:
      'x402 convierte un 402 Payment Required en un flujo de pago funcional: llamas al endpoint sin autenticación, recibes un reto de pago firmado, lo pagas y reintentas con el recibo.',
    x402Step1: 'Haz GET al endpoint con un mint — no necesitas cabecera Authorization.',
    x402Step2: 'Recibes un HTTP 402 con una cabecera PAYMENT-REQUIRED — un reto firmado por $0.02 en USDC en Solana.',
    x402Step3: "Firma el pago con cualquier cliente compatible con x402 (o SDK de wallet/agente) y luego reintenta la misma petición con el pago firmado en una cabecera PAYMENT-SIGNATURE (lo que envían los clientes x402 v2) o una cabecera X-PAYMENT; se aceptan ambas.",
    x402HowToNote:
      'La misma tarifa de $0.02/llamada que el nivel estándar de pago por llamada, pero sin necesidad de cuenta ni de guardar una key — para agentes que prefieren liquidar por petición. Listado en x402scan.com.',
    pricingNote: 'Se paga en $MRDT / SOL / USDC vía Solana Pay — el mismo flujo de pago que el resto de TNT House. Solana Pay no puede cobrar automáticamente, así que la suscripción es una recarga manual de 30 días, no una suscripción recurrente en el sentido tradicional.',
    manageBillingTitle: 'Gestionar facturación',
    getKeyTitle: 'Obtén tu API key',
    getKeySub: 'Al instante, gratis, sin necesidad de tarjeta.',
    backToTnt: 'Volver a TNT House',
    billingTitle: 'Facturación',
    billingSub: 'Suscríbete para 5000 llamadas/30 días, o recarga créditos de pago por llamada. Se paga en $MRDT / SOL / USDC vía Solana Pay — mismo flujo que el resto de TNT House.',
    continueBtn: 'Continuar',
    noKeyYet: '¿Aún no tienes una key? Consigue una gratis más arriba primero.',
    currentTierLabel: 'Nivel actual:',
    callsUsedLabel: 'llamadas usadas',
    renewsLabel: 'renueva',
    creditBalanceLabel: 'Saldo de crédito:',
    subscribeCardTitle: 'Suscribirse — $45',
    subscribeCardSub: '5000 llamadas / 30 días',
    topupCardTitle: 'Recargar créditos',
    topupCardSub: 'Pago por llamada, $5–$500',
    continueTopup: 'Continuar con la recarga →',
    chooseCurrencyTitle: 'Elige la moneda de pago',
    backBtn: '← Atrás',
    chooseWalletTitle: 'Elige tu wallet',
    invoiceTapNote: 'Al pulsar se abrirá nuestra página de pago dentro del navegador de {wallet}. Paga exactamente el importe mostrado — puede aparecer un aviso de "dominio aún no revisado", es normal.',
    cancelBtn: 'Cancelar',
    payNowBtn: 'Pagar ahora',
    manualPayTitle: 'O paga manualmente desde cualquier wallet',
    sendToLabel: 'Enviar a',
    exactAmountLabel: 'Importe exacto',
    manualPayNote: 'Envía exactamente este importe desde cualquier wallet o exchange de Solana. Tu crédito se aplicará automáticamente en cuanto se detecte el pago — no hace falta hacer nada más después de enviarlo.',
    copyLabel: 'Copiar',
    verifyingText: 'Comprobando la blockchain en busca de tu pago...',
    verifyingAttemptPrefix: 'Intento',
    verifyingAttemptSuffix: '— esto puede tardar uno o dos minutos.',
    paymentConfirmed: '¡Pago confirmado!',
    subActiveUntil: 'Suscripción activa hasta',
    newCreditBalance: 'Nuevo saldo de crédito:',
    refreshStatus: 'Actualizar estado',
    startOver: 'Empezar de nuevo',
    signupReadyTitle: 'Tu API key está lista',
    signupWarningPrefix: 'Esta key se muestra una sola vez y no se puede recuperar después. Cópiala ahora y guárdala en un lugar seguro —',
    signupWarningSuffix: 'peticiones/día, nivel gratuito.',
    signupQuickStartLabel: 'Pruébalo ahora — tu key ya está en este comando:',
    signupQuickStartHint: 'Pégalo en una terminal, o úsalo en cualquier cliente HTTP como encabezado Authorization: Bearer.',
    generatingText: 'Generando...',
    getFreeKeyBtn: 'Obtener API key gratis',
    freeTierNote: 'Nivel gratuito: 15 peticiones/día. Sin tarjeta de crédito. Una key por email.',
    signupHint: 'Escribe tu email y copia la key que aparece — se muestra una sola vez.',
    emailPlaceholder: 'Correo electrónico',
    tryItTitle: 'Pruébalo ahora — sin registro',
    tryItSubtitle: '3 comprobaciones gratis, sin email',
    tryItFreeToday: 'gratis hoy',
    tryItQuickTryLabel: 'o prueba un token conocido:',
    tryItPlaceholder: 'Pega una dirección mint de Solana',
    tryItButton: 'Comprobar riesgo',
    tryItLoading: 'Analizando...',
    tryItRemaining: '{n} comprobación(es) gratis restantes',
    tryItLimitTitle: 'Has usado tus 3 comprobaciones gratis',
    tryItLimitBody: 'Consigue una API key gratis abajo — 15 comprobaciones/día, sin tarjeta.',
    tryItInvalidMint: 'Introduce una dirección mint de Solana válida',
    tryItErrorGeneric: 'Algo salió mal. Inténtalo de nuevo.',
    // v1.21 docs audit (2026-10-28): MCP section, response fields, 402 note
    mcpTitle: "Servidor MCP",
    mcpIntro: "Usa la API como herramienta desde Claude, Cursor y cualquier otro agente compatible con MCP: el mismo motor y el mismo JSON que el endpoint REST. Transporte HTTP Streamable, sin estado (JSON-RPC solo mediante POST).",
    mcpEndpointLabel: "Endpoint",
    mcpConfigLabel: "Configuración de Claude Desktop / Cursor (no requiere clave)",
    mcpConfigNote: "Los clientes que soportan servidores MCP remotos de forma nativa pueden usar directamente la URL del endpoint en lugar de mcp-remote.",
    mcpToolsTitle: "Herramientas",
    mcpNoKeyBadge: "sin clave",
    mcpKeyBadge: "clave API",
    mcpToolCheckTokenRisk: "Puntuación de seguridad, clusters de insider, autoridades, concentración de holders y datos de mercado para un mint (la misma respuesta que GET /api/v1/token-risk). 5 llamadas gratis/día sin clave; después, una clave gratuita (15/día), crédito de llamadas o una suscripción.",
    mcpToolBatch: "La misma comprobación para hasta 25 mints en una sola llamada. N mints = N llamadas, todo o nada: el lote completo se rechaza si tu cuota/crédito no puede cubrirlo.",
    mcpToolFreeKey: "Emite una clave API gratuita para una dirección de correo electrónico (15 comprobaciones/día). Una clave activa por correo; la clave se devuelve una sola vez y también se envía por correo. Los registros están limitados por IP y por día.",
    mcpToolTopup: "Crea una factura de pago en Solana para tu key: recarga de crédito de llamadas ($5–$500) o una suscripción de 30 días. Devuelve payment_id, el pay_amount exacto y wallet_address.",
    mcpToolCheckPayment: "Comprueba on-chain si una factura de create_topup_invoice ha sido pagada y, si es así, acredita tu key. Es seguro repetirla; limitado a una comprobación cada 5 segundos por payment_id.",
    mcpToolHistory: "Historial por horas de safety_score, número de clusters de insider, holders, precio, liquidez y volumen para un mint durante los últimos N días (máx. 90). Gratis y no cuenta contra ninguna cuota.",
    mcpAuthNote: "Pasa una key como cabecera Authorization: Bearer <api_key> en cada solicitud MCP, o como el argumento api_key de check_token_risk / check_token_risk_batch si tu cliente no puede establecer cabeceras (la cabecera tiene prioridad). Las denegaciones por cuota devuelven error_code y options[] con el siguiente paso exacto. x402 de pago por llamada es un endpoint REST; consulta Límites y precios más abajo.",
    exampleIllustrativeNote: "Respuesta ilustrativa: los valores son inventados para un token ficticio, no datos en vivo de ningún mint real. Los campos opcionales como explanation y note aparecen solo cuando corresponde.",
    fieldCapFlags: "Un booleano por cada nivel de tope de puntuación (maturity, market_health, contract_risk, rugged, wash_trading, lp_risk, mint_authority, freeze_authority, honeypot): true solo cuando ese tope realmente bajó la puntuación. reliefs_triggered lista las mitigaciones que aflojaron un tope ({ reason, from, to }), p. ej., una LP quemada o bloqueada.",
    fieldClusterSupply: "Porcentaje del suministro (%) en manos de todos los clusters de insider contabilizados y del más grande, más cuántas wallets incluyen. Los clusters marcados como false_positive_likely se excluyen. null mientras cluster_analysis sea \"pending\" o cuando se desconoce una participación. Solo se rastrean los principales holders, por lo que son límites inferiores.",
    fieldFlags: "Hechos descriptivos, no veredictos, p. ej. young_token, cluster_scan_pending, no_market_data, high_turnover, mint_authority_active, freeze_authority_active, lp_partially_or_not_locked, insider_cluster_detected, shared_cex_or_infra_funder, single_holder_gt_50.",
    fieldDataConfidence: "Qué tan completa es esta respuesta: cluster_scan (\"pending\" | \"complete\"), holders_traced, cluster_supply_is_lower_bound, market_data_available, rugcheck_data_available. Úsalo para distinguir \"riesgo bajo\" de \"datos insuficientes\".",
    fieldLockedSupply: "Porcentaje del suministro (%) actualmente bloqueado en contratos de vesting/lock no cancelables conocidos, y la parte que se desbloquea dentro de los próximos 30 días. Consulta vesting_locks para los contratos individuales.",
    fieldRugcheckExtra: "Desde RugCheck: rugged (rug confirmado), jup_verified (token verificado por Jupiter), lp_burned ({ burned }), deployer_address, e insider_holder_count (rugcheck_insider_holder_count lleva el mismo valor). null significa que no se pudo comprobar.",
    rateLimit402TrimmedNote: "Los campos de texto largos (note, options[].next_step) se acortan aquí; la respuesta real lleva el texto completo.",
    perCallSuffix: "/llamada",
    per30DaysSuffix: "/30 días",
  },
  fr: {
    flag: '🇫🇷',
    name: 'FR',
    headerBadge: 'API DE DONNÉES DE RISQUE',
    heroEyebrow: 'CONÇU POUR LES AGENTS DE TRADING IA',
    statsLine: '{n}+ vérifications de risque effectuées · en direct sur Solana mainnet · réponse en moins d\'1s',
    heroTitle1: 'Découvrez ce qu\'un token cache',
    heroTitle2: 'avant que votre bot ne l\'achète.',
    heroSub: 'Une seule requête GET renvoie un score de sécurité, une détection en temps réel des clusters d\'insiders et les fondamentaux on-chain de n\'importe quel mint Solana — le même moteur que les audits TNT House, exposé en JSON propre pour les bots plutôt qu\'un tableau de bord pour humains.',
    valueCard1Title: 'Safety Score',
    valueCard1Desc: 'Un seul chiffre, 0–100, qui résume autorité mint/freeze, risque de honeypot, verrouillage de liquidité et concentration des holders — go/no-go instantané pour votre bot.',
    valueCard2Title: 'Clusters d\'Insiders',
    valueCard2Desc: 'Quand 20 wallets remontent tous au même premier financeur, ce ne sont pas 20 acheteurs distincts — c\'est un seul wallet prêt à vous vendre dessus.',
    valueCard3Title: 'Honeypot + Verrouillage LP',
    valueCard3Desc: 'Vérification réelle que le contrat vous laisse vendre, et que la liquidité ne peut pas être retirée sous vos pieds.',
    btnTryFree: 'Essayez gratuitement — sans email',
    btnGetKey: 'Obtenir une clé API gratuite',
    btnReadDocs: 'Lire la documentation',
    btnSiteAssistant: 'Assistant du site',
    copyCurl: 'Copier curl',
    howItWorksTitle: 'Comment ça marche',
    integrationsTitle: 'Connectez votre bot ou agent',
    integrationsHint: 'Touchez une plateforme pour obtenir un extrait prêt à copier.',
    mcpFreeTierNote: '5 appels MCP gratuits par jour, sans inscription — conçu pour les bots et agents IA. Ensuite, une clé gratuite (15/jour) ou x402 par appel.',
    demoPublicKeyTitle: 'Clé démo publique — Expérience en direct',
    demoPublicKeyRemaining: 'Il reste {remaining}/{total} appels. Partagée par tout le monde. Meurt pour toujours à 0.',
    demoPublicKeyCopy: 'Copier la clé',
    demoPublicKeyNote: "Sans inscription — collez-la directement dans votre bot maintenant. Une fois morte, obtenez votre propre clé gratuite ci-dessous.",
    demoPublicKeyDead: '💀 La clé démo publique est morte — tous les appels utilisés, définitivement. Obtenez votre propre clé gratuite (15/jour, sans carte) ci-dessous.',
    step1Title: 'Obtenez une clé',
    step1Desc: 'Entrez votre email ci-dessous. Pas de carte bancaire, pas d\'attente d\'approbation — la clé est émise instantanément.',
    step2Title: 'Appelez l\'endpoint',
    step2Desc: 'GET /api/v1/token-risk?mint=<adresse> avec votre clé dans l\'en-tête Authorization. Temps de réponse typique : bien moins d\'une seconde.',
    step3Title: 'Agissez selon le score',
    step3Desc: 'Votre bot obtient un score instantanément — agissez ou passez votre chemin.',
    responseFieldsTitle: 'Champs de la réponse',
    fieldSafetyScore: '0–100. Pondéré selon les autorités, la concentration des holders, la liquidité, le volume et de vraies pénalités liées aux clusters d\'insiders.',
    fieldInsiderClusters: "Wallets partageant un même premier financeur : un signal insider/sniper prouvable on-chain, pas une supposition. Chaque cluster porte également funder_class, funder_label, funder_confidence et false_positive_likely : les hot wallets CEX/bridge connus et les funders d'infrastructure à haut fan-out confirmés restent visibles ici mais ne comptent plus dans la pénalité insider du safety_score. supply_pct est la part de l'offre du cluster, funder_path la chaîne de financement tracée, deployer_linked indique si cette chaîne atteint le déployeur, exchange_source l'exchange qui a financé la racine (chacun null si inconnu).",
    fieldClusterAnalysis: '"pending" lors de la toute première vérification d\'un token (le traçage des clusters tourne en arrière-plan), "complete" une fois le traçage terminé.',
    fieldAuthorities: 'Si chaque autorité est révoquée, et son adresse si elle est encore active.',
    fieldHoneypotLpLocked: "honeypot_risk (booléen) et lp_locked ({ locked, percent }) issus de RugCheck. null signifie que la vérification a échoué, jamais « sûr ».",
    fieldHolderDistribution: "Pourcentage brut du plus gros détenteur, % du top-10, risk_level et holder_count : le nombre dédupliqué de portefeuilles détenteurs lorsqu'il est disponible, sinon le nombre de comptes dans la réponse RPC des 20 plus gros détenteurs de Solana (une vraie limite RPC). freely_tradeable_top10_percent, freely_tradeable_largest_holder_percent et scoring_risk_level sont les chiffres que le scoring utilise réellement (offre verrouillée dans des contrats de vesting soustraite). holder_data_stale / holder_data_age_seconds indiquent quand le dernier bon instantané de détenteurs a été servi au lieu d'une lecture en direct.",
    fieldMarket: "Prix en direct, liquidité, volume 24h, variation 24h et âge du token (age_days, plus age_hours) via DexScreener. Si DexScreener n'a pas de donnée de liquidité, elle peut provenir de RugCheck (drapeau liquidity_from_rugcheck).",
    fieldOwnerDelegate: 'hidden_owner et permanent_delegate (booléens) issus de la liste de risques de RugCheck. permanent_delegate est une extension Token-2022 permettant à cette adresse de déplacer ou brûler les tokens de N\'IMPORTE QUEL holder sans permission — un risque sévère. null signifie non vérifié, jamais un faux "sûr".',
    fieldTax: 'buy_tax_percent / sell_tax_percent — extension de frais de transfert Token-2022. Les frais de Solana sont symétriques, donc les deux valeurs sont identiques. null signifie que le mint n\'a pas cette extension (pas un échec de vérification).',
    fieldDevWallet: 'dev_wallet_percent — la propre participation on-chain du déployeur, en % de l\'offre totale. Signal de concentration distinct de holder_distribution.top10_percent, car le déployeur peut détenir une part importante sans figurer dans le top 10.',
    fieldProgramRenounced: 'token_program : "standard" si le mint utilise l\'un des deux programmes de token canoniques de Solana, "nonstandard" sinon. contract_renounced : booléen pratique pour mint_authority.revoked && freeze_authority.revoked.',
    fieldCapsTriggered: "caps_triggered liste chaque plafond de score déclenché pour ce mint (raison + valeur du plafond) ; dominant_cap est le plus strict — la vraie raison du safety_score, pas juste un chiffre. explanation donne cette même raison sous forme de phrase prête à l'emploi.",
    fieldVestingLocks: "vesting_locks liste les contrats de vesting/lock on-chain connus parmi les principaux détenteurs de ce mint (Streamflow, v1). Un gros détenteur réellement bloqué à long terme est noté différemment d'une baleine librement négociable — le score en tient déjà compte, holder_distribution.top10_percent reste le chiffre on-chain brut.",
    rateLimitHeadersNote: 'Chaque réponse inclut aussi les en-têtes X-RateLimit-Limit, X-RateLimit-Remaining et X-RateLimit-Reset — plus X-Credit-Balance-Usd dès que vous avez un abonnement payant ou un solde de crédit — pour que votre bot suive son quota sans jamais tomber sur un 429.',
    openApiUsageNote: 'Fonctionne directement avec les Actions des Custom GPT de ChatGPT (il suffit de coller l\'URL). Pour Claude, Gemini ou des frameworks d\'agents comme LangChain/CrewAI, utilisez cette spec comme source de schéma pour votre propre intégration d\'outil — la plupart ont besoin d\'un petit adaptateur, OpenAPISpec.from_url() de LangChain étant celui qui l\'importe directement.',
    chatBubbleLabel: 'Question sur l\'API',
    chatTitle: 'Assistant Risk-Data API',
    chatWelcome: 'Salut ! Pose-moi tes questions sur la Risk-Data API — endpoint, tarifs, champs de réponse, comment obtenir une clé.',
    chatPlaceholder: 'Pose ta question...',
    chatLimitReached: 'Limite atteinte — réessaie dans quelques minutes.',
    chatConnectionError: 'Erreur de connexion. ⚡ Obtenez votre clé API gratuite ci-dessous.',
    copyOpenApiUrl: 'Copier',
    webhooksRoadmapNote: 'Lors de la toute première vérification d\'un token, cluster_analysis renvoie "pending" pendant que l\'analyse s\'exécute en arrière-plan — revérifiez le même mint peu après, ou abonnez-vous à un webhook de safety_score ci-dessous pour recevoir une notification au lieu de faire du polling.',
    webhooksDocsTitle: 'Webhooks',
    webhooksDocsIntro: 'Plutôt que de faire du polling sur token-risk selon un planning, abonnez-vous une seule fois à un mint et un seuil de safety_score — recevez un callback HTTP signé dès qu\'il est franchi, dans un sens comme dans l\'autre.',
    webhooksSubscribeLabel: 'S\'abonner',
    webhooksResponseLabel: 'Abonnement créé',
    webhooksPayloadLabel: 'Livré à votre callback_url',
    webhooksUnsubscribeNote: 'Se déclenche une seule fois par franchissement, pas à chaque vérification. Vérifiez chaque livraison avec l\'en-tête X-Webhook-Signature et le webhook_secret renvoyé lors de l\'abonnement (affiché une seule fois). Appelez DELETE /api/v1/webhooks/{id} pour vous désabonner.',
    webhooksDeliveryTitle: 'Livraison et nouvelles tentatives',
    webhooksDeliveryText: 'La livraison passe par QStash : en cas de réponse autre que 2xx ou de timeout, nous réessayons jusqu\'à 3 fois avec un backoff exponentiel, puis abandonnons. Chaque événement porte un id unique (evt_...) — conservez-le et ignorez ce que vous avez déjà traité, car les nouvelles tentatives renvoient le même événement. Une réponse 200 marque l\'événement comme livré même si votre traitement échoue ensuite, donc enregistrez ou traitez le payload avant de répondre.',
    rateLimitingTitle: 'Limitation de débit',
    rateLimitingIntro: "Chaque clé dispose de 15 requêtes gratuites par jour calendaire (UTC). Les appels gratuits partagent également une capacité quotidienne globale du site entre toutes les clés gratuites : un jour chargé, vous pouvez recevoir un 402 avec error_code free_pool_capacity avant d'atteindre 15 (votre premier appel de la journée passe toujours). Les appels payés par crédit ou couverts par un abonnement ne dépendent jamais de ce pool. Dépassez votre quota sans solde de crédit d'appel et vous recevez un 402, pas un blocage silencieux : rechargez ou abonnez-vous et la même clé refonctionne immédiatement.",
    rateLimitHeaderLimitLabel: 'X-RateLimit-Limit',
    rateLimitHeaderLimitDesc: 'Votre quota quotidien. Vide pour les clés illimitées/émises par un admin.',
    rateLimitHeaderRemainingLabel: 'X-RateLimit-Remaining',
    rateLimitHeaderRemainingDesc: 'Requêtes restantes avant épuisement du quota gratuit du jour.',
    rateLimitHeaderResetLabel: 'X-RateLimit-Reset',
    rateLimitHeaderResetDesc: 'Horodatage ISO de la prochaine réinitialisation du quota (minuit UTC, ou la date de renouvellement de votre abonnement).',
    rateLimitHeaderCreditLabel: 'X-Credit-Balance-Usd',
    rateLimitHeaderCreditDesc: 'Votre solde de crédit actuel, dès que vous en avez un.',
    rateLimitExceededTitle: 'Que se passe-t-il au-delà de la limite',
    rateLimitExceededDesc: "Vous recevez un HTTP 402 avec un corps JSON lisible par machine : error_code, limit, used, reset_at, resets_in, prices et options[], où chaque option (recharger / s'abonner, ou x402) porte l'étape suivante exacte pour qu'un agent puisse continuer de lui-même. Pas besoin de réessayer : dès que vous rechargez du crédit ou vous abonnez, la même clé refonctionne dès le prochain appel.",
    rateLimitBestPractice: "Vérifiez X-RateLimit-Remaining avant de lancer un lot d'appels — lire un en-tête ne coûte rien, un 402 gâché si.",
    versioningTitle: 'Versions et journal des modifications',
    versioningIntro: "L'API est versionnée dans l'URL (/api/v1/...). Au sein de v1, les champs existants ne sont jamais supprimés, renommés ni détournés de leur usage — seulement ajoutés. Les intégrations doivent ignorer les champs qu'elles ne reconnaissent pas plutôt que d'échouer à cause d'eux. Un changement véritablement cassant est publié sous /api/v2/..., avec v1 maintenue en fonctionnement pendant une période de recouvrement raisonnable — jamais une rupture silencieuse sur place.",
    changelogTitle: 'Journal des modifications',
    changelogNote: "Pas encore de liste de diffusion ni de flux d'annonces : cette page est l'endroit pour rester à jour.",
    changelogEntries: [
      {
        version: 'v1.21',
        date: '2026-10-28',
        changes: [
          "Docs : nouvelle section serveur MCP : endpoint https://www.tnt-audit.com/api/mcp, configuration client, et les 6 outils (check_token_risk, check_token_risk_batch, get_free_api_key, create_topup_invoice, check_payment, get_token_risk_history), y compris ceux qui fonctionnent sans clé.",
          "Docs : l'exemple Python x402 utilise désormais le SDK x402 officiel (x402[svm,httpx], schéma exact x402 v2 sur Solana). L'exemple précédent openlibx402-client ne parlait pas x402 v2 et a été supprimé.",
          "Docs : exemple de réponse et référence des champs alignés sur le schéma en direct (explanation, cluster_supply_pct, flags, data_confidence, booléens de plafond, offre verrouillée, fraîcheur des données de détenteurs, age_hours) ; l'exemple 402 montre maintenant le corps de refus complet (error_code, options[]) ; toutes les URL d'exemple utilisent https://www.tnt-audit.com. Aucun changement d'API.",
        ],
      },
      {
        version: 'v1.20',
        date: '2026-09-15',
        changes: [
          "insider_clusters: chaque cluster comporte désormais funder_class ('cex' | 'infra' | 'likely_exchange_or_infra' | 'unknown'), funder_label, funder_confidence et false_positive_likely. Un premier financeur partagé qui est un hot wallet connu d'exchange/bridge, ou qui correspond à un motif d'infrastructure à forte ramification (des milliers de comptes financés, des paiements de loyer par micro-transfert, une fréquence de transactions élevée), reste visible dans la réponse par souci de transparence mais ne compte plus dans la pénalité d'initié dans safety_score -- corrige les faux positifs que nous avons trouvés en direct sur les hot wallets CEX qui étaient notés comme des clusters d'initiés.",
        ],
      },
      {
        version: 'v1.19',
        date: '2026-08-29',
        changes: [
          "Docs : ajout d'un exemple Python exécutable pour l'endpoint x402 en plus de l'exemple curl existant (remplacé en v1.21 par le SDK x402 officiel) : montre à un développeur de bot/agent le flux complet 402 -> paiement -> nouvelle tentative en quelques lignes au lieu de la seule mécanique HTTP brute.",
        ],
      },
      {
        version: 'v1.18',
        date: '2026-08-29',
        changes: [
          "Tarif de dépassement pay-per-call (PAYG sans abonnement) : 0,04 \$ -> 0,02 \$/appel -- réduit la friction d'un premier essai pour un nouvel utilisateur pas encore prêt pour l'abonnement à 45 \$. Résultat : PAYG et x402 ont désormais le même tarif ; le message de x402 est passé de \"moins cher que PAYG\" à \"sans compte ni clé nécessaire\" -- le véritable argument différenciant.",
        ],
      },
      {
        version: 'v1.17',
        date: '2026-08-28',
        changes: [
          "Changement de tarification de l'abonnement : quota mensuel 1000 -> 5000 appels/30 jours, dépassement avec abonnement 0,02 $ -> 0,015 $/appel. Les tarifs Free (15/jour), PAYG (0,04 $/appel sans abonnement) et x402 (0,02 $/appel) restent inchangés -- prix ajusté en dessous du concurrent payant le plus proche (token-rugcheck via x402, 0,02 $/appel pour des données comparables) après une revue de la concurrence.",
        ],
      },
      {
        version: 'v1.16',
        date: '2026-08-22',
        changes: [
          "Synchronisation de la spécification OpenAPI publique (openapi.json) avec les 5 endpoints API en production -- batch, history, webhook subscribe/list, signup et trial -- seuls les 2 endpoints principaux token-risk étaient documentés jusqu'ici. Correction également d'un prix x402 obsolète dans la spec (elle indiquait 0,07 $, le prix réel est 0,02 $).",
          "Ajout de public/llms.txt -- un index de l'API lisible par machine, conçu pour que les agents de codage LLM (Claude Code, Cursor, etc.) s'y intègrent directement, suivant la convention émergente llms.txt.",
        ],
      },
      {
        version: 'v1.15',
        date: '2026-08-21',
        changes: [
          "Publication d'un paquet Agent Plugins 1.0 (plugin.json + mcp.json, spécification agent-plugins.org) — permet aux clients compatibles Agent Plugins de découvrir et de se connecter au serveur MCP sans configuration manuelle.",
          "Soumission d'un paquet de plugin natif Codex au répertoire awesome-codex-plugins (hashgraph-online/awesome-codex-plugins, PR #380), score HOL Plugin Scanner 91/100, aucune découverte critique ou élevée, CI au vert. Fusionné le 2026-08-31.",
        ],
      },
      {
        version: 'v1.14',
        date: '2026-08-18',
        changes: [
          "Référencé dans l'écosystème DeepSeek Harness (dsh-plugin) — le dépôt porte désormais le topic GitHub dsh-plugin, ce qui le rend détectable par les annuaires de plugins DSH et la marketplace de plugins intégrée.",
          "Skill de Sécurité soumise à la marketplace Solana Skills (sendaifun/skills, qui alimente solana.com/skills) — en attente de revue par les mainteneurs.",
        ],
      },
      {
        version: 'v1.13',
        date: '2026-08-13',
        changes: [
          "Baisse de prix : paiement à l'appel 0,07 $ -> 0,04 $/appel, dépassement avec abonnement 0,03 $ -> 0,02 $/appel, abonnement 49 $ -> 45 $ pour 1000 appels/30 jours, x402 0,07 $ -> 0,02 $/appel — aligné sur les tarifs comparables du marché après examen des concurrents directs.",
        ],
      },
      {
        version: 'v1.12',
        date: '2026-08-08',
        changes: [
          "Nouveau champ vesting_locks[] — détecte les contrats de vesting/lock on-chain connus (Streamflow, v1) parmi les principaux détenteurs d'un mint, pour qu'un gros détenteur réellement bloqué à long terme n'obtienne plus le même score qu'une baleine librement négociable.",
          'Le score de concentration de safety_score utilise désormais un top10% « librement négociable » qui soustrait l\'offre réellement bloquée (sauf si le lock est annulable par son sender, ou se débloque dans les 30 jours) — holder_distribution.top10_percent reste le chiffre on-chain brut, non ajusté.',
        ],
      },
      {
        version: 'v1.11',
        date: '2026-08-08',
        changes: [
          "Six nouveaux champs : hidden_owner, permanent_delegate, buy_tax_percent, sell_tax_percent, dev_wallet_percent, token_program, plus contract_renounced — tous issus du même appel RugCheck, sans latence supplémentaire.",
          "safety_score inclut désormais un nouveau niveau contractRiskCap (permanent_delegate, hidden_owner, taxe, token_program non standard) et un axe dev-wallet-% sur le plafond de santé de marché existant — un token ne peut plus obtenir un score élevé uniquement grâce à la liquidité/au volume tout en portant un signal d'alerte grave au niveau du contrat.",
          "Nouveau tableau caps_triggered et champ dominant_cap sur chaque réponse — chaque plafond de score déclenché, plus le plus strict, pour voir POURQUOI un score est bas, pas seulement qu'il l'est.",
          "Corrigé : rugged, jup_verified, deployer_address, insider_holder_count et les booléens capped de maturity/market-health/rugged étaient calculés depuis v1.4 mais jamais réellement renvoyés par les endpoints principal, batch ou x402 — désormais présents sur les trois.",
        ],
      },
      {
        version: 'v1.10',
        date: '2026-08-05',
        changes: [
          "honeypot_risk et lp_locked renvoient désormais de vraies valeurs issues de RugCheck au lieu de toujours null — honeypot_risk est un booléen, lp_locked est { locked, percent }. null signifie toujours « impossible à vérifier », jamais une fausse valeur « sûre ».",
        ],
      },
      {
        version: 'v1.9',
        date: '2026-08-03',
        changes: [
          "Ajout des abonnements webhook — POST /api/v1/webhooks/subscribe pour recevoir un callback quand le safety_score d'un mint franchit un seuil (au-dessus/en dessous), au lieu de faire du polling.",
          "Livraison déclenchée par le franchissement (se déclenche une seule fois par franchissement, pas de façon répétée), payloads signés HMAC, DELETE /api/v1/webhooks/{id} pour se désabonner.",
        ],
      },
      {
        version: 'v1.8',
        date: '2026-07-27',
        changes: [
          "Ajout de GET /api/v1/token-risk/x402 — accès payant à l'appel via le protocole x402 (USDC sur Solana), sans clé API requise. Même tarif que le tarif payant à l'appel existant.",
          "Publié comme ressource détectable par x402 sur x402scan.com, avec un schéma OpenAPI x-payment-info pour la découverte automatique par les agents.",
        ],
      },
      {
        version: 'v1.7',
        date: '2026-07-26',
        changes: [
          "Publié comme serveur MCP sur Smithery.ai et Glama.ai, en plus de l'Official MCP Registry — utilisable directement comme outil par Claude, Cursor et d'autres agents compatibles MCP.",
          "Plugins npm publiés pour ElizaOS (eliza-plugin-tnt-risk-api) et Solana Agent Kit (solana-agent-kit-plugin-risk-api).",
        ],
      },
      {
        version: 'v1.6',
        date: '2026-07-25',
        changes: ["Publié sur l'Official MCP Registry, mcp.so, RapidAPI et le Postman Public API Network — davantage de moyens de découvrir et d'intégrer l'API."],
      },
      { version: 'v1.5', date: '2026-07-23', changes: ["Publication d'une collection Postman prête à importer."] },
      {
        version: 'v1.4',
        date: '2026-07-21',
        changes: [
          "Publication d'une spécification OpenAPI 3.0 formelle à /openapi.json.",
          'Rééquilibrage du budget de délai d\'attente pour les mints très volumineux/liquides, réduisant encore les faux échecs de holder_distribution.',
        ],
      },
      {
        version: 'v1.3',
        date: '2026-07-19',
        changes: ['Renforcement de la sécurité de facturation contre les abus de correspondance invoice/paiement — aucun changement du schéma de réponse.'],
      },
      {
        version: 'v1.2',
        date: '2026-07-18',
        changes: [
          "Correction des délais d'attente sur les appels en amont pouvant occasionnellement renvoyer un 502 brut sur des tokens plus lents et moins importants.",
          'Correction de holder_distribution signalant parfois holder_count: 0 sur des tokens à fort volume à cause d\'un échec RPC avalé.',
          'Correction de valeurs invraisemblables de price_change_24h_percent transmises telles quelles depuis les données de marché en amont.',
        ],
      },
      {
        version: 'v1.1',
        date: '2026-07-18',
        changes: ['Ajout des en-têtes X-RateLimit-Limit / X-RateLimit-Remaining / X-RateLimit-Reset, rejoints plus tard par X-Credit-Balance-Usd.'],
      },
      {
        version: 'v1.0',
        date: '2026-07-18',
        changes: [
          'Lancement public : GET /api/v1/token-risk — safety_score, insider_clusters, mint/freeze authority, holder_distribution, données de marché.',
          "Authentification par clé API, facturation free tier + paiement à l'appel + abonnement via Solana Pay.",
        ],
      },
    ],
    pricingTitle: 'Limites et tarifs',
    tierFree: 'GRATUIT',
    tierFreeAmount: '15 req/jour',
    freeFeature1: 'Schéma de réponse complet',
    freeFeature2: 'Détection des clusters d\'insiders',
    freeFeature3: 'Pas de carte bancaire',
    tierPayPerCall: 'PAIEMENT À L\'APPEL',
    payPerCallFeature1: 'Rechargez n\'importe quel montant entre $5 et $500',
    payPerCallFeature2: 'Facturé seulement au-delà des 15/jour gratuits',
    payPerCallFeature3: 'Les abonnés paient 0,015 $/appel pour le dépassement de leur quota',
    tierSubscription: 'ABONNEMENT',
    subFeature1: '5000 appels inclus',
    subFeature2: '$0.015/appel de dépassement ensuite',
    subFeature3: 'Renouvellement manuel — pas de prélèvement automatique',
    tierX402: 'X402 (PAIEMENT À L\'APPEL, SANS CLÉ)',
    x402Feature1: 'Sans clé API, sans inscription — paiement à la requête',
    x402Feature2: 'USDC sur Solana, réglé par appel via le protocole x402',
    x402Feature3: 'Conçu pour les agents autonomes qui paient eux-mêmes',
    x402HowToLabel: 'protocole x402',
    x402PythonLabel: "Python, SDK x402 officiel (gère le flux 402 → paiement → nouvelle tentative automatiquement)",
    x402HowToIntro:
      "x402 transforme un 402 Payment Required en un vrai flux de paiement : appelez l'endpoint sans authentification, recevez un défi de paiement signé, payez-le, puis réessayez avec le reçu.",
    x402Step1: "Faites un GET sur l'endpoint avec un mint — pas besoin d'en-tête Authorization.",
    x402Step2: 'Vous recevez un HTTP 402 avec un en-tête PAYMENT-REQUIRED — un défi signé pour 0,02 $ en USDC sur Solana.',
    x402Step3: "Signez le paiement avec n'importe quel client compatible x402 (ou SDK wallet/agent), puis réessayez la même requête avec le paiement signé dans un en-tête PAYMENT-SIGNATURE (ce que les clients x402 v2 envoient) ou un en-tête X-PAYMENT ; les deux sont acceptés.",
    x402HowToNote:
      'Le même tarif de 0,02 $/appel que le niveau paiement à l\'appel standard, mais sans compte ni clé à stocker — pour les agents qui préfèrent régler par requête. Référencé sur x402scan.com.',
    pricingNote: 'Payable en $MRDT / SOL / USDC via Solana Pay — le même flux de paiement que le reste de TNT House. Solana Pay ne peut pas prélever automatiquement, donc l\'abonnement est une recharge manuelle de 30 jours, pas un abonnement récurrent au sens traditionnel.',
    manageBillingTitle: 'Gérer la facturation',
    getKeyTitle: 'Obtenez votre clé API',
    getKeySub: 'Instantané, gratuit, sans carte requise.',
    backToTnt: 'Retour à TNT House',
    billingTitle: 'Facturation',
    billingSub: 'Abonnez-vous pour 5000 appels/30 jours, ou rechargez des crédits à l\'appel. Payable en $MRDT / SOL / USDC via Solana Pay — même flux que le reste de TNT House.',
    continueBtn: 'Continuer',
    noKeyYet: 'Pas encore de clé ? Obtenez-en une gratuite plus haut d\'abord.',
    currentTierLabel: 'Niveau actuel :',
    callsUsedLabel: 'appels utilisés',
    renewsLabel: 'se renouvelle',
    creditBalanceLabel: 'Solde de crédit :',
    subscribeCardTitle: 'S\'abonner — $45',
    subscribeCardSub: '5000 appels / 30 jours',
    topupCardTitle: 'Recharger des crédits',
    topupCardSub: 'Paiement à l\'appel, $5–$500',
    continueTopup: 'Continuer la recharge →',
    chooseCurrencyTitle: 'Choisissez la devise de paiement',
    backBtn: '← Retour',
    chooseWalletTitle: 'Choisissez votre wallet',
    invoiceTapNote: 'Appuyer ouvrira notre page de paiement dans le navigateur intégré de {wallet}. Payez exactement le montant affiché — un avertissement "domaine pas encore vérifié" peut apparaître, c\'est normal.',
    cancelBtn: 'Annuler',
    payNowBtn: 'Payer maintenant',
    manualPayTitle: 'Ou payez manuellement depuis n\'importe quel wallet',
    sendToLabel: 'Envoyer à',
    exactAmountLabel: 'Montant exact',
    manualPayNote: 'Envoyez exactement ce montant depuis n\'importe quel wallet ou exchange Solana. Votre crédit sera appliqué automatiquement dès que le paiement sera détecté — rien d\'autre à faire après l\'envoi.',
    copyLabel: 'Copier',
    verifyingText: 'Vérification de la blockchain pour votre paiement...',
    verifyingAttemptPrefix: 'Tentative',
    verifyingAttemptSuffix: '— cela peut prendre une à deux minutes.',
    paymentConfirmed: 'Paiement confirmé !',
    subActiveUntil: 'Abonnement actif jusqu\'au',
    newCreditBalance: 'Nouveau solde de crédit :',
    refreshStatus: 'Actualiser le statut',
    startOver: 'Recommencer',
    signupReadyTitle: 'Votre clé API est prête',
    signupWarningPrefix: 'Cette clé n\'est affichée qu\'une seule fois et ne peut plus être récupérée. Copiez-la maintenant et conservez-la en lieu sûr —',
    signupWarningSuffix: 'requêtes/jour, niveau gratuit.',
    signupQuickStartLabel: 'Essayez-le maintenant — votre clé est déjà dans cette commande :',
    signupQuickStartHint: 'Collez-la dans un terminal, ou utilisez-la dans n\'importe quel client HTTP comme en-tête Authorization: Bearer.',
    generatingText: 'Génération...',
    getFreeKeyBtn: 'Obtenir une clé API gratuite',
    freeTierNote: 'Niveau gratuit : 15 requêtes/jour. Pas de carte bancaire. Une clé par email.',
    signupHint: 'Entrez votre email, puis copiez la clé affichée — elle n’apparaît qu’une fois.',
    emailPlaceholder: 'Adresse email',
    tryItTitle: 'Essayez maintenant — sans inscription',
    tryItSubtitle: '3 vérifications gratuites, sans email',
    tryItFreeToday: "gratuit aujourd'hui",
    tryItQuickTryLabel: 'ou essayez un token connu :',
    tryItPlaceholder: 'Collez une adresse mint Solana',
    tryItButton: 'Vérifier le risque',
    tryItLoading: 'Analyse en cours...',
    tryItRemaining: '{n} vérification(s) gratuite(s) restante(s)',
    tryItLimitTitle: 'Vous avez utilisé vos 3 vérifications gratuites',
    tryItLimitBody: 'Obtenez une clé API gratuite ci-dessous — 15 vérifications/jour, sans carte.',
    tryItInvalidMint: 'Entrez une adresse mint Solana valide',
    tryItErrorGeneric: "Une erreur s'est produite. Réessayez.",
    // v1.21 docs audit (2026-10-28): MCP section, response fields, 402 note
    mcpTitle: "Serveur MCP",
    mcpIntro: "Utilisez l'API comme un outil depuis Claude, Cursor et tout autre agent compatible MCP : même moteur et même JSON que l'endpoint REST. Transport Streamable HTTP, sans état (JSON-RPC via POST uniquement).",
    mcpEndpointLabel: "Endpoint",
    mcpConfigLabel: "Configuration Claude Desktop / Cursor (aucune clé requise)",
    mcpConfigNote: "Les clients qui prennent en charge les serveurs MCP distants nativement peuvent utiliser l'URL de l'endpoint directement au lieu de mcp-remote.",
    mcpToolsTitle: "Outils",
    mcpNoKeyBadge: "sans clé",
    mcpKeyBadge: "clé API",
    mcpToolCheckTokenRisk: "Score de sécurité, clusters insider, autorités, concentration des détenteurs et données de marché pour un mint (la même réponse que GET /api/v1/token-risk). 5 appels gratuits/jour sans clé ; ensuite une clé gratuite (15/jour), du crédit d'appel ou un abonnement.",
    mcpToolBatch: "La même vérification pour jusqu'à 25 mints en un seul appel. N mints = N appels, tout ou rien : le lot entier est rejeté si votre quota/crédit ne peut pas le couvrir.",
    mcpToolFreeKey: "Émet une clé API gratuite pour une adresse e-mail (15 vérifications/jour). Une clé active par e-mail ; la clé est renvoyée une seule fois et également envoyée par e-mail. Les inscriptions sont plafonnées par IP et par jour.",
    mcpToolTopup: "Crée une facture de paiement Solana pour votre clé : recharge de crédit d'appel (5 $ – 500 $) ou un abonnement de 30 jours. Renvoie payment_id, le montant exact pay_amount et wallet_address.",
    mcpToolCheckPayment: "Vérifie sur la chaîne si une facture de create_topup_invoice a été payée et, si c'est le cas, crédite votre clé. Peut être répété sans risque ; limité à une vérification toutes les 5 secondes par payment_id.",
    mcpToolHistory: "Historique horaire du safety_score, du nombre de clusters insider, des détenteurs, du prix, de la liquidité et du volume pour un mint sur les N derniers jours (max 90). Gratuit et non décompté d'aucun quota.",
    mcpAuthNote: "Passez une clé comme en-tête Authorization: Bearer <api_key> sur chaque requête MCP, ou comme argument api_key de check_token_risk / check_token_risk_batch si votre client ne peut pas définir d'en-têtes (l'en-tête a priorité). Les refus de quota renvoient error_code et options[] avec l'étape suivante exacte. Le paiement à l'appel x402 est un endpoint REST, voir Limites et tarifs ci-dessous.",
    exampleIllustrativeNote: "Réponse illustrative : les valeurs sont inventées pour un token fictif, pas des données en direct pour un mint réel. Les champs optionnels tels que explanation et note n'apparaissent que lorsqu'ils s'appliquent.",
    fieldCapFlags: "Un booléen par niveau de plafond de scoring (maturity, market_health, contract_risk, rugged, wash_trading, lp_risk, mint_authority, freeze_authority, honeypot) : true uniquement lorsque ce plafond a réellement tiré le score vers le bas. reliefs_triggered liste les atténuations qui ont assoupli un plafond ({ reason, from, to }), par exemple une LP brûlée ou verrouillée.",
    fieldClusterSupply: "Part de l'offre (%) détenue par tous les clusters insider comptés et par le plus grand, plus le nombre de portefeuilles qu'ils incluent. Les clusters marqués false_positive_likely sont exclus. null tant que cluster_analysis est \"pending\" ou lorsqu'une part est inconnue. Seuls les principaux détenteurs sont tracés, donc ce sont des bornes inférieures.",
    fieldFlags: "Faits descriptifs, pas des verdicts, par exemple young_token, cluster_scan_pending, no_market_data, high_turnover, mint_authority_active, freeze_authority_active, lp_partially_or_not_locked, insider_cluster_detected, shared_cex_or_infra_funder, single_holder_gt_50.",
    fieldDataConfidence: "Dans quelle mesure cette réponse est complète : cluster_scan (\"pending\" | \"complete\"), holders_traced, cluster_supply_is_lower_bound, market_data_available, rugcheck_data_available. Utilisez-le pour distinguer \"risque faible\" de \"données insuffisantes\".",
    fieldLockedSupply: "Part de l'offre (%) actuellement verrouillée dans des contrats de vesting/lock non annulables connus, et la partie qui se déverrouille dans les 30 prochains jours. Voir vesting_locks pour les contrats individuels.",
    fieldRugcheckExtra: "Depuis RugCheck : rugged (rug confirmé), jup_verified (token vérifié par Jupiter), lp_burned ({ burned }), deployer_address et insider_holder_count (rugcheck_insider_holder_count porte la même valeur). null signifie qu'il n'a pas pu être vérifié.",
    rateLimit402TrimmedNote: "Les champs de texte longs (note, options[].next_step) sont raccourcis ici ; la réponse réelle contient le texte complet.",
    perCallSuffix: "/appel",
    per30DaysSuffix: "/30 jours",
  },
  el: {
    flag: '🇬🇷',
    name: 'EL',
    headerBadge: 'API ΔΕΔΟΜΕΝΩΝ ΚΙΝΔΥΝΟΥ',
    heroEyebrow: 'ΦΤΙΑΓΜΕΝΟ ΓΙΑ AI TRADING AGENTS',
    statsLine: '{n}+ έλεγχοι ρίσκου έχουν εκτελεστεί · live στο Solana mainnet · απόκριση κάτω από 1 δευτ.',
    heroTitle1: 'Μάθε τι κρύβει ένα token',
    heroTitle2: 'πριν το αγοράσει το bot σου.',
    heroSub: 'Ένα μόνο αίτημα GET επιστρέφει βαθμολογία ασφάλειας, ανίχνευση insider-cluster σε πραγματικό χρόνο και on-chain θεμελιώδη στοιχεία για κάθε Solana mint — η ίδια μηχανή πίσω από τα audits του TNT House, εκτεθειμένη ως καθαρό JSON για bots αντί για dashboard για ανθρώπους.',
    valueCard1Title: 'Safety Score',
    valueCard1Desc: 'Ένας αριθμός, 0–100, που συνοψίζει mint/freeze authority, honeypot risk, κλείδωμα ρευστότητας και συγκέντρωση κατόχων — άμεσο go/no-go για το bot σου.',
    valueCard2Title: 'Insider Clusters',
    valueCard2Desc: 'Όταν 20 wallets οδηγούν όλα στον ίδιο πρώτο χρηματοδότη, δεν είναι 20 ξεχωριστοί αγοραστές — είναι ένα wallet έτοιμο να σου την πέσει.',
    valueCard3Title: 'Honeypot + Κλείδωμα LP',
    valueCard3Desc: 'Πραγματικός έλεγχος αν το συμβόλαιο σε αφήνει να πουλήσεις, και αν η ρευστότητα μπορεί να τραβηχτεί κάτω από τα πόδια σου.',
    btnTryFree: 'Δοκίμασέ το δωρεάν — χωρίς email',
    btnGetKey: 'Πάρε δωρεάν API key',
    btnReadDocs: 'Διάβασε την τεκμηρίωση',
    btnSiteAssistant: 'Βοηθός ιστότοπου',
    copyCurl: 'Αντιγραφή curl',
    howItWorksTitle: 'Πώς λειτουργεί',
    integrationsTitle: 'Σύνδεσε το bot ή τον agent σου',
    integrationsHint: 'Πάτησε μια πλατφόρμα για ένα έτοιμο προς αντιγραφή snippet.',
    mcpFreeTierNote: '5 δωρεάν κλήσεις MCP την ημέρα, χωρίς εγγραφή — φτιαγμένο για bots και AI agents. Μετά, δωρεάν κλειδί (15/ημέρα) ή x402 ανά κλήση.',
    demoPublicKeyTitle: 'Δημόσιο demo κλειδί — Ζωντανό πείραμα',
    demoPublicKeyRemaining: 'Απομένουν {remaining}/{total} κλήσεις. Κοινόχρηστο από όλους. Πεθαίνει οριστικά στο 0.',
    demoPublicKeyCopy: 'Αντιγραφή κλειδιού',
    demoPublicKeyNote: 'Χωρίς εγγραφή — επικόλλησέ το κατευθείαν στο bot σου τώρα. Όταν πεθάνει, πάρε το δικό σου δωρεάν κλειδί παρακάτω.',
    demoPublicKeyDead: '💀 Το δημόσιο demo κλειδί πέθανε — όλες οι κλήσεις χρησιμοποιήθηκαν, οριστικά. Πάρε το δικό σου δωρεάν κλειδί (15/ημέρα, χωρίς κάρτα) παρακάτω.',
    step1Title: 'Πάρε ένα key',
    step1Desc: 'Βάλε το email σου παρακάτω. Χωρίς πιστωτική κάρτα, χωρίς αναμονή έγκρισης — το key εκδίδεται άμεσα.',
    step2Title: 'Κάλεσε το endpoint',
    step2Desc: 'GET /api/v1/token-risk?mint=<διεύθυνση> με το key σου στο header Authorization. Τυπικός χρόνος απόκρισης: αρκετά κάτω από ένα δευτερόλεπτο.',
    step3Title: 'Δράσε βάσει της βαθμολογίας',
    step3Desc: 'Το bot σου παίρνει σκορ αμέσως — προχώρα ή πέρασε το trade.',
    responseFieldsTitle: 'Πεδία απόκρισης',
    fieldSafetyScore: '0–100. Σταθμισμένο από authorities, συγκέντρωση holders, ρευστότητα, όγκο και πραγματικές ποινές insider-cluster.',
    fieldInsiderClusters: "Wallets που μοιράζονται έναν πρώτο χρηματοδότη: ένα on-chain αποδείξιμο σήμα insider/sniper, όχι εικασία. Κάθε cluster φέρει επίσης funder_class, funder_label, funder_confidence και false_positive_likely: γνωστά hot wallets CEX/bridge και επιβεβαιωμένοι infra funders υψηλής διασποράς παραμένουν ορατά εδώ αλλά δεν προσμετρώνται πλέον στην ποινή insider στο safety_score. Το supply_pct είναι το μερίδιο προμήθειας του cluster, το funder_path η ανιχνευμένη αλυσίδα χρηματοδότησης, το deployer_linked αν αυτή η αλυσίδα φτάνει στον deployer, το exchange_source το ανταλλακτήριο που χρηματοδότησε τη ρίζα (κάθε ένα null όταν είναι άγνωστο).",
    fieldClusterAnalysis: '"pending" στον πρώτο έλεγχο ενός token (η ανίχνευση clusters τρέχει στο παρασκήνιο), "complete" όταν ολοκληρωθεί η ανίχνευση.',
    fieldAuthorities: 'Αν κάθε authority έχει ανακληθεί, και η διεύθυνσή της αν είναι ακόμα ενεργή.',
    fieldHoneypotLpLocked: 'honeypot_risk (boolean) και lp_locked ({ locked, percent }) από το RugCheck. Το null σημαίνει ότι δεν ήταν δυνατός ο έλεγχος, όχι «ασφαλές».',
    fieldHolderDistribution: "Ακατέργαστο % μεγαλύτερου holder, top-10 %, risk_level και holder_count: ο αριθμός αποδιπλασιασμένων holder-wallets όταν είναι διαθέσιμος, αλλιώς ο αριθμός λογαριασμών στην απόκριση RPC των 20 μεγαλύτερων holders της Solana (πραγματικό όριο RPC). Τα freely_tradeable_top10_percent, freely_tradeable_largest_holder_percent και scoring_risk_level είναι τα νούμερα που χρησιμοποιεί πραγματικά η βαθμολόγηση (αφαιρείται η προμήθεια κλειδωμένη σε vesting contracts). Τα holder_data_stale / holder_data_age_seconds δείχνουν πότε εξυπηρετήθηκε το τελευταίο καλό snapshot holder αντί για ζωντανή ανάγνωση.",
    fieldMarket: "Ζωντανή τιμή, ρευστότητα, όγκος 24ω, μεταβολή 24ω και ηλικία token (age_days, συν age_hours) από το DexScreener. Αν το DexScreener δεν έχει νούμερο ρευστότητας, μπορεί να προέρχεται από το RugCheck (σημαία liquidity_from_rugcheck).",
    fieldOwnerDelegate: 'hidden_owner και permanent_delegate (boolean) από τη λίστα κινδύνων του RugCheck. Το permanent_delegate είναι επέκταση Token-2022 που επιτρέπει σε εκείνη τη διεύθυνση να μετακινεί ή να καίει τα tokens ΟΠΟΙΟΥΔΗΠΟΤΕ holder χωρίς άδεια — σοβαρός κίνδυνος. Το null σημαίνει ότι δεν ελέγχθηκε, ποτέ ψευδές «ασφαλές».',
    fieldTax: 'buy_tax_percent / sell_tax_percent — επέκταση transfer-fee του Token-2022. Η προμήθεια στη Solana είναι συμμετρική, οπότε και τα δύο έχουν την ίδια τιμή. Το null σημαίνει ότι το mint δεν έχει τέτοια επέκταση (όχι αποτυχημένος έλεγχος).',
    fieldDevWallet: 'dev_wallet_percent — το δικό του on-chain μερίδιο του deployer ως % της συνολικής προσφοράς. Διαφορετικό σήμα συγκέντρωσης από το holder_distribution.top10_percent, αφού ο deployer μπορεί να κρατά μεγάλο μερίδιο χωρίς να είναι στους top-10.',
    fieldProgramRenounced: 'token_program: «standard» αν το mint χρησιμοποιεί ένα από τα δύο κανονικά token programs της Solana, αλλιώς «nonstandard». contract_renounced: βολικό boolean για mint_authority.revoked && freeze_authority.revoked.',
    fieldCapsTriggered: 'Το caps_triggered απαριθμεί κάθε όριο βαθμολογίας που ενεργοποιήθηκε για αυτό το mint (λόγος + τιμή ορίου)· το dominant_cap είναι το πιο αυστηρό — ο πραγματικός λόγος για το safety_score, όχι απλώς ένας αριθμός. Το explanation δίνει τον ίδιο λόγο ως έτοιμη πρόταση.',
    fieldVestingLocks: 'Το vesting_locks απαριθμεί γνωστά on-chain vesting/lock συμβόλαια που βρέθηκαν ανάμεσα στους κορυφαίους κατόχους αυτού του mint (Streamflow, v1). Ένας μεγάλος κάτοχος πραγματικά κλειδωμένος μακροπρόθεσμα βαθμολογείται διαφορετικά από μια ελεύθερα διαπραγματεύσιμη φάλαινα — το score το λαμβάνει ήδη υπόψη, το holder_distribution.top10_percent παραμένει το ακατέργαστο on-chain νούμερο.',
    rateLimitHeadersNote: 'Κάθε απόκριση περιλαμβάνει επίσης τα headers X-RateLimit-Limit, X-RateLimit-Remaining και X-RateLimit-Reset — συν το X-Credit-Balance-Usd μόλις έχεις πληρωμένο επίπεδο ή υπόλοιπο πίστωσης — ώστε το bot σου να παρακολουθεί το όριό του χωρίς ποτέ να πέσει σε 429.',
    openApiUsageNote: 'Λειτουργεί απευθείας με τα Custom GPT Actions του ChatGPT (απλώς επικόλλησε το URL). Για Claude, Gemini ή agent frameworks όπως LangChain/CrewAI, χρησιμοποίησε αυτό το spec ως πηγή σχήματος για τη δική σου ενσωμάτωση εργαλείου — τα περισσότερα χρειάζονται έναν μικρό προσαρμογέα, με το OpenAPISpec.from_url() του LangChain να το εισάγει απευθείας.',
    chatBubbleLabel: 'Ρώτα για το API',
    chatTitle: 'Βοηθός Risk-Data API',
    chatWelcome: 'Γεια! Ρώτα με ό,τι θες για το Risk-Data API — endpoint, τιμές, πεδία απόκρισης, πώς να πάρεις key.',
    chatPlaceholder: 'Γράψε την ερώτησή σου...',
    chatLimitReached: 'Το όριο ξεπεράστηκε — δοκίμασε ξανά σε λίγα λεπτά.',
    chatConnectionError: 'Σφάλμα σύνδεσης. ⚡ Πάρε το δωρεάν API key σου παρακάτω.',
    copyOpenApiUrl: 'Αντιγραφή',
    webhooksRoadmapNote: 'Στον πρώτο έλεγχο ενός token, το cluster_analysis επιστρέφει "pending" όσο η ανάλυση εκτελείται στο παρασκήνιο — ξαναέλεγξε το ίδιο mint λίγο αργότερα, ή κάνε εγγραφή σε ένα webhook του safety_score παρακάτω για να λαμβάνεις ειδοποίηση αντί να κάνεις polling.',
    webhooksDocsTitle: 'Webhooks',
    webhooksDocsIntro: 'Αντί να κάνεις polling στο token-risk σε πρόγραμμα, κάνε εγγραφή μία φορά σε ένα mint και ένα όριο safety_score — λάβε ένα υπογεγραμμένο HTTP callback τη στιγμή που το διασχίζει, προς οποιαδήποτε κατεύθυνση.',
    webhooksSubscribeLabel: 'Εγγραφή',
    webhooksResponseLabel: 'Η συνδρομή δημιουργήθηκε',
    webhooksPayloadLabel: 'Παραδίδεται στο callback_url σου',
    webhooksUnsubscribeNote: 'Ενεργοποιείται μία φορά ανά διάσχιση, όχι σε κάθε έλεγχο. Επιβεβαίωσε κάθε παράδοση με το header X-Webhook-Signature και το webhook_secret από την απόκριση εγγραφής (εμφανίζεται μία μόνο φορά). Κάλεσε DELETE /api/v1/webhooks/{id} για διαγραφή συνδρομής.',
    webhooksDeliveryTitle: 'Παράδοση και επαναλήψεις',
    webhooksDeliveryText: 'Η παράδοση γίνεται μέσω του QStash: σε απόκριση που δεν είναι 2xx ή σε timeout, επαναλαμβάνουμε έως 3 φορές με εκθετικό backoff και μετά σταματάμε. Κάθε συμβάν έχει μοναδικό id (evt_...) — αποθήκευσέ το και παράβλεψε όσα έχεις ήδη επεξεργαστεί, καθώς οι επαναλήψεις στέλνουν ξανά το ίδιο συμβάν. Μια απόκριση 200 σημαίνει ότι το συμβάν παραδόθηκε ακόμα κι αν η δική σου επεξεργασία αποτύχει μετά, γι\' αυτό αποθήκευσε ή επεξεργάσου το payload πριν απαντήσεις.',
    rateLimitingTitle: 'Όριο αιτημάτων',
    rateLimitingIntro: "Κάθε key λαμβάνει 15 δωρεάν αιτήματα ανά ημερολογιακή ημέρα (UTC). Οι δωρεάν κλήσεις μοιράζονται επίσης μια ημερήσια χωρητικότητα σε όλο το site για όλα τα δωρεάν keys: μια μέρα με φόρτο μπορεί να λάβεις 402 με error_code free_pool_capacity πριν φτάσεις τα 15 (η πρώτη κλήση της ημέρας περνάει πάντα). Οι κλήσεις που πληρώνονται από πίστωση ή καλύπτονται από συνδρομή δεν εξαρτώνται ποτέ από αυτό το pool. Αν ξεπεράσεις το όριό σου χωρίς υπόλοιπο πίστωσης κλήσεων, λαμβάνεις 402, όχι σιωπηλό μπλοκάρισμα: φόρτωσε υπόλοιπο ή κάνε συνδρομή και το ίδιο key συνεχίζει να δουλεύει αμέσως.",
    rateLimitHeaderLimitLabel: 'X-RateLimit-Limit',
    rateLimitHeaderLimitDesc: 'Η ημερήσια ποσόστωσή σου. Κενό σε απεριόριστα ή διαχειριστικά keys.',
    rateLimitHeaderRemainingLabel: 'X-RateLimit-Remaining',
    rateLimitHeaderRemainingDesc: 'Αιτήματα που απομένουν πριν εξαντληθεί η σημερινή δωρεάν ποσόστωση.',
    rateLimitHeaderResetLabel: 'X-RateLimit-Reset',
    rateLimitHeaderResetDesc: 'Χρονοσφραγίδα ISO της επόμενης επαναφοράς ποσόστωσης (επόμενα μεσάνυχτα UTC, ή η ημερομηνία ανανέωσης της συνδρομής σου).',
    rateLimitHeaderCreditLabel: 'X-Credit-Balance-Usd',
    rateLimitHeaderCreditDesc: 'Το τρέχον υπόλοιπο πίστωσής σου, μόλις αποκτήσεις ένα.',
    rateLimitExceededTitle: 'Τι συμβαίνει πέρα από το όριο',
    rateLimitExceededDesc: "Λαμβάνεις HTTP 402 με μηχανικά αναγνώσιμο σώμα JSON: error_code, limit, used, reset_at, resets_in, prices και options[], όπου κάθε επιλογή (φόρτωση πίστωσης / συνδρομή, ή x402) φέρει το ακριβές επόμενο βήμα ώστε ένας agent να μπορεί να συνεχίσει μόνος του. Δεν χρειάζονται επαναλήψεις: μόλις φορτώσεις πίστωση ή κάνεις συνδρομή, το ίδιο key αρχίζει να δουλεύει ξανά από την αμέσως επόμενη κλήση.",
    rateLimitBestPractice: 'Έλεγξε το X-RateLimit-Remaining πριν στείλεις μια δέσμη κλήσεων — η ανάγνωση ενός header δεν κοστίζει τίποτα, ένα χαμένο 402 όμως ναι.',
    versioningTitle: 'Εκδόσεις & Ιστορικό αλλαγών',
    versioningIntro: 'Το API έχει έκδοση στο URL (/api/v1/...). Μέσα στο v1, τα υπάρχοντα πεδία δεν αφαιρούνται, δεν μετονομάζονται ούτε αλλάζουν σκοπό ποτέ — μόνο προστίθενται. Οι ενσωματώσεις θα πρέπει να αγνοούν πεδία που δεν αναγνωρίζουν αντί να αποτυγχάνουν εξαιτίας τους. Μια πραγματικά ασύμβατη αλλαγή δημοσιεύεται ως /api/v2/..., με το v1 να συνεχίζει να λειτουργεί για ένα λογικό διάστημα επικάλυψης — ποτέ μια σιωπηλή αλλαγή επί τόπου.',
    changelogTitle: 'Ιστορικό αλλαγών',
    changelogNote: "Δεν υπάρχει ακόμα mailing list ή feed ανακοινώσεων: αυτή η σελίδα είναι ο τρόπος να μένεις ενήμερος.",
    changelogEntries: [
      {
        version: 'v1.21',
        date: '2026-10-28',
        changes: [
          "Docs: νέα ενότητα MCP server: endpoint https://www.tnt-audit.com/api/mcp, ρυθμίσεις client και όλα τα 6 εργαλεία (check_token_risk, check_token_risk_batch, get_free_api_key, create_topup_invoice, check_payment, get_token_risk_history), συμπεριλαμβανομένου ποια λειτουργούν χωρίς key.",
          "Docs: το παράδειγμα Python για x402 χρησιμοποιεί πλέον το επίσημο x402 SDK (x402[svm,httpx], ακριβές σχήμα x402 v2 στο Solana). Το προηγούμενο παράδειγμα openlibx402-client δεν μιλούσε x402 v2 και αφαιρέθηκε.",
          "Docs: το δείγμα απόκρισης και η αναφορά πεδίων ευθυγραμμίστηκαν με το ζωντανό σχήμα (explanation, cluster_supply_pct, flags, data_confidence, cap booleans, locked supply, φρεσκάδα holder-data, age_hours)· το παράδειγμα 402 δείχνει τώρα το πλήρες σώμα άρνησης (error_code, options[])· όλα τα παραδείγματα URL χρησιμοποιούν https://www.tnt-audit.com. Καμία αλλαγή στο API.",
        ],
      },
      {
        version: 'v1.20',
        date: '2026-09-15',
        changes: [
          "insider_clusters: κάθε cluster φέρει πλέον funder_class ('cex' | 'infra' | 'likely_exchange_or_infra' | 'unknown'), funder_label, funder_confidence και false_positive_likely. Ένας κοινός πρώτος χρηματοδότης που είναι γνωστό hot wallet exchange/bridge ή ταιριάζει με ένα μοτίβο υποδομής υψηλής διασποράς (χιλιάδες χρηματοδοτούμενοι λογαριασμοί, πληρωμές ενοικίου με μικρομεταφορές, υψηλή συχνότητα συναλλαγών), παραμένει ορατός στην απόκριση για λόγους διαφάνειας αλλά δεν προσμετράται πλέον στην ποινή insider στο safety_score -- διορθώνει ψευδή θετικά που βρήκαμε ζωντανά σε hot wallets CEX που βαθμολογούνταν ως insider clusters.",
        ],
      },
      {
        version: 'v1.19',
        date: '2026-08-29',
        changes: [
          "Docs: προστέθηκε ένα εκτελέσιμο παράδειγμα Python για το endpoint x402 δίπλα στο υπάρχον παράδειγμα curl (αντικαταστάθηκε στην v1.21 από το επίσημο x402 SDK): δείχνει σε έναν προγραμματιστή bot/agent την πλήρη ροή 402 -> πληρωμή -> επανάληψη σε λίγες γραμμές αντί μόνο τον ωμό μηχανισμό HTTP.",
        ],
      },
      {
        version: 'v1.18',
        date: '2026-08-29',
        changes: [
          "Τιμή υπέρβασης pay-per-call (PAYG χωρίς συνδρομή): \$0.04 -> \$0.02/κλήση -- μειώνει την τριβή μιας πρώτης δοκιμής για έναν νέο χρήστη που δεν είναι ακόμα έτοιμος για τη συνδρομή των \$45. Ως αποτέλεσμα, PAYG και x402 έχουν πλέον την ίδια τιμή· το μήνυμα του x402 άλλαξε από \"φθηνότερο από το PAYG\" σε \"χωρίς λογαριασμό ή key\" -- το πραγματικό διαφοροποιητικό στοιχείο.",
        ],
      },
      {
        version: 'v1.17',
        date: '2026-08-28',
        changes: [
          "Αλλαγή τιμολόγησης συνδρομής: μηνιαία ποσόστωση 1000 -> 5000 κλήσεις/30 ημέρες, υπέρβαση με συνδρομή $0.02 -> $0.015/κλήση. Οι τιμές Free (15/ημέρα), PAYG ($0.04/κλήση χωρίς συνδρομή) και x402 ($0.02/κλήση) παραμένουν αμετάβλητες -- η τιμή προσαρμόστηκε κάτω από τον πλησιέστερο επί πληρωμή ανταγωνιστή (token-rugcheck μέσω x402, $0.02/κλήση για συγκρίσιμα δεδομένα) μετά από έρευνα ανταγωνισμού.",
        ],
      },
      {
        version: 'v1.16',
        date: '2026-08-22',
        changes: [
          'Συγχρονίστηκε το δημόσιο OpenAPI spec (openapi.json) με όλα τα 5 ενεργά endpoints του API -- batch, history, webhook subscribe/list, signup και trial -- μέχρι τώρα ήταν τεκμηριωμένα μόνο τα 2 βασικά endpoints token-risk. Διορθώθηκε επίσης μια παλιά τιμή x402 στο spec (έγραφε $0.07, η πραγματική τιμή είναι $0.02).',
          'Προστέθηκε το public/llms.txt -- ένα μηχανικά αναγνώσιμο ευρετήριο του API, φτιαγμένο για να μπορούν οι LLM coding agents (Claude Code, Cursor κ.λπ.) να ενσωματωθούν απευθείας, ακολουθώντας τη νέα σύμβαση llms.txt.',
        ],
      },
      {
        version: 'v1.15',
        date: '2026-08-21',
        changes: [
          'Δημοσιεύτηκε πακέτο Agent Plugins 1.0 (plugin.json + mcp.json, προδιαγραφή agent-plugins.org) — επιτρέπει σε συμβατούς clients Agent Plugins να ανακαλύπτουν και να συνδέονται με τον MCP server χωρίς χειροκίνητη ρύθμιση.',
          "Υποβλήθηκε native πακέτο plugin για Codex στον κατάλογο awesome-codex-plugins (hashgraph-online/awesome-codex-plugins, PR #380), βαθμολογία HOL Plugin Scanner 91/100, καμία κρίσιμη ή υψηλή εύρεση, CI επιτυχές. Συγχωνεύτηκε στις 2026-08-31.",
        ],
      },
      {
        version: 'v1.14',
        date: '2026-08-18',
        changes: [
          'Καταχωρήθηκε στο οικοσύστημα DeepSeek Harness (dsh-plugin) — το αποθετήριο φέρει πλέον το GitHub topic dsh-plugin, καθιστώντας το ανιχνεύσιμο από καταλόγους DSH plugin και το ενσωματωμένο marketplace plugin.',
          'Υποβλήθηκε skill Ασφάλειας στο marketplace Solana Skills (sendaifun/skills, που τροφοδοτεί το solana.com/skills) — σε αναμονή ελέγχου από τους συντηρητές.',
        ],
      },
      {
        version: 'v1.13',
        date: '2026-08-13',
        changes: [
          'Μείωση τιμών: pay-per-call $0.07 -> $0.04/κλήση, υπέρβαση με συνδρομή $0.03 -> $0.02/κλήση, συνδρομή $49 -> $45 για 1000 κλήσεις/30 ημέρες, x402 $0.07 -> $0.02/κλήση — ευθυγραμμίστηκε με συγκρίσιμες τιμές αγοράς μετά από έλεγχο άμεσων ανταγωνιστών.',
        ],
      },
      {
        version: 'v1.12',
        date: '2026-08-08',
        changes: [
          'Νέο πεδίο vesting_locks[] — εντοπίζει γνωστά on-chain vesting/lock συμβόλαια (Streamflow, v1) ανάμεσα στους κορυφαίους κατόχους ενός mint, ώστε ένας μεγάλος κάτοχος πραγματικά κλειδωμένος μακροπρόθεσμα να μη βαθμολογείται πια όπως μια ελεύθερα διαπραγματεύσιμη φάλαινα.',
          'Η βαθμολόγηση συγκέντρωσης του safety_score πλέον χρησιμοποιεί ένα «ελεύθερα διαπραγματεύσιμο» top10% που αφαιρεί την πραγματικά κλειδωμένη προσφορά (εκτός αν το lock μπορεί να ακυρωθεί από τον sender, ή ξεκλειδώνει εντός 30 ημερών) — το holder_distribution.top10_percent παραμένει το ακατέργαστο on-chain νούμερο.',
        ],
      },
      {
        version: 'v1.11',
        date: '2026-08-08',
        changes: [
          'Έξι νέα πεδία: hidden_owner, permanent_delegate, buy_tax_percent, sell_tax_percent, dev_wallet_percent, token_program, συν contract_renounced — όλα από την ίδια κλήση στο RugCheck, χωρίς επιπλέον καθυστέρηση.',
          'Το safety_score πλέον περιλαμβάνει νέο επίπεδο contractRiskCap (permanent_delegate, hidden_owner, φόρος, μη τυπικό token_program) και έναν άξονα dev-wallet-% στο υπάρχον όριο υγείας αγοράς — ένα token δεν μπορεί πια να βαθμολογηθεί ψηλά μόνο από ρευστότητα/όγκο ενώ φέρει σοβαρή ένδειξη κινδύνου σε επίπεδο συμβολαίου.',
          'Νέος πίνακας caps_triggered και πεδίο dominant_cap σε κάθε απόκριση — κάθε όριο βαθμολογίας που ενεργοποιήθηκε, συν το πιο αυστηρό, ώστε να βλέπεις ΓΙΑΤΙ μια βαθμολογία είναι χαμηλή, όχι μόνο ότι είναι.',
          'Διορθώθηκε: τα rugged, jup_verified, deployer_address, insider_holder_count και τα capped booleans των maturity/market-health/rugged υπολογίζονταν από το v1.4 αλλά ποτέ δεν επιστρέφονταν πραγματικά από τα endpoints main, batch ή x402 — τώρα υπάρχουν και στα τρία.',
        ],
      },
      {
        version: 'v1.10',
        date: '2026-08-05',
        changes: [
          'Τα honeypot_risk και lp_locked επιστρέφουν πλέον πραγματικές τιμές από το RugCheck αντί για πάντα null — το honeypot_risk είναι boolean, το lp_locked είναι { locked, percent }. Το null εξακολουθεί να σημαίνει «δεν ήταν δυνατός ο έλεγχος», ποτέ μια ψευδή «ασφαλή» τιμή.',
        ],
      },
      {
        version: 'v1.9',
        date: '2026-08-03',
        changes: [
          "Προστέθηκαν συνδρομές webhook — POST /api/v1/webhooks/subscribe για να λαμβάνεις ένα callback όταν το safety_score ενός mint διασχίζει ένα όριο (πάνω/κάτω), αντί να κάνεις polling.",
          "Παράδοση με βάση τη διάσχιση (ενεργοποιείται μία φορά ανά διάσχιση, όχι επανειλημμένα), payloads υπογεγραμμένα με HMAC, DELETE /api/v1/webhooks/{id} για διαγραφή συνδρομής.",
        ],
      },
      {
        version: 'v1.8',
        date: '2026-07-27',
        changes: [
          'Προστέθηκε το GET /api/v1/token-risk/x402 — πρόσβαση με πληρωμή ανά κλήση μέσω του πρωτοκόλλου x402 (USDC σε Solana), χωρίς API key. Ίδια τιμή με την υπάρχουσα χρέωση ανά κλήση.',
          'Δημοσιεύτηκε ως πόρος ανιχνεύσιμος από x402 στο x402scan.com, με σχήμα OpenAPI x-payment-info για αυτόματη ανακάλυψη από agents.',
        ],
      },
      {
        version: 'v1.7',
        date: '2026-07-26',
        changes: [
          'Δημοσιεύτηκε ως διακομιστής MCP στο Smithery.ai και στο Glama.ai, εκτός από το Official MCP Registry — χρησιμοποιήσιμο απευθείας ως εργαλείο από το Claude, το Cursor και άλλους συμβατούς με MCP agents.',
          'Δημοσιεύτηκαν πρόσθετα npm για το ElizaOS (eliza-plugin-tnt-risk-api) και το Solana Agent Kit (solana-agent-kit-plugin-risk-api).',
        ],
      },
      {
        version: 'v1.6',
        date: '2026-07-25',
        changes: ['Δημοσιεύτηκε στο Official MCP Registry, στο mcp.so, στο RapidAPI και στο Postman Public API Network — περισσότεροι τρόποι ανακάλυψης και ενσωμάτωσης του API.'],
      },
      { version: 'v1.5', date: '2026-07-23', changes: ['Δημοσιεύτηκε μια έτοιμη προς εισαγωγή συλλογή Postman.'] },
      {
        version: 'v1.4',
        date: '2026-07-21',
        changes: [
          'Δημοσιεύτηκε επίσημη προδιαγραφή OpenAPI 3.0 στο /openapi.json.',
          'Επαναρρύθμιση του προϋπολογισμού timeout για πολύ μεγάλα/ρευστά mints, μειώνοντας περαιτέρω τις ψευδείς αποτυχίες holder_distribution.',
        ],
      },
      {
        version: 'v1.3',
        date: '2026-07-19',
        changes: ['Ενίσχυση ασφάλειας χρέωσης κατά της κατάχρησης αντιστοίχισης invoice/πληρωμής — καμία αλλαγή στο σχήμα απόκρισης.'],
      },
      {
        version: 'v1.2',
        date: '2026-07-18',
        changes: [
          'Διορθώθηκαν timeouts σε upstream κλήσεις που περιστασιακά επέστρεφαν ακατέργαστο 502 σε πιο αργά, λιγότερο σημαντικά tokens.',
          'Διορθώθηκε το holder_distribution που περιστασιακά ανέφερε holder_count: 0 σε tokens υψηλού όγκου λόγω καταπιεσμένης αποτυχίας RPC.',
          'Διορθώθηκαν μη ρεαλιστικές τιμές price_change_24h_percent που περνούσαν αυτούσιες από τα upstream δεδομένα αγοράς.',
        ],
      },
      {
        version: 'v1.1',
        date: '2026-07-18',
        changes: ['Προστέθηκαν οι κεφαλίδες X-RateLimit-Limit / X-RateLimit-Remaining / X-RateLimit-Reset, στις οποίες αργότερα προστέθηκε η X-Credit-Balance-Usd.'],
      },
      {
        version: 'v1.0',
        date: '2026-07-18',
        changes: [
          'Δημόσια κυκλοφορία: GET /api/v1/token-risk — safety_score, insider_clusters, mint/freeze authority, holder_distribution, δεδομένα αγοράς.',
          'Αυθεντικοποίηση με API key, χρέωση free tier + πληρωμή ανά κλήση + συνδρομή μέσω Solana Pay.',
        ],
      },
    ],
    pricingTitle: 'Όρια & τιμολόγηση',
    tierFree: 'ΔΩΡΕΑΝ',
    tierFreeAmount: '15 αιτ./ημέρα',
    freeFeature1: 'Πλήρες σχήμα απόκρισης',
    freeFeature2: 'Ανίχνευση insider-cluster',
    freeFeature3: 'Χωρίς πιστωτική κάρτα',
    tierPayPerCall: 'ΠΛΗΡΩΜΗ ΑΝΑ ΚΛΗΣΗ',
    payPerCallFeature1: 'Φόρτισε οποιοδήποτε ποσό $5–$500',
    payPerCallFeature2: 'Χρέωση μόνο πέρα από τις δωρεάν 15/ημέρα',
    payPerCallFeature3: 'Οι συνδρομητές πληρώνουν $0.015/κλήση για υπέρβαση της ποσόστωσής τους',
    tierSubscription: 'ΣΥΝΔΡΟΜΗ',
    subFeature1: '5000 κλήσεις περιλαμβάνονται',
    subFeature2: '$0.015/κλήση υπέρβασης μετά',
    subFeature3: 'Χειροκίνητη ανανέωση — καμία αυτόματη χρέωση',
    tierX402: 'X402 (ΠΛΗΡΩΜΗ ΑΝΑ ΚΛΗΣΗ, ΧΩΡΙΣ KEY)',
    x402Feature1: 'Χωρίς API key, χωρίς εγγραφή — πληρώνεις ανά αίτημα',
    x402Feature2: 'USDC στη Solana, εκκαθάριση ανά κλήση μέσω του πρωτοκόλλου x402',
    x402Feature3: 'Φτιαγμένο για αυτόνομους agents που πληρώνουν μόνοι τους',
    x402HowToLabel: 'πρωτόκολλο x402',
    x402PythonLabel: "Python, επίσημο x402 SDK (χειρίζεται αυτόματα τη ροή 402 → πληρωμή → επανάληψη)",
    x402HowToIntro:
      'Το x402 μετατρέπει ένα 402 Payment Required σε λειτουργική ροή πληρωμής: καλείς το endpoint χωρίς αυθεντικοποίηση, παίρνεις πίσω μια υπογεγραμμένη πρόκληση πληρωμής, την πληρώνεις, ξαναδοκιμάζεις με την απόδειξη.',
    x402Step1: 'Κάνε GET στο endpoint με ένα mint — δεν χρειάζεται header Authorization.',
    x402Step2: 'Παίρνεις πίσω HTTP 402 με header PAYMENT-REQUIRED — μια υπογεγραμμένη πρόκληση για $0.02 σε USDC στη Solana.',
    x402Step3: "Υπόγραψε την πληρωμή με οποιονδήποτε client συμβατό με x402 (ή SDK wallet/agent), μετά ξαναδοκίμασε το ίδιο αίτημα με την υπογεγραμμένη πληρωμή σε header PAYMENT-SIGNATURE (αυτό που στέλνουν οι clients x402 v2) ή σε header X-PAYMENT· και τα δύο γίνονται δεκτά.",
    x402HowToNote:
      'Ίδια τιμή $0.02/κλήση με το βασικό επίπεδο πληρωμής ανά κλήση, αλλά χωρίς λογαριασμό ή αποθηκευμένο key — για agents που προτιμούν να πληρώνουν ανά αίτημα. Καταχωρημένο στο x402scan.com.',
    pricingNote: 'Πληρωμή σε $MRDT / SOL / USDC μέσω Solana Pay — ίδια ροή πληρωμής με το υπόλοιπο TNT House. Το Solana Pay δεν μπορεί να χρεώσει αυτόματα, οπότε η συνδρομή είναι μια χειροκίνητη ανανέωση 30 ημερών, όχι επαναλαμβανόμενη συνδρομή με την παραδοσιακή έννοια.',
    manageBillingTitle: 'Διαχείριση χρέωσης',
    getKeyTitle: 'Πάρε το API key σου',
    getKeySub: 'Άμεσα, δωρεάν, χωρίς κάρτα.',
    backToTnt: 'Πίσω στο TNT House',
    billingTitle: 'Χρέωση',
    billingSub: 'Κάνε συνδρομή για 5000 κλήσεις/30 ημέρες, ή φόρτισε πίστωση ανά κλήση. Πληρωμή σε $MRDT / SOL / USDC μέσω Solana Pay — ίδια ροή με το υπόλοιπο TNT House.',
    continueBtn: 'Συνέχεια',
    noKeyYet: 'Δεν έχεις ακόμα key; Πάρε ένα δωρεάν παραπάνω πρώτα.',
    currentTierLabel: 'Τρέχον επίπεδο:',
    callsUsedLabel: 'κλήσεις χρησιμοποιήθηκαν',
    renewsLabel: 'ανανεώνεται',
    creditBalanceLabel: 'Υπόλοιπο πίστωσης:',
    subscribeCardTitle: 'Συνδρομή — $45',
    subscribeCardSub: '5000 κλήσεις / 30 ημέρες',
    topupCardTitle: 'Φόρτιση πίστωσης',
    topupCardSub: 'Πληρωμή ανά κλήση, $5–$500',
    continueTopup: 'Συνέχεια με φόρτιση →',
    chooseCurrencyTitle: 'Επίλεξε νόμισμα πληρωμής',
    backBtn: '← Πίσω',
    chooseWalletTitle: 'Επίλεξε wallet',
    invoiceTapNote: 'Πατώντας θα ανοίξει η σελίδα πληρωμής μας μέσα στον browser του {wallet}. Πλήρωσε ακριβώς το ποσό που εμφανίζεται — ίσως δεις προειδοποίηση "domain not yet reviewed", αυτό είναι αναμενόμενο.',
    cancelBtn: 'Ακύρωση',
    payNowBtn: 'Πλήρωσε τώρα',
    manualPayTitle: 'Ή πλήρωσε χειροκίνητα από οποιοδήποτε wallet',
    sendToLabel: 'Αποστολή σε',
    exactAmountLabel: 'Ακριβές ποσό',
    manualPayNote: 'Στείλε ακριβώς αυτό το ποσό από οποιοδήποτε Solana wallet ή exchange. Η πίστωσή σου θα εφαρμοστεί αυτόματα μόλις εντοπιστεί η πληρωμή — δεν χρειάζεται να κάνεις τίποτα άλλο μετά την αποστολή.',
    copyLabel: 'Αντιγραφή',
    verifyingText: 'Έλεγχος blockchain για την πληρωμή σου...',
    verifyingAttemptPrefix: 'Προσπάθεια',
    verifyingAttemptSuffix: '— αυτό μπορεί να πάρει ένα με δύο λεπτά.',
    paymentConfirmed: 'Η πληρωμή επιβεβαιώθηκε!',
    subActiveUntil: 'Η συνδρομή είναι ενεργή έως',
    newCreditBalance: 'Νέο υπόλοιπο πίστωσης:',
    refreshStatus: 'Ανανέωση κατάστασης',
    startOver: 'Ξεκίνα ξανά',
    signupReadyTitle: 'Το API key σου είναι έτοιμο',
    signupWarningPrefix: 'Αυτό το key εμφανίζεται μία φορά και δεν μπορεί να ανακτηθεί ξανά. Αντέγραψέ το τώρα και φύλαξέ το κάπου ασφαλές —',
    signupWarningSuffix: 'αιτήματα/ημέρα, δωρεάν επίπεδο.',
    signupQuickStartLabel: 'Δοκιμάστε το τώρα — το κλειδί σας βρίσκεται ήδη σε αυτήν την εντολή:',
    signupQuickStartHint: 'Επικολλήστε το σε ένα τερματικό, ή χρησιμοποιήστε το σε οποιονδήποτε HTTP client ως κεφαλίδα Authorization: Bearer.',
    generatingText: 'Δημιουργία...',
    getFreeKeyBtn: 'Πάρε δωρεάν API key',
    freeTierNote: 'Δωρεάν επίπεδο: 15 αιτήματα/ημέρα. Χωρίς πιστωτική κάρτα. Ένα key ανά email.',
    signupHint: 'Γράψε το email σου και αντέγραψε το key που θα εμφανιστεί — εμφανίζεται μόνο μία φορά.',
    emailPlaceholder: 'Διεύθυνση email',
    tryItTitle: 'Δοκίμασέ το τώρα — χωρίς εγγραφή',
    tryItSubtitle: '3 δωρεάν έλεγχοι, χωρίς email',
    tryItFreeToday: 'δωρεάν σήμερα',
    tryItQuickTryLabel: 'ή δοκίμασε ένα γνωστό token:',
    tryItPlaceholder: 'Επικόλλησε μια διεύθυνση mint Solana',
    tryItButton: 'Έλεγχος ρίσκου',
    tryItLoading: 'Ανάλυση...',
    tryItRemaining: '{n} δωρεάν έλεγχος/οι απομένουν',
    tryItLimitTitle: 'Χρησιμοποίησες και τους 3 δωρεάν ελέγχους',
    tryItLimitBody: 'Πάρε δωρεάν API key παρακάτω — 15 έλεγχοι/ημέρα, χωρίς κάρτα.',
    tryItInvalidMint: 'Βάλε μια έγκυρη διεύθυνση mint Solana',
    tryItErrorGeneric: 'Κάτι πήγε στραβά. Δοκίμασε ξανά.',
    // v1.21 docs audit (2026-10-28): MCP section, response fields, 402 note
    mcpTitle: "MCP server",
    mcpIntro: "Χρησιμοποίησε το API ως εργαλείο από τον Claude, το Cursor και οποιονδήποτε άλλο συμβατό με MCP agent: ίδια μηχανή και ίδιο JSON με το REST endpoint. Μεταφορά Streamable HTTP, stateless (μόνο JSON-RPC μέσω POST).",
    mcpEndpointLabel: "Endpoint",
    mcpConfigLabel: "Ρυθμίσεις Claude Desktop / Cursor (δεν απαιτείται key)",
    mcpConfigNote: "Οι clients που υποστηρίζουν εγγενώς απομακρυσμένους MCP servers μπορούν να χρησιμοποιήσουν απευθείας το URL του endpoint αντί για το mcp-remote.",
    mcpToolsTitle: "Εργαλεία",
    mcpNoKeyBadge: "χωρίς key",
    mcpKeyBadge: "API key",
    mcpToolCheckTokenRisk: "Βαθμολογία ασφάλειας, insider clusters, authorities, συγκέντρωση holders και δεδομένα αγοράς για ένα mint (η ίδια απόκριση με το GET /api/v1/token-risk). 5 δωρεάν κλήσεις/ημέρα χωρίς key· μετά, δωρεάν key (15/ημέρα), πίστωση κλήσεων ή συνδρομή.",
    mcpToolBatch: "Ο ίδιος έλεγχος για έως 25 mints σε μία κλήση. N mints = N κλήσεις, όλα ή τίποτα: ολόκληρο το batch απορρίπτεται αν το όριο/η πίστωσή σου δεν το καλύπτει.",
    mcpToolFreeKey: "Εκδίδει ένα δωρεάν API key για μια διεύθυνση email (15 έλεγχοι/ημέρα). Ένα ενεργό key ανά email· το key επιστρέφεται μία φορά και αποστέλλεται επίσης με email. Οι εγγραφές περιορίζονται ανά IP και ανά ημέρα.",
    mcpToolTopup: "Δημιουργεί ένα τιμολόγιο πληρωμής Solana για το key σου: ανανέωση πίστωσης κλήσεων ($5–$500) ή συνδρομή 30 ημερών. Επιστρέφει payment_id, το ακριβές pay_amount και wallet_address.",
    mcpToolCheckPayment: "Ελέγχει on-chain αν έχει πληρωθεί ένα τιμολόγιο από το create_topup_invoice και, αν ναι, πιστώνει το key σου. Ασφαλές να επαναληφθεί· περιορίζεται σε έναν έλεγχο ανά 5 δευτερόλεπτα ανά payment_id.",
    mcpToolHistory: "Ωριαίο ιστορικό safety_score, αριθμού insider-cluster, holders, τιμής, ρευστότητας και όγκου για ένα mint τις τελευταίες N ημέρες (μέγιστο 90). Δωρεάν και δεν προσμετράται σε κανένα όριο.",
    mcpAuthNote: "Πέρασε ένα key ως header Authorization: Bearer <api_key> σε κάθε αίτημα MCP, ή ως όρισμα api_key των check_token_risk / check_token_risk_batch αν ο client σου δεν μπορεί να θέσει headers (το header υπερισχύει). Οι αρνήσεις λόγω ορίου επιστρέφουν error_code και options[] με το ακριβές επόμενο βήμα. Το x402 pay-per-call είναι REST endpoint, δες Όρια & τιμολόγηση παρακάτω.",
    exampleIllustrativeNote: "Ενδεικτική απόκριση: οι τιμές είναι επινοημένες για ένα φανταστικό token, όχι ζωντανά δεδομένα για κανένα πραγματικό mint. Προαιρετικά πεδία όπως explanation και note εμφανίζονται μόνο όταν ισχύουν.",
    fieldCapFlags: "Ένα boolean ανά βαθμίδα ορίου βαθμολόγησης (maturity, market_health, contract_risk, rugged, wash_trading, lp_risk, mint_authority, freeze_authority, honeypot): true μόνο όταν αυτό το cap πραγματικά κατέβασε το score. Το reliefs_triggered απαριθμεί μετριασμούς που χαλάρωσαν ένα cap ({ reason, from, to }), π.χ. ένα burned ή locked LP.",
    fieldClusterSupply: "Μερίδιο προμήθειας (%) που κατέχουν όλα τα μετρημένα insider clusters και το μεγαλύτερο από αυτά, συν πόσα wallets περιλαμβάνουν. Τα clusters με σήμανση false_positive_likely εξαιρούνται. null ενώ το cluster_analysis είναι \"pending\" ή όταν ένα μερίδιο είναι άγνωστο. Μόνο οι κορυφαίοι holders ανιχνεύονται, οπότε αυτά είναι κατώτατα όρια.",
    fieldFlags: "Περιγραφικά γεγονότα, όχι ετυμηγορίες, π.χ. young_token, cluster_scan_pending, no_market_data, high_turnover, mint_authority_active, freeze_authority_active, lp_partially_or_not_locked, insider_cluster_detected, shared_cex_or_infra_funder, single_holder_gt_50.",
    fieldDataConfidence: "Πόσο πλήρης είναι αυτή η απάντηση: cluster_scan (\"pending\" | \"complete\"), holders_traced, cluster_supply_is_lower_bound, market_data_available, rugcheck_data_available. Χρησιμοποίησέ το για να ξεχωρίσεις το «χαμηλός κίνδυνος» από το «ανεπαρκή δεδομένα».",
    fieldLockedSupply: "Μερίδιο προμήθειας (%) που είναι επί του παρόντος κλειδωμένο σε γνωστά μη ακυρώσιμα vesting/lock contracts, και το μέρος του που ξεκλειδώνει μέσα στις επόμενες 30 ημέρες. Δες το vesting_locks για τα επιμέρους συμβόλαια.",
    fieldRugcheckExtra: "Από το RugCheck: rugged (επιβεβαιωμένο rug), jup_verified (token επαληθευμένο από Jupiter), lp_burned ({ burned }), deployer_address και insider_holder_count (το rugcheck_insider_holder_count φέρει την ίδια τιμή). null σημαίνει ότι δεν μπόρεσε να ελεγχθεί.",
    rateLimit402TrimmedNote: "Τα μεγάλα πεδία κειμένου (note, options[].next_step) συντομεύονται εδώ· η πραγματική απόκριση φέρει το πλήρες κείμενο.",
    perCallSuffix: "/κλήση",
    per30DaysSuffix: "/30 ημέρες",
  },
  ru: {
    flag: '🇷🇺',
    name: 'RU',
    headerBadge: 'RISK-DATA API',
    heroEyebrow: 'СОЗДАНО ДЛЯ AI-ТРЕЙДИНГ-АГЕНТОВ',
    statsLine: '{n}+ проверок риска выполнено · работает на Solana mainnet · ответ меньше 1 сек',
    heroTitle1: 'Узнай, что скрывает токен,',
    heroTitle2: 'прежде чем его купит твой бот.',
    heroSub: 'Один GET-запрос возвращает Safety Score, детект инсайдерских кластеров в реальном времени и он-чейн показатели для любого Solana-минта — тот же движок, что стоит за аудитами TNT House, только в виде чистого JSON для ботов, а не дашборда для людей.',
    valueCard1Title: 'Safety Score',
    valueCard1Desc: 'Одно число от 0 до 100, которое суммирует mint/freeze authority, риск honeypot, блокировку ликвидности и концентрацию холдеров — мгновенное решение "покупать или нет" для твоего бота.',
    valueCard2Title: 'Инсайдерские кластеры',
    valueCard2Desc: 'Когда 20 кошельков ведут к одному и тому же первому фандеру — это не 20 разных покупателей, а один кошелёк, готовый слить на тебя.',
    valueCard3Title: 'Honeypot + LP-блокировка',
    valueCard3Desc: 'Реальная проверка, даст ли контракт тебе продать, и можно ли вывести ликвидность прямо у тебя из-под ног.',
    btnTryFree: 'Попробовать бесплатно — без email',
    btnGetKey: 'Получить бесплатный API-ключ',
    btnReadDocs: 'Читать документацию',
    btnSiteAssistant: 'Помощник по сайту',
    copyCurl: 'Скопировать curl',
    howItWorksTitle: 'Как это работает',
    integrationsTitle: 'Подключи своего бота или агента',
    integrationsHint: 'Нажми на платформу, чтобы получить готовый сниппет для копирования.',
    mcpFreeTierNote: '5 бесплатных MCP-вызовов в день, без регистрации — для ботов и ИИ-агентов. Дальше — бесплатный ключ (15/день) или x402 за вызов.',
    demoPublicKeyTitle: 'Публичный демо-ключ — Живой эксперимент',
    demoPublicKeyRemaining: 'Осталось {remaining}/{total} вызовов. Общий для всех. Умирает навсегда на нуле.',
    demoPublicKeyCopy: 'Скопировать ключ',
    demoPublicKeyNote: 'Без регистрации — вставь прямо в своего бота прямо сейчас. Когда умрёт — получи свой бесплатный ключ ниже.',
    demoPublicKeyDead: '💀 Публичный демо-ключ умер — все вызовы использованы, навсегда. Получи свой бесплатный ключ (15/день, без карты) ниже.',
    step1Title: 'Получи ключ',
    step1Desc: 'Введи email ниже. Без карты, без ожидания одобрения — ключ выдаётся мгновенно.',
    step2Title: 'Дёрни эндпоинт',
    step2Desc: 'GET /api/v1/token-risk?mint=<адрес> с ключом в заголовке Authorization. Типичное время ответа — заметно меньше секунды.',
    step3Title: 'Действуй по скору',
    step3Desc: 'Твой бот получает скор мгновенно — действуй или пропускай сделку.',
    responseFieldsTitle: 'Поля ответа',
    fieldSafetyScore: '0–100. Взвешено по authorities, концентрации холдеров, ликвидности, объёму и реальным штрафам за инсайдерские кластеры.',
    fieldInsiderClusters: "Кошельки с общим первым фандером: доказуемый он-чейн сигнал инсайдера/снайпера, а не догадка. Каждый кластер также содержит funder_class, funder_label, funder_confidence и false_positive_likely: известные CEX/bridge-горячие кошельки и подтверждённые инфраструктурные фондеры с массовым фандингом остаются видны здесь, но больше не учитываются в штрафе за инсайдеров в safety_score. supply_pct — доля кластера в предложении, funder_path — отслеженная цепочка финансирования, deployer_linked — достигает ли эта цепочка деплойера, exchange_source — биржа, финансировавшая корень (каждое значение null, если неизвестно).",
    fieldClusterAnalysis: '"pending" при первой проверке токена (трассировка кластеров считается в фоне), "complete" когда трассировка завершится.',
    fieldAuthorities: 'Отозвана ли каждая authority, и её адрес, если ещё активна.',
    fieldHoneypotLpLocked: 'honeypot_risk (булево) и lp_locked ({ locked, percent }) от RugCheck. null означает "не удалось проверить", а не "безопасно".',
    fieldHolderDistribution: "Сырой % крупнейшего холдера, % топ-10, risk_level и holder_count: дедуплицированное число кошельков-холдеров, когда доступно, иначе число аккаунтов в ответе RPC Solana о 20 крупнейших холдерах (реальное ограничение RPC). freely_tradeable_top10_percent, freely_tradeable_largest_holder_percent и scoring_risk_level — это значения, которые фактически использует скоринг (вычитается предложение, заблокированное в вестинг-контрактах). holder_data_stale / holder_data_age_seconds показывают, когда последний удачный снимок холдеров был отдан вместо живого чтения.",
    fieldMarket: "Живая цена, ликвидность, объём за 24ч, изменение за 24ч и возраст токена (age_days, плюс age_hours) из DexScreener. Если у DexScreener нет данных о ликвидности, она может быть взята из RugCheck (флаг liquidity_from_rugcheck).",
    fieldOwnerDelegate: 'hidden_owner и permanent_delegate (булевы) из списка рисков RugCheck. permanent_delegate — расширение Token-2022, позволяющее этому адресу списывать или сжигать токены ЛЮБОГО холдера без разрешения — серьёзный риск. null значит "не проверялось", никогда не ложное "безопасно".',
    fieldTax: 'buy_tax_percent / sell_tax_percent — расширение Token-2022 transfer fee. Комиссия в Solana симметрична, поэтому оба поля совпадают. null значит, что у минта нет такого расширения (а не что проверка провалилась).',
    fieldDevWallet: 'dev_wallet_percent — собственная он-чейн доля деплойера в % от общего supply. Отдельный сигнал концентрации от holder_distribution.top10_percent — деплойер может держать крупную долю, не входя при этом в топ-10.',
    fieldProgramRenounced: 'token_program: "standard", если минт использует одну из двух канонических token-программ Solana, иначе "nonstandard". contract_renounced: удобное булево поле для mint_authority.revoked && freeze_authority.revoked.',
    fieldCapsTriggered: 'caps_triggered перечисляет каждый сработавший потолок скоринга для этого минта (причина + значение потолка); dominant_cap — самый жёсткий из них, реальная причина текущего safety_score, а не просто цифра. explanation даёт ту же причину готовым предложением.',
    fieldVestingLocks: 'vesting_locks перечисляет известные on-chain вестинг/лок-контракты, найденные среди топ-холдеров этого минта (Streamflow, v1). Крупный холдер, реально заблокированный на длительный срок, оценивается иначе, чем свободно торгуемый кит — score уже это учитывает, holder_distribution.top10_percent остаётся сырой on-chain цифрой без поправки.',
    rateLimitHeadersNote: 'Каждый ответ также включает заголовки X-RateLimit-Limit, X-RateLimit-Remaining и X-RateLimit-Reset — плюс X-Credit-Balance-Usd, если у тебя платный тариф или баланс кредитов — чтобы бот мог отслеживать свою квоту, не ловя 429.',
    openApiUsageNote: 'Работает из коробки с ChatGPT Custom GPT Actions (просто вставь ссылку). Для Claude, Gemini или агентских фреймворков вроде LangChain/CrewAI используй эту спеку как источник схемы для своей интеграции — большинству нужен небольшой адаптер, LangChain\'s OpenAPISpec.from_url() импортирует её напрямую.',
    chatBubbleLabel: 'Спросить про API',
    chatTitle: 'Ассистент Risk-Data API',
    chatWelcome: 'Привет! Спроси меня что угодно про Risk-Data API — эндпоинт, тарифы, поля ответа, как получить ключ.',
    chatPlaceholder: 'Напиши вопрос...',
    chatLimitReached: 'Достигнут лимит — попробуй через несколько минут.',
    chatConnectionError: 'Ошибка соединения. ⚡ Получи бесплатный API-ключ ниже.',
    copyOpenApiUrl: 'Копировать',
    webhooksRoadmapNote: 'При первой проверке токена cluster_analysis возвращает "pending", пока анализ выполняется в фоне — перепроверь тот же mint чуть позже, либо подпишись на webhook по safety_score ниже, чтобы получать уведомление вместо постоянного опроса.',
    webhooksDocsTitle: 'Webhooks',
    webhooksDocsIntro: 'Вместо постоянного опроса token-risk по расписанию — подпишись один раз на mint и порог safety_score и получай подписанный HTTP callback в момент пересечения, в любую сторону.',
    webhooksSubscribeLabel: 'Подписаться',
    webhooksResponseLabel: 'Подписка создана',
    webhooksPayloadLabel: 'Доставляется на твой callback_url',
    webhooksUnsubscribeNote: 'Срабатывает один раз за пересечение, а не при каждой проверке. Проверяй каждую доставку через заголовок X-Webhook-Signature и webhook_secret из ответа на подписку (показывается только один раз). Вызови DELETE /api/v1/webhooks/{id}, чтобы отписаться.',
    webhooksDeliveryTitle: 'Доставка и повторы',
    webhooksDeliveryText: 'Доставка идёт через QStash: при ответе не 2xx или таймауте мы повторяем попытку до 3 раз с экспоненциальной задержкой, затем сдаёмся. У каждого события уникальный id (evt_...) — сохраняй его и пропускай уже обработанные события, потому что повтор присылает точно то же событие. Ответ 200 помечает событие доставленным, даже если твоя обработка потом упадёт с ошибкой, — сохраняй или обрабатывай payload до того как ответить.',
    rateLimitingTitle: 'Лимиты запросов',
    rateLimitingIntro: "У каждого ключа 15 бесплатных запросов в календарные сутки (UTC). Бесплатные запросы также делят общесайтовую суточную ёмкость между всеми бесплатными ключами: в загруженный день ты можешь получить 402 с error_code free_pool_capacity до того, как достигнешь 15 (твой первый запрос за день всегда проходит). Запросы, оплаченные из кредита или покрытые подпиской, никогда не зависят от этого пула. Превысил квоту без баланса кредитов — получишь 402, а не тихую блокировку: пополни или оформи подписку — и тот же ключ сразу снова работает.",
    rateLimitHeaderLimitLabel: 'X-RateLimit-Limit',
    rateLimitHeaderLimitDesc: 'Твоя дневная квота. Пусто у безлимитных/выданных админом ключей.',
    rateLimitHeaderRemainingLabel: 'X-RateLimit-Remaining',
    rateLimitHeaderRemainingDesc: 'Сколько запросов осталось до конца бесплатной квоты на сегодня.',
    rateLimitHeaderResetLabel: 'X-RateLimit-Reset',
    rateLimitHeaderResetDesc: 'ISO-таймстамп следующего сброса квоты (следующая полночь по UTC или дата продления подписки).',
    rateLimitHeaderCreditLabel: 'X-Credit-Balance-Usd',
    rateLimitHeaderCreditDesc: 'Текущий баланс кредитов на запросы, как только он появится.',
    rateLimitExceededTitle: 'Что происходит при превышении лимита',
    rateLimitExceededDesc: "Ты получаешь HTTP 402 с машиночитаемым JSON-телом: error_code, limit, used, reset_at, resets_in, prices и options[], где каждая опция (пополнение / подписка или x402) несёт точный следующий шаг, чтобы агент мог продолжить самостоятельно. Повторные попытки не нужны: как только пополнишь кредит или оформишь подписку, тот же ключ снова заработает уже на следующем вызове.",
    rateLimitBestPractice: 'Проверяй X-RateLimit-Remaining перед отправкой пачки запросов — прочитать заголовок бесплатно, а вот впустую словленный 402 — нет.',
    versioningTitle: 'Версионирование и история изменений',
    versioningIntro: 'API версионируется через URL (/api/v1/...). Внутри v1 существующие поля никогда не удаляются, не переименовываются и не меняют смысл — только добавляются. Интеграциям стоит игнорировать незнакомые поля, а не падать из-за них. По-настоящему ломающее изменение выйдет как /api/v2/..., а v1 продолжит работать разумный переходный период — никогда никаких тихих изменений на месте.',
    changelogTitle: 'История изменений',
    changelogNote: "Пока нет рассылки или ленты анонсов: эта страница — место, чтобы оставаться в курсе.",
    changelogEntries: [
      {
        version: 'v1.21',
        date: '2026-10-28',
        changes: [
          "Доки: новый раздел MCP-сервера: эндпоинт https://www.tnt-audit.com/api/mcp, конфиг клиента и все 6 инструментов (check_token_risk, check_token_risk_batch, get_free_api_key, create_topup_invoice, check_payment, get_token_risk_history), включая информацию, какие из них работают без ключа.",
          "Доки: пример Python для x402 теперь использует официальный x402 SDK (x402[svm,httpx], точная схема x402 v2 на Solana). Предыдущий пример с openlibx402-client не поддерживал x402 v2 и был удалён.",
          "Доки: пример ответа и справочник полей приведены в соответствие с живой схемой (explanation, cluster_supply_pct, flags, data_confidence, булевы флаги ограничений, заблокированное предложение, свежесть данных холдеров, age_hours); пример 402 теперь показывает полное тело отказа (error_code, options[]); все URL в примерах используют https://www.tnt-audit.com. Без изменений API.",
        ],
      },
      {
        version: 'v1.20',
        date: '2026-09-15',
        changes: [
          "insider_clusters: у каждого кластера теперь есть funder_class ('cex' | 'infra' | 'likely_exchange_or_infra' | 'unknown'), funder_label, funder_confidence и false_positive_likely. Общий первый фандер, который оказался известным hot wallet биржи/моста, или подходит под паттерн инфраструктуры (тысячи профинансированных аккаунтов, микро-переводы на rent, высокая частота транзакций), остаётся видимым в ответе для прозрачности, но больше не штрафует safety_score как инсайдерский сигнал -- чинит ложные срабатывания, которые мы живьём поймали на биржевых hot wallet'ах, помеченных как инсайдерские кластеры.",
        ],
      },
      {
        version: 'v1.19',
        date: '2026-08-29',
        changes: [
          "Доки: добавлен работающий пример Python для x402-эндпоинта рядом с существующим примером curl (заменён в v1.21 официальным x402 SDK): показывает разработчику бота/агента полный флоу 402 -> оплата -> повтор запроса в нескольких строках, а не только сырую HTTP-механику.",
        ],
      },
      {
        version: 'v1.18',
        date: '2026-08-29',
        changes: [
          "Ставка overage для pay-per-call (PAYG без подписки): \$0.04 -> \$0.02/запрос -- снижает порог входа для первой пробы новому пользователю, который ещё не готов сразу на подписку за \$45. В результате PAYG и x402 теперь по одной ставке; посыл x402 переписан с \"дешевле, чем PAYG\" на \"без аккаунта и ключа\" -- это и есть реальное отличие.",
        ],
      },
      {
        version: 'v1.17',
        date: '2026-08-28',
        changes: [
          "Изменение цены подписки: месячная квота 1000 -> 5000 запросов/30 дней, overage при подписке $0.02 -> $0.015/запрос. Тарифы Free (15/день), PAYG ($0.04/запрос без подписки) и x402 ($0.02/запрос) не изменились -- цена скорректирована ниже ближайшего платного конкурента (token-rugcheck через x402, $0.02/запрос за сопоставимые данные) после анализа конкурентов.",
        ],
      },
      {
        version: 'v1.16',
        date: '2026-08-22',
        changes: [
          'Синхронизирована публичная OpenAPI-спека (openapi.json) со всеми 5 живыми эндпоинтами API -- batch, history, webhook subscribe/list, signup и trial -- раньше были задокументированы только 2 базовых token-risk эндпоинта. Заодно поправлена устаревшая цена x402 в спеке (было указано $0.07, реальная цена -- $0.02).',
          'Добавлен public/llms.txt -- машиночитаемый индекс API для LLM coding-агентов (Claude Code, Cursor и т.д.), чтобы они могли сразу онбордиться, по новому стандарту llms.txt.',
        ],
      },
      {
        version: 'v1.15',
        date: '2026-08-21',
        changes: [
          'Опубликован пакет Agent Plugins 1.0 (plugin.json + mcp.json, спецификация agent-plugins.org) — позволяет клиентам, совместимым с Agent Plugins, находить и подключаться к MCP-серверу без ручной настройки.',
          "Подан нативный Codex-пакет плагина в каталог awesome-codex-plugins (hashgraph-online/awesome-codex-plugins, PR #380), оценка HOL Plugin Scanner 91/100, критичных и high-находок нет, CI зелёный. Смёржен 2026-08-31.",
        ],
      },
      {
        version: 'v1.14',
        date: '2026-08-18',
        changes: [
          'Листинг в экосистеме DeepSeek Harness (dsh-plugin) — репозиторий теперь несёт GitHub topic dsh-plugin, благодаря чему его находят каталоги DSH-плагинов и встроенный маркетплейс плагинов.',
          'Подан Security-скилл в маркетплейс Solana Skills (sendaifun/skills, откуда данные подтягиваются на solana.com/skills) — ожидает ревью мейнтейнеров.',
        ],
      },
      {
        version: 'v1.13',
        date: '2026-08-13',
        changes: [
          'Снижение цен: pay-per-call $0.07 -> $0.04/запрос, overage с подпиской $0.03 -> $0.02/запрос, подписка $49 -> $45 за 1000 запросов/30 дней, x402 $0.07 -> $0.02/запрос — приведено в соответствие с ценами прямых конкурентов после сравнительного анализа.',
        ],
      },
      {
        version: 'v1.12',
        date: '2026-08-08',
        changes: [
          'Новое поле vesting_locks[] — детектит известные on-chain вестинг/лок-контракты (Streamflow, v1) среди топ-холдеров минта, чтобы крупный холдер, реально заблокированный на долгий срок, больше не оценивался так же, как свободно торгуемый кит.',
          'Скоринг концентрации в safety_score теперь использует "свободно торгуемый" top10%, из которого вычитается реально заблокированная доля (если только лок не отзывается отправителем или не разлочится в течение 30 дней) — сам holder_distribution.top10_percent остаётся сырой, неисправленной on-chain цифрой.',
        ],
      },
      {
        version: 'v1.11',
        date: '2026-08-08',
        changes: [
          'Шесть новых полей: hidden_owner, permanent_delegate, buy_tax_percent, sell_tax_percent, dev_wallet_percent, token_program, плюс contract_renounced — все из того же запроса к RugCheck, без доп. задержки.',
          'safety_score теперь включает новый уровень contractRiskCap (permanent_delegate, hidden_owner, налог, нестандартный token_program) и ось dev-wallet-% в существующем потолке рыночного здоровья — токен больше не может получить высокий score только за счёт ликвидности/объёма, неся при этом серьёзный красный флаг на уровне контракта.',
          'Новый массив caps_triggered и поле dominant_cap в каждом ответе — каждый сработавший потолок скоринга плюс самый жёсткий из них, чтобы видеть ПОЧЕМУ score низкий, а не просто что он такой.',
          'Исправлено: rugged, jup_verified, deployer_address, insider_holder_count и булевы capped для maturity/market-health/rugged считались с v1.4, но никогда реально не возвращались основным, batch- и x402-эндпоинтами — теперь присутствуют во всех трёх.',
        ],
      },
      {
        version: 'v1.10',
        date: '2026-08-05',
        changes: [
          'honeypot_risk и lp_locked теперь возвращают реальные значения от RugCheck вместо вечного null — honeypot_risk булево значение, lp_locked это { locked, percent }. null по-прежнему значит "не удалось проверить", а не ложное "чисто".',
        ],
      },
      {
        version: 'v1.9',
        date: '2026-08-03',
        changes: [
          "Добавлены подписки на webhook — POST /api/v1/webhooks/subscribe, чтобы получать callback, когда safety_score минта пересекает порог (сверху/снизу), вместо постоянного опроса.",
          "Доставка по факту пересечения (срабатывает один раз за пересечение, не повторяется), payload подписан HMAC, DELETE /api/v1/webhooks/{id} для отписки.",
        ],
      },
      {
        version: 'v1.8',
        date: '2026-07-27',
        changes: [
          'Добавлен GET /api/v1/token-risk/x402 — оплата за вызов через протокол x402 (USDC в Solana), без API-ключа. Цена совпадает с текущим тарифом pay-per-call.',
          'Опубликован как обнаруживаемый x402-ресурс на x402scan.com, со схемой OpenAPI x-payment-info для автоматического обнаружения агентами.',
        ],
      },
      {
        version: 'v1.7',
        date: '2026-07-26',
        changes: [
          'Опубликован как MCP-сервер на Smithery.ai и Glama.ai, в дополнение к Official MCP Registry — доступен как инструмент напрямую для Claude, Cursor и других MCP-совместимых агентов.',
          'Опубликованы npm-плагины для ElizaOS (eliza-plugin-tnt-risk-api) и Solana Agent Kit (solana-agent-kit-plugin-risk-api).',
        ],
      },
      {
        version: 'v1.6',
        date: '2026-07-25',
        changes: ['Опубликован в Official MCP Registry, mcp.so, RapidAPI и Postman Public API Network — больше способов найти и интегрировать API.'],
      },
      { version: 'v1.5', date: '2026-07-23', changes: ['Опубликована готовая к импорту коллекция Postman.'] },
      {
        version: 'v1.4',
        date: '2026-07-21',
        changes: [
          'Опубликована формальная спецификация OpenAPI 3.0 по адресу /openapi.json.',
          'Перебалансирован бюджет таймаута для очень крупных/ликвидных минтов — дополнительно снижает ложные сбои holder_distribution.',
        ],
      },
      {
        version: 'v1.3',
        date: '2026-07-19',
        changes: ['Усиление защиты биллинга от злоупотреблений сопоставлением invoice/платежей — схема ответа не изменилась.'],
      },
      {
        version: 'v1.2',
        date: '2026-07-18',
        changes: [
          'Исправлены таймауты в апстрим-вызовах, из-за которых иногда возвращался «сырой» 502 на менее популярных токенах.',
          'Исправлено: holder_distribution иногда показывал holder_count: 0 на высокооборотных токенах из-за проглоченной ошибки RPC.',
          'Исправлены неправдоподобные значения price_change_24h_percent, приходившие как есть из апстрим рыночных данных.',
        ],
      },
      {
        version: 'v1.1',
        date: '2026-07-18',
        changes: ['Добавлены заголовки X-RateLimit-Limit / X-RateLimit-Remaining / X-RateLimit-Reset, позже дополненные X-Credit-Balance-Usd.'],
      },
      {
        version: 'v1.0',
        date: '2026-07-18',
        changes: [
          'Публичный запуск: GET /api/v1/token-risk — safety_score, insider_clusters, mint/freeze authority, holder_distribution, рыночные данные.',
          'Авторизация по API-ключу, биллинг free tier + pay-per-call + подписка через Solana Pay.',
        ],
      },
    ],
    pricingTitle: 'Лимиты и цены',
    tierFree: 'БЕСПЛАТНО',
    tierFreeAmount: '15 запр./день',
    freeFeature1: 'Полная схема ответа',
    freeFeature2: 'Детект инсайдерских кластеров',
    freeFeature3: 'Без карты',
    tierPayPerCall: 'ОПЛАТА ЗА ЗАПРОС',
    payPerCallFeature1: 'Пополнение на любую сумму $5–$500',
    payPerCallFeature2: 'Списывается только сверх бесплатных 15/день',
    payPerCallFeature3: 'Подписчики платят $0.015/запрос за превышение своей квоты',
    tierSubscription: 'ПОДПИСКА',
    subFeature1: '5000 запросов включено',
    subFeature2: '$0.015/запрос сверх лимита далее',
    subFeature3: 'Ручное продление — без автосписания',
    tierX402: 'X402 (ОПЛАТА ЗА ЗАПРОС, БЕЗ КЛЮЧА)',
    x402Feature1: 'Без API-ключа, без регистрации — платишь за каждый запрос',
    x402Feature2: 'USDC в сети Solana, оплата каждого запроса через протокол x402',
    x402Feature3: 'Для автономных агентов, которые платят сами за себя',
    x402HowToLabel: 'протокол x402',
    x402PythonLabel: "Python, официальный x402 SDK (автоматически проходит флоу 402 → оплата → повтор запроса)",
    x402HowToIntro:
      'x402 превращает 402 Payment Required в рабочий платёжный флоу: дёргаешь эндпоинт без авторизации, получаешь подписанный платёжный челлендж, оплачиваешь его, повторяешь запрос с квитанцией.',
    x402Step1: 'Делаешь GET на эндпоинт с mint — заголовок Authorization не нужен.',
    x402Step2: 'В ответ приходит HTTP 402 с заголовком PAYMENT-REQUIRED — подписанный челлендж на $0.02 в USDC на Solana.',
    x402Step3: "Подпиши платёж любым x402-совместимым клиентом (или wallet/agent SDK), затем повтори тот же запрос с подписанным платежом в заголовке PAYMENT-SIGNATURE (то, что отправляют клиенты x402 v2) или X-PAYMENT; принимаются оба.",
    x402HowToNote:
      'Та же ставка $0.02/запрос, что и в обычном pay-per-call тарифе, но без аккаунта и без хранения ключа — для агентов, которым удобнее платить за каждый запрос. Указан на x402scan.com.',
    pricingNote: 'Оплата в $MRDT / SOL / USDC через Solana Pay — тот же флоу, что и на остальном TNT House. Solana Pay не умеет автосписание, поэтому подписка — это ручное пополнение на 30 дней, а не рекуррентная подписка в привычном смысле.',
    manageBillingTitle: 'Управление биллингом',
    getKeyTitle: 'Получи свой API-ключ',
    getKeySub: 'Мгновенно, бесплатно, без карты.',
    backToTnt: 'Назад в TNT House',
    billingTitle: 'Биллинг',
    billingSub: 'Оформи подписку на 5000 запросов/30 дней или пополни баланс pay-per-call. Оплата в $MRDT / SOL / USDC через Solana Pay — тот же флоу, что и на остальном TNT House.',
    continueBtn: 'Продолжить',
    noKeyYet: 'Ещё нет ключа? Сначала получи бесплатный выше.',
    currentTierLabel: 'Текущий тариф:',
    callsUsedLabel: 'запросов использовано',
    renewsLabel: 'обновление',
    creditBalanceLabel: 'Баланс кредитов:',
    subscribeCardTitle: 'Подписка — $45',
    subscribeCardSub: '5000 запросов / 30 дней',
    topupCardTitle: 'Пополнить баланс',
    topupCardSub: 'Pay-per-call, $5–$500',
    continueTopup: 'Продолжить пополнение →',
    chooseCurrencyTitle: 'Выбери валюту оплаты',
    backBtn: '← Назад',
    chooseWalletTitle: 'Выбери кошелёк',
    invoiceTapNote: 'Нажатие откроет нашу страницу оплаты внутри браузера {wallet}. Заплати ровно указанную сумму — может появиться предупреждение "домен ещё не проверен", это ожидаемо.',
    cancelBtn: 'Отмена',
    payNowBtn: 'Оплатить',
    manualPayTitle: 'Или заплати вручную с любого кошелька',
    sendToLabel: 'Отправить на',
    exactAmountLabel: 'Точная сумма',
    manualPayNote: 'Отправь ровно эту сумму с любого Solana-кошелька или биржи. Баланс начислится автоматически, как только платёж будет обнаружен — после отправки больше ничего делать не нужно.',
    copyLabel: 'Копировать',
    verifyingText: 'Проверяю блокчейн на предмет твоего платежа...',
    verifyingAttemptPrefix: 'Попытка',
    verifyingAttemptSuffix: '— это может занять минуту-две.',
    paymentConfirmed: 'Платёж подтверждён!',
    subActiveUntil: 'Подписка активна до',
    newCreditBalance: 'Новый баланс кредитов:',
    refreshStatus: 'Обновить статус',
    startOver: 'Начать заново',
    signupReadyTitle: 'Твой API-ключ готов',
    signupWarningPrefix: 'Этот ключ показывается один раз и не может быть получен повторно. Скопируй его сейчас и сохрани в надёжном месте —',
    signupWarningSuffix: 'запросов/день, бесплатный тариф.',
    signupQuickStartLabel: 'Попробуй прямо сейчас — твой ключ уже в этой команде:',
    signupQuickStartHint: 'Вставь в терминал, или используй в любом HTTP-клиенте как заголовок Authorization: Bearer.',
    generatingText: 'Генерация...',
    getFreeKeyBtn: 'Получить бесплатный API-ключ',
    freeTierNote: 'Бесплатный тариф: 15 запросов/день. Без карты. Один ключ на email.',
    signupHint: 'Введи email и скопируй ключ, который появится — показывается один раз.',
    signupErrEmailExists: 'На этот email уже выдан активный API-ключ. Ключ показывается только один раз — если потерял его, напиши нам, и мы выпустим новый.',
    signupErrIpLimit: 'Слишком много регистраций с этого IP сегодня ({used}/{limit}) — попробуй после полуночи UTC или используй x402 без регистрации: GET /api/v1/token-risk/x402.',
    signupErrGlobalLimit: 'Лимит бесплатных ключей на сегодня исчерпан ({used}/{limit}) — попробуй после полуночи UTC.',
    emailPlaceholder: 'Email адрес',
    tryItTitle: 'Попробуй прямо сейчас — без регистрации',
    tryItSubtitle: '3 бесплатные проверки, без email',
    tryItFreeToday: 'бесплатно сегодня',
    tryItQuickTryLabel: 'или попробуй известный токен:',
    tryItPlaceholder: 'Вставь mint-адрес токена Solana',
    tryItButton: 'Проверить риск',
    tryItLoading: 'Анализ...',
    tryItRemaining: 'Осталось бесплатных проверок: {n}',
    tryItLimitTitle: 'Ты использовал все 3 бесплатные проверки',
    tryItLimitBody: 'Получи бесплатный API-ключ ниже — 15 проверок/день, без карты.',
    tryItInvalidMint: 'Введи корректный mint-адрес Solana',
    tryItErrorGeneric: 'Что-то пошло не так. Попробуй ещё раз.',
    // v1.21 docs audit (2026-10-28): MCP section, response fields, 402 note
    mcpTitle: "MCP-сервер",
    mcpIntro: "Используй API как инструмент из Claude, Cursor и любого другого MCP-совместимого агента: тот же движок и тот же JSON, что и у REST-эндпоинта. Транспорт Streamable HTTP, без состояния (только JSON-RPC через POST).",
    mcpEndpointLabel: "Эндпоинт",
    mcpConfigLabel: "Конфиг Claude Desktop / Cursor (ключ не требуется)",
    mcpConfigNote: "Клиенты, которые нативно поддерживают удалённые MCP-серверы, могут использовать URL эндпоинта напрямую вместо mcp-remote.",
    mcpToolsTitle: "Инструменты",
    mcpNoKeyBadge: "без ключа",
    mcpKeyBadge: "API-ключ",
    mcpToolCheckTokenRisk: "Оценка безопасности, инсайдерские кластеры, полномочия, концентрация холдеров и рыночные данные для одного минта (тот же ответ, что и GET /api/v1/token-risk). 5 бесплатных вызовов/день без ключа; далее — бесплатный ключ (15/день), кредит за вызов или подписка.",
    mcpToolBatch: "Та же проверка для до 25 минтов за один вызов. N минтов = N вызовов, всё или ничего: весь батч отклоняется, если твоя квота/кредит не покрывает его.",
    mcpToolFreeKey: "Выдаёт бесплатный API-ключ на адрес электронной почты (15 проверок/день). Один активный ключ на email; ключ возвращается один раз и также отправляется на почту. Количество регистраций ограничено по IP и в сутки.",
    mcpToolTopup: "Создаёт платёжный счёт Solana для твоего ключа: пополнение кредита за вызовы ($5–$500) или подписку на 30 дней. Возвращает payment_id, точную pay_amount и wallet_address.",
    mcpToolCheckPayment: "Проверяет он-чейн, оплачен ли счёт из create_topup_invoice, и если да — зачисляет кредит на твой ключ. Можно безопасно повторять; не чаще одной проверки в 5 секунд на payment_id.",
    mcpToolHistory: "Почасовая история safety_score, числа инсайдерских кластеров, холдеров, цены, ликвидности и объёма для минта за последние N дней (максимум 90). Бесплатно и не учитывается ни в какой квоте.",
    mcpAuthNote: "Передавай ключ в заголовке Authorization: Bearer <api_key> при каждом MCP-запросе либо как аргумент api_key у check_token_risk / check_token_risk_batch, если твой клиент не умеет задавать заголовки (заголовок имеет приоритет). Отказы по квоте возвращают error_code и options[] с точным следующим шагом. x402 с оплатой за вызов — это REST-эндпоинт, см. «Лимиты и цены» ниже.",
    exampleIllustrativeNote: "Иллюстративный ответ: значения выдуманы для вымышленного токена, это не живые данные какого-либо реального минта. Необязательные поля, такие как explanation и note, появляются только когда применимы.",
    fieldCapFlags: "Один булев флаг на каждый уровень ограничения скоринга (maturity, market_health, contract_risk, rugged, wash_trading, lp_risk, mint_authority, freeze_authority, honeypot): true только тогда, когда это ограничение реально снизило оценку. reliefs_triggered перечисляет смягчения, ослабившие ограничение ({ reason, from, to }), например сожжённая или заблокированная LP.",
    fieldClusterSupply: "Доля предложения (%) у всех учтённых инсайдерских кластеров и у крупнейшего из них, плюс сколько кошельков они включают. Кластеры с пометкой false_positive_likely исключаются. null, пока cluster_analysis находится в \"pending\" или когда доля неизвестна. Отслеживаются только топ-холдеры, поэтому это нижние оценки.",
    fieldFlags: "Описательные факты, а не вердикты, например: young_token, cluster_scan_pending, no_market_data, high_turnover, mint_authority_active, freeze_authority_active, lp_partially_or_not_locked, insider_cluster_detected, shared_cex_or_infra_funder, single_holder_gt_50.",
    fieldDataConfidence: "Насколько полон этот ответ: cluster_scan (\"pending\" | \"complete\"), holders_traced, cluster_supply_is_lower_bound, market_data_available, rugcheck_data_available. Используй это, чтобы отличить «низкий риск» от «недостаточно данных».",
    fieldLockedSupply: "Доля предложения (%), заблокированная сейчас в известных неотменяемых вестинг/лок-контрактах, и её часть, которая разблокируется в ближайшие 30 дней. См. vesting_locks для отдельных контрактов.",
    fieldRugcheckExtra: "Из RugCheck: rugged (подтверждённый раг), jup_verified (токен, верифицированный Jupiter), lp_burned ({ burned }), deployer_address и insider_holder_count (rugcheck_insider_holder_count несёт то же значение). null означает, что проверить не удалось.",
    rateLimit402TrimmedNote: "Длинные текстовые поля (note, options[].next_step) здесь сокращены; реальный ответ содержит полный текст.",
    perCallSuffix: "/запрос",
    per30DaysSuffix: "/30 дней",
  },
  it: {
    flag: '🇮🇹',
    name: 'IT',
    headerBadge: 'API DATI DI RISCHIO',
    heroEyebrow: 'PROGETTATO PER AGENTI DI TRADING AI',
    statsLine: '{n}+ controlli di rischio eseguiti · live su Solana mainnet · risposta in meno di 1s',
    heroTitle1: 'Scopri cosa nasconde un token',
    heroTitle2: 'prima che il tuo bot lo compri.',
    heroSub: 'Una singola richiesta GET restituisce un punteggio di sicurezza, il rilevamento in tempo reale dei cluster di insider e i fondamentali on-chain per qualsiasi mint Solana — lo stesso motore degli audit di TNT House, esposto come JSON pulito per i bot invece di una dashboard per gli umani.',
    valueCard1Title: 'Safety Score',
    valueCard1Desc: 'Un solo numero, 0–100, che riassume mint/freeze authority, rischio honeypot, blocco della liquidità e concentrazione degli holder — go/no-go istantaneo per il tuo bot.',
    valueCard2Title: 'Cluster di Insider',
    valueCard2Desc: 'Quando 20 wallet risalgono tutti allo stesso primo finanziatore, non sono 20 acquirenti distinti — è un solo wallet pronto a scaricare su di te.',
    valueCard3Title: 'Honeypot + Blocco LP',
    valueCard3Desc: 'Verifica reale se il contratto ti permette di vendere, e se la liquidità può essere ritirata da sotto i tuoi piedi.',
    btnTryFree: 'Provalo gratis — senza email',
    btnGetKey: 'Ottieni una API key gratuita',
    btnReadDocs: 'Leggi la documentazione',
    btnSiteAssistant: 'Assistente del sito',
    copyCurl: 'Copia curl',
    howItWorksTitle: 'Come funziona',
    integrationsTitle: 'Collega il tuo bot o agente',
    integrationsHint: 'Tocca una piattaforma per ottenere uno snippet pronto da copiare.',
    mcpFreeTierNote: '5 chiamate MCP gratuite al giorno, senza registrazione — pensato per bot e agenti AI. Poi, una chiave gratuita (15/giorno) o x402 a chiamata.',
    demoPublicKeyTitle: 'Chiave demo pubblica — Esperimento live',
    demoPublicKeyRemaining: 'Rimangono {remaining}/{total} chiamate. Condivisa da tutti. Muore per sempre a 0.',
    demoPublicKeyCopy: 'Copia chiave',
    demoPublicKeyNote: 'Senza registrazione — incollala subito nel tuo bot. Quando muore, prendi la tua chiave gratuita qui sotto.',
    demoPublicKeyDead: '💀 La chiave demo pubblica è morta — tutte le chiamate usate, per sempre. Prendi la tua chiave gratuita (15/giorno, senza carta) qui sotto.',
    step1Title: 'Ottieni una key',
    step1Desc: 'Inserisci la tua email qui sotto. Nessuna carta di credito, nessuna attesa di approvazione — la key viene rilasciata immediatamente.',
    step2Title: 'Chiama l\'endpoint',
    step2Desc: 'GET /api/v1/token-risk?mint=<indirizzo> con la tua key nell\'header Authorization. Tempo di risposta tipico: ben sotto il secondo.',
    step3Title: 'Agisci in base al punteggio',
    step3Desc: 'Il tuo bot ottiene un punteggio all\'istante — agisci o salta il trade.',
    responseFieldsTitle: 'Campi della risposta',
    fieldSafetyScore: '0–100. Ponderato su authorities, concentrazione degli holder, liquidità, volume e reali penalità da cluster di insider.',
    fieldInsiderClusters: "Wallet che condividono un primo finanziatore: un segnale insider/sniper dimostrabile on-chain, non un'ipotesi. Ogni cluster include anche funder_class, funder_label, funder_confidence e false_positive_likely: hot wallet noti di CEX/bridge e finanziatori infrastrutturali confermati ad alto fan-out rimangono visibili qui ma non contano più nella penalità insider in safety_score. supply_pct è la quota di offerta del cluster, funder_path la catena di finanziamento tracciata, deployer_linked se quella catena raggiunge il deployer, exchange_source l'exchange che ha finanziato la radice (ognuno null quando sconosciuto).",
    fieldClusterAnalysis: '"pending" al primo controllo di un token (il tracciamento dei cluster gira in background), "complete" a tracciamento concluso.',
    fieldAuthorities: 'Se ciascuna authority è revocata, e il suo indirizzo se ancora attiva.',
    fieldHoneypotLpLocked: 'honeypot_risk (booleano) e lp_locked ({ locked, percent }) da RugCheck. null significa che non è stato possibile verificarlo, non "sicuro".',
    fieldHolderDistribution: "Dati grezzi: % del maggior holder, % top-10, risk_level e holder_count: il conteggio deduplicato dei wallet holder quando disponibile, altrimenti il numero di account nella risposta RPC dei 20 maggiori holder di Solana (un vero limite RPC). freely_tradeable_top10_percent, freely_tradeable_largest_holder_percent e scoring_risk_level sono le cifre che il punteggio utilizza effettivamente (offerta bloccata in contratti di vesting sottratta). holder_data_stale / holder_data_age_seconds mostrano quando è stata servita l'ultima buona snapshot degli holder invece di una lettura live.",
    fieldMarket: "Prezzo live, liquidità, volume 24h, variazione 24h ed età del token (age_days, più age_hours) da DexScreener. Se DexScreener non ha un dato di liquidità, può provenire da RugCheck (flag liquidity_from_rugcheck).",
    fieldOwnerDelegate: 'hidden_owner e permanent_delegate (booleani) dalla lista di rischi di RugCheck. permanent_delegate è un\'estensione Token-2022 che permette a quell\'indirizzo di spostare o bruciare i token di QUALSIASI holder senza permesso — un rischio grave. null significa non verificato, mai un falso "sicuro".',
    fieldTax: 'buy_tax_percent / sell_tax_percent — estensione transfer-fee di Token-2022. La commissione di Solana è simmetrica, quindi entrambi i valori coincidono. null significa che il mint non ha questa estensione (non un controllo fallito).',
    fieldDevWallet: 'dev_wallet_percent — la partecipazione on-chain del deployer stesso, come % dell\'offerta totale. Segnale di concentrazione distinto da holder_distribution.top10_percent, poiché il deployer può detenere una quota importante pur restando fuori dalla top-10.',
    fieldProgramRenounced: 'token_program: "standard" se il mint usa uno dei due programmi token canonici di Solana, "nonstandard" altrimenti. contract_renounced: booleano di comodo per mint_authority.revoked && freeze_authority.revoked.',
    fieldCapsTriggered: 'caps_triggered elenca ogni tetto di punteggio attivato per questo mint (motivo + valore del tetto); dominant_cap è il più severo — il vero motivo del safety_score, non solo un numero. explanation fornisce lo stesso motivo come frase pronta.',
    fieldVestingLocks: 'vesting_locks elenca i contratti di vesting/lock on-chain conosciuti trovati tra i principali holder di questo mint (Streamflow, v1). Un grande holder realmente bloccato a lungo termine viene valutato diversamente da una balena liberamente negoziabile — il punteggio ne tiene già conto, holder_distribution.top10_percent resta il dato grezzo on-chain.',
    rateLimitHeadersNote: 'Ogni risposta include anche gli header X-RateLimit-Limit, X-RateLimit-Remaining e X-RateLimit-Reset — più X-Credit-Balance-Usd non appena hai un livello a pagamento o un saldo di credito — così il tuo bot può monitorare la sua quota senza mai incontrare un 429.',
    openApiUsageNote: 'Funziona subito con le Custom GPT Actions di ChatGPT (basta incollare l\'URL). Per Claude, Gemini o framework di agenti come LangChain/CrewAI, usa questa spec come fonte dello schema per la tua integrazione — la maggior parte richiede un piccolo adattatore, con OpenAPISpec.from_url() di LangChain che la importa direttamente.',
    chatBubbleLabel: 'Chiedi info sull\'API',
    chatTitle: 'Assistente Risk-Data API',
    chatWelcome: 'Ciao! Chiedimi qualsiasi cosa sulla Risk-Data API — endpoint, prezzi, campi di risposta, come ottenere una key.',
    chatPlaceholder: 'Scrivi la tua domanda...',
    chatLimitReached: 'Limite raggiunto — riprova tra qualche minuto.',
    chatConnectionError: 'Errore di connessione. ⚡ Ottieni la tua API key gratuita qui sotto.',
    copyOpenApiUrl: 'Copia',
    webhooksRoadmapNote: 'Al primo controllo di un token, cluster_analysis restituisce "pending" mentre l\'analisi viene eseguita in background — ricontrolla lo stesso mint poco dopo, oppure iscriviti a un webhook su safety_score qui sotto per ricevere una notifica invece di fare polling.',
    webhooksDocsTitle: 'Webhooks',
    webhooksDocsIntro: 'Invece di fare polling su token-risk secondo una pianificazione, iscriviti una sola volta a un mint e una soglia di safety_score — ricevi una callback HTTP firmata nel momento in cui viene superata, in entrambe le direzioni.',
    webhooksSubscribeLabel: 'Iscriviti',
    webhooksResponseLabel: 'Iscrizione creata',
    webhooksPayloadLabel: 'Consegnato al tuo callback_url',
    webhooksUnsubscribeNote: 'Si attiva una sola volta per attraversamento, non a ogni controllo. Verifica ogni consegna con l\'header X-Webhook-Signature e il webhook_secret restituito alla sottoscrizione (mostrato una sola volta). Chiama DELETE /api/v1/webhooks/{id} per annullare l\'iscrizione.',
    webhooksDeliveryTitle: 'Consegna e nuovi tentativi',
    webhooksDeliveryText: 'La consegna avviene tramite QStash: in caso di risposta non 2xx o timeout, riproviamo fino a 3 volte con backoff esponenziale, poi rinunciamo. Ogni evento ha un id univoco (evt_...) — salvalo e ignora ciò che hai già elaborato, perché i tentativi ripetuti reinviano lo stesso evento identico. Una risposta 200 segna l\'evento come consegnato anche se la tua elaborazione fallisce in seguito, quindi salva o elabora il payload prima di rispondere.',
    rateLimitingTitle: 'Limiti di richieste',
    rateLimitingIntro: "Ogni chiave riceve 15 richieste gratuite per giorno solare (UTC). Le chiamate gratuite condividono anche una capacità giornaliera a livello di sito tra tutte le chiavi gratuite: in un giorno di traffico potresti ricevere un 402 con error_code free_pool_capacity prima di raggiungere 15 (la prima chiamata del giorno passa sempre). Le chiamate pagate con credito o coperte da un abbonamento non dipendono mai da quel pool. Supera la tua quota senza saldo di credito per chiamate e ricevi un 402, non un blocco silenzioso: ricarica o abbonati e la stessa chiave continua a funzionare immediatamente.",
    rateLimitHeaderLimitLabel: 'X-RateLimit-Limit',
    rateLimitHeaderLimitDesc: 'La tua quota giornaliera. Vuoto per le key illimitate/emesse da admin.',
    rateLimitHeaderRemainingLabel: 'X-RateLimit-Remaining',
    rateLimitHeaderRemainingDesc: 'Richieste rimaste prima che si esaurisca la quota gratuita di oggi.',
    rateLimitHeaderResetLabel: 'X-RateLimit-Reset',
    rateLimitHeaderResetDesc: 'Timestamp ISO del prossimo reset della quota (mezzanotte UTC, oppure la data di rinnovo del tuo abbonamento).',
    rateLimitHeaderCreditLabel: 'X-Credit-Balance-Usd',
    rateLimitHeaderCreditDesc: 'Il tuo saldo di credito attuale, non appena ne hai uno.',
    rateLimitExceededTitle: 'Cosa succede oltre il limite',
    rateLimitExceededDesc: "Ricevi un HTTP 402 con un corpo JSON machine-readable: error_code, limit, used, reset_at, resets_in, prices e options[], dove ogni opzione (ricarica / abbonamento, o x402) riporta il passo successivo esatto, così un agente può continuare da solo. Nessun retry necessario: appena ricarichi credito o ti abboni, la stessa chiave torna a funzionare dalla chiamata successiva.",
    rateLimitBestPractice: 'Controlla X-RateLimit-Remaining prima di lanciare un batch di chiamate — leggere un header non costa nulla, un 402 sprecato sì.',
    versioningTitle: 'Versionamento e changelog',
    versioningIntro: "L'API è versionata nell'URL (/api/v1/...). All'interno della v1, i campi esistenti non vengono mai rimossi, rinominati o riutilizzati con altro significato — solo aggiunti. Le integrazioni dovrebbero ignorare i campi che non riconoscono anziché fallire per colpa loro. Una modifica realmente incompatibile viene pubblicata come /api/v2/..., mantenendo la v1 attiva per un ragionevole periodo di sovrapposizione — mai una rottura silenziosa sullo stesso endpoint.",
    changelogTitle: 'Changelog',
    changelogNote: "Non c'è ancora una mailing list o un feed di annunci: questa pagina è il posto per restare aggiornati.",
    changelogEntries: [
      {
        version: 'v1.21',
        date: '2026-10-28',
        changes: [
          "Docs: nuova sezione server MCP: endpoint https://www.tnt-audit.com/api/mcp, configurazione client e tutti i 6 strumenti (check_token_risk, check_token_risk_batch, get_free_api_key, create_topup_invoice, check_payment, get_token_risk_history), inclusi quelli che funzionano senza chiave.",
          "Docs: l'esempio Python per x402 ora utilizza l'SDK ufficiale x402 (x402[svm,httpx], schema esatto x402 v2 su Solana). Il precedente esempio openlibx402-client non supportava x402 v2 ed è stato rimosso.",
          "Docs: risposta di esempio e riferimento ai campi allineati allo schema live (explanation, cluster_supply_pct, flags, data_confidence, booleani cap, offerta bloccata, freschezza dei dati holder, age_hours); l'esempio 402 ora mostra il corpo completo del rifiuto (error_code, options[]); tutti gli URL di esempio usano https://www.tnt-audit.com. Nessuna modifica API.",
        ],
      },
      {
        version: 'v1.20',
        date: '2026-09-15',
        changes: [
          "insider_clusters: ogni cluster ora include funder_class ('cex' | 'infra' | 'likely_exchange_or_infra' | 'unknown'), funder_label, funder_confidence e false_positive_likely. Un primo finanziatore condiviso che sia un hot wallet noto di exchange/bridge, o che corrisponda a un pattern infrastrutturale ad alta ramificazione (migliaia di account finanziati, pagamenti di affitto tramite micro-transazioni, alta frequenza di transazioni), rimane visibile nella risposta per motivi di trasparenza ma non conta più nella penalità insider in safety_score -- corregge i falsi positivi che abbiamo riscontrato in produzione su hot wallet CEX valutati come cluster insider.",
        ],
      },
      {
        version: 'v1.19',
        date: '2026-08-29',
        changes: [
          "Docs: aggiunto un esempio Python eseguibile per l'endpoint x402 accanto all'esempio curl esistente (sostituito in v1.21 dall'SDK ufficiale x402): mostra a uno sviluppatore di bot/agent l'intero flusso 402 -> paga -> riprova in poche righe invece della sola meccanica HTTP grezza.",
        ],
      },
      {
        version: 'v1.18',
        date: '2026-08-29',
        changes: [
          "Tariffa di eccedenza pay-per-call (PAYG senza abbonamento): \$0.04 -> \$0.02/chiamata -- riduce l'attrito di una prima prova per un nuovo utente non ancora pronto per l'abbonamento da \$45. Di conseguenza PAYG e x402 hanno ora la stessa tariffa; il messaggio di x402 è stato riscritto da \"più economico di PAYG\" a \"senza account o key\" -- il vero elemento distintivo.",
        ],
      },
      {
        version: 'v1.17',
        date: '2026-08-28',
        changes: [
          "Modifica prezzi abbonamento: quota mensile 1000 -> 5000 chiamate/30 giorni, eccedenza con abbonamento $0.02 -> $0.015/chiamata. Le tariffe Free (15/giorno), PAYG ($0.04/chiamata senza abbonamento) e x402 ($0.02/chiamata) restano invariate -- prezzo adeguato al di sotto del concorrente a pagamento più vicino (token-rugcheck via x402, $0.02/chiamata per dati comparabili) dopo un'analisi della concorrenza.",
        ],
      },
      {
        version: 'v1.16',
        date: '2026-08-22',
        changes: [
          "Sincronizzata la spec OpenAPI pubblica (openapi.json) con tutti i 5 endpoint API live -- batch, history, webhook subscribe/list, signup e trial -- finora erano documentati solo i 2 endpoint principali token-risk. Corretto anche un prezzo x402 obsoleto nella spec (indicava $0.07, il prezzo reale è $0.02).",
          "Aggiunto public/llms.txt -- un indice dell'API leggibile dalle macchine, pensato per gli agenti di coding LLM (Claude Code, Cursor, ecc.) per integrarsi direttamente, seguendo la convenzione emergente llms.txt.",
        ],
      },
      {
        version: 'v1.15',
        date: '2026-08-21',
        changes: [
          "Pubblicato un pacchetto Agent Plugins 1.0 (plugin.json + mcp.json, specifica agent-plugins.org) — consente ai client compatibili con Agent Plugins di scoprire e connettersi al server MCP senza configurazione manuale.",
          "Inviato un pacchetto di plugin nativo per Codex alla directory awesome-codex-plugins (hashgraph-online/awesome-codex-plugins, PR #380), punteggio HOL Plugin Scanner 91/100, nessun rilievo critico o alto, CI verde. Unito il 2026-08-31.",
        ],
      },
      {
        version: 'v1.14',
        date: '2026-08-18',
        changes: [
          "Inserito nell'ecosistema DeepSeek Harness (dsh-plugin) — il repository ora porta il topic GitHub dsh-plugin, rendendolo rilevabile dalle directory di plugin DSH e dal marketplace di plugin integrato.",
          "Skill di Sicurezza inviata al marketplace Solana Skills (sendaifun/skills, che alimenta solana.com/skills) — in attesa di revisione da parte dei maintainer.",
        ],
      },
      {
        version: 'v1.13',
        date: '2026-08-13',
        changes: [
          "Taglio prezzi: pay-per-call $0.07 -> $0.04/chiamata, eccedenza con abbonamento $0.03 -> $0.02/chiamata, abbonamento $49 -> $45 per 1000 chiamate/30 giorni, x402 $0.07 -> $0.02/chiamata — allineato a tariffe comparabili di mercato dopo un confronto con i concorrenti diretti.",
        ],
      },
      {
        version: 'v1.12',
        date: '2026-08-08',
        changes: [
          "Nuovo campo vesting_locks[] — rileva contratti di vesting/lock on-chain conosciuti (Streamflow, v1) tra i principali holder di un mint, così un grande holder realmente bloccato a lungo termine non ottiene più lo stesso punteggio di una balena liberamente negoziabile.",
          'Il punteggio di concentrazione di safety_score ora usa un top10% "liberamente negoziabile" che sottrae l\'offerta realmente bloccata (a meno che il lock non sia annullabile dal sender, o si sblocchi entro 30 giorni) — holder_distribution.top10_percent resta il dato grezzo on-chain, non modificato.',
        ],
      },
      {
        version: 'v1.11',
        date: '2026-08-08',
        changes: [
          "Sei nuovi campi: hidden_owner, permanent_delegate, buy_tax_percent, sell_tax_percent, dev_wallet_percent, token_program, più contract_renounced — tutti dalla stessa chiamata RugCheck, senza latenza aggiuntiva.",
          "safety_score ora include un nuovo livello contractRiskCap (permanent_delegate, hidden_owner, tassa, token_program non standard) e un asse dev-wallet-% sul tetto di salute di mercato esistente — un token non può più ottenere un punteggio alto solo grazie a liquidità/volume pur portando un grave segnale di allarme a livello di contratto.",
          "Nuovo array caps_triggered e campo dominant_cap in ogni risposta — ogni tetto di punteggio attivato, più il più severo, così vedi PERCHÉ un punteggio è basso, non solo che lo è.",
          "Corretto: rugged, jup_verified, deployer_address, insider_holder_count e i booleani capped di maturity/market-health/rugged venivano calcolati dalla v1.4 ma non venivano mai realmente restituiti dagli endpoint principale, batch o x402 — ora presenti su tutti e tre.",
        ],
      },
      {
        version: 'v1.10',
        date: '2026-08-05',
        changes: [
          "honeypot_risk e lp_locked ora restituiscono valori reali da RugCheck invece di sempre null — honeypot_risk è un booleano, lp_locked è { locked, percent }. null continua a significare \"impossibile verificare\", mai un falso \"sicuro\".",
        ],
      },
      {
        version: 'v1.9',
        date: '2026-08-03',
        changes: [
          "Aggiunte le sottoscrizioni webhook — POST /api/v1/webhooks/subscribe per ricevere una callback quando il safety_score di un mint supera una soglia (sopra/sotto), invece di fare polling.",
          "Consegna basata sull'attraversamento della soglia (si attiva una sola volta per attraversamento, non ripetutamente), payload firmati HMAC, DELETE /api/v1/webhooks/{id} per annullare l'iscrizione.",
        ],
      },
      {
        version: 'v1.8',
        date: '2026-07-27',
        changes: [
          "Aggiunto GET /api/v1/token-risk/x402 — accesso a pagamento per chiamata tramite il protocollo x402 (USDC su Solana), senza bisogno di una chiave API. Stesso prezzo della tariffa pay-per-call esistente.",
          "Pubblicato come risorsa rilevabile da x402 su x402scan.com, con uno schema OpenAPI x-payment-info per la scoperta automatica da parte degli agenti.",
        ],
      },
      {
        version: 'v1.7',
        date: '2026-07-26',
        changes: [
          "Pubblicato come server MCP su Smithery.ai e Glama.ai, oltre all'Official MCP Registry — utilizzabile direttamente come strumento da Claude, Cursor e altri agenti compatibili con MCP.",
          "Pubblicati plugin npm per ElizaOS (eliza-plugin-tnt-risk-api) e Solana Agent Kit (solana-agent-kit-plugin-risk-api).",
        ],
      },
      {
        version: 'v1.6',
        date: '2026-07-25',
        changes: ["Pubblicato su Official MCP Registry, mcp.so, RapidAPI e Postman Public API Network — più modi per scoprire e integrare l'API."],
      },
      { version: 'v1.5', date: '2026-07-23', changes: ["Pubblicata una collezione Postman pronta all'importazione."] },
      {
        version: 'v1.4',
        date: '2026-07-21',
        changes: [
          "Pubblicata una specifica OpenAPI 3.0 formale su /openapi.json.",
          'Ribilanciato il budget di timeout per mint molto grandi/liquidi, riducendo ulteriormente i falsi fallimenti di holder_distribution.',
        ],
      },
      {
        version: 'v1.3',
        date: '2026-07-19',
        changes: ['Rafforzamento della sicurezza di fatturazione contro abusi di corrispondenza invoice/pagamento — nessuna modifica allo schema di risposta.'],
      },
      {
        version: 'v1.2',
        date: '2026-07-18',
        changes: [
          'Risolti timeout nelle chiamate upstream che potevano occasionalmente restituire un 502 grezzo su token più lenti e meno importanti.',
          'Risolto il problema per cui holder_distribution segnalava occasionalmente holder_count: 0 su token ad alto volume a causa di un errore RPC soppresso.',
          'Risolti valori implausibili di price_change_24h_percent trasmessi così come sono dai dati di mercato upstream.',
        ],
      },
      {
        version: 'v1.1',
        date: '2026-07-18',
        changes: ['Aggiunte le intestazioni X-RateLimit-Limit / X-RateLimit-Remaining / X-RateLimit-Reset, a cui si è unita successivamente X-Credit-Balance-Usd.'],
      },
      {
        version: 'v1.0',
        date: '2026-07-18',
        changes: [
          'Lancio pubblico: GET /api/v1/token-risk — safety_score, insider_clusters, mint/freeze authority, holder_distribution, dati di mercato.',
          'Autenticazione con API key, fatturazione free tier + pagamento a chiamata + abbonamento tramite Solana Pay.',
        ],
      },
    ],
    pricingTitle: 'Limiti e prezzi',
    tierFree: 'GRATIS',
    tierFreeAmount: '15 rich./giorno',
    freeFeature1: 'Schema di risposta completo',
    freeFeature2: 'Rilevamento cluster di insider',
    freeFeature3: 'Nessuna carta di credito',
    tierPayPerCall: 'PAGAMENTO A CHIAMATA',
    payPerCallFeature1: 'Ricarica qualsiasi importo tra $5 e $500',
    payPerCallFeature2: 'Addebitato solo oltre le 15/giorno gratuite',
    payPerCallFeature3: "Gli abbonati pagano $0.015/chiamata per l'eccedenza oltre la quota",
    tierSubscription: 'ABBONAMENTO',
    subFeature1: '5000 chiamate incluse',
    subFeature2: '$0.015/chiamata di eccedenza dopo',
    subFeature3: 'Rinnovo manuale — nessun addebito automatico',
    tierX402: 'X402 (PAGAMENTO A CHIAMATA, SENZA KEY)',
    x402Feature1: 'Nessuna API key, nessuna registrazione — paghi per richiesta',
    x402Feature2: 'USDC su Solana, regolato per chiamata tramite il protocollo x402',
    x402Feature3: 'Pensato per agenti autonomi che pagano da soli',
    x402HowToLabel: 'protocollo x402',
    x402PythonLabel: "Python, SDK ufficiale x402 (gestisce automaticamente il flusso 402 → paga → riprova)",
    x402HowToIntro:
      "x402 trasforma un 402 Payment Required in un flusso di pagamento funzionante: chiami l'endpoint senza autenticazione, ricevi una sfida di pagamento firmata, la paghi, riprovi con la ricevuta.",
    x402Step1: "Fai una GET sull'endpoint con un mint — non serve l'header Authorization.",
    x402Step2: "Ricevi un HTTP 402 con un header PAYMENT-REQUIRED — una sfida firmata per $0.02 in USDC su Solana.",
    x402Step3: "Firma il pagamento con qualsiasi client compatibile x402 (o SDK wallet/agent), poi riprova la stessa richiesta con il pagamento firmato in un header PAYMENT-SIGNATURE (quello che inviano i client x402 v2) o in un header X-PAYMENT; entrambi sono accettati.",
    x402HowToNote:
      "Stessa tariffa di $0.02/chiamata del livello pagamento a chiamata standard, ma senza bisogno di account o di conservare una key — per agenti che preferiscono pagare per richiesta. Elencato su x402scan.com.",
    pricingNote: 'Pagabile in $MRDT / SOL / USDC via Solana Pay — lo stesso flusso di pagamento del resto di TNT House. Solana Pay non può addebitare automaticamente, quindi l\'abbonamento è una ricarica manuale di 30 giorni, non un abbonamento ricorrente in senso tradizionale.',
    manageBillingTitle: 'Gestisci la fatturazione',
    getKeyTitle: 'Ottieni la tua API key',
    getKeySub: 'Istantaneo, gratuito, nessuna carta richiesta.',
    backToTnt: 'Torna a TNT House',
    billingTitle: 'Fatturazione',
    billingSub: 'Abbonati per 5000 chiamate/30 giorni, oppure ricarica crediti a chiamata. Pagabile in $MRDT / SOL / USDC via Solana Pay — stesso flusso del resto di TNT House.',
    continueBtn: 'Continua',
    noKeyYet: 'Non hai ancora una key? Ottienine una gratis qui sopra prima.',
    currentTierLabel: 'Livello attuale:',
    callsUsedLabel: 'chiamate usate',
    renewsLabel: 'si rinnova',
    creditBalanceLabel: 'Saldo crediti:',
    subscribeCardTitle: 'Abbonati — $45',
    subscribeCardSub: '5000 chiamate / 30 giorni',
    topupCardTitle: 'Ricarica crediti',
    topupCardSub: 'Pagamento a chiamata, $5–$500',
    continueTopup: 'Continua con la ricarica →',
    chooseCurrencyTitle: 'Scegli la valuta di pagamento',
    backBtn: '← Indietro',
    chooseWalletTitle: 'Scegli il wallet',
    invoiceTapNote: 'Toccando si aprirà la nostra pagina di pagamento nel browser interno di {wallet}. Paga esattamente l\'importo mostrato — potresti vedere un avviso "dominio non ancora verificato", è previsto.',
    cancelBtn: 'Annulla',
    payNowBtn: 'Paga ora',
    manualPayTitle: 'Oppure paga manualmente da qualsiasi wallet',
    sendToLabel: 'Invia a',
    exactAmountLabel: 'Importo esatto',
    manualPayNote: 'Invia esattamente questo importo da qualsiasi wallet o exchange Solana. Il tuo credito verrà applicato automaticamente non appena il pagamento sarà rilevato — non serve fare altro dopo l\'invio.',
    copyLabel: 'Copia',
    verifyingText: 'Controllo della blockchain per il tuo pagamento...',
    verifyingAttemptPrefix: 'Tentativo',
    verifyingAttemptSuffix: '— può richiedere uno o due minuti.',
    paymentConfirmed: 'Pagamento confermato!',
    subActiveUntil: 'Abbonamento attivo fino al',
    newCreditBalance: 'Nuovo saldo crediti:',
    refreshStatus: 'Aggiorna stato',
    startOver: 'Ricomincia',
    signupReadyTitle: 'La tua API key è pronta',
    signupWarningPrefix: 'Questa key viene mostrata una sola volta e non può essere recuperata di nuovo. Copiala ora e conservala in un posto sicuro —',
    signupWarningSuffix: 'richieste/giorno, livello gratuito.',
    signupQuickStartLabel: 'Provalo subito — la tua chiave è già in questo comando:',
    signupQuickStartHint: 'Incollalo in un terminale, oppure usalo in qualsiasi client HTTP come header Authorization: Bearer.',
    generatingText: 'Generazione...',
    getFreeKeyBtn: 'Ottieni API key gratuita',
    freeTierNote: 'Livello gratuito: 15 richieste/giorno. Nessuna carta di credito. Una key per email.',
    signupHint: 'Inserisci la tua email, poi copia la key che appare — mostrata una sola volta.',
    emailPlaceholder: 'Indirizzo email',
    tryItTitle: 'Provalo ora — senza registrazione',
    tryItSubtitle: '3 controlli gratuiti, senza email',
    tryItFreeToday: 'gratis oggi',
    tryItQuickTryLabel: 'oppure prova un token noto:',
    tryItPlaceholder: 'Incolla un indirizzo mint Solana',
    tryItButton: 'Controlla rischio',
    tryItLoading: 'Analisi in corso...',
    tryItRemaining: '{n} controllo/i gratuito/i rimasto/i',
    tryItLimitTitle: 'Hai usato tutti e 3 i controlli gratuiti',
    tryItLimitBody: 'Ottieni una API key gratuita qui sotto — 15 controlli/giorno, senza carta.',
    tryItInvalidMint: 'Inserisci un indirizzo mint Solana valido',
    tryItErrorGeneric: 'Qualcosa è andato storto. Riprova.',
    // v1.21 docs audit (2026-10-28): MCP section, response fields, 402 note
    mcpTitle: "Server MCP",
    mcpIntro: "Usa l'API come strumento da Claude, Cursor e qualsiasi altro agente compatibile MCP: stesso motore e stesso JSON dell'endpoint REST. Trasporto Streamable HTTP, senza stato (solo JSON-RPC su POST).",
    mcpEndpointLabel: "Endpoint",
    mcpConfigLabel: "Configurazione Claude Desktop / Cursor (nessuna chiave richiesta)",
    mcpConfigNote: "I client che supportano nativamente server MCP remoti possono usare direttamente l'URL dell'endpoint invece di mcp-remote.",
    mcpToolsTitle: "Strumenti",
    mcpNoKeyBadge: "senza chiave",
    mcpKeyBadge: "chiave API",
    mcpToolCheckTokenRisk: "Punteggio di sicurezza, cluster insider, autorità, concentrazione degli holder e dati di mercato per un mint (la stessa risposta di GET /api/v1/token-risk). 5 chiamate gratuite al giorno senza chiave; dopo, una chiave gratuita (15/giorno), credito per chiamate o un abbonamento.",
    mcpToolBatch: "Lo stesso controllo per fino a 25 mint in una chiamata. N mint = N chiamate, tutto o niente: l'intero batch viene rifiutato se la tua quota/il tuo credito non può coprirlo.",
    mcpToolFreeKey: "Emette una chiave API gratuita per un indirizzo email (15 controlli/giorno). Una chiave attiva per email; la chiave viene restituita una volta e inviata anche via email. Le registrazioni sono limitate per IP e per giorno.",
    mcpToolTopup: "Crea una fattura di pagamento Solana per la tua chiave: ricarica del credito per chiamate ($5–$500) o un abbonamento di 30 giorni. Restituisce payment_id, l'importo esatto pay_amount e wallet_address.",
    mcpToolCheckPayment: "Controlla on-chain se una fattura da create_topup_invoice è stata pagata e, in tal caso, accredita la tua chiave. Sicuro da ripetere; limitato a un controllo ogni 5 secondi per payment_id.",
    mcpToolHistory: "Cronologia oraria di safety_score, numero di cluster insider, holder, prezzo, liquidità e volume per un mint negli ultimi N giorni (max 90). Gratuita e non conteggiata in alcuna quota.",
    mcpAuthNote: "Passa una chiave come header Authorization: Bearer <api_key> su ogni richiesta MCP, o come argomento api_key di check_token_risk / check_token_risk_batch se il tuo client non può impostare gli header (l'header ha la precedenza). I rifiuti per quota restituiscono error_code e options[] con il passo successivo esatto. x402 a chiamata è un endpoint REST, vedi Limiti e prezzi sotto.",
    exampleIllustrativeNote: "Risposta illustrativa: i valori sono inventati per un token fittizio, non dati live per alcun mint reale. I campi opzionali come explanation e note compaiono solo quando applicabili.",
    fieldCapFlags: "Un booleano per ogni livello di cap del punteggio (maturity, market_health, contract_risk, rugged, wash_trading, lp_risk, mint_authority, freeze_authority, honeypot): true solo quando quel cap ha effettivamente abbassato il punteggio. reliefs_triggered elenca le mitigazioni che hanno allentato un cap ({ reason, from, to }), ad es. una LP bruciata o bloccata.",
    fieldClusterSupply: "Quota dell'offerta (%) detenuta da tutti i cluster insider conteggiati e dal più grande, più quanti wallet includono. I cluster contrassegnati false_positive_likely sono esclusi. null mentre cluster_analysis è \"pending\" o quando una quota è sconosciuta. Vengono tracciati solo i principali holder, quindi si tratta di limiti inferiori.",
    fieldFlags: "Fatti descrittivi, non verdetti, ad es. young_token, cluster_scan_pending, no_market_data, high_turnover, mint_authority_active, freeze_authority_active, lp_partially_or_not_locked, insider_cluster_detected, shared_cex_or_infra_funder, single_holder_gt_50.",
    fieldDataConfidence: "Quanto è completa questa risposta: cluster_scan (\"pending\" | \"complete\"), holders_traced, cluster_supply_is_lower_bound, market_data_available, rugcheck_data_available. Usalo per distinguere \"rischio basso\" da \"dati insufficienti\".",
    fieldLockedSupply: "Quota dell'offerta (%) attualmente bloccata in contratti di vesting/lock noti non annullabili, e la parte di essa che si sblocca entro i prossimi 30 giorni. Vedi vesting_locks per i singoli contratti.",
    fieldRugcheckExtra: "Da RugCheck: rugged (rug confermato), jup_verified (token verificato da Jupiter), lp_burned ({ burned }), deployer_address e insider_holder_count (rugcheck_insider_holder_count riporta lo stesso valore). null significa che non è stato possibile controllare.",
    rateLimit402TrimmedNote: "I campi di testo lunghi (note, options[].next_step) sono accorciati qui; la risposta reale contiene il testo completo.",
    perCallSuffix: "/chiamata",
    per30DaysSuffix: "/30 giorni",
  },
  zh: {
    flag: '🇨🇳',
    name: '中文',
    headerBadge: '风险数据 API',
    heroEyebrow: '专为 AI 交易机器人打造',
    statsLine: '已完成 {n}+ 次风险检测 · 已上线 Solana 主网 · 响应时间低于 1 秒',
    heroTitle1: '在你的机器人买入之前',
    heroTitle2: '先看清代币在隐藏什么。',
    heroSub: '一次 GET 请求即可获取安全评分、实时内部人集群检测，以及任意 Solana mint 的链上基本面数据 —— 与 TNT House 审计所用的同一套引擎，以纯净的 JSON 形式面向机器人开放，而不是面向人类的仪表盘。',
    valueCard1Title: 'Safety Score 安全评分',
    valueCard1Desc: '一个 0-100 的数字，汇总了 mint/freeze 权限、honeypot 风险、流动性锁定和持有者集中度 —— 让你的机器人瞬间做出买或不买的决定。',
    valueCard2Title: '内部人集群',
    valueCard2Desc: '当 20 个钱包都指向同一个首笔资助者时，这不是 20 个独立买家 —— 而是一个随时准备砸盘的钱包。',
    valueCard3Title: 'Honeypot + LP 锁定',
    valueCard3Desc: '真实检测合约是否允许你卖出，以及流动性是否可能被从你脚下抽走。',
    btnTryFree: '免费试用 — 无需邮箱',
    btnGetKey: '获取免费 API 密钥',
    btnReadDocs: '查看文档',
    btnSiteAssistant: '网站助手',
    copyCurl: '复制 curl',
    howItWorksTitle: '工作原理',
    integrationsTitle: '连接你的机器人或智能体',
    integrationsHint: '点击一个平台，获取可直接复制的代码片段。',
    mcpFreeTierNote: '每天5次免费MCP调用，无需注册 — 专为机器人和AI智能体打造。之后可使用免费密钥（15次/天）或按次付费的x402。',
    demoPublicKeyTitle: '公共演示密钥 — 实时实验',
    demoPublicKeyRemaining: '剩余 {remaining}/{total} 次调用。所有人共享。归零后永久失效。',
    demoPublicKeyCopy: '复制密钥',
    demoPublicKeyNote: '无需注册 — 现在就直接粘贴到你的机器人里。失效后，在下方获取你自己的免费密钥。',
    demoPublicKeyDead: '💀 公共演示密钥已失效 — 所有调用次数已用完，永久性的。在下方获取你自己的免费密钥（15次/天，无需信用卡）。',
    step1Title: '获取密钥',
    step1Desc: '在下方输入邮箱。无需信用卡，无需等待审批 —— 密钥即时发放。',
    step2Title: '调用接口',
    step2Desc: '在 Authorization 请求头中带上你的密钥，调用 GET /api/v1/token-risk?mint=<地址>。典型响应时间：远低于一秒。',
    step3Title: '根据评分行动',
    step3Desc: '你的机器人立即获得分数——直接行动或跳过这笔交易。',
    responseFieldsTitle: '响应字段',
    fieldSafetyScore: '0–100 分。根据权限状态、持币集中度、流动性、交易量以及真实的内部人集群扣分综合加权得出。',
    fieldInsiderClusters: "共享同一个首次资金来源的钱包：一个链上可证明的内部人/狙击信号，而非猜测。每个集群还带有 funder_class、funder_label、funder_confidence 和 false_positive_likely：已知的 CEX/桥接热钱包以及已确认的高扇出基础设施出资方仍会在此显示，但不再计入 safety_score 中的内部人惩罚。supply_pct 是该集群占总供应量的比例，funder_path 是追溯到的资金链，deployer_linked 表示该链是否到达部署者，exchange_source 是为根账户提供资金的交易所（未知时均为 null）。",
    fieldClusterAnalysis: '代币首次检查时为 "pending"（集群追踪正在后台运行），追踪完成后变为 "complete"。',
    fieldAuthorities: '各权限是否已被撤销，若仍处于活跃状态则显示其地址。',
    fieldHoneypotLpLocked: 'honeypot_risk（布尔值）和 lp_locked（{ locked, percent }）来自 RugCheck。null 表示无法检测，而不是"安全"。',
    fieldHolderDistribution: "原始最大持币者占比、前10名占比、risk_level 和 holder_count：可用时为去重后的持币钱包数量，否则为 Solana 前20大持币者 RPC 响应中的账户数量（这是 RPC 本身的真实限制）。freely_tradeable_top10_percent、freely_tradeable_largest_holder_percent 和 scoring_risk_level 是评分实际使用的数据（已减去锁定在 vesting 合约中的供应量）。holder_data_stale / holder_data_age_seconds 显示最后一次可用的持币快照替代实时读取的时间。",
    fieldMarket: "来自 DexScreener 的实时价格、流动性、24小时交易量、24小时涨跌幅以及代币存在天数（age_days，以及 age_hours）。如果 DexScreener 没有流动性数据，可能来自 RugCheck（标记 liquidity_from_rugcheck）。",
    fieldOwnerDelegate: 'hidden_owner 和 permanent_delegate（布尔值）来自 RugCheck 的风险列表。permanent_delegate 是 Token-2022 扩展，允许该地址在未经许可的情况下转移或销毁任意持币者的代币 —— 严重风险。null 表示未检测，绝不代表虚假的"安全"。',
    fieldTax: 'buy_tax_percent / sell_tax_percent —— Token-2022 转账手续费扩展。Solana 的手续费是对称的，因此两个字段值相同。null 表示该 mint 没有此扩展（而非检测失败）。',
    fieldDevWallet: 'dev_wallet_percent —— 部署者自身链上持仓占总供应量的百分比。这是与 holder_distribution.top10_percent 不同的独立集中度信号，因为部署者可能持有大量份额却不在前10名之列。',
    fieldProgramRenounced: 'token_program：若 mint 使用 Solana 两种标准代币程序之一则为 "standard"，否则为 "nonstandard"。contract_renounced：mint_authority.revoked && freeze_authority.revoked 的便捷布尔字段。',
    fieldCapsTriggered: 'caps_triggered 列出了该 mint 触发的每一个评分上限（原因 + 上限值）；dominant_cap 是其中最严格的一个 —— 也就是 safety_score 真正的成因，而不仅仅是一个数字。explanation 则以现成的句子给出同样的原因。',
    fieldVestingLocks: 'vesting_locks 列出了在该 mint 主要持有者中发现的已知链上 vesting/lock 合约（Streamflow，v1）。真正长期锁定的大户持仓与可自由交易的巨鲸持仓在评分上会有区别 —— 评分已经考虑了这一点，holder_distribution.top10_percent 仍是未经调整的原始链上数据。',
    rateLimitHeadersNote: '每个响应还包含 X-RateLimit-Limit、X-RateLimit-Remaining 和 X-RateLimit-Reset 请求头 —— 一旦你有付费套餐或信用余额，还会附带 X-Credit-Balance-Usd —— 这样你的机器人无需触发 429 就能追踪自己的配额。',
    openApiUsageNote: '可直接配合 ChatGPT 的 Custom GPT Actions 使用（只需粘贴链接即可）。若用于 Claude、Gemini 或 LangChain/CrewAI 等智能体框架，请将此规范作为你自己工具集成的 schema 来源 —— 大多数平台仍需一个小型适配层，其中 LangChain 的 OpenAPISpec.from_url() 可以直接导入。',
    chatBubbleLabel: '咨询 API',
    chatTitle: 'Risk-Data API 助手',
    chatWelcome: '你好！关于 Risk-Data API 的任何问题都可以问我 —— 接口、价格、响应字段、如何获取密钥。',
    chatPlaceholder: '输入你的问题…',
    chatLimitReached: '已达到限制 —— 请几分钟后再试。',
    chatConnectionError: '连接错误。⚡ 在下方获取你的免费 API 密钥。',
    copyOpenApiUrl: '复制',
    webhooksRoadmapNote: '代币首次检测时，cluster_analysis 会返回 "pending"，此时分析仍在后台运行 —— 请稍后重新查询同一个 mint，或在下方订阅 safety_score webhook，以推送通知代替轮询。',
    webhooksDocsTitle: 'Webhooks',
    webhooksDocsIntro: '无需按计划轮询 token-risk —— 只需针对某个 mint 和 safety_score 阈值订阅一次，一旦跨越阈值（无论方向），即可收到已签名的 HTTP 回调。',
    webhooksSubscribeLabel: '订阅',
    webhooksResponseLabel: '订阅已创建',
    webhooksPayloadLabel: '推送到你的 callback_url',
    webhooksUnsubscribeNote: '每次跨越只触发一次，而非每次检测都触发。请使用 X-Webhook-Signature 请求头和订阅响应中返回的 webhook_secret（仅显示一次）验证每次推送。调用 DELETE /api/v1/webhooks/{id} 即可取消订阅。',
    webhooksDeliveryTitle: '投递与重试',
    webhooksDeliveryText: '推送通过 QStash 完成：如果收到非 2xx 响应或超时，我们会以指数退避的方式重试最多 3 次，之后放弃。每个事件都带有唯一的 id（evt_...）——请保存它，并跳过已处理过的事件，因为重试会重新发送完全相同的事件。返回 200 即视为该事件已投递，即使你之后的处理失败也是如此，因此请在响应之前先保存或处理好 payload。',
    rateLimitingTitle: '速率限制',
    rateLimitingIntro: "每个密钥在每个日历日（UTC）有 15 次免费请求。所有免费密钥还共享全站每日免费调用容量：在繁忙的一天，你可能在达到 15 次之前收到带 error_code free_pool_capacity 的 402（你当天的第一次调用总会通过）。由额度支付或订阅覆盖的调用从来不依赖该池。超出配额且没有调用额度余额时，你会收到 402，而不是被默默拦截——充值或订阅后，同一个密钥会立即恢复可用。",
    rateLimitHeaderLimitLabel: 'X-RateLimit-Limit',
    rateLimitHeaderLimitDesc: '你的每日配额。无限量/管理员发放的密钥此项为空。',
    rateLimitHeaderRemainingLabel: 'X-RateLimit-Remaining',
    rateLimitHeaderRemainingDesc: '今天免费配额用完前还剩多少次请求。',
    rateLimitHeaderResetLabel: 'X-RateLimit-Reset',
    rateLimitHeaderResetDesc: '下次配额重置的 ISO 时间戳（下一个 UTC 午夜，或你的订阅续费日期）。',
    rateLimitHeaderCreditLabel: 'X-Credit-Balance-Usd',
    rateLimitHeaderCreditDesc: '你当前的通话信用余额（如果有的话）。',
    rateLimitExceededTitle: '超出限制后会发生什么',
    rateLimitExceededDesc: "你会收到一个带机器可读 JSON 主体的 HTTP 402：error_code、limit、used、reset_at、resets_in、prices 和 options[]，其中每个选项（充值 / 订阅，或 x402）都带有确切的下一步，以便智能体可以自行继续。无需重试：一旦充值额度或订阅，同一个密钥在下一次调用时就会立即恢复正常。",
    rateLimitBestPractice: '在发起一批调用之前先检查 X-RateLimit-Remaining —— 读取一个响应头不花钱，白白触发一次 402 却会。',
    versioningTitle: '版本管理与更新日志',
    versioningIntro: 'API 通过 URL 进行版本管理（/api/v1/...）。在 v1 内部，现有字段永远不会被删除、重命名或改变用途——只会新增字段。集成方应该忽略无法识别的字段，而不是因此报错。真正的不兼容变更会以 /api/v2/... 的形式发布，v1 会继续运行一段合理的过渡期——绝不会在原地进行静默的破坏性改动。',
    changelogTitle: '更新日志',
    changelogNote: "目前还没有邮件列表或公告订阅源：本页面是获取最新动态的地方。",
    changelogEntries: [
      {
        version: 'v1.21',
        date: '2026-10-28',
        changes: [
          "文档：新增 MCP 服务器部分：端点 https://www.tnt-audit.com/api/mcp、客户端配置，以及全部 6 个工具（check_token_risk、check_token_risk_batch、get_free_api_key、create_topup_invoice、check_payment、get_token_risk_history），包括哪些工具无需密钥即可使用。",
          "文档：x402 Python 示例现在使用官方 x402 SDK（x402[svm,httpx]，Solana 上的 x402 v2 精确方案）。之前的 openlibx402-client 示例不支持 x402 v2，已移除。",
          "文档：示例响应和字段参考已与实时 schema 保持一致（explanation、cluster_supply_pct、flags、data_confidence、cap 布尔值、锁定供应量、持币数据新鲜度、age_hours）；402 示例现在显示完整的拒绝响应体（error_code、options[]）；所有示例 URL 均使用 https://www.tnt-audit.com。无 API 变更。",
        ],
      },
      {
        version: 'v1.20',
        date: '2026-09-15',
        changes: [
          "insider_clusters: 每个集群现在带有 funder_class ('cex' | 'infra' | 'likely_exchange_or_infra' | 'unknown')、funder_label、funder_confidence 和 false_positive_likely。一个共享的首个资金提供者如果是已知的交易所/跨链桥热钱包，或者匹配高扇出基础设施模式 (数千个受资账户、微转账租金支付、高交易频率)，出于透明度考虑在响应中保持可见，但不再计入 safety_score 中的内部人士惩罚 -- 修复了我们在线发现的 CEX 热钱包被评分为内部人士集群的误报。",
        ],
      },
      {
        version: 'v1.19',
        date: '2026-08-29',
        changes: [
          "文档：为 x402 端点新增了一个可运行的 Python 示例，与现有 curl 示例并列（在 v1.21 中被官方 x402 SDK 取代）：用几行代码向机器人/智能体开发者展示完整的 402 -> 支付 -> 重试流程，而非仅原始 HTTP 机制。",
        ],
      },
      {
        version: 'v1.18',
        date: '2026-08-29',
        changes: [
          "按次付费（未订阅 PAYG）超额费率：\$0.04 -> \$0.02/次 —— 降低新用户在尚未准备好 \$45 订阅前进行首次试用的门槛。结果 PAYG 与 x402 费率现已相同；x402 的宣传语从\"比 PAYG 便宜\"改写为\"无需账户或密钥\" —— 这才是真正的差异点。",
        ],
      },
      {
        version: 'v1.17',
        date: '2026-08-28',
        changes: [
          "订阅定价调整：月度配额从 1000 提升至 5000 次调用/30 天，订阅后超额费率从 $0.02 降至 $0.015/次。Free（15次/天）、PAYG（未订阅 $0.04/次）和 x402（$0.02/次）费率保持不变 —— 在竞品调研后，将价格调整至低于最接近的付费竞品（token-rugcheck 通过 x402，$0.02/次，提供类似的基础数据）。",
        ],
      },
      {
        version: 'v1.16',
        date: '2026-08-22',
        changes: [
          '同步了公开的 OpenAPI 规范（openapi.json），涵盖全部 5 个已上线的 API 端点——batch、history、webhook subscribe/list、signup 和 trial——此前只记录了 2 个核心 token-risk 端点。同时修复了规范中过时的 x402 价格（原为 $0.07，实际价格为 $0.02）。',
          '新增 public/llms.txt——一个供 LLM 编程代理（Claude Code、Cursor 等）直接读取的机器可读 API 索引，遵循新兴的 llms.txt 规范。',
        ],
      },
      {
        version: 'v1.15',
        date: '2026-08-21',
        changes: [
          '发布了 Agent Plugins 1.0 软件包（plugin.json + mcp.json，遵循 agent-plugins.org 规范）—— 让兼容 Agent Plugins 的客户端无需手动配置即可发现并连接到 MCP 服务器。',
          "已向 awesome-codex-plugins 目录（hashgraph-online/awesome-codex-plugins，PR #380）提交原生 Codex 插件包，HOL Plugin Scanner 评分 91/100，无严重或高危问题，CI 通过。已于 2026-08-31 合并。",
        ],
      },
      {
        version: 'v1.14',
        date: '2026-08-18',
        changes: [
          '已收录至 DeepSeek Harness（dsh-plugin）生态系统 —— 仓库现已加上 dsh-plugin 这一 GitHub topic，使其可被 DSH 插件目录及内置插件市场发现。',
          '已向 Solana Skills 市场（sendaifun/skills，为 solana.com/skills 提供数据）提交安全类 skill —— 等待维护者审核。',
        ],
      },
      {
        version: 'v1.13',
        date: '2026-08-13',
        changes: [
          '价格下调：按次付费 $0.07 -> $0.04/次，订阅超额 $0.03 -> $0.02/次，订阅 $49 -> $45（1000次/30天），x402 $0.07 -> $0.02/次 —— 在对比直接竞争对手后，调整至具有市场竞争力的水平。',
        ],
      },
      {
        version: 'v1.12',
        date: '2026-08-08',
        changes: [
          '新增 vesting_locks[] 字段 —— 检测 mint 主要持有者中已知的链上 vesting/lock 合约（Streamflow，v1），使真正长期锁定的大户持仓不再与可自由交易的巨鲸持仓获得相同评分。',
          'safety_score 的集中度评分现在使用"可自由交易"的 top10%，会扣除真正被锁定的供应量（除非该锁仓可由发起方取消，或将在 30 天内解锁）—— holder_distribution.top10_percent 本身仍保持未经调整的原始链上数值。',
        ],
      },
      {
        version: 'v1.11',
        date: '2026-08-08',
        changes: [
          '新增六个字段：hidden_owner、permanent_delegate、buy_tax_percent、sell_tax_percent、dev_wallet_percent、token_program，以及 contract_renounced —— 均来自同一次 RugCheck 请求，无额外延迟。',
          'safety_score 现在包含新的 contractRiskCap 层级（permanent_delegate、hidden_owner、税费、非标准 token_program），并在现有市场健康上限中加入了 dev-wallet-% 维度 —— 代币不能再仅凭流动性/交易量获得高分，同时却携带严重的合约层面风险信号。',
          '每个响应新增 caps_triggered 数组和 dominant_cap 字段 —— 列出所有触发的评分上限，以及其中最严格的一个，让你清楚看到分数低的真正原因，而不仅仅是一个数字。',
          '修复：rugged、jup_verified、deployer_address、insider_holder_count 以及 maturity/market-health/rugged 的 capped 布尔字段自 v1.4 起就已计算，但从未真正在主接口、批量接口或 x402 接口中返回 —— 现已在三者中全部补齐。',
        ],
      },
      {
        version: 'v1.10',
        date: '2026-08-05',
        changes: [
          'honeypot_risk 和 lp_locked 现在返回来自 RugCheck 的真实值，不再始终为 null —— honeypot_risk 是布尔值，lp_locked 是 { locked, percent }。null 仍然表示"无法检测"，而不是虚假的"安全"。',
        ],
      },
      {
        version: 'v1.9',
        date: '2026-08-03',
        changes: [
          "新增 webhook 订阅功能 —— 通过 POST /api/v1/webhooks/subscribe，当某个 mint 的 safety_score 跨越设定阈值（above/below）时推送回调，而无需轮询。",
          "基于阈值跨越触发的推送（每次跨越只触发一次，不会重复），payload 使用 HMAC 签名，可通过 DELETE /api/v1/webhooks/{id} 取消订阅。",
        ],
      },
      {
        version: 'v1.8',
        date: '2026-07-27',
        changes: [
          '新增 GET /api/v1/token-risk/x402 — 通过 x402 协议按次付费访问（Solana 上的 USDC），无需 API 密钥。价格与现有的按次计费费率相同。',
          '已作为可被 x402 发现的资源发布在 x402scan.com 上，并附有 OpenAPI x-payment-info 架构以便代理自动发现。',
        ],
      },
      {
        version: 'v1.7',
        date: '2026-07-26',
        changes: [
          '已作为 MCP 服务器发布在 Smithery.ai 和 Glama.ai 上，此外还发布在 Official MCP Registry 上 —— Claude、Cursor 及其他兼容 MCP 的智能体可直接将其作为工具使用。',
          '已发布 ElizaOS（eliza-plugin-tnt-risk-api）和 Solana Agent Kit（solana-agent-kit-plugin-risk-api）的 npm 插件。',
        ],
      },
      {
        version: 'v1.6',
        date: '2026-07-25',
        changes: ['已发布至 Official MCP Registry、mcp.so、RapidAPI 和 Postman Public API Network —— 提供更多发现和集成该 API 的途径。'],
      },
      { version: 'v1.5', date: '2026-07-23', changes: ['发布了可直接导入的 Postman 集合。'] },
      {
        version: 'v1.4',
        date: '2026-07-21',
        changes: [
          '在 /openapi.json 发布了正式的 OpenAPI 3.0 规范。',
          '为超大/高流动性的 mint 重新调整了上游超时预算，进一步减少了 holder_distribution 的误报失败。',
        ],
      },
      {
        version: 'v1.3',
        date: '2026-07-19',
        changes: ['针对 invoice/支付匹配滥用加强了计费安全性——响应结构没有变化。'],
      },
      {
        version: 'v1.2',
        date: '2026-07-18',
        changes: [
          '修复了上游调用超时问题，此前在较慢、非主流代币上偶尔会返回原始 502。',
          '修复了 holder_distribution 因被吞掉的 RPC 失败而在高交易量代币上偶尔报告 holder_count: 0 的问题。',
          '修复了从上游行情数据原样传递过来的不合理的 price_change_24h_percent 数值。',
        ],
      },
      {
        version: 'v1.1',
        date: '2026-07-18',
        changes: ['新增 X-RateLimit-Limit / X-RateLimit-Remaining / X-RateLimit-Reset 响应头，随后又加入了 X-Credit-Balance-Usd。'],
      },
      {
        version: 'v1.0',
        date: '2026-07-18',
        changes: [
          '公开发布：GET /api/v1/token-risk —— safety_score、insider_clusters、mint/freeze authority、holder_distribution、行情数据。',
          'API 密钥鉴权，free tier + 按次付费 + 通过 Solana Pay 订阅的计费方式。',
        ],
      },
    ],
    pricingTitle: '限额与价格',
    tierFree: '免费',
    tierFreeAmount: '15 次/天',
    freeFeature1: '完整响应结构',
    freeFeature2: '内部人集群检测',
    freeFeature3: '无需信用卡',
    tierPayPerCall: '按次付费',
    payPerCallFeature1: '可充值 $5–$500 之间任意金额',
    payPerCallFeature2: '仅在超出免费的 15 次/天后才会扣费',
    payPerCallFeature3: '订阅后超出配额部分按 $0.015/次 计费',
    tierSubscription: '订阅',
    subFeature1: '含 5000 次调用',
    subFeature2: '超出后 $0.015/次',
    subFeature3: '手动续费 —— 不会自动扣款',
    tierX402: 'X402（按次付费，无需密钥）',
    x402Feature1: '无需 API 密钥，无需注册 —— 按请求付费',
    x402Feature2: 'Solana 上的 USDC，通过 x402 协议按次结算',
    x402Feature3: '专为自主支付的自动化 agent 设计',
    x402HowToLabel: 'x402 协议',
    x402PythonLabel: "Python，官方 x402 SDK（自动处理 402 → 支付 → 重试流程）",
    x402HowToIntro:
      'x402 把 402 Payment Required 变成一套可用的支付流程：无需鉴权即可调用接口，返回一个已签名的支付挑战，完成支付后携带凭证重试。',
    x402Step1: '用 mint 参数 GET 该接口 —— 不需要 Authorization 请求头。',
    x402Step2: '你会收到 HTTP 402，响应头带有 PAYMENT-REQUIRED —— 一个价值 $0.02 USDC（Solana 链上）的已签名支付挑战。',
    x402Step3: "使用任意兼容 x402 的客户端（或钱包/agent SDK）签名支付，然后携带含已签名支付信息的 PAYMENT-SIGNATURE 请求头（x402 v2 客户端发送的）或 X-PAYMENT 请求头重试同一请求；两者均接受。",
    x402HowToNote:
      '与标准按次付费套餐相同的 $0.02/次费率，但无需账户或保存密钥 —— 适合那些更愿意按请求结算的 agent。已收录在 x402scan.com。',
    pricingNote: '通过 Solana Pay 以 $MRDT / SOL / USDC 支付 —— 与 TNT House 其他部分相同的支付流程。Solana Pay 无法自动扣款，因此订阅本质上是每 30 天手动充值一次，而非传统意义上的自动续订。',
    manageBillingTitle: '管理账单',
    getKeyTitle: '获取你的 API 密钥',
    getKeySub: '即时获取，完全免费，无需信用卡。',
    backToTnt: '返回 TNT House',
    billingTitle: '账单',
    billingSub: '订阅 5000 次调用/30 天，或为按次付费充值。通过 Solana Pay 以 $MRDT / SOL / USDC 支付 —— 与 TNT House 其他部分相同的流程。',
    continueBtn: '继续',
    noKeyYet: '还没有密钥？先在上方免费获取一个。',
    currentTierLabel: '当前套餐：',
    callsUsedLabel: '次已使用',
    renewsLabel: '续期于',
    creditBalanceLabel: '信用余额：',
    subscribeCardTitle: '订阅 —— $45',
    subscribeCardSub: '5000 次调用 / 30 天',
    topupCardTitle: '充值信用额度',
    topupCardSub: '按次付费，$5–$500',
    continueTopup: '继续充值 →',
    chooseCurrencyTitle: '选择支付币种',
    backBtn: '← 返回',
    chooseWalletTitle: '选择钱包',
    invoiceTapNote: '点击后将在 {wallet} 的内置浏览器中打开我们的支付页面。请支付显示的确切金额 —— 你可能会看到"域名尚未审核"的提示，这是正常现象。',
    cancelBtn: '取消',
    payNowBtn: '立即支付',
    manualPayTitle: '或使用任意钱包手动支付',
    sendToLabel: '发送至',
    exactAmountLabel: '确切金额',
    manualPayNote: '从任意 Solana 钱包或交易所发送这个确切金额即可。一旦检测到付款，你的额度将自动生效 —— 发送后无需再做任何操作。',
    copyLabel: '复制',
    verifyingText: '正在链上查询你的付款…',
    verifyingAttemptPrefix: '第',
    verifyingAttemptSuffix: '次尝试 —— 这可能需要一两分钟。',
    paymentConfirmed: '付款已确认！',
    subActiveUntil: '订阅有效期至',
    newCreditBalance: '新的信用余额：',
    refreshStatus: '刷新状态',
    startOver: '重新开始',
    signupReadyTitle: '你的 API 密钥已就绪',
    signupWarningPrefix: '此密钥仅显示一次，之后无法再次查看。请立即复制并妥善保存 ——',
    signupWarningSuffix: '次请求/天，免费套餐。',
    signupQuickStartLabel: '立即试试 —— 你的密钥已经填入这条命令：',
    signupQuickStartHint: '粘贴到终端里，或在任意 HTTP 客户端中作为 Authorization: Bearer 请求头使用。',
    generatingText: '生成中…',
    getFreeKeyBtn: '获取免费 API 密钥',
    freeTierNote: '免费套餐：15 次请求/天。无需信用卡。每个邮箱一个密钥。',
    signupHint: '输入邮箱，然后复制出现的密钥 —— 只显示一次。',
    emailPlaceholder: '邮箱地址',
    tryItTitle: '立即试用 — 无需注册',
    tryItSubtitle: '3 次免费查询，无需邮箱',
    tryItFreeToday: '今日免费',
    tryItQuickTryLabel: '或试试知名代币：',
    tryItPlaceholder: '粘贴 Solana mint 地址',
    tryItButton: '检查风险',
    tryItLoading: '分析中...',
    tryItRemaining: '剩余 {n} 次免费查询',
    tryItLimitTitle: '你已用完 3 次免费查询',
    tryItLimitBody: '在下方获取免费 API 密钥 —— 每天 15 次查询，无需信用卡。',
    tryItInvalidMint: '请输入有效的 Solana mint 地址',
    tryItErrorGeneric: '出错了，请重试。',
    // v1.21 docs audit (2026-10-28): MCP section, response fields, 402 note
    mcpTitle: "MCP 服务器",
    mcpIntro: "将 API 作为工具从 Claude、Cursor 及任何其他兼容 MCP 的智能体中使用：与 REST 端点相同的引擎和相同的 JSON。Streamable HTTP 传输，无状态（仅通过 POST 使用 JSON-RPC）。",
    mcpEndpointLabel: "端点",
    mcpConfigLabel: "Claude Desktop / Cursor 配置（无需密钥）",
    mcpConfigNote: "原生支持远程 MCP 服务器的客户端可以直接使用端点 URL，而无需 mcp-remote。",
    mcpToolsTitle: "工具",
    mcpNoKeyBadge: "无需密钥",
    mcpKeyBadge: "API 密钥",
    mcpToolCheckTokenRisk: "针对一个 mint 的安全评分、内部人集群、权限、持币集中度及市场数据（与 GET /api/v1/token-risk 响应相同）。无密钥时每天 5 次免费调用；之后可使用免费密钥（15 次/天）、调用额度或订阅。",
    mcpToolBatch: "在单次调用中对最多 25 个 mint 进行相同的检查。N 个 mint = N 次调用，全有或全无：如果配额/额度无法覆盖，整个批次会被拒绝。",
    mcpToolFreeKey: "为电子邮件地址发放一个免费 API 密钥（每天 15 次检查）。每个邮箱一个有效密钥；密钥仅返回一次并同时通过邮件发送。注册按 IP 和按天限制。",
    mcpToolTopup: "为你的密钥创建 Solana 支付发票：调用额度充值（$5–$500）或 30 天订阅。返回 payment_id、精确的 pay_amount 和 wallet_address。",
    mcpToolCheckPayment: "在链上检查来自 create_topup_invoice 的发票是否已支付，如果已支付则为你的密钥添加额度。可安全重复；每个 payment_id 每 5 秒限制检查一次。",
    mcpToolHistory: "一个 mint 在过去 N 天（最多 90）内的 safety_score、内部人集群数量、持币人数、价格、流动性和交易量的逐小时历史。免费且不计入任何配额。",
    mcpAuthNote: "在每次 MCP 请求中，将密钥作为 Authorization: Bearer <api_key> 请求头传递；如果你的客户端无法设置请求头，则作为 check_token_risk / check_token_risk_batch 的 api_key 参数传递（请求头优先）。配额拒绝会返回 error_code 和 options[]，其中包含确切的下一步。x402 按次付费是一个 REST 端点，参见下方限额与价格。",
    exampleIllustrativeNote: "示例响应：数值为虚构代币编造，并非任何真实 mint 的实时数据。explanation 和 note 等可选字段仅在适用时出现。",
    fieldCapFlags: "每个评分上限层级对应一个布尔值（maturity、market_health、contract_risk、rugged、wash_trading、lp_risk、mint_authority、freeze_authority、honeypot）：仅当该上限实际拉低分数时为 true。reliefs_triggered 列出放宽上限的缓解措施（{ reason, from, to }），例如销毁或锁定的 LP。",
    fieldClusterSupply: "所有已计入的内部人集群及最大集群持有的供应量占比（%），以及它们包含的钱包数量。标记为 false_positive_likely 的集群被排除。当 cluster_analysis 为 \"pending\" 或份额未知时为 null。仅追踪顶级持币者，因此这些是下限。",
    fieldFlags: "描述性事实，而非结论，例如 young_token、cluster_scan_pending、no_market_data、high_turnover、mint_authority_active、freeze_authority_active、lp_partially_or_not_locked、insider_cluster_detected、shared_cex_or_infra_funder、single_holder_gt_50。",
    fieldDataConfidence: "此答案的完整程度：cluster_scan（\"pending\" | \"complete\"）、holders_traced、cluster_supply_is_lower_bound、market_data_available、rugcheck_data_available。用它来区分“低风险”与“数据不足”。",
    fieldLockedSupply: "当前锁定在已知不可取消的 vesting/lock 合约中的供应量占比（%），以及在未来 30 天内解锁的部分。详见 vesting_locks 中的具体合约。",
    fieldRugcheckExtra: "来自 RugCheck：rugged（确认的 rug）、jup_verified（Jupiter 验证的代币）、lp_burned（{ burned }）、deployer_address，以及 insider_holder_count（rugcheck_insider_holder_count 携带相同值）。null 表示无法检查。",
    rateLimit402TrimmedNote: "长文本字段（note、options[].next_step）在此处被缩短；真实响应包含完整文本。",
    perCallSuffix: "/调用",
    per30DaysSuffix: "/30 天",
  },
};


