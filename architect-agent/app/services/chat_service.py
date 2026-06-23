import json
import logging
from langchain_core.messages import HumanMessage
from langgraph.graph.state import CompiledStateGraph
from app.contracts.chat_interface import (
    ChatRequest, ReplyInterface, FinalReplyInterface,
)
from app.services.chat_manager import ChatManager
from app.services.redis_helper import RedisHelper


class ChatService:
    def __init__(self, agent_graph: CompiledStateGraph, chat_manager: ChatManager, logger: logging.Logger):
        self._graph = agent_graph
        self._logger = logger
        self._message_manager = chat_manager

    async def execute(self, request: ChatRequest) -> None:
        key = RedisHelper.chat_key(request.conversationId)
        chat_obj = await self._message_manager.load_chat(key, request.conversationId)

        raw_history = [m.model_dump() for m in request.history]

        self._logger.info(
            "Starting graph | correlationId=%s | conversation=%s | message=%r | history=%s",
            request.correlationId,
            request.conversationId,
            request.message,
            json.dumps(raw_history, default=str),
        )

        initial_state = {
            "messages": [HumanMessage(content=request.message)],
            "conversation_id": request.conversationId,
            "requirement": request.message,
            "raw_history": raw_history,
        }

        final_reply = None
        user_intent: str | None = None
        error: str | None = None

        try:
            async for update in self._graph.astream(initial_state, stream_mode="updates"):
                for node_name, node_output in update.items():
                    self._logger.info(
                        "Node completed | node=%s | output=%s",
                        node_name,
                        json.dumps(node_output, default=str),
                    )
                    if node_name == "intent_node":
                        user_intent = node_output.get("user_intent")
                    self._message_manager.append_thinking_message(chat_obj, node_name, node_output)
                    await self._message_manager.save_chat(key, chat_obj)

                    if node_output.get("final_reply") is not None:
                        final_reply = node_output["final_reply"]
        except Exception as e:
            error = str(e)
            self._logger.exception("Graph error for conversation %s", request.conversationId)

        # On accept, ticket-agent will publish the final reply and set hasReplied in Redis
        if user_intent == "accept" and not error:
            return

        parsed_reply = self._parse_reply(final_reply)
        await self._message_manager.append_reply_message(key, chat_obj, error, parsed_reply)

    @staticmethod
    def _parse_reply(raw: dict | None) -> ReplyInterface | FinalReplyInterface | None:
        if raw is None:
            return None
        if "epicId" in raw:
            return FinalReplyInterface(**raw)
        if "epic" in raw and "tickets" in raw:
            return ReplyInterface(**raw)
        return None
