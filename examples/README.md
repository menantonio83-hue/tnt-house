# Risk-Data API — Integration Examples

Working, minimal integrations for [TNT House Risk-Data API](https://www.tnt-audit.com/risk-api) — a JSON risk endpoint for Solana tokens (safety score, insider cluster detection, honeypot risk, LP lock status), built for AI trading agents and bots.

Get a free API key at [tnt-audit.com/risk-api](https://www.tnt-audit.com/risk-api) (15 free requests/day).

## Examples in this folder

| Folder | What it does |
|---|---|
| [`telegram-bot/`](./telegram-bot) | Telegram bot — send a mint address, get back a formatted risk report |
| [`tradingview-webhook/`](./tradingview-webhook) | Webhook receiver for TradingView alerts — checks token risk before acting on a signal |
| [`langchain-agent/`](./langchain-agent) | LangChain `Tool` wrapping the API, so an LLM agent can check token risk mid-reasoning |

Each folder is self-contained: its own `README.md`, dependencies, and a single entry-point file you can run as-is after dropping in your API key.

## Common request shape

```
GET https://tnt-audit.com/api/v1/token-risk?mint=<MINT_ADDRESS>
Authorization: Bearer <YOUR_API_KEY>
```

Full field reference, rate-limit headers, and error codes: see [`/openapi.json`](https://www.tnt-audit.com/openapi.json) and the docs page linked above.

## Support

Questions or bugs in these examples — open an issue in this repo. General API questions — use the chat widget on the [docs page](https://www.tnt-audit.com/risk-api).
