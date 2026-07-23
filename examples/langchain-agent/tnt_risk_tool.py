# Version 1.1 — tnt_risk_tool.py
#
# A LangChain Tool wrapping the TNT House Risk-Data API, so an LLM agent can
# check a Solana token's risk profile mid-reasoning before recommending or
# executing a trade.

import os
import json

import requests
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

RISK_API_URL = "https://tnt-audit.com/api/v1/token-risk"


class TokenRiskInput(BaseModel):
    mint: str = Field(description="The Solana token mint address to check, e.g. EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")


def check_token_risk(mint: str) -> str:
    """Calls the Risk-Data API and returns a JSON string summary for the LLM.

    Kept as a plain string return (not a dict) because most LangChain tool
    call plumbing expects text back from a tool — the agent's LLM will parse
    the JSON itself from the string.
    """
    api_key = os.environ.get("TNT_RISK_API_KEY")
    if not api_key:
        return json.dumps({"error": "TNT_RISK_API_KEY is not set in the environment"})

    try:
        resp = requests.get(
            RISK_API_URL,
            params={"mint": mint},
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=15,
        )
    except requests.RequestException as e:
        return json.dumps({"error": f"network error calling Risk-Data API: {e}"})

    if resp.status_code == 401:
        return json.dumps({"error": "API key rejected — check TNT_RISK_API_KEY"})
    if resp.status_code == 402:
        return json.dumps({"error": "rate limit or credit balance exceeded for this API key"})
    if resp.status_code == 400:
        return json.dumps({"error": f"invalid mint address: {mint}"})
    if not resp.ok:
        return json.dumps({"error": f"Risk-Data API returned HTTP {resp.status_code}"})

    data = resp.json()

    # Trim to what an LLM actually needs to reason about — the full response
    # also includes fields like checked_at that just add noise to the prompt.
    summary = {
        "mint": data.get("mint", mint),
        "safety_score": data.get("safety_score"),
        "honeypot_risk": data.get("honeypot_risk"),
        "lp_locked": data.get("lp_locked"),
        "mint_authority_active": bool(data.get("mint_authority")),
        "freeze_authority_active": bool(data.get("freeze_authority")),
        "insider_cluster_count": len(data.get("insider_clusters") or []),
        "insider_clusters": data.get("insider_clusters"),
    }
    return json.dumps(summary)


tnt_risk_tool = StructuredTool.from_function(
    func=check_token_risk,
    name="check_solana_token_risk",
    description=(
        "Checks the risk profile of a Solana token by mint address. Returns "
        "a JSON string with safety_score (0-100), honeypot_risk, lp_locked, "
        "mint/freeze authority status, and any detected insider wallet "
        "clusters. Use this before recommending or executing any trade on a "
        "Solana token you haven't already verified in this conversation."
    ),
    args_schema=TokenRiskInput,
)
