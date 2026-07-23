# Version 1.1 — agent_example.py
#
# Minimal ReAct-style agent that uses tnt_risk_tool to check token risk
# before answering. Swap ChatOpenAI for whatever LLM provider you use —
# the tool itself is provider-agnostic.
#
# Setup:
#   pip install -r requirements.txt
#   export TNT_RISK_API_KEY="tnt_sk_your_key_here"
#   export OPENAI_API_KEY="sk-..."
#   python agent_example.py

from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from tnt_risk_tool import tnt_risk_tool

SYSTEM_PROMPT = (
    "You are a Solana trading assistant. Before giving any opinion on "
    "whether a token is safe to buy, you MUST call check_solana_token_risk "
    "on its mint address and base your answer on the returned data — never "
    "guess at a token's safety from its name or memory alone."
)

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", SYSTEM_PROMPT),
        ("human", "{input}"),
        ("placeholder", "{agent_scratchpad}"),
    ]
)

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
tools = [tnt_risk_tool]

agent = create_tool_calling_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)


if __name__ == "__main__":
    question = (
        "Is this token safe to buy? Mint address: "
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    )
    result = agent_executor.invoke({"input": question})
    print("\n--- Final answer ---")
    print(result["output"])
