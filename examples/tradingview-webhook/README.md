# TradingView Alert → Risk-Data API Gate

Small Express server that sits between TradingView alerts and your trading
logic: it receives the alert webhook, checks the token's risk score via the
Risk-Data API, and only forwards the signal downstream if the token passes
your threshold. Fails closed — if the risk check itself errors out, the
signal is not forwarded.

## Setup

```bash
npm install

export TNT_RISK_API_KEY="tnt_sk_your_key_here"
export MIN_SAFETY_SCORE=50            # optional, default 50
export FORWARD_WEBHOOK_URL="https://your-bot.example.com/execute"  # optional

node server.js
```

## Pointing TradingView at it

In your TradingView alert: **Notifications → Webhook URL** →
`https://your-server.example.com/tradingview-webhook`

Alert message (JSON):

```json
{ "mint": "YOUR_TOKEN_MINT_ADDRESS", "action": "buy", "price": "{{close}}" }
```

`{{ticker}}` in TradingView is an exchange symbol, not a Solana mint address —
you'll need a lookup table or a per-alert hardcoded mint if you're scripting
alerts across many tokens.

## Decision logic

A signal is approved only if:
- `safety_score` is present and ≥ `MIN_SAFETY_SCORE`
- `honeypot_risk` is `false`

If insider clusters are present but the score still clears the bar, the
signal is still approved but flagged (`warn: true`) in the response — you
decide in your own downstream logic whether that's acceptable.

## Response shape

```json
{
  "forwarded": true,
  "decision": { "approved": true, "reason": "passed all checks" },
  "risk": { "...": "full Risk-Data API response" }
}
```

Adjust `decide()` in `server.js` to match your own risk appetite (e.g. also
gate on `lp_locked`, or require a maximum number of insider clusters).
