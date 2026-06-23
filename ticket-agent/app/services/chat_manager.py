from datetime import datetime, timezone
from app.contracts.chat_interface import (
    ChatInterface, MessageInterface, ChatActor, AgentStatus, FinalReplyInterface,
)


class ChatManager:
    def __init__(self, redis):
        self._redis = redis

    async def load_chat(self, key: str, conversation_id: str) -> ChatInterface:
        raw = await self._redis.get(key)
        if not raw:
            raise Exception(f"Conversation {conversation_id} not found in Redis")
        return ChatInterface.model_validate_json(raw)

    async def save_chat(self, key: str, chat_obj: ChatInterface) -> None:
        await self._redis.set(key, chat_obj.model_dump_json())

    async def append_reply_message(
        self,
        key: str,
        chat_obj: ChatInterface,
        error: str | None,
        final_reply: FinalReplyInterface | None,
    ) -> None:
        if error:
            content = f"Error creating tickets: {error}"
        elif final_reply is not None:
            content = final_reply
        else:
            content = "Ticket creation produced no result."

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
