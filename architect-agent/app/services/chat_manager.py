from datetime import datetime, timezone
from fastapi import HTTPException
from app.contracts.chat_interface import (
    ChatInterface, MessageInterface, ChatActor, AgentStatus,
    ReplyInterface, FinalReplyInterface,
)


class ChatManager:
    def __init__(self, redis):
        self._redis = redis

    async def load_chat(self, key: str, conversation_id: str) -> ChatInterface:
        raw = await self._redis.get(key)
        if not raw:
            raise HTTPException(status_code=404, detail=f"Conversation {conversation_id} not found")
        chat_obj = ChatInterface.model_validate_json(raw)
        chat_obj.agentStatus = AgentStatus.is_thinking
        await self._redis.set(key, chat_obj.model_dump_json())
        return chat_obj

    async def save_chat(self, key: str, chat_obj: ChatInterface) -> None:
        await self._redis.set(key, chat_obj.model_dump_json())

    _DESIGN_LABEL = "Designing solution architecture..."
    _PLAN_LABEL = "Planning development tickets..."

    def append_thinking_message(self, chat_obj: ChatInterface, node_name: str, node_output: dict = {}) -> None:
        if node_name == "solution_review_node":
            self._append_review(
                chat_obj,
                review_label="Reviewing solution architecture...",
                approved=node_output.get("solution_approved", False),
                comments=node_output.get("solution_review_comments", []),
            )
            return

        if node_name == "plan_review_node":
            self._append_review(
                chat_obj,
                review_label="Reviewing development tickets...",
                approved=node_output.get("tickets_approved", False),
                comments=node_output.get("ticket_review_comments", []),
            )
            return

        label = self._build_label(node_name, node_output)
        if label:
            chat_obj.messages.append(
                MessageInterface(
                    actor=ChatActor.agent,
                    content=label,
                    timestamp=datetime.now(timezone.utc),
                    agentStatus=AgentStatus.is_thinking,
                )
            )

    def _append_review(self, chat_obj: ChatInterface, review_label: str, approved: bool, comments: list[str]) -> None:
        status = "Approved" if approved else "Needs revision"
        content = f"{review_label} → Result: {status}"
        if comments:
            content += "\nComments:\n" + "\n".join(f"- {c}" for c in comments)
        chat_obj.messages.append(
            MessageInterface(
                actor=ChatActor.agent,
                content=content,
                timestamp=datetime.now(timezone.utc),
                agentStatus=AgentStatus.is_thinking,
            )
        )

    @staticmethod
    def _build_label(node_name: str, node_output: dict) -> str | None:
        if node_name == "intent_node":
            intent = node_output.get("user_intent", "plan")
            return f"Analyzing your request... → Intention: {intent.capitalize()}"

        return {
            "solution_node": "Designing solution architecture...",
            "plan_node": "Planning development tickets...",
            "reply_node": "Preparing response...",
        }.get(node_name)

    async def append_reply_message(
        self, key: str, chat_obj: ChatInterface, error: str | None,
        final_reply: ReplyInterface | FinalReplyInterface | None,
    ) -> None:
        if error:
            content: str | ReplyInterface | FinalReplyInterface = f"Error: {error}"
        elif final_reply is not None:
            content = final_reply
        else:
            content = "No response generated."

        chat_obj.messages.append(
            MessageInterface(
                actor=ChatActor.agent,
                content=content,
                timestamp=datetime.now(timezone.utc),
                agentStatus=AgentStatus.has_replied,
            )
        )
        chat_obj.agentStatus = AgentStatus.has_replied
        await self._redis.set(key, chat_obj.model_dump_json())
