from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage
from app.agent.contracts.agent_interface import TicketState
from app.agent.templates.create_node_templates import CREATE_NODE_PERSONA
from app.metrics import llm_requests


class CreateNode:
    def __init__(self, llm: ChatAnthropic):
        self._llm = llm

    async def __call__(self, state: TicketState) -> dict:
        messages = [SystemMessage(content=CREATE_NODE_PERSONA)] + state["messages"]
        llm_requests.labels(node="create").inc()
        response = await self._llm.ainvoke(messages)
        return {"messages": [response]}
