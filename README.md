# TNT House

> This repo hosts both the TNT House web platform *and* a Model Context Protocol (MCP) server (`app/api/mcp`) exposing the Risk-Data API — Solana token risk scoring and insider wallet cluster detection for AI agents. See the [MCP Server section](#mcp-server--risk-data-api) below.

**Trench Construction Site v1.0** — Safe New Tokens Platform

A modern Next.js landing page for discovering and submitting verified micro-cap gems on Solana.

## Features
- Live DexScreener feed for low MC gems ($5K–$100K)
- AI Audit submission form (MVP mock)
- Whale Club DAO section (hold $MRDT for access)
- Blueprint/cinematic UI built with Tailwind

## Tech Stack
- Next.js 14 (App Router) + React 18
- Tailwind CSS
- Lucide React icons
- DexScreener public API

## MCP Server — Risk-Data API

This repository includes a remote **[Model Context Protocol](https://modelcontextprotocol.io) (MCP) server**, built with the official **[`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk)** (TypeScript), exposing Solana token risk data as tools for AI agents (Claude, Cursor, and any other MCP-compatible client).

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

Vercel-ready. Connected to GitHub main branch for auto-deploys.

**Latest: Next.js full migration done. Forced new deploy trigger.**

**Part of $MRDT ecosystem** • D10S vibes

**Links:** [X @Crypto_D10S](https://x.com/Crypto_D10S) | [Telegram](https://t.me/D10S_Solana_Stadium) | [Site](https://www.maradonatoken-mrdt.xyz)