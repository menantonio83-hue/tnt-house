# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # install dependencies
npm run dev       # start dev server at localhost:3000
npm run build     # production build
npm run lint      # ESLint check
npm run start     # serve production build
```

There are no tests in this project.

## Architecture

**TNT House** is a Next.js 14 (App Router) platform for listing and auditing Solana micro-cap tokens. Users pay in `$MRDT` (the ecosystem token) to have their token audited and listed in a public safety table.

### Page structure

- `app/page.js` — the entire main landing page (~1150 lines, single client component). All UI state (tokens, modals, chat, payment flow) lives here. Uses old-style `var` and `function` expressions throughout — keep this style consistent in that file.
- `app/admin-d10s/page.js` — admin panel for approving/rejecting token submissions. Access is gated client-side by wallet address (`AZyzUySu6HP9ocJYhZECG5syycYNV6ubTQKyfB2mDWgG`), connecting via `window.solana` or `window.solflare` directly (no wallet adapter).
- `app/tnt-house/page.tsx` — stub/placeholder route, not in use.
- `app/layout.js` — minimal root layout. Note: Tailwind CSS is loaded via CDN `<script>` tag in the `<head>`, not through the PostCSS pipeline, even though `tailwindcss` is in devDependencies.

### API routes (`app/api/`)

| Route | Purpose |
|---|---|
| `chat/route.js` | AI chat via Groq API (`llama-3.1-8b-instant`), edge runtime |
| `verify-payment/route.js` | Polls Helius API to confirm on-chain MRDT or SOL transfer, edge runtime |
| `audit/route.js` | Runs `performFullAudit()` from `lib/helius-client.js`, saves result to Supabase |
| `tokens/route.js` | CRUD for `verified_tokens` Supabase table; admin-write protected by wallet address |
| `admin/route.js` | Approve/reject submissions from `submissions` table, logs to `admin_logs` |
| `sendTelegram/route.js` | Posts audit results to the `@tnt_house2026` Telegram channel |

### External services

- **Supabase** (`pjtvjslcffuulsqxerpx.supabase.co`): Primary database. The publishable anon key is hardcoded in `app/page.js` and API routes — this is intentional (it's a publishable key). Key tables: `listed_tokens`, `active_banner`, `verified_tokens`, `submissions`, `admin_logs`. The full schema is in `supabase-schema.sql`.
- **DexScreener API** (no auth): Fetches live token data and `$MRDT` price. Main page caches token results in `localStorage` for 2 minutes and refreshes every 5 minutes.
- **RugCheck.xyz API** (no auth): `GET /v1/tokens/{ca}/report/summary` — used in `app/page.js` during free audits. Score is converted as `100 - rugScore/10`.
- **Helius API** (`HELIUS_API_KEY` env var): On-chain transaction lookup for payment verification. Checks recent transfers to `WALLET_ADDRESS` with 10% tolerance on amount.
- **Groq API** (`GROQ_API_KEY` env var): Powers the AI chat widget.
- **Solana mainnet RPC** (`api.mainnet-beta.solana.com`): Used in `lib/helius-client.js` for mint authority, freeze authority, and top-holder checks.

### Required environment variables

```
GROQ_API_KEY          # Groq API for /api/chat
HELIUS_API_KEY        # Helius API for /api/verify-payment
TELEGRAM_BOT_TOKEN    # Telegram bot for /api/sendTelegram
```

### Payment flow

1. User submits audit/banner form → `showPaymentModal` opens (choose MRDT or SOL)
2. User picks wallet (Phantom / Solflare) → invoice shown
3. On confirm, a `solana:` deep link fires to open the wallet for signing
4. `startPaymentVerification()` polls `/api/verify-payment` every 10 seconds, up to 30 attempts (5 minutes), then times out

### Token table data sources

The main safety table merges two sources in order:
1. **Pinned $MRDT row** — always first, hardcoded
2. **`listedTokens`** — loaded from Supabase `listed_tokens` on mount (paid/free audit submissions)
3. **`tokens`** — live DexScreener micro-cap feed (market cap $1K–$300K, up to 9 tokens)

### Audit scoring (`lib/helius-client.js`)

`performFullAudit()` builds a score out of 100:
- Mint authority revoked: +15
- Freeze authority revoked: +10
- Holder distribution: +25 (LOW risk), +12 (MEDIUM), +5 (HIGH)
- Volume, insider, liquidity: fixed +15/+10/+15

### i18n

Five languages (EN, ES, FR, EL, RU) are handled via a plain `TRANSLATIONS` object at the top of `app/page.js`. All UI strings are accessed as `t.keyName` where `t = TRANSLATIONS[lang]`. No i18n library is used.

### Config note

`next.config.js` is the active config (handles image domains for Solana NFT storage, and CORS headers for `/api/*`). The `next.config.mjs` file is empty and should be ignored.
