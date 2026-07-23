# LangChain Agent with Risk-Data API Tool

`tnt_risk_tool.py` wraps the TNT House Risk-Data API as a LangChain
`StructuredTool`, so any LangChain agent can call it mid-reasoning to check a
Solana token's risk profile before answering a question or acting on a
signal.

## Files

- `tnt_risk_tool.py` — the tool itself. Import `tnt_risk_tool` into any
  agent's tool list.
- `agent_example.py` — a minimal tool-calling agent (OpenAI) that uses it,
  as a runnable end-to-end example.

## Setup

```bash
pip install -r requirements.txt

export TNT_RISK_API_KEY="tnt_sk_your_key_here"
export OPENAI_API_KEY="sk-..."

python agent_example.py
```

## Using the tool in your own agent

```python
from tnt_risk_tool import tnt_risk_tool

tools = [tnt_risk_tool, ...your_other_tools]
```

The tool returns a JSON string (not a raw dict) since that's what most
LangChain tool-calling flows expect back as a `ToolMessage` — the LLM parses
it from there. See `check_token_risk()` in `tnt_risk_tool.py` if you want to
change what fields get surfaced to the model.

## Notes

- Errors (bad API key, rate limit, invalid mint, network failure) come back
  as `{"error": "..."}` JSON rather than raising — this keeps the agent loop
  from crashing on a single bad tool call, and lets the LLM explain the
  failure to the user instead.
- `agent_example.py` uses `ChatOpenAI`, but the tool itself has no
  OpenAI-specific code — drop it into an Anthropic, local, or any other
  LangChain-compatible agent the same way.
