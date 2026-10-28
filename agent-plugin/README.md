# TNT House Risk-Data API — Agent Plugins package

This directory is an [Agent Plugins 1.0.0](https://agent-plugins.org) package
for the Risk-Data API's MCP server. It lets Agent Plugins-compatible clients
(Codex, Claude Code, Cursor, and others) discover and connect to the same
production MCP server already listed on Smithery, Glama, and the Official MCP
Registry — no separate integration needed.

- `plugin.json` — manifest (name, description, repo, license, keywords)
- `mcp.json` — declares the remote server at `https://www.tnt-audit.com/api/mcp`
  (`streamable-http` transport)

## What you get with zero configuration

- `check_token_risk` works with **no API key** for **5 free anonymous MCP
  calls/day** — a genuine anonymous trial, not a locked demo. (Each caller is
  also capped per IP, per subnet and by a global daily pool.)
- Returns a 0-100 safety score, insider wallet cluster detection (shared
  first-funder tracing), mint/freeze authority status, honeypot risk, and
  LP-lock status for any Solana token mint.
- `get_token_risk_history` is free and works without a key too.

## When the free calls run out

Every quota refusal returns JSON with `error_code`, `message` and an
`options[]` array giving the price and exact next step. Two ways to continue:

1. **Free email key — 15 calls/day, no card.** Call the MCP tool
   `get_free_api_key` with your email, or `POST
   https://www.tnt-audit.com/api/v1/signup`. Send the key as an
   `Authorization: Bearer <api_key>` header, or pass it in the optional
   `api_key` tool argument if your client cannot set headers. Per the Agent
   Plugins spec, `mcp.json` cannot embed credentials in `headers`.
2. **x402 pay-per-call — $0.02/call in USDC on Solana, no account at all.**
   `GET https://www.tnt-audit.com/api/v1/token-risk/x402?mint=<mint>`.

`check_token_risk_batch` (up to 25 mints/call, N mints = N calls) needs a key
or x402. Paid top-ups are available via the `create_topup_invoice` and
`check_payment` tools.

Quick start for agents: https://www.tnt-audit.com/llms.txt

## Links

- Docs / pricing / changelog: https://www.tnt-audit.com/risk-api
- Source: https://github.com/menantonio83-hue/tnt-house
- X: [@RiskDataApiSol](https://x.com/RiskDataApiSol)
