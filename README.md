# RiskDataApi — Solana token risk, 5 MCP calls free

[![tnt-house MCP server](https://glama.ai/mcp/servers/menantonio83-hue/tnt-house/badges/card.svg)](https://glama.ai/mcp/servers/menantonio83-hue/tnt-house)

[![MCP Marketplace](https://img.shields.io/badge/MCP%20Marketplace-Indexed-blueviolet)](https://getlulu.dev/mcps)

RiskDataApi is the risk layer for Solana trading bots and AI agents. One call on a mint returns a safety score (0–100), insider clusters (wallets that share a first funder), honeypot, and LP lock. Scanners count wallets. We trace who funded them.

Connect with no key. MCP: https://www.tnt-audit.com/api/mcp
Paste that URL into Glama Inspector, Claude, or Cursor and call `check_token_risk`. 5 calls/day, no email.

After that: email key 15/day, x402 at $0.02/call with no account, or a $45/5000-call subscription for volume. Humans on the site get 3 free checks with no signup at [tnt-audit.com/risk-api](https://www.tnt-audit.com/risk-api).

- **Docs:** [https://www.tnt-audit.com/risk-api/docs](https://www.tnt-audit.com/risk-api/docs)

This repository hosts a remote **Model Context Protocol (MCP) server** exposing the RiskDataApi engine as tools for AI agents (Claude, Cursor, and any other MCP-compatible client). See the [MCP Server section](#mcp-server--risk-data-api) below.

## Getting Started (3 steps)

1. **Try it now, no signup** — no API key needed for your first **5 MCP calls/day** (no signup at all). Three ways, pick whichever is easiest:
   - **⚡ Glama's MCP Inspector (fastest, zero setup, real MCP call)** — go to [glama.ai/mcp/inspector](https://glama.ai/mcp/inspector), paste `https://tnt-audit.com/api/mcp` as the server URL, and call `check_token_risk` right in your browser — no install needed.
   - **Claude Desktop / Cursor** — paste this into your MCP config, no key required:
     ```json
     {
       "mcpServers": {
         "tnt-risk-data-api": {
           "command": "npx",
           "args": ["-y", "mcp-remote", "https://tnt-audit.com/api/mcp"]
         }
       }
     }
     ```
   - **Browser, raw REST preview** — open [a live example](https://tnt-audit.com/api/v1/token-risk?mint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v) directly, no install, no signup. ⚠️ *This is a REST preview of the underlying data, not the MCP tool itself — for the real MCP tool, use the Inspector above.*
2. **Want more?** — get a free API key in seconds at [tnt-audit.com/risk-api](https://www.tnt-audit.com/risk-api) (email only, no card).
3. **Need higher volume?** — on the same page, paste your key into the pricing section to pay per-call, by subscription, or via x402 (autonomous agents, no key at all).

## Tech Stack
- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS
- Supabase (auth, billing, key storage)
- Helius (Solana RPC) + RugCheck + DexScreener (market/risk data)
- Vercel (hosting, cron via QStash)

## MCP Server — Risk-Data API

This repository includes a remote **[Model Context Protocol](https://modelcontextprotocol.io) (MCP) server**, built with the official **[`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk)** (TypeScript), exposing Solana token risk data as tools for AI agents.

- **Source:** [`app/api/mcp/route.ts`](./app/api/mcp/route.ts)
- **Docs:** [`app/api/mcp/README.md`](./app/api/mcp/README.md)
- **Endpoint:** `https://tnt-audit.com/api/mcp` (Streamable HTTP transport)
- **Auth:** optional — first 5 calls/day need no `Authorization` header at all. Beyond that: `Authorization: Bearer <api_key>` — free key at [tnt-audit.com/risk-api](https://www.tnt-audit.com/risk-api)

### Tools

Registered via `server.registerTool(...)`:

| Tool | Description |
|---|---|
| `check_token_risk` | Safety score, insider wallet cluster detection, mint/freeze authority, holder concentration, live price/liquidity/volume for one Solana token mint |
| `check_token_risk_batch` | Same as above for up to 25 mints in one call |
| `get_token_risk_history` | Hourly historical risk/price data for a mint over up to 90 days |

Full tool schemas and input parameters: [`app/api/mcp/README.md`](./app/api/mcp/README.md).

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

Vercel-ready. Connected to this repo's `main` branch for auto-deploys.

**Links:** [X @RiskDataApiSol](https://x.com/RiskDataApiSol) | [Risk-Data API](https://www.tnt-audit.com/risk-api) | [Telegram](https://t.me/tnt_house2026)
