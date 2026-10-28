# RiskDataApi — MCP Server

A remote **[Model Context Protocol](https://modelcontextprotocol.io) (MCP)** server exposing Solana token risk data as tools for AI agents (Claude, Cursor, and any other MCP-compatible client).

Built with the official **[`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk)** (TypeScript), using the `McpServer` class and `WebStandardStreamableHTTPServerTransport` for a stateless, serverless-friendly deployment on Vercel.

- **Endpoint:** `https://www.tnt-audit.com/api/mcp`
- **Transport:** Streamable HTTP (stateless — a fresh `McpServer` + transport is created per request, no in-memory session state, safe for serverless)
- **Auth:** `Authorization: Bearer <api_key>` — same API key used by the REST endpoints below. Get a free key (15 requests/day, no card) at [tnt-audit.com/risk-api](https://www.tnt-audit.com/risk-api).
- **Source:** [`route.ts`](./route.ts) in this directory

## Tools

This server registers 6 MCP tools via `server.registerTool(...)`:

### `check_token_risk`
Returns a 0-100 safety score, on-chain insider wallet cluster detection (wallets sharing a first funder — a provable on-chain signal, not a heuristic), mint/freeze authority status, holder concentration, and live price/liquidity/volume for a single Solana token mint. 5 free anonymous calls/day, no signup; after that use a free API key (15/day) or pay per call via x402.

**Input:** `{ mint: string, api_key?: string }` — the Solana token mint address; optional API key (or pass it in the `Authorization` header).

### `check_token_risk_batch`
Same as `check_token_risk`, but for up to 25 mints in one call. N mints = N calls charged (no bulk discount). All-or-nothing: if the batch can't be fully covered by the caller's remaining quota/credit, the whole batch is rejected rather than partially processed. Requires an API key or x402 — no anonymous batch calls.

**Input:** `{ mints: string[], api_key?: string }` — 1 to 25 Solana token mint addresses.

### `get_token_risk_history`
Returns hourly historical data points (safety score, insider cluster count, holder count, price, liquidity, volume) for a mint over the last N days (max 90). Free and unmetered — works with or without an API key; it's a pure read from stored history, not a live upstream call.

**Input:** `{ mint: string, days?: number }` — mint address, optional lookback window (default 30, max 90).

### `get_free_api_key`
Issues a free API key for an email address (15 checks/day instead of 5 anonymous calls/day). One active key per email; the key is returned once and also emailed.

**Input:** `{ email: string }`

### `create_topup_invoice`
Creates a Solana payment invoice for your API key: `kind: "topup"` adds call credit, `kind: "subscription"` buys 30 days. Returns `payment_id`, the exact `pay_amount` and `wallet_address`. Send exactly `pay_amount`, then call `check_payment`. Max 3 pending invoices per key.

**Input:** `{ api_key?: string, kind?: "topup" | "subscription", currency?: string, usd_amount?: number }` — currency defaults to USDC.

### `check_payment`
Checks on-chain whether an invoice from `create_topup_invoice` has been paid and, if so, credits your key. Idempotent and safe to call repeatedly (rate-limited; returns `verify_rate_limited` with `retry_after` when throttled).

**Input:** `{ api_key?: string, payment_id: string }`

## Why this exists

RiskDataApi runs the same risk-scoring engine used by [TNT House](https://www.tnt-audit.com)'s token safety checker, exposed here specifically for AI trading agents and agentic frameworks that speak MCP — so a bot can call `check_token_risk` before executing a trade, instead of scraping a dashboard or hand-rolling an HTTP client against the REST API.

## REST API

The same underlying logic is also available as a plain REST API (`GET /api/v1/token-risk`, `POST /api/v1/token-risk/batch`, `GET /api/v1/token-risk/history`) if you'd rather integrate without MCP — see the [full documentation](https://www.tnt-audit.com/risk-api), [OpenAPI 3.0 spec](https://www.tnt-audit.com/openapi.json), and [Postman collection](https://www.tnt-audit.com/risk-data-api.postman_collection.json).
