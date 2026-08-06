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
  heroTitle1: string;
  heroTitle2: string;
  heroSub: string;
  btnGetKey: string;
  btnReadDocs: string;

  // Docs terminal
  copyCurl: string;

  // How it works
  howItWorksTitle: string;
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
}

export const RISK_API_TRANSLATIONS: Record<LangCode, RiskApiTranslations> = {
  en: {
    flag: '🇬🇧',
    name: 'EN',
    headerBadge: 'RISK-DATA API',
    heroEyebrow: 'BUILT FOR AI TRADING AGENTS',
    heroTitle1: 'Know what a token is hiding',
    heroTitle2: 'before your bot buys it.',
    heroSub: 'One GET request returns a safety score, live insider-cluster detection, and on-chain fundamentals for any Solana mint — the same engine behind TNT House audits, exposed as clean JSON for bots instead of a dashboard for humans.',
    btnGetKey: 'Get a free API key',
    btnReadDocs: 'Read the docs',
    copyCurl: 'Copy curl',
    howItWorksTitle: 'How it works',
    step1Title: 'Get a key',
    step1Desc: 'Enter your email below. No credit card, no approval wait — the key is issued instantly.',
    step2Title: 'Call the endpoint',
    step2Desc: 'GET /api/v1/token-risk?mint=<address> with your key in the Authorization header. Typical response time: well under a second.',
    step3Title: 'Act on the score',
    step3Desc: 'First-ever check on a mint returns cluster_analysis: "pending" while the insider trace runs in the background — re-check in a minute or two for the full picture.',
    responseFieldsTitle: 'Response fields',
    fieldSafetyScore: '0–100. Weighted from authorities, holder concentration, liquidity, volume, and real insider-cluster penalties.',
    fieldInsiderClusters: 'Wallets that share a first-funder — an on-chain-provable insider/sniper signal, not a guess.',
    fieldClusterAnalysis: '"pending" on a token\'s first-ever check (cluster trace runs in the background), "complete" after ~1–2 minutes.',
    fieldAuthorities: 'Whether each authority is revoked, and its address if still active.',
    fieldHoneypotLpLocked: 'honeypot_risk (boolean) and lp_locked ({ locked, percent }) from RugCheck. null means it could not be checked, not "safe."',
    fieldHolderDistribution: 'Largest holder %, top-10 %, risk level, and holder_count — the number of accounts in Solana\u2019s top-20-largest-holders response (a real RPC limit, not a full holder count for widely-held tokens like BONK or USDC).',
    fieldMarket: 'Live price, liquidity, 24h volume, 24h change, and token age from DexScreener.',
    rateLimitHeadersNote: 'Every response also includes X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers — plus X-Credit-Balance-Usd once you have a paid tier or credit balance — so your bot can track its quota without ever hitting a 429.',
    openApiUsageNote: 'Works out of the box with ChatGPT Custom GPT Actions (just paste the URL). For Claude, Gemini, or agent frameworks like LangChain/CrewAI, use this spec as the schema source for your own tool integration — most of those need a small adapter, LangChain\'s OpenAPISpec.from_url() being the one that imports it directly.',
    chatBubbleLabel: 'Ask about the API',
    chatTitle: 'Risk-Data API Assistant',
    chatWelcome: 'Hey! Ask me anything about the Risk-Data API — endpoint, pricing, response fields, getting a key.',
    chatPlaceholder: 'Ask a question...',
    chatLimitReached: 'Rate limit reached — try again in a few minutes.',
    chatConnectionError: 'Connection error. ⚡ Get your free API key below.',
    copyOpenApiUrl: 'Copy',
    webhooksRoadmapNote: 'On a token\'s first-ever check, cluster_analysis returns "pending" while the trace runs in the background — re-check the same mint after 1-2 minutes, or subscribe to a safety_score webhook below to get pushed a notification instead of polling.',
    webhooksDocsTitle: 'Webhooks',
    webhooksDocsIntro: 'Instead of polling token-risk on a schedule, subscribe once to a mint and a safety_score threshold — get a signed HTTP callback the moment it\'s crossed, in either direction.',
    webhooksSubscribeLabel: 'Subscribe',
    webhooksResponseLabel: 'Subscription created',
    webhooksPayloadLabel: 'Delivered to your callback_url',
    webhooksUnsubscribeNote: 'Fires once per crossing, not on every check. Verify each delivery with the X-Webhook-Signature header and the webhook_secret from the subscribe response (shown only once). Call DELETE /api/v1/webhooks/{id} to unsubscribe.',
    rateLimitingTitle: 'Rate Limiting',
    rateLimitingIntro: 'Every key gets 15 free requests per calendar day (UTC). Go over that with no call-credit balance and you get a 402, not a silent block — top up or subscribe and the same key keeps working immediately.',
    rateLimitHeaderLimitLabel: 'X-RateLimit-Limit',
    rateLimitHeaderLimitDesc: 'Your daily quota. Empty on unlimited/admin-issued keys.',
    rateLimitHeaderRemainingLabel: 'X-RateLimit-Remaining',
    rateLimitHeaderRemainingDesc: 'Requests left before the free quota runs out today.',
    rateLimitHeaderResetLabel: 'X-RateLimit-Reset',
    rateLimitHeaderResetDesc: 'ISO timestamp of the next quota reset (next UTC midnight, or your subscription renewal date).',
    rateLimitHeaderCreditLabel: 'X-Credit-Balance-Usd',
    rateLimitHeaderCreditDesc: 'Your current call-credit balance, once you have one.',
    rateLimitExceededTitle: 'What happens over the limit',
    rateLimitExceededDesc: 'You get an HTTP 402 with a JSON body — limit, used, reset_at, overage_rate_usd, and an upgrade_url. No retries needed: as soon as you top up credit or subscribe, the same key starts working again on the very next call.',
    rateLimitBestPractice: 'Check X-RateLimit-Remaining before firing off a batch of calls — reading a header costs nothing, a wasted 402 does not.',
    versioningTitle: 'Versioning & Changelog',
    versioningIntro: "The API is versioned in the URL (/api/v1/...). Within v1, existing fields are never removed, renamed, or repurposed — only added. Integrations should ignore fields they don't recognize rather than fail on them. A genuinely breaking change ships as /api/v2/..., with v1 kept running for a reasonable overlap period — never a silent in-place break.",
    changelogTitle: 'Changelog',
    changelogNote: 'No mailing list or webhooks yet for update announcements — this page and the X / Telegram links in the footer are the way to stay current.',
    changelogEntries: [
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
    payPerCallFeature3: 'Drops to $0.03/call once subscribed',
    tierSubscription: 'SUBSCRIPTION',
    subFeature1: '1000 calls included',
    subFeature2: '$0.03/call overage after that',
    subFeature3: 'Manual renewal — no auto-charge',
    pricingNote: 'Paid in $MRDT / SOL / USDC via Solana Pay — same payment flow as the rest of TNT House. Solana Pay can\'t auto-charge, so the subscription is a manual 30-day top-up, not a recurring subscription in the traditional sense.',
    manageBillingTitle: 'Manage billing',
    getKeyTitle: 'Get your API key',
    getKeySub: 'Instant, free, no card required.',
    backToTnt: 'Back to TNT House',
    billingTitle: 'Billing',
    billingSub: 'Subscribe for 1000 calls/30 days, or top up pay-per-call credits. Paid in $MRDT / SOL / USDC via Solana Pay — same flow as the rest of TNT House.',
    continueBtn: 'Continue',
    noKeyYet: 'Don\'t have a key yet? Get one free above first.',
    currentTierLabel: 'Current tier:',
    callsUsedLabel: 'calls used',
    renewsLabel: 'renews',
    creditBalanceLabel: 'Credit balance:',
    subscribeCardTitle: 'Subscribe — $49',
    subscribeCardSub: '1000 calls / 30 days',
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
    emailPlaceholder: 'Email address',
  },
  es: {
    flag: '🇪🇸',
    name: 'ES',
    headerBadge: 'API DE DATOS DE RIESGO',
    heroEyebrow: 'CREADO PARA AGENTES DE TRADING CON IA',
    heroTitle1: 'Descubre qué esconde un token',
    heroTitle2: 'antes de que tu bot lo compre.',
    heroSub: 'Una sola petición GET devuelve una puntuación de seguridad, detección de clústeres de insiders en tiempo real y datos fundamentales on-chain de cualquier mint de Solana — el mismo motor detrás de las auditorías de TNT House, expuesto como JSON limpio para bots en lugar de un panel para humanos.',
    btnGetKey: 'Obtener una API key gratis',
    btnReadDocs: 'Leer la documentación',
    copyCurl: 'Copiar curl',
    howItWorksTitle: 'Cómo funciona',
    step1Title: 'Obtén una key',
    step1Desc: 'Introduce tu email abajo. Sin tarjeta de crédito, sin esperar aprobación — la key se emite al instante.',
    step2Title: 'Llama al endpoint',
    step2Desc: 'GET /api/v1/token-risk?mint=<dirección> con tu key en la cabecera Authorization. Tiempo de respuesta típico: bastante menos de un segundo.',
    step3Title: 'Actúa según la puntuación',
    step3Desc: 'La primera comprobación de un mint devuelve cluster_analysis: "pending" mientras el rastreo de insiders corre en segundo plano — vuelve a comprobar en uno o dos minutos para ver el panorama completo.',
    responseFieldsTitle: 'Campos de la respuesta',
    fieldSafetyScore: '0–100. Ponderado según autoridades, concentración de holders, liquidez, volumen y penalizaciones reales por clústeres de insiders.',
    fieldInsiderClusters: 'Wallets que comparten un mismo financiador inicial — una señal de insider/sniper demostrable on-chain, no una suposición.',
    fieldClusterAnalysis: '"pending" en la primera comprobación de un token (el rastreo de clústeres corre en segundo plano), "complete" tras ~1–2 minutos.',
    fieldAuthorities: 'Si cada autoridad está revocada, y su dirección si sigue activa.',
    fieldHoneypotLpLocked: 'honeypot_risk (booleano) y lp_locked ({ locked, percent }) de RugCheck. null significa que no se pudo comprobar, no "seguro".',
    fieldHolderDistribution: '% del mayor holder, % del top-10, nivel de riesgo, y holder_count — el número de cuentas en la respuesta de los 20 mayores holders de Solana (un límite real de la RPC, no un recuento total de holders para tokens muy distribuidos como BONK o USDC).',
    fieldMarket: 'Precio en vivo, liquidez, volumen 24h, cambio 24h y antigüedad del token desde DexScreener.',
    rateLimitHeadersNote: 'Cada respuesta también incluye las cabeceras X-RateLimit-Limit, X-RateLimit-Remaining y X-RateLimit-Reset — además de X-Credit-Balance-Usd en cuanto tengas un nivel de pago o saldo de crédito — para que tu bot controle su cuota sin llegar nunca a un 429.',
    openApiUsageNote: 'Funciona directamente con las Actions de Custom GPT de ChatGPT (solo pega la URL). Para Claude, Gemini o frameworks de agentes como LangChain/CrewAI, usa esta spec como fuente del esquema para tu propia integración de herramienta — la mayoría necesita un pequeño adaptador; OpenAPISpec.from_url() de LangChain es el que la importa directamente.',
    chatBubbleLabel: 'Pregunta sobre la API',
    chatTitle: 'Asistente de Risk-Data API',
    chatWelcome: '¡Hola! Pregúntame lo que quieras sobre la Risk-Data API — endpoint, precios, campos de respuesta, cómo conseguir una key.',
    chatPlaceholder: 'Escribe tu pregunta...',
    chatLimitReached: 'Límite alcanzado — inténtalo de nuevo en unos minutos.',
    chatConnectionError: 'Error de conexión. ⚡ Consigue tu API key gratis más abajo.',
    copyOpenApiUrl: 'Copiar',
    webhooksRoadmapNote: 'En la primera verificación de un token, cluster_analysis devuelve "pending" mientras el rastreo se ejecuta en segundo plano — vuelve a comprobar el mismo mint tras 1-2 minutos, o suscríbete a un webhook de safety_score más abajo para recibir una notificación en lugar de hacer polling.',
    webhooksDocsTitle: 'Webhooks',
    webhooksDocsIntro: 'En lugar de hacer polling a token-risk según un horario, suscríbete una vez a un mint y un umbral de safety_score — recibe un callback HTTP firmado en el momento en que se cruza, en cualquier dirección.',
    webhooksSubscribeLabel: 'Suscribirse',
    webhooksResponseLabel: 'Suscripción creada',
    webhooksPayloadLabel: 'Entregado a tu callback_url',
    webhooksUnsubscribeNote: 'Se dispara una sola vez por cruce, no en cada verificación. Verifica cada entrega con la cabecera X-Webhook-Signature y el webhook_secret de la respuesta de suscripción (se muestra una sola vez). Llama a DELETE /api/v1/webhooks/{id} para darte de baja.',
    rateLimitingTitle: 'Límite de solicitudes',
    rateLimitingIntro: 'Cada key tiene 15 solicitudes gratuitas por día natural (UTC). Si superas ese límite sin saldo de crédito, recibes un 402, no un bloqueo silencioso — recarga saldo o suscríbete y la misma key vuelve a funcionar de inmediato.',
    rateLimitHeaderLimitLabel: 'X-RateLimit-Limit',
    rateLimitHeaderLimitDesc: 'Tu cuota diaria. Vacío en keys ilimitadas o emitidas por un admin.',
    rateLimitHeaderRemainingLabel: 'X-RateLimit-Remaining',
    rateLimitHeaderRemainingDesc: 'Solicitudes restantes antes de que se agote la cuota gratuita de hoy.',
    rateLimitHeaderResetLabel: 'X-RateLimit-Reset',
    rateLimitHeaderResetDesc: 'Marca de tiempo ISO del próximo reinicio de cuota (medianoche UTC, o la fecha de renovación de tu suscripción).',
    rateLimitHeaderCreditLabel: 'X-Credit-Balance-Usd',
    rateLimitHeaderCreditDesc: 'Tu saldo de crédito actual, en cuanto tengas uno.',
    rateLimitExceededTitle: 'Qué pasa al superar el límite',
    rateLimitExceededDesc: 'Recibes un HTTP 402 con un cuerpo JSON — limit, used, reset_at, overage_rate_usd y un upgrade_url. No hace falta reintentar: en cuanto recargues saldo o te suscribas, la misma key vuelve a funcionar en la siguiente llamada.',
    rateLimitBestPractice: 'Revisa X-RateLimit-Remaining antes de lanzar un lote de llamadas — leer una cabecera no cuesta nada, un 402 desperdiciado sí.',
    versioningTitle: 'Versionado y registro de cambios',
    versioningIntro: 'La API se versiona en la URL (/api/v1/...). Dentro de v1, los campos existentes nunca se eliminan, renombran ni cambian de propósito — solo se añaden. Las integraciones deberían ignorar los campos que no reconozcan en lugar de fallar por ellos. Un cambio realmente disruptivo se publica como /api/v2/..., manteniendo v1 en funcionamiento durante un periodo de solapamiento razonable — nunca una ruptura silenciosa en el mismo endpoint.',
    changelogTitle: 'Registro de cambios',
    changelogNote: 'Todavía no hay lista de correo ni webhooks para anunciar novedades — esta página y los enlaces de X / Telegram del pie son la forma de mantenerte al día.',
    changelogEntries: [
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
    payPerCallFeature3: 'Baja a $0.03/llamada con suscripción activa',
    tierSubscription: 'SUSCRIPCIÓN',
    subFeature1: '1000 llamadas incluidas',
    subFeature2: '$0.03/llamada de exceso después',
    subFeature3: 'Renovación manual — sin cobro automático',
    pricingNote: 'Se paga en $MRDT / SOL / USDC vía Solana Pay — el mismo flujo de pago que el resto de TNT House. Solana Pay no puede cobrar automáticamente, así que la suscripción es una recarga manual de 30 días, no una suscripción recurrente en el sentido tradicional.',
    manageBillingTitle: 'Gestionar facturación',
    getKeyTitle: 'Obtén tu API key',
    getKeySub: 'Al instante, gratis, sin necesidad de tarjeta.',
    backToTnt: 'Volver a TNT House',
    billingTitle: 'Facturación',
    billingSub: 'Suscríbete para 1000 llamadas/30 días, o recarga créditos de pago por llamada. Se paga en $MRDT / SOL / USDC vía Solana Pay — mismo flujo que el resto de TNT House.',
    continueBtn: 'Continuar',
    noKeyYet: '¿Aún no tienes una key? Consigue una gratis más arriba primero.',
    currentTierLabel: 'Nivel actual:',
    callsUsedLabel: 'llamadas usadas',
    renewsLabel: 'renueva',
    creditBalanceLabel: 'Saldo de crédito:',
    subscribeCardTitle: 'Suscribirse — $49',
    subscribeCardSub: '1000 llamadas / 30 días',
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
  },
  fr: {
    flag: '🇫🇷',
    name: 'FR',
    headerBadge: 'API DE DONNÉES DE RISQUE',
    heroEyebrow: 'CONÇU POUR LES AGENTS DE TRADING IA',
    heroTitle1: 'Découvrez ce qu\'un token cache',
    heroTitle2: 'avant que votre bot ne l\'achète.',
    heroSub: 'Une seule requête GET renvoie un score de sécurité, une détection en temps réel des clusters d\'insiders et les fondamentaux on-chain de n\'importe quel mint Solana — le même moteur que les audits TNT House, exposé en JSON propre pour les bots plutôt qu\'un tableau de bord pour humains.',
    btnGetKey: 'Obtenir une clé API gratuite',
    btnReadDocs: 'Lire la documentation',
    copyCurl: 'Copier curl',
    howItWorksTitle: 'Comment ça marche',
    step1Title: 'Obtenez une clé',
    step1Desc: 'Entrez votre email ci-dessous. Pas de carte bancaire, pas d\'attente d\'approbation — la clé est émise instantanément.',
    step2Title: 'Appelez l\'endpoint',
    step2Desc: 'GET /api/v1/token-risk?mint=<adresse> avec votre clé dans l\'en-tête Authorization. Temps de réponse typique : bien moins d\'une seconde.',
    step3Title: 'Agissez selon le score',
    step3Desc: 'La toute première vérification d\'un mint renvoie cluster_analysis: "pending" pendant que la recherche d\'insiders tourne en arrière-plan — revérifiez dans une minute ou deux pour la vue complète.',
    responseFieldsTitle: 'Champs de la réponse',
    fieldSafetyScore: '0–100. Pondéré selon les autorités, la concentration des holders, la liquidité, le volume et de vraies pénalités liées aux clusters d\'insiders.',
    fieldInsiderClusters: 'Wallets partageant un même premier financeur — un signal insider/sniper prouvable on-chain, pas une supposition.',
    fieldClusterAnalysis: '"pending" lors de la toute première vérification d\'un token (le traçage des clusters tourne en arrière-plan), "complete" après ~1–2 minutes.',
    fieldAuthorities: 'Si chaque autorité est révoquée, et son adresse si elle est encore active.',
    fieldHoneypotLpLocked: "honeypot_risk (booléen) et lp_locked ({ locked, percent }) issus de RugCheck. null signifie que la vérification a échoué, jamais « sûr ».",
    fieldHolderDistribution: '% du plus gros holder, % du top-10, niveau de risque, et holder_count — le nombre de comptes dans la réponse des 20 plus gros holders de Solana (une vraie limite de la RPC, pas un décompte complet des holders pour des tokens très détenus comme BONK ou USDC).',
    fieldMarket: 'Prix en direct, liquidité, volume 24h, variation 24h et âge du token, via DexScreener.',
    rateLimitHeadersNote: 'Chaque réponse inclut aussi les en-têtes X-RateLimit-Limit, X-RateLimit-Remaining et X-RateLimit-Reset — plus X-Credit-Balance-Usd dès que vous avez un abonnement payant ou un solde de crédit — pour que votre bot suive son quota sans jamais tomber sur un 429.',
    openApiUsageNote: 'Fonctionne directement avec les Actions des Custom GPT de ChatGPT (il suffit de coller l\'URL). Pour Claude, Gemini ou des frameworks d\'agents comme LangChain/CrewAI, utilisez cette spec comme source de schéma pour votre propre intégration d\'outil — la plupart ont besoin d\'un petit adaptateur, OpenAPISpec.from_url() de LangChain étant celui qui l\'importe directement.',
    chatBubbleLabel: 'Question sur l\'API',
    chatTitle: 'Assistant Risk-Data API',
    chatWelcome: 'Salut ! Pose-moi tes questions sur la Risk-Data API — endpoint, tarifs, champs de réponse, comment obtenir une clé.',
    chatPlaceholder: 'Pose ta question...',
    chatLimitReached: 'Limite atteinte — réessaie dans quelques minutes.',
    chatConnectionError: 'Erreur de connexion. ⚡ Obtenez votre clé API gratuite ci-dessous.',
    copyOpenApiUrl: 'Copier',
    webhooksRoadmapNote: 'Lors de la toute première vérification d\'un token, cluster_analysis renvoie "pending" pendant que l\'analyse s\'exécute en arrière-plan — revérifiez le même mint après 1-2 minutes, ou abonnez-vous à un webhook de safety_score ci-dessous pour recevoir une notification au lieu de faire du polling.',
    webhooksDocsTitle: 'Webhooks',
    webhooksDocsIntro: 'Plutôt que de faire du polling sur token-risk selon un planning, abonnez-vous une seule fois à un mint et un seuil de safety_score — recevez un callback HTTP signé dès qu\'il est franchi, dans un sens comme dans l\'autre.',
    webhooksSubscribeLabel: 'S\'abonner',
    webhooksResponseLabel: 'Abonnement créé',
    webhooksPayloadLabel: 'Livré à votre callback_url',
    webhooksUnsubscribeNote: 'Se déclenche une seule fois par franchissement, pas à chaque vérification. Vérifiez chaque livraison avec l\'en-tête X-Webhook-Signature et le webhook_secret renvoyé lors de l\'abonnement (affiché une seule fois). Appelez DELETE /api/v1/webhooks/{id} pour vous désabonner.',
    rateLimitingTitle: 'Limitation de débit',
    rateLimitingIntro: 'Chaque clé dispose de 15 requêtes gratuites par jour calendaire (UTC). Au-delà, sans solde de crédit, vous recevez un 402, pas un blocage silencieux — rechargez ou abonnez-vous et la même clé refonctionne immédiatement.',
    rateLimitHeaderLimitLabel: 'X-RateLimit-Limit',
    rateLimitHeaderLimitDesc: 'Votre quota quotidien. Vide pour les clés illimitées/émises par un admin.',
    rateLimitHeaderRemainingLabel: 'X-RateLimit-Remaining',
    rateLimitHeaderRemainingDesc: 'Requêtes restantes avant épuisement du quota gratuit du jour.',
    rateLimitHeaderResetLabel: 'X-RateLimit-Reset',
    rateLimitHeaderResetDesc: 'Horodatage ISO de la prochaine réinitialisation du quota (minuit UTC, ou la date de renouvellement de votre abonnement).',
    rateLimitHeaderCreditLabel: 'X-Credit-Balance-Usd',
    rateLimitHeaderCreditDesc: 'Votre solde de crédit actuel, dès que vous en avez un.',
    rateLimitExceededTitle: 'Que se passe-t-il au-delà de la limite',
    rateLimitExceededDesc: "Vous recevez un HTTP 402 avec un corps JSON — limit, used, reset_at, overage_rate_usd et un upgrade_url. Pas besoin de réessayer : dès que vous rechargez du crédit ou vous abonnez, la même clé refonctionne dès le prochain appel.",
    rateLimitBestPractice: "Vérifiez X-RateLimit-Remaining avant de lancer un lot d'appels — lire un en-tête ne coûte rien, un 402 gâché si.",
    versioningTitle: 'Versions et journal des modifications',
    versioningIntro: "L'API est versionnée dans l'URL (/api/v1/...). Au sein de v1, les champs existants ne sont jamais supprimés, renommés ni détournés de leur usage — seulement ajoutés. Les intégrations doivent ignorer les champs qu'elles ne reconnaissent pas plutôt que d'échouer à cause d'eux. Un changement véritablement cassant est publié sous /api/v2/..., avec v1 maintenue en fonctionnement pendant une période de recouvrement raisonnable — jamais une rupture silencieuse sur place.",
    changelogTitle: 'Journal des modifications',
    changelogNote: 'Pas encore de liste de diffusion ni de webhooks pour les annonces — cette page et les liens X / Telegram en pied de page sont le moyen de rester à jour.',
    changelogEntries: [
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
    payPerCallFeature3: 'Descend à $0.03/appel avec un abonnement actif',
    tierSubscription: 'ABONNEMENT',
    subFeature1: '1000 appels inclus',
    subFeature2: '$0.03/appel de dépassement ensuite',
    subFeature3: 'Renouvellement manuel — pas de prélèvement automatique',
    pricingNote: 'Payable en $MRDT / SOL / USDC via Solana Pay — le même flux de paiement que le reste de TNT House. Solana Pay ne peut pas prélever automatiquement, donc l\'abonnement est une recharge manuelle de 30 jours, pas un abonnement récurrent au sens traditionnel.',
    manageBillingTitle: 'Gérer la facturation',
    getKeyTitle: 'Obtenez votre clé API',
    getKeySub: 'Instantané, gratuit, sans carte requise.',
    backToTnt: 'Retour à TNT House',
    billingTitle: 'Facturation',
    billingSub: 'Abonnez-vous pour 1000 appels/30 jours, ou rechargez des crédits à l\'appel. Payable en $MRDT / SOL / USDC via Solana Pay — même flux que le reste de TNT House.',
    continueBtn: 'Continuer',
    noKeyYet: 'Pas encore de clé ? Obtenez-en une gratuite plus haut d\'abord.',
    currentTierLabel: 'Niveau actuel :',
    callsUsedLabel: 'appels utilisés',
    renewsLabel: 'se renouvelle',
    creditBalanceLabel: 'Solde de crédit :',
    subscribeCardTitle: 'S\'abonner — $49',
    subscribeCardSub: '1000 appels / 30 jours',
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
  },
  el: {
    flag: '🇬🇷',
    name: 'EL',
    headerBadge: 'API ΔΕΔΟΜΕΝΩΝ ΚΙΝΔΥΝΟΥ',
    heroEyebrow: 'ΦΤΙΑΓΜΕΝΟ ΓΙΑ AI TRADING AGENTS',
    heroTitle1: 'Μάθε τι κρύβει ένα token',
    heroTitle2: 'πριν το αγοράσει το bot σου.',
    heroSub: 'Ένα μόνο αίτημα GET επιστρέφει βαθμολογία ασφάλειας, ανίχνευση insider-cluster σε πραγματικό χρόνο και on-chain θεμελιώδη στοιχεία για κάθε Solana mint — η ίδια μηχανή πίσω από τα audits του TNT House, εκτεθειμένη ως καθαρό JSON για bots αντί για dashboard για ανθρώπους.',
    btnGetKey: 'Πάρε δωρεάν API key',
    btnReadDocs: 'Διάβασε την τεκμηρίωση',
    copyCurl: 'Αντιγραφή curl',
    howItWorksTitle: 'Πώς λειτουργεί',
    step1Title: 'Πάρε ένα key',
    step1Desc: 'Βάλε το email σου παρακάτω. Χωρίς πιστωτική κάρτα, χωρίς αναμονή έγκρισης — το key εκδίδεται άμεσα.',
    step2Title: 'Κάλεσε το endpoint',
    step2Desc: 'GET /api/v1/token-risk?mint=<διεύθυνση> με το key σου στο header Authorization. Τυπικός χρόνος απόκρισης: αρκετά κάτω από ένα δευτερόλεπτο.',
    step3Title: 'Δράσε βάσει της βαθμολογίας',
    step3Desc: 'Ο πρώτος έλεγχος ενός mint επιστρέφει cluster_analysis: "pending" ενώ το insider trace τρέχει στο παρασκήνιο — ξαναέλεγξε σε ένα-δύο λεπτά για την πλήρη εικόνα.',
    responseFieldsTitle: 'Πεδία απόκρισης',
    fieldSafetyScore: '0–100. Σταθμισμένο από authorities, συγκέντρωση holders, ρευστότητα, όγκο και πραγματικές ποινές insider-cluster.',
    fieldInsiderClusters: 'Wallets που μοιράζονται τον ίδιο πρώτο χρηματοδότη — ένα on-chain αποδείξιμο σήμα insider/sniper, όχι εικασία.',
    fieldClusterAnalysis: '"pending" στον πρώτο έλεγχο ενός token (η ανίχνευση clusters τρέχει στο παρασκήνιο), "complete" μετά από ~1–2 λεπτά.',
    fieldAuthorities: 'Αν κάθε authority έχει ανακληθεί, και η διεύθυνσή της αν είναι ακόμα ενεργή.',
    fieldHoneypotLpLocked: 'honeypot_risk (boolean) και lp_locked ({ locked, percent }) από το RugCheck. Το null σημαίνει ότι δεν ήταν δυνατός ο έλεγχος, όχι «ασφαλές».',
    fieldHolderDistribution: '% μεγαλύτερου holder, top-10 %, επίπεδο κινδύνου, και holder_count — ο αριθμός λογαριασμών στην απόκριση των 20 μεγαλύτερων holders της Solana (πραγματικό όριο του RPC, όχι πλήρης αριθμός holders για ευρέως κατεχόμενα tokens όπως το BONK ή το USDC).',
    fieldMarket: 'Τιμή σε πραγματικό χρόνο, ρευστότητα, όγκος 24ω, μεταβολή 24ω και ηλικία του token, από το DexScreener.',
    rateLimitHeadersNote: 'Κάθε απόκριση περιλαμβάνει επίσης τα headers X-RateLimit-Limit, X-RateLimit-Remaining και X-RateLimit-Reset — συν το X-Credit-Balance-Usd μόλις έχεις πληρωμένο επίπεδο ή υπόλοιπο πίστωσης — ώστε το bot σου να παρακολουθεί το όριό του χωρίς ποτέ να πέσει σε 429.',
    openApiUsageNote: 'Λειτουργεί απευθείας με τα Custom GPT Actions του ChatGPT (απλώς επικόλλησε το URL). Για Claude, Gemini ή agent frameworks όπως LangChain/CrewAI, χρησιμοποίησε αυτό το spec ως πηγή σχήματος για τη δική σου ενσωμάτωση εργαλείου — τα περισσότερα χρειάζονται έναν μικρό προσαρμογέα, με το OpenAPISpec.from_url() του LangChain να το εισάγει απευθείας.',
    chatBubbleLabel: 'Ρώτα για το API',
    chatTitle: 'Βοηθός Risk-Data API',
    chatWelcome: 'Γεια! Ρώτα με ό,τι θες για το Risk-Data API — endpoint, τιμές, πεδία απόκρισης, πώς να πάρεις key.',
    chatPlaceholder: 'Γράψε την ερώτησή σου...',
    chatLimitReached: 'Το όριο ξεπεράστηκε — δοκίμασε ξανά σε λίγα λεπτά.',
    chatConnectionError: 'Σφάλμα σύνδεσης. ⚡ Πάρε το δωρεάν API key σου παρακάτω.',
    copyOpenApiUrl: 'Αντιγραφή',
    webhooksRoadmapNote: 'Στον πρώτο έλεγχο ενός token, το cluster_analysis επιστρέφει "pending" όσο η ανάλυση εκτελείται στο παρασκήνιο — ξαναέλεγξε το ίδιο mint μετά από 1-2 λεπτά, ή κάνε εγγραφή σε ένα webhook του safety_score παρακάτω για να λαμβάνεις ειδοποίηση αντί να κάνεις polling.',
    webhooksDocsTitle: 'Webhooks',
    webhooksDocsIntro: 'Αντί να κάνεις polling στο token-risk σε πρόγραμμα, κάνε εγγραφή μία φορά σε ένα mint και ένα όριο safety_score — λάβε ένα υπογεγραμμένο HTTP callback τη στιγμή που το διασχίζει, προς οποιαδήποτε κατεύθυνση.',
    webhooksSubscribeLabel: 'Εγγραφή',
    webhooksResponseLabel: 'Η συνδρομή δημιουργήθηκε',
    webhooksPayloadLabel: 'Παραδίδεται στο callback_url σου',
    webhooksUnsubscribeNote: 'Ενεργοποιείται μία φορά ανά διάσχιση, όχι σε κάθε έλεγχο. Επιβεβαίωσε κάθε παράδοση με το header X-Webhook-Signature και το webhook_secret από την απόκριση εγγραφής (εμφανίζεται μία μόνο φορά). Κάλεσε DELETE /api/v1/webhooks/{id} για διαγραφή συνδρομής.',
    rateLimitingTitle: 'Όριο αιτημάτων',
    rateLimitingIntro: 'Κάθε key έχει 15 δωρεάν αιτήματα ανά ημερολογιακή ημέρα (UTC). Αν το ξεπεράσεις χωρίς υπόλοιπο πίστωσης, παίρνεις 402, όχι σιωπηλό μπλοκάρισμα — φόρτωσε υπόλοιπο ή κάνε συνδρομή και το ίδιο key ξαναδουλεύει αμέσως.',
    rateLimitHeaderLimitLabel: 'X-RateLimit-Limit',
    rateLimitHeaderLimitDesc: 'Η ημερήσια ποσόστωσή σου. Κενό σε απεριόριστα ή διαχειριστικά keys.',
    rateLimitHeaderRemainingLabel: 'X-RateLimit-Remaining',
    rateLimitHeaderRemainingDesc: 'Αιτήματα που απομένουν πριν εξαντληθεί η σημερινή δωρεάν ποσόστωση.',
    rateLimitHeaderResetLabel: 'X-RateLimit-Reset',
    rateLimitHeaderResetDesc: 'Χρονοσφραγίδα ISO της επόμενης επαναφοράς ποσόστωσης (επόμενα μεσάνυχτα UTC, ή η ημερομηνία ανανέωσης της συνδρομής σου).',
    rateLimitHeaderCreditLabel: 'X-Credit-Balance-Usd',
    rateLimitHeaderCreditDesc: 'Το τρέχον υπόλοιπο πίστωσής σου, μόλις αποκτήσεις ένα.',
    rateLimitExceededTitle: 'Τι συμβαίνει πέρα από το όριο',
    rateLimitExceededDesc: 'Λαμβάνεις HTTP 402 με JSON σώμα — limit, used, reset_at, overage_rate_usd και ένα upgrade_url. Δεν χρειάζονται επαναλήψεις: μόλις φορτώσεις πίστωση ή κάνεις συνδρομή, το ίδιο key ξαναδουλεύει από την επόμενη κλήση.',
    rateLimitBestPractice: 'Έλεγξε το X-RateLimit-Remaining πριν στείλεις μια δέσμη κλήσεων — η ανάγνωση ενός header δεν κοστίζει τίποτα, ένα χαμένο 402 όμως ναι.',
    versioningTitle: 'Εκδόσεις & Ιστορικό αλλαγών',
    versioningIntro: 'Το API έχει έκδοση στο URL (/api/v1/...). Μέσα στο v1, τα υπάρχοντα πεδία δεν αφαιρούνται, δεν μετονομάζονται ούτε αλλάζουν σκοπό ποτέ — μόνο προστίθενται. Οι ενσωματώσεις θα πρέπει να αγνοούν πεδία που δεν αναγνωρίζουν αντί να αποτυγχάνουν εξαιτίας τους. Μια πραγματικά ασύμβατη αλλαγή δημοσιεύεται ως /api/v2/..., με το v1 να συνεχίζει να λειτουργεί για ένα λογικό διάστημα επικάλυψης — ποτέ μια σιωπηλή αλλαγή επί τόπου.',
    changelogTitle: 'Ιστορικό αλλαγών',
    changelogNote: 'Δεν υπάρχει ακόμα mailing list ή webhooks για ανακοινώσεις ενημερώσεων — αυτή η σελίδα και οι σύνδεσμοι X / Telegram στο footer είναι ο τρόπος να μένεις ενήμερος.',
    changelogEntries: [
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
    payPerCallFeature3: 'Πέφτει στα $0.03/κλήση μόλις γίνεις συνδρομητής',
    tierSubscription: 'ΣΥΝΔΡΟΜΗ',
    subFeature1: '1000 κλήσεις περιλαμβάνονται',
    subFeature2: '$0.03/κλήση υπέρβασης μετά',
    subFeature3: 'Χειροκίνητη ανανέωση — καμία αυτόματη χρέωση',
    pricingNote: 'Πληρωμή σε $MRDT / SOL / USDC μέσω Solana Pay — ίδια ροή πληρωμής με το υπόλοιπο TNT House. Το Solana Pay δεν μπορεί να χρεώσει αυτόματα, οπότε η συνδρομή είναι μια χειροκίνητη ανανέωση 30 ημερών, όχι επαναλαμβανόμενη συνδρομή με την παραδοσιακή έννοια.',
    manageBillingTitle: 'Διαχείριση χρέωσης',
    getKeyTitle: 'Πάρε το API key σου',
    getKeySub: 'Άμεσα, δωρεάν, χωρίς κάρτα.',
    backToTnt: 'Πίσω στο TNT House',
    billingTitle: 'Χρέωση',
    billingSub: 'Κάνε συνδρομή για 1000 κλήσεις/30 ημέρες, ή φόρτισε πίστωση ανά κλήση. Πληρωμή σε $MRDT / SOL / USDC μέσω Solana Pay — ίδια ροή με το υπόλοιπο TNT House.',
    continueBtn: 'Συνέχεια',
    noKeyYet: 'Δεν έχεις ακόμα key; Πάρε ένα δωρεάν παραπάνω πρώτα.',
    currentTierLabel: 'Τρέχον επίπεδο:',
    callsUsedLabel: 'κλήσεις χρησιμοποιήθηκαν',
    renewsLabel: 'ανανεώνεται',
    creditBalanceLabel: 'Υπόλοιπο πίστωσης:',
    subscribeCardTitle: 'Συνδρομή — $49',
    subscribeCardSub: '1000 κλήσεις / 30 ημέρες',
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
  },
  ru: {
    flag: '🇷🇺',
    name: 'RU',
    headerBadge: 'RISK-DATA API',
    heroEyebrow: 'СОЗДАНО ДЛЯ AI-ТРЕЙДИНГ-АГЕНТОВ',
    heroTitle1: 'Узнай, что скрывает токен,',
    heroTitle2: 'прежде чем его купит твой бот.',
    heroSub: 'Один GET-запрос возвращает Safety Score, детект инсайдерских кластеров в реальном времени и он-чейн показатели для любого Solana-минта — тот же движок, что стоит за аудитами TNT House, только в виде чистого JSON для ботов, а не дашборда для людей.',
    btnGetKey: 'Получить бесплатный API-ключ',
    btnReadDocs: 'Читать документацию',
    copyCurl: 'Скопировать curl',
    howItWorksTitle: 'Как это работает',
    step1Title: 'Получи ключ',
    step1Desc: 'Введи email ниже. Без карты, без ожидания одобрения — ключ выдаётся мгновенно.',
    step2Title: 'Дёрни эндпоинт',
    step2Desc: 'GET /api/v1/token-risk?mint=<адрес> с ключом в заголовке Authorization. Типичное время ответа — заметно меньше секунды.',
    step3Title: 'Действуй по скору',
    step3Desc: 'Первая проверка минта возвращает cluster_analysis: "pending", пока трассировка инсайдеров считается в фоне — перепроверь через минуту-две за полной картиной.',
    responseFieldsTitle: 'Поля ответа',
    fieldSafetyScore: '0–100. Взвешено по authorities, концентрации холдеров, ликвидности, объёму и реальным штрафам за инсайдерские кластеры.',
    fieldInsiderClusters: 'Кошельки с общим первым фандером — доказуемый он-чейн сигнал инсайдера/снайпера, а не догадка.',
    fieldClusterAnalysis: '"pending" при первой проверке токена (трассировка кластеров считается в фоне), "complete" через ~1–2 минуты.',
    fieldAuthorities: 'Отозвана ли каждая authority, и её адрес, если ещё активна.',
    fieldHoneypotLpLocked: 'honeypot_risk (булево) и lp_locked ({ locked, percent }) от RugCheck. null означает "не удалось проверить", а не "безопасно".',
    fieldHolderDistribution: '% крупнейшего холдера, % топ-10, уровень риска и holder_count — число аккаунтов в ответе топ-20 крупнейших холдеров Solana (реальное ограничение самого RPC, а не полное число холдеров для широко распределённых токенов вроде BONK или USDC).',
    fieldMarket: 'Живая цена, ликвидность, объём за 24ч, изменение за 24ч и возраст токена — с DexScreener.',
    rateLimitHeadersNote: 'Каждый ответ также включает заголовки X-RateLimit-Limit, X-RateLimit-Remaining и X-RateLimit-Reset — плюс X-Credit-Balance-Usd, если у тебя платный тариф или баланс кредитов — чтобы бот мог отслеживать свою квоту, не ловя 429.',
    openApiUsageNote: 'Работает из коробки с ChatGPT Custom GPT Actions (просто вставь ссылку). Для Claude, Gemini или агентских фреймворков вроде LangChain/CrewAI используй эту спеку как источник схемы для своей интеграции — большинству нужен небольшой адаптер, LangChain\'s OpenAPISpec.from_url() импортирует её напрямую.',
    chatBubbleLabel: 'Спросить про API',
    chatTitle: 'Ассистент Risk-Data API',
    chatWelcome: 'Привет! Спроси меня что угодно про Risk-Data API — эндпоинт, тарифы, поля ответа, как получить ключ.',
    chatPlaceholder: 'Напиши вопрос...',
    chatLimitReached: 'Достигнут лимит — попробуй через несколько минут.',
    chatConnectionError: 'Ошибка соединения. ⚡ Получи бесплатный API-ключ ниже.',
    copyOpenApiUrl: 'Копировать',
    webhooksRoadmapNote: 'При первой проверке токена cluster_analysis возвращает "pending", пока анализ выполняется в фоне — перепроверь тот же mint через 1-2 минуты, либо подпишись на webhook по safety_score ниже, чтобы получать уведомление вместо постоянного опроса.',
    webhooksDocsTitle: 'Webhooks',
    webhooksDocsIntro: 'Вместо постоянного опроса token-risk по расписанию — подпишись один раз на mint и порог safety_score и получай подписанный HTTP callback в момент пересечения, в любую сторону.',
    webhooksSubscribeLabel: 'Подписаться',
    webhooksResponseLabel: 'Подписка создана',
    webhooksPayloadLabel: 'Доставляется на твой callback_url',
    webhooksUnsubscribeNote: 'Срабатывает один раз за пересечение, а не при каждой проверке. Проверяй каждую доставку через заголовок X-Webhook-Signature и webhook_secret из ответа на подписку (показывается только один раз). Вызови DELETE /api/v1/webhooks/{id}, чтобы отписаться.',
    rateLimitingTitle: 'Лимиты запросов',
    rateLimitingIntro: 'У каждого ключа 15 бесплатных запросов в календарные сутки (UTC). Превысил лимит без баланса кредитов — получишь 402, а не тихую блокировку: пополни баланс или оформи подписку — и тот же ключ сразу снова работает.',
    rateLimitHeaderLimitLabel: 'X-RateLimit-Limit',
    rateLimitHeaderLimitDesc: 'Твоя дневная квота. Пусто у безлимитных/выданных админом ключей.',
    rateLimitHeaderRemainingLabel: 'X-RateLimit-Remaining',
    rateLimitHeaderRemainingDesc: 'Сколько запросов осталось до конца бесплатной квоты на сегодня.',
    rateLimitHeaderResetLabel: 'X-RateLimit-Reset',
    rateLimitHeaderResetDesc: 'ISO-таймстамп следующего сброса квоты (следующая полночь по UTC или дата продления подписки).',
    rateLimitHeaderCreditLabel: 'X-Credit-Balance-Usd',
    rateLimitHeaderCreditDesc: 'Текущий баланс кредитов на звонки, как только он появится.',
    rateLimitExceededTitle: 'Что происходит при превышении лимита',
    rateLimitExceededDesc: 'Приходит HTTP 402 с JSON-телом — limit, used, reset_at, overage_rate_usd и upgrade_url. Повторные попытки не нужны: как только пополнишь баланс или оформишь подписку, тот же ключ снова заработает уже на следующем вызове.',
    rateLimitBestPractice: 'Проверяй X-RateLimit-Remaining перед отправкой пачки запросов — прочитать заголовок бесплатно, а вот впустую словленный 402 — нет.',
    versioningTitle: 'Версионирование и история изменений',
    versioningIntro: 'API версионируется через URL (/api/v1/...). Внутри v1 существующие поля никогда не удаляются, не переименовываются и не меняют смысл — только добавляются. Интеграциям стоит игнорировать незнакомые поля, а не падать из-за них. По-настоящему ломающее изменение выйдет как /api/v2/..., а v1 продолжит работать разумный переходный период — никогда никаких тихих изменений на месте.',
    changelogTitle: 'История изменений',
    changelogNote: 'Пока нет рассылки или вебхуков для анонсов обновлений — следить за актуальным состоянием можно по этой странице и ссылкам на X / Telegram в подвале.',
    changelogEntries: [
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
    tierFree: 'FREE',
    tierFreeAmount: '15 запр./день',
    freeFeature1: 'Полная схема ответа',
    freeFeature2: 'Детект инсайдерских кластеров',
    freeFeature3: 'Без карты',
    tierPayPerCall: 'PAY-PER-CALL',
    payPerCallFeature1: 'Пополнение на любую сумму $5–$500',
    payPerCallFeature2: 'Списывается только сверх бесплатных 15/день',
    payPerCallFeature3: 'Падает до $0.03/запрос при активной подписке',
    tierSubscription: 'ПОДПИСКА',
    subFeature1: '1000 запросов включено',
    subFeature2: '$0.03/запрос сверх лимита далее',
    subFeature3: 'Ручное продление — без автосписания',
    pricingNote: 'Оплата в $MRDT / SOL / USDC через Solana Pay — тот же флоу, что и на остальном TNT House. Solana Pay не умеет автосписание, поэтому подписка — это ручное пополнение на 30 дней, а не рекуррентная подписка в привычном смысле.',
    manageBillingTitle: 'Управление биллингом',
    getKeyTitle: 'Получи свой API-ключ',
    getKeySub: 'Мгновенно, бесплатно, без карты.',
    backToTnt: 'Назад в TNT House',
    billingTitle: 'Биллинг',
    billingSub: 'Оформи подписку на 1000 запросов/30 дней или пополни баланс pay-per-call. Оплата в $MRDT / SOL / USDC через Solana Pay — тот же флоу, что и на остальном TNT House.',
    continueBtn: 'Продолжить',
    noKeyYet: 'Ещё нет ключа? Сначала получи бесплатный выше.',
    currentTierLabel: 'Текущий тариф:',
    callsUsedLabel: 'запросов использовано',
    renewsLabel: 'обновление',
    creditBalanceLabel: 'Баланс кредитов:',
    subscribeCardTitle: 'Подписка — $49',
    subscribeCardSub: '1000 запросов / 30 дней',
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
    emailPlaceholder: 'Email адрес',
  },
  it: {
    flag: '🇮🇹',
    name: 'IT',
    headerBadge: 'API DATI DI RISCHIO',
    heroEyebrow: 'PROGETTATO PER AGENTI DI TRADING AI',
    heroTitle1: 'Scopri cosa nasconde un token',
    heroTitle2: 'prima che il tuo bot lo compri.',
    heroSub: 'Una singola richiesta GET restituisce un punteggio di sicurezza, il rilevamento in tempo reale dei cluster di insider e i fondamentali on-chain per qualsiasi mint Solana — lo stesso motore degli audit di TNT House, esposto come JSON pulito per i bot invece di una dashboard per gli umani.',
    btnGetKey: 'Ottieni una API key gratuita',
    btnReadDocs: 'Leggi la documentazione',
    copyCurl: 'Copia curl',
    howItWorksTitle: 'Come funziona',
    step1Title: 'Ottieni una key',
    step1Desc: 'Inserisci la tua email qui sotto. Nessuna carta di credito, nessuna attesa di approvazione — la key viene rilasciata immediatamente.',
    step2Title: 'Chiama l\'endpoint',
    step2Desc: 'GET /api/v1/token-risk?mint=<indirizzo> con la tua key nell\'header Authorization. Tempo di risposta tipico: ben sotto il secondo.',
    step3Title: 'Agisci in base al punteggio',
    step3Desc: 'Il primo controllo di un mint restituisce cluster_analysis: "pending" mentre l\'analisi insider gira in background — ricontrolla tra un minuto o due per il quadro completo.',
    responseFieldsTitle: 'Campi della risposta',
    fieldSafetyScore: '0–100. Ponderato su authorities, concentrazione degli holder, liquidità, volume e reali penalità da cluster di insider.',
    fieldInsiderClusters: 'Wallet che condividono lo stesso primo finanziatore — un segnale insider/sniper dimostrabile on-chain, non un\'ipotesi.',
    fieldClusterAnalysis: '"pending" al primo controllo di un token (il tracciamento dei cluster gira in background), "complete" dopo ~1–2 minuti.',
    fieldAuthorities: 'Se ciascuna authority è revocata, e il suo indirizzo se ancora attiva.',
    fieldHoneypotLpLocked: 'honeypot_risk (booleano) e lp_locked ({ locked, percent }) da RugCheck. null significa che non è stato possibile verificarlo, non "sicuro".',
    fieldHolderDistribution: '% del maggior holder, % del top-10, livello di rischio, e holder_count — il numero di account nella risposta dei 20 maggiori holder di Solana (un vero limite dell\'RPC, non un conteggio completo degli holder per token molto distribuiti come BONK o USDC).',
    fieldMarket: 'Prezzo live, liquidità, volume 24h, variazione 24h ed età del token, da DexScreener.',
    rateLimitHeadersNote: 'Ogni risposta include anche gli header X-RateLimit-Limit, X-RateLimit-Remaining e X-RateLimit-Reset — più X-Credit-Balance-Usd non appena hai un livello a pagamento o un saldo di credito — così il tuo bot può monitorare la sua quota senza mai incontrare un 429.',
    openApiUsageNote: 'Funziona subito con le Custom GPT Actions di ChatGPT (basta incollare l\'URL). Per Claude, Gemini o framework di agenti come LangChain/CrewAI, usa questa spec come fonte dello schema per la tua integrazione — la maggior parte richiede un piccolo adattatore, con OpenAPISpec.from_url() di LangChain che la importa direttamente.',
    chatBubbleLabel: 'Chiedi info sull\'API',
    chatTitle: 'Assistente Risk-Data API',
    chatWelcome: 'Ciao! Chiedimi qualsiasi cosa sulla Risk-Data API — endpoint, prezzi, campi di risposta, come ottenere una key.',
    chatPlaceholder: 'Scrivi la tua domanda...',
    chatLimitReached: 'Limite raggiunto — riprova tra qualche minuto.',
    chatConnectionError: 'Errore di connessione. ⚡ Ottieni la tua API key gratuita qui sotto.',
    copyOpenApiUrl: 'Copia',
    webhooksRoadmapNote: 'Al primo controllo di un token, cluster_analysis restituisce "pending" mentre l\'analisi viene eseguita in background — ricontrolla lo stesso mint dopo 1-2 minuti, oppure iscriviti a un webhook su safety_score qui sotto per ricevere una notifica invece di fare polling.',
    webhooksDocsTitle: 'Webhooks',
    webhooksDocsIntro: 'Invece di fare polling su token-risk secondo una pianificazione, iscriviti una sola volta a un mint e una soglia di safety_score — ricevi una callback HTTP firmata nel momento in cui viene superata, in entrambe le direzioni.',
    webhooksSubscribeLabel: 'Iscriviti',
    webhooksResponseLabel: 'Iscrizione creata',
    webhooksPayloadLabel: 'Consegnato al tuo callback_url',
    webhooksUnsubscribeNote: 'Si attiva una sola volta per attraversamento, non a ogni controllo. Verifica ogni consegna con l\'header X-Webhook-Signature e il webhook_secret restituito alla sottoscrizione (mostrato una sola volta). Chiama DELETE /api/v1/webhooks/{id} per annullare l\'iscrizione.',
    rateLimitingTitle: 'Limiti di richieste',
    rateLimitingIntro: 'Ogni key ha 15 richieste gratuite al giorno solare (UTC). Se lo superi senza saldo di credito, ricevi un 402, non un blocco silenzioso — ricarica il saldo o abbonati e la stessa key torna subito a funzionare.',
    rateLimitHeaderLimitLabel: 'X-RateLimit-Limit',
    rateLimitHeaderLimitDesc: 'La tua quota giornaliera. Vuoto per le key illimitate/emesse da admin.',
    rateLimitHeaderRemainingLabel: 'X-RateLimit-Remaining',
    rateLimitHeaderRemainingDesc: 'Richieste rimaste prima che si esaurisca la quota gratuita di oggi.',
    rateLimitHeaderResetLabel: 'X-RateLimit-Reset',
    rateLimitHeaderResetDesc: 'Timestamp ISO del prossimo reset della quota (mezzanotte UTC, oppure la data di rinnovo del tuo abbonamento).',
    rateLimitHeaderCreditLabel: 'X-Credit-Balance-Usd',
    rateLimitHeaderCreditDesc: 'Il tuo saldo di credito attuale, non appena ne hai uno.',
    rateLimitExceededTitle: 'Cosa succede oltre il limite',
    rateLimitExceededDesc: 'Ricevi un HTTP 402 con un corpo JSON — limit, used, reset_at, overage_rate_usd e un upgrade_url. Nessun retry necessario: appena ricarichi credito o ti abboni, la stessa key torna a funzionare dalla chiamata successiva.',
    rateLimitBestPractice: 'Controlla X-RateLimit-Remaining prima di lanciare un batch di chiamate — leggere un header non costa nulla, un 402 sprecato sì.',
    versioningTitle: 'Versionamento e changelog',
    versioningIntro: "L'API è versionata nell'URL (/api/v1/...). All'interno della v1, i campi esistenti non vengono mai rimossi, rinominati o riutilizzati con altro significato — solo aggiunti. Le integrazioni dovrebbero ignorare i campi che non riconoscono anziché fallire per colpa loro. Una modifica realmente incompatibile viene pubblicata come /api/v2/..., mantenendo la v1 attiva per un ragionevole periodo di sovrapposizione — mai una rottura silenziosa sullo stesso endpoint.",
    changelogTitle: 'Changelog',
    changelogNote: "Non c'è ancora una mailing list o webhook per gli annunci di aggiornamento — questa pagina e i link X / Telegram nel footer sono il modo per restare aggiornati.",
    changelogEntries: [
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
    payPerCallFeature3: 'Scende a $0.03/chiamata con abbonamento attivo',
    tierSubscription: 'ABBONAMENTO',
    subFeature1: '1000 chiamate incluse',
    subFeature2: '$0.03/chiamata di eccedenza dopo',
    subFeature3: 'Rinnovo manuale — nessun addebito automatico',
    pricingNote: 'Pagabile in $MRDT / SOL / USDC via Solana Pay — lo stesso flusso di pagamento del resto di TNT House. Solana Pay non può addebitare automaticamente, quindi l\'abbonamento è una ricarica manuale di 30 giorni, non un abbonamento ricorrente in senso tradizionale.',
    manageBillingTitle: 'Gestisci la fatturazione',
    getKeyTitle: 'Ottieni la tua API key',
    getKeySub: 'Istantaneo, gratuito, nessuna carta richiesta.',
    backToTnt: 'Torna a TNT House',
    billingTitle: 'Fatturazione',
    billingSub: 'Abbonati per 1000 chiamate/30 giorni, oppure ricarica crediti a chiamata. Pagabile in $MRDT / SOL / USDC via Solana Pay — stesso flusso del resto di TNT House.',
    continueBtn: 'Continua',
    noKeyYet: 'Non hai ancora una key? Ottienine una gratis qui sopra prima.',
    currentTierLabel: 'Livello attuale:',
    callsUsedLabel: 'chiamate usate',
    renewsLabel: 'si rinnova',
    creditBalanceLabel: 'Saldo crediti:',
    subscribeCardTitle: 'Abbonati — $49',
    subscribeCardSub: '1000 chiamate / 30 giorni',
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
  },
  zh: {
    flag: '🇨🇳',
    name: '中文',
    headerBadge: '风险数据 API',
    heroEyebrow: '专为 AI 交易机器人打造',
    heroTitle1: '在你的机器人买入之前',
    heroTitle2: '先看清代币在隐藏什么。',
    heroSub: '一次 GET 请求即可获取安全评分、实时内部人集群检测，以及任意 Solana mint 的链上基本面数据 —— 与 TNT House 审计所用的同一套引擎，以纯净的 JSON 形式面向机器人开放，而不是面向人类的仪表盘。',
    btnGetKey: '获取免费 API 密钥',
    btnReadDocs: '查看文档',
    copyCurl: '复制 curl',
    howItWorksTitle: '工作原理',
    step1Title: '获取密钥',
    step1Desc: '在下方输入邮箱。无需信用卡，无需等待审批 —— 密钥即时发放。',
    step2Title: '调用接口',
    step2Desc: '在 Authorization 请求头中带上你的密钥，调用 GET /api/v1/token-risk?mint=<地址>。典型响应时间：远低于一秒。',
    step3Title: '根据评分行动',
    step3Desc: '对某个 mint 的首次检查会返回 cluster_analysis: "pending"，此时内部人追踪正在后台运行 —— 一两分钟后再次检查即可获得完整结果。',
    responseFieldsTitle: '响应字段',
    fieldSafetyScore: '0–100 分。根据权限状态、持币集中度、流动性、交易量以及真实的内部人集群扣分综合加权得出。',
    fieldInsiderClusters: '共享同一个首次资金来源的钱包 —— 一个链上可证明的内部人/狙击信号，而非猜测。',
    fieldClusterAnalysis: '代币首次检查时为 "pending"（集群追踪正在后台运行），约 1–2 分钟后变为 "complete"。',
    fieldAuthorities: '各权限是否已被撤销，若仍处于活跃状态则显示其地址。',
    fieldHoneypotLpLocked: 'honeypot_risk（布尔值）和 lp_locked（{ locked, percent }）来自 RugCheck。null 表示无法检测，而不是"安全"。',
    fieldHolderDistribution: '最大持币者占比、前10名占比、风险等级，以及 holder_count —— 即 Solana 前20大持币者响应中的账户数量（这是 RPC 本身的真实限制，对于 BONK 或 USDC 这类持有非常分散的代币，并不代表完整持币人数）。',
    fieldMarket: '来自 DexScreener 的实时价格、流动性、24小时交易量、24小时涨跌幅及代币存在天数。',
    rateLimitHeadersNote: '每个响应还包含 X-RateLimit-Limit、X-RateLimit-Remaining 和 X-RateLimit-Reset 请求头 —— 一旦你有付费套餐或信用余额，还会附带 X-Credit-Balance-Usd —— 这样你的机器人无需触发 429 就能追踪自己的配额。',
    openApiUsageNote: '可直接配合 ChatGPT 的 Custom GPT Actions 使用（只需粘贴链接即可）。若用于 Claude、Gemini 或 LangChain/CrewAI 等智能体框架，请将此规范作为你自己工具集成的 schema 来源 —— 大多数平台仍需一个小型适配层，其中 LangChain 的 OpenAPISpec.from_url() 可以直接导入。',
    chatBubbleLabel: '咨询 API',
    chatTitle: 'Risk-Data API 助手',
    chatWelcome: '你好！关于 Risk-Data API 的任何问题都可以问我 —— 接口、价格、响应字段、如何获取密钥。',
    chatPlaceholder: '输入你的问题…',
    chatLimitReached: '已达到限制 —— 请几分钟后再试。',
    chatConnectionError: '连接错误。⚡ 在下方获取你的免费 API 密钥。',
    copyOpenApiUrl: '复制',
    webhooksRoadmapNote: '代币首次检测时，cluster_analysis 会返回 "pending"，此时分析仍在后台运行 —— 请在 1-2 分钟后重新查询同一个 mint，或在下方订阅 safety_score webhook，以推送通知代替轮询。',
    webhooksDocsTitle: 'Webhooks',
    webhooksDocsIntro: '无需按计划轮询 token-risk —— 只需针对某个 mint 和 safety_score 阈值订阅一次，一旦跨越阈值（无论方向），即可收到已签名的 HTTP 回调。',
    webhooksSubscribeLabel: '订阅',
    webhooksResponseLabel: '订阅已创建',
    webhooksPayloadLabel: '推送到你的 callback_url',
    webhooksUnsubscribeNote: '每次跨越只触发一次，而非每次检测都触发。请使用 X-Webhook-Signature 请求头和订阅响应中返回的 webhook_secret（仅显示一次）验证每次推送。调用 DELETE /api/v1/webhooks/{id} 即可取消订阅。',
    rateLimitingTitle: '速率限制',
    rateLimitingIntro: '每个密钥每个日历日（UTC）有 15 次免费请求。超过这个额度且没有信用余额时，你会收到 402，而不是被默默拦截——充值或订阅后，同一个密钥会立即恢复可用。',
    rateLimitHeaderLimitLabel: 'X-RateLimit-Limit',
    rateLimitHeaderLimitDesc: '你的每日配额。无限量/管理员发放的密钥此项为空。',
    rateLimitHeaderRemainingLabel: 'X-RateLimit-Remaining',
    rateLimitHeaderRemainingDesc: '今天免费配额用完前还剩多少次请求。',
    rateLimitHeaderResetLabel: 'X-RateLimit-Reset',
    rateLimitHeaderResetDesc: '下次配额重置的 ISO 时间戳（下一个 UTC 午夜，或你的订阅续费日期）。',
    rateLimitHeaderCreditLabel: 'X-Credit-Balance-Usd',
    rateLimitHeaderCreditDesc: '你当前的通话信用余额（如果有的话）。',
    rateLimitExceededTitle: '超出限制后会发生什么',
    rateLimitExceededDesc: '你会收到一个带 JSON 内容的 HTTP 402 —— limit、used、reset_at、overage_rate_usd 以及 upgrade_url。无需重试：一旦充值或订阅，同一个密钥在下一次调用时就会立即恢复正常。',
    rateLimitBestPractice: '在发起一批调用之前先检查 X-RateLimit-Remaining —— 读取一个响应头不花钱，白白触发一次 402 却会。',
    versioningTitle: '版本管理与更新日志',
    versioningIntro: 'API 通过 URL 进行版本管理（/api/v1/...）。在 v1 内部，现有字段永远不会被删除、重命名或改变用途——只会新增字段。集成方应该忽略无法识别的字段，而不是因此报错。真正的不兼容变更会以 /api/v2/... 的形式发布，v1 会继续运行一段合理的过渡期——绝不会在原地进行静默的破坏性改动。',
    changelogTitle: '更新日志',
    changelogNote: '目前还没有邮件列表或 webhook 用于更新通知——请通过本页面以及页脚的 X / Telegram 链接来获取最新动态。',
    changelogEntries: [
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
    payPerCallFeature3: '订阅后降至 $0.03/次',
    tierSubscription: '订阅',
    subFeature1: '含 1000 次调用',
    subFeature2: '超出后 $0.03/次',
    subFeature3: '手动续费 —— 不会自动扣款',
    pricingNote: '通过 Solana Pay 以 $MRDT / SOL / USDC 支付 —— 与 TNT House 其他部分相同的支付流程。Solana Pay 无法自动扣款，因此订阅本质上是每 30 天手动充值一次，而非传统意义上的自动续订。',
    manageBillingTitle: '管理账单',
    getKeyTitle: '获取你的 API 密钥',
    getKeySub: '即时获取，完全免费，无需信用卡。',
    backToTnt: '返回 TNT House',
    billingTitle: '账单',
    billingSub: '订阅 1000 次调用/30 天，或为按次付费充值。通过 Solana Pay 以 $MRDT / SOL / USDC 支付 —— 与 TNT House 其他部分相同的流程。',
    continueBtn: '继续',
    noKeyYet: '还没有密钥？先在上方免费获取一个。',
    currentTierLabel: '当前套餐：',
    callsUsedLabel: '次已使用',
    renewsLabel: '续期于',
    creditBalanceLabel: '信用余额：',
    subscribeCardTitle: '订阅 —— $49',
    subscribeCardSub: '1000 次调用 / 30 天',
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
  },
};


