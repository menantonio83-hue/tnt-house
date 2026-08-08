# TNT House

TNT House ([tnt-audit.com](https://www.tnt-audit.com)) is an AI-powered Solana token audit and listing platform: safety scoring, insider wallet cluster detection, mint/freeze authority checks, honeypot and LP-lock detection.

This repository also hosts a remote **Model Context Protocol (MCP) server** exposing that same engine as the **Risk-Data API** — Solana token risk scoring and insider wallet cluster detection for AI agents (Claude, Cursor, and any other MCP-compatible client). See the [MCP Server section](#mcp-server--risk-data-api) below.

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
