import logging
import json
from langchain_core.messages import HumanMessage
from app.contracts.chat_interface import TicketRequest, FinalReplyInterface
from app.services.chat_manager import ChatManager
from app.services.redis_helper import RedisHelper


class TicketService:
    def __init__(self, ticket_graph, chat_manager: ChatManager, logger: logging.Logger):
        self._graph = ticket_graph
        self._chat_manager = chat_manager
        self._logger = logger

    async def execute(self, request: TicketRequest) -> None:
        key = RedisHelper.chat_key(request.conversationId)
        chat_obj = await self._chat_manager.load_chat(key, request.conversationId)

        prompt = f"Process this architect plan and create the appropriate items:\n{json.dumps(request.content, default=str)}"
        initial_state = {"messages": [HumanMessage(content=prompt)]}

        final_state = None
        error: str | None = None

        try:
            async for state in self._graph.astream(initial_state, stream_mode="values"):
                final_state = state
                last = state["messages"][-1]
                self._logger.info(
                    "Agent step | type=%s | conversation=%s",
                    type(last).__name__,
                    request.conversationId,
                )
        except Exception as e:
            error = str(e)
            self._logger.exception("Ticket agent error for conversation %s", request.conversationId)

        parsed_reply = self._extract_reply(final_state) if final_state else None
        await self._chat_manager.append_reply_message(key, chat_obj, error, parsed_reply)

    def _extract_reply(self, state: dict) -> FinalReplyInterface | None:
        extract_out = state.get("extract_out")
        if not extract_out:
            return None
        return FinalReplyInterface(epicId=extract_out.epicId, ticketIds=extract_out.ticketIds)
