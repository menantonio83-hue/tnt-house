# Version 1.1 — bot.py
#
# Minimal Telegram bot for the TNT House Risk-Data API.
# Send it any Solana mint address, it replies with a formatted risk report.
#
# Setup:
#   pip install -r requirements.txt
#   export TELEGRAM_BOT_TOKEN="123456:ABC-your-bot-token"
#   export TNT_RISK_API_KEY="tnt_sk_your_key_here"
#   python bot.py

import os
import re
import logging

import requests
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, CommandHandler, filters

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("tnt-risk-bot")

RISK_API_URL = "https://tnt-audit.com/api/v1/token-risk"
TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TNT_RISK_API_KEY = os.environ["TNT_RISK_API_KEY"]

# Solana base58 mint addresses are typically 32-44 characters
MINT_PATTERN = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")


def fetch_risk(mint: str) -> dict:
    """Calls the Risk-Data API for a single mint. Raises for HTTP errors."""
    resp = requests.get(
        RISK_API_URL,
        params={"mint": mint},
        headers={"Authorization": f"Bearer {TNT_RISK_API_KEY}"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def format_report(data: dict) -> str:
    """Turns the API JSON response into a readable Telegram message."""
    score = data.get("safety_score")
    clusters = data.get("insider_clusters") or []
    honeypot = data.get("honeypot_risk")
    lp_locked = data.get("lp_locked")
    mint_auth = data.get("mint_authority")
    freeze_auth = data.get("freeze_authority")

    if score is None:
        risk_emoji = "❓"
    elif score >= 70:
        risk_emoji = "🟢"
    elif score >= 40:
        risk_emoji = "🟡"
    else:
        risk_emoji = "🔴"

    lines = [
        f"{risk_emoji} *Safety Score:* {score if score is not None else 'n/a'}/100",
        f"🔒 *LP Locked:* {'Yes' if lp_locked else 'No'}",
        f"🍯 *Honeypot Risk:* {'Yes ⚠️' if honeypot else 'No'}",
        f"🛠 *Mint Authority:* {'Revoked ✅' if not mint_auth else 'Active ⚠️'}",
        f"❄️ *Freeze Authority:* {'Revoked ✅' if not freeze_auth else 'Active ⚠️'}",
    ]

    if clusters:
        lines.append(f"\n👥 *Insider Clusters Found:* {len(clusters)}")
        for i, cluster in enumerate(clusters[:5], start=1):
            pct = cluster.get("percent_of_supply", cluster.get("percentage"))
            wallets = cluster.get("wallets") or cluster.get("wallet_count")
            lines.append(f"  {i}. ~{pct}% of supply across {wallets} linked wallets")
        if len(clusters) > 5:
            lines.append(f"  ...and {len(clusters) - 5} more")
    else:
        lines.append("\n👥 *Insider Clusters:* none detected")

    note = data.get("note")
    if note:
        lines.append(f"\nℹ️ {note}")

    return "\n".join(lines)


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (update.message.text or "").strip()

    if not MINT_PATTERN.match(text):
        await update.message.reply_text(
            "Send me a Solana token mint address and I'll check its risk score."
        )
        return

    await update.message.chat.send_action("typing")

    try:
        data = fetch_risk(text)
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else None
        if status == 401:
            msg = "API key rejected — check TNT_RISK_API_KEY."
        elif status == 402:
            msg = "Rate limit or credit balance exceeded for this API key."
        elif status == 400:
            msg = "That doesn't look like a valid mint address."
        else:
            msg = f"Risk-Data API error (HTTP {status})."
        log.warning("API error for mint=%s: %s", text, e)
        await update.message.reply_text(msg)
        return
    except requests.RequestException as e:
        log.warning("Network error for mint=%s: %s", text, e)
        await update.message.reply_text("Couldn't reach the Risk-Data API, try again in a moment.")
        return

    await update.message.reply_markdown(format_report(data))


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "👋 Send me a Solana token mint address and I'll run a risk check "
        "(safety score, insider clusters, honeypot risk, LP lock status)."
    )


def main() -> None:
    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    log.info("Bot started, polling...")
    app.run_polling()


if __name__ == "__main__":
    main()
