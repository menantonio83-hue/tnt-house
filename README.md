# TNT House — RiskDataApi

TNT House ([tnt-audit.com/risk-api](https://www.tnt-audit.com/risk-api)) is an AI-powered Solana token audit and listing platform: safety scoring, insider wallet cluster detection, mint/freeze authority checks, honeypot and LP-lock detection.

This repository also hosts a remote **Model Context Protocol (MCP) server** exposing that same engine as the **Risk-Data API** — Solana token risk scoring and insider wallet cluster detection for AI agents (Claude, Cursor, and any other MCP-compatible client). See the [MCP Server section](#mcp-server--risk-data-api) below.

## Getting Started (3 steps)

1. **Try it now, no signup** — call `check_token_risk` right here in Glama's "Try in Browser" / Inspector, or via curl. **In the "Try in Browser" popup, the `TNT_API_KEY` field is optional — leave it empty and click "Start Inspector" directly.** No API key needed for your first **3 calls/day** (per IP).
2. **Want more?** — get a free API key in seconds at [tnt-audit.com/risk-api](https://www.tnt-audit.com/risk-api) (email only, no card). A free key raises your limit to **15 calls/day**.
3. **Need higher volume?** — on the same page, paste your key into the pricing section and pay per-call ($0.04), by subscription ($45/1000 calls), or via x402 (autonomous agents, no key at all, $0.02/call).

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

**Links:** [X @RiskDataApiSol](https://x.com/RiskDataApiSol) | [Risk-Data API](https://www.tnt-audit.com/risk-api) | [Telegram](https://t.me/tnt_house2026)


