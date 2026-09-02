# TNT House — RiskDataApi

[![tnt-house MCP server](https://glama.ai/mcp/servers/menantonio83-hue/tnt-house/badges/card.svg)](https://glama.ai/mcp/servers/menantonio83-hue/tnt-house)

[![MCP Marketplace](https://img.shields.io/badge/MCP%20Marketplace-Indexed-blueviolet)](https://getlulu.dev/mcps)

RiskDataApi is a Solana token-risk API for trading bots and AI agents. One call returns a safety score (0–100), insider wallet clusters (shared first-funder), honeypot risk, and LP lock.

- **Website (humans):** 3 manual checks/day, no email, no key — [tnt-audit.com/risk-api](https://www.tnt-audit.com/risk-api)
- **API key (bots):** email signup, 15 calls/day, no card
- **Agents:** x402 $0.02 USDC/call, no key — `GET /api/v1/token-risk/x402`
- **Subscription:** $45 / 30 days / 5000 calls, then $0.015/call
- **MCP:** [https://tnt-audit.com/api/mcp](https://tnt-audit.com/api/mcp)
- **Docs:** [https://www.tnt-audit.com/risk-api/docs](https://www.tnt-audit.com/risk-api/docs)

This repository hosts a remote **Model Context Protocol (MCP) server** exposing the RiskDataApi engine as tools for AI agents (Claude, Cursor, and any other MCP-compatible client). See the [MCP Server section](#mcp-server--risk-data-api) below.

## Getting Started (3 steps)

1. **Try it now, no signup** — no API key needed for your first **3 calls/day** (per IP). Three ways, pick whichever is easiest:
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
2. **Want more?** — get a free API key in seconds at [tnt-audit.com/risk-api](https://www.tnt-audit.com/risk-api) (email only, no card). A free key raises your limit to **15 calls/day**.
3. **Need higher volume?** — on the same page, paste your key into the pricing section and pay per-call ($0.02), by subscription ($45/5000 calls), or via x402 (autonomous agents, no key at all, $0.02/call).

## Tech Stack
- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS
- Supabase (auth, billing, key storage)
- Helius (Solana RPC) + RugCheck + DexScreener (market/risk data)
- Vercel (hosting, cron via QStash)

## MCP Server — RiskDataApi

This repository includes a remote **[Model Context Protocol](https://modelcontextprotocol.io) (MCP) server**, built with the official **[`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk)** (TypeScript), exposing Solana token risk data as tools for AI agents.

- **Source:** [`app/api/mcp/route.ts`](./app/api/mcp/route.ts)
- **Docs:** [`app/api/mcp/README.md`](./app/api/mcp/README.md)
- **Endpoint:** `https://tnt-audit.com/api/mcp` (Streamable HTTP transport)
- **Auth:** `Authorization: Bearer <api_key>` — free key at [tnt-audit.com/risk-api](https://www.tnt-audit.com/risk-api)

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

**Links:** [X @RiskDataApiSol](https://x.com/RiskDataApiSol) | [RiskDataApi](https://www.tnt-audit.com/risk-api) | [Telegram](https://t.me/tnt_house2026)
