# RiskDataApi — MCP Server

A remote **[Model Context Protocol](https://modelcontextprotocol.io) (MCP)** server exposing Solana token risk data as tools for AI agents (Claude, Cursor, and any other MCP-compatible client).

Built with the official **[`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk)** (TypeScript), using the `McpServer` class and `WebStandardStreamableHTTPServerTransport` for a stateless, serverless-friendly deployment on Vercel.

- **Endpoint:** `https://tnt-audit.com/api/mcp`
- **Transport:** Streamable HTTP (stateless — a fresh `McpServer` + transport is created per request, no in-memory session state, safe for serverless)
- **Auth:** `Authorization: Bearer <api_key>` — same API key used by the REST endpoints below. Get a free key (15 requests/day, no card) at [tnt-audit.com/risk-api](https://www.tnt-audit.com/risk-api).
- **Source:** [`route.ts`](./route.ts) in this directory

## Tools

This server registers 3 MCP tools via `server.registerTool(...)`:

### `check_token_risk`
Returns a 0-100 safety score, on-chain insider wallet cluster detection (wallets sharing a first funder — a provable on-chain signal, not a heuristic), mint/freeze authority status, holder concentration, and live price/liquidity/volume for a single Solana token mint.

**Input:** `{ mint: string }` — the Solana token mint address.

### `check_token_risk_batch`
Same as `check_token_risk`, but for up to 25 mints in one call. N mints = N calls charged (no bulk discount). All-or-nothing: if the batch can't be fully covered by the caller's remaining quota/credit, the whole batch is rejected rather than partially processed.

**Input:** `{ mints: string[] }` — 1 to 25 Solana token mint addresses.

### `get_token_risk_history`
Returns hourly historical data points (safety score, insider cluster count, holder count, price, liquidity, volume) for a mint over the last N days (max 90). Does not count against the free/subscription call quota — it's a pure read from stored history, not a live upstream call.

**Input:** `{ mint: string, days?: number }` — mint address, optional lookback window (default 30, max 90).

## Why this exists

RiskDataApi runs the same risk-scoring engine used by [TNT House](https://www.tnt-audit.com)'s token safety checker, exposed here specifically for AI trading agents and agentic frameworks that speak MCP — so a bot can call `check_token_risk` before executing a trade, instead of scraping a dashboard or hand-rolling an HTTP client against the REST API.

## REST API

The same underlying logic is also available as a plain REST API (`GET /api/v1/token-risk`, `POST /api/v1/token-risk/batch`, `GET /api/v1/token-risk/history`) if you'd rather integrate without MCP — see the [full documentation](https://www.tnt-audit.com/risk-api), [OpenAPI 3.0 spec](https://www.tnt-audit.com/openapi.json), and [Postman collection](https://www.tnt-audit.com/risk-data-api.postman_collection.json).
