from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.schemas.extract_node_schemas import ExtractOut
from app.agent.contracts.agent_interface import TicketState
from app.agent.templates.extract_node_templates import EXTRACT_NODE_PERSONA, EXTRACT_NODE_PROMPT
from app.metrics import llm_requests


class ExtractNode:
    def __init__(self, llm: ChatAnthropic):
        self._llm = llm.with_structured_output(ExtractOut)

    async def __call__(self, state: TicketState) -> dict:
        messages = [SystemMessage(content=EXTRACT_NODE_PERSONA)] + state["messages"] + [HumanMessage(content=EXTRACT_NODE_PROMPT)]
        llm_requests.labels(node="extract").inc()
        result: ExtractOut = await self._llm.ainvoke(messages)
        return {"extract_out": result}
