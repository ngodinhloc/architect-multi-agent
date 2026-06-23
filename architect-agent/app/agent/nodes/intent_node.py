import uuid
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage

from app.agent.contracts.agent_interface import ArchitectState
from app.agent.schemas.intent_schema import IntentOut
from app.agent.templates.intent_templates import INTENT_PERSONA, INTENT_PROMPT
from app.events.rabbitmq_publisher import RabbitMQPublisher

ACCEPT_QUEUE = "architecture-agent.accept"
ACCEPT_EVENT_NAME = "architecture-agent.accept"


class IntentNode:
    def __init__(self, llm: ChatAnthropic, publisher: RabbitMQPublisher):
        self._llm = llm.with_structured_output(IntentOut)
        self._publisher = publisher

    async def __call__(self, state: ArchitectState) -> dict:
        messages = state["messages"]
        latest = next((m for m in reversed(messages) if isinstance(m, HumanMessage)), None)
        user_text = latest.content if latest else ""

        has_prior_plan = any(
            m.get("agentStatus") == "hasReplied" and isinstance(m.get("content"), dict)
            for m in state.get("raw_history", [])
        )

        prompt = INTENT_PROMPT.format(user_text=user_text, has_prior_plan=has_prior_plan)
        result: IntentOut = await self._llm.ainvoke([SystemMessage(content=INTENT_PERSONA), HumanMessage(content=prompt)])

        if result.intent == "accept":
            return await self._handle_accept(state)

        return self._build_updates(state, result)

    async def _handle_accept(self, state: ArchitectState) -> dict:
        conversation_id = state.get("conversation_id", "")

        for msg in reversed(state.get("raw_history", [])):
            content = msg.get("content", {})
            if isinstance(content, dict) and "epic" in content and "tickets" in content:
                await self._publisher.publish(ACCEPT_EVENT_NAME, {
                    "eventName": ACCEPT_EVENT_NAME,
                    "correlationId": str(uuid.uuid4()),
                    "meta": {"publisher": "architect-agent"},
                    "data": {
                        "conversationId": conversation_id,
                        "content": content,
                    },
                })
                break

        return {"user_intent": "accept"}

    def _build_updates(self, state: ArchitectState, result: IntentOut) -> dict:
        updates: dict = {"user_intent": result.intent}

        if result.intent == "refine":
            for msg in reversed(state.get("raw_history", [])):
                content = msg.get("content", {})
                if isinstance(content, dict) and "epic" in content and "tickets" in content:
                    updates["prior_solution"] = content["epic"].get("solution")
                    break

        return updates
