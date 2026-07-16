from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.agent.contracts.agent_interface import ArchitectState
from app.agent.schemas.intent_schema import IntentOut
from app.agent.templates.intent_templates import INTENT_PERSONA, INTENT_PROMPT
from app.contracts.chat_interface import (
    MessageInterface,
    NodeName,
    ReplyInterface,
    SolutionInterface,
    UserIntent,
)
from app.events.rabbitmq_publisher import RabbitMQPublisher
from app.metrics import llm_requests

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

        # Check if there is a prior plan by reply_node in the conversation history
        has_prior_plan = any(m.node == NodeName.reply for m in state.get("raw_history", []))

        prompt = INTENT_PROMPT.format(user_text=user_text, has_prior_plan=has_prior_plan)
        result: IntentOut = await self._llm.ainvoke(
            [SystemMessage(content=INTENT_PERSONA), HumanMessage(content=prompt)]
        )

        # increment the llm_requests metric
        llm_requests.labels(node="intent").inc()

        match result.intent:
            case UserIntent.undefined:
                comment = (
                    result.comment
                    or "I can help you plan software architecture. Could you describe a requirement or system you'd like to build?"
                )
                return {"user_intent": UserIntent.undefined, "comment": comment}
            case UserIntent.plan:
                return {"user_intent": UserIntent.plan}
            case UserIntent.refine:
                return self._handle_refine(state)
            case UserIntent.accept:
                return await self._handle_accept(state)

    def _handle_refine(self, state: ArchitectState) -> dict:
        prior_solution: SolutionInterface | None = None
        for msg in reversed(state.get("raw_history", [])):
            if msg.node == NodeName.reply and isinstance(msg.content, ReplyInterface):
                prior_solution = msg.content.epic.solution
                break

        return {"user_intent": UserIntent.refine, "prior_solution": prior_solution}

    async def _handle_accept(self, state: ArchitectState) -> dict:
        for msg in reversed(state.get("raw_history", [])):
            if msg.node == NodeName.reply and isinstance(msg.content, ReplyInterface):
                await self._publisher.publish(
                    ACCEPT_EVENT_NAME, self._build_accept_event(state, msg)
                )
                break

        return {"user_intent": UserIntent.accept}

    def _build_accept_event(self, state: ArchitectState, msg: MessageInterface) -> dict:
        return {
            "eventName": ACCEPT_EVENT_NAME,
            "meta": {"publisher": "architect-agent"},
            "data": {
                "conversationId": state.get("conversation_id", ""),
                "content": msg.content.model_dump(),
            },
        }
