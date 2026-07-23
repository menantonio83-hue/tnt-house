# Telegram Risk-Check Bot

A tiny Telegram bot: send it a Solana mint address, it replies with a formatted
Risk-Data API report — safety score, insider clusters, honeypot flag, LP lock
status, mint/freeze authority.

## Setup

```bash
pip install -r requirements.txt

export TELEGRAM_BOT_TOKEN="123456:ABC-your-bot-token"   # from @BotFather
export TNT_RISK_API_KEY="tnt_sk_your_key_here"           # from tnt-audit.com/risk-api

python bot.py
```

## Usage

Open a chat with your bot and send any Solana token mint address, e.g.:

```
EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

You'll get back something like:

```
🟢 Safety Score: 82/100
🔒 LP Locked: Yes
🍯 Honeypot Risk: No
🛠 Mint Authority: Revoked ✅
❄️ Freeze Authority: Revoked ✅

👥 Insider Clusters: none detected
```

## Notes

- Mint address validation is a basic base58-length regex, not a full
  on-chain existence check — the API itself will return a 400 for invalid
  addresses.
- Handles 401 (bad key), 402 (rate limit / credit exceeded), and 400
  (invalid mint) with user-facing messages instead of raw errors.
- For production use behind a webhook (instead of polling), swap
  `run_polling()` for `run_webhook()` per the `python-telegram-bot` docs.
