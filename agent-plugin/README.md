# TNT House Risk-Data API — Agent Plugins package

This directory is an [Agent Plugins 1.0.0](https://agent-plugins.org) package
for the Risk-Data API's MCP server. It lets Agent Plugins-compatible clients
(Codex, Claude Code, Cursor, and others) discover and connect to the same
production MCP server already listed on Smithery, Glama, and the Official MCP
Registry — no separate integration needed.

- `plugin.json` — manifest (name, description, repo, license, keywords)
- `mcp.json` — declares the remote server at `https://tnt-audit.com/api/mcp`
  (`streamable-http` transport)

## What you get with zero configuration

- `check_token_risk` works with **no API key** for the first 3 calls/day per
  IP (100/day global cap) — a genuine anonymous trial, not a locked demo.
- Returns a 0-100 safety score, insider wallet cluster detection (shared
  first-funder tracing), mint/freeze authority status, honeypot risk, and
  LP-lock status for any Solana token mint.

## Higher limits / other tools

`check_token_risk_batch` (up to 25 mints/call) and `get_token_risk_history`
require a Bearer API key. Per the Agent Plugins spec, `mcp.json` cannot embed
credentials in `headers` — get a free key (15 calls/day) at
[tnt-audit.com/risk-api](https://tnt-audit.com/risk-api) and add it as an
`Authorization: Bearer <key>` header wherever your client exposes that option
for configured MCP servers.

x402 pay-per-call ($0.02/call in USDC, no key at all) is also available for
fully autonomous agents — see
[tnt-audit.com/risk-api](https://tnt-audit.com/risk-api) for the x402
endpoint.

## Links

- Docs / pricing / changelog: https://tnt-audit.com/risk-api
- Source: https://github.com/menantonio83-hue/tnt-house
- X: [@RiskDataApiSol](https://x.com/RiskDataApiSol)
