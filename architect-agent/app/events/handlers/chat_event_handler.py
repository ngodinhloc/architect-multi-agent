import logging
from app.services.chat_service import ChatService
from app.contracts.chat_interface import ChatRequest
from app.events.contracts.event_interface import ChatEvent


class ChatEventHandler:
    def __init__(self, chat_service: ChatService, logger: logging.Logger):
        self._chat_service = chat_service
        self._logger = logger

    async def handle(self, event: ChatEvent) -> None:
        self._logger.info(
            "ChatEventHandler.handle: Received chat event",
            extra={
                "conversationId": event.data.conversationId,
                "historyLength": len(event.data.history),
            },
        )
        request = ChatRequest(
            conversationId=event.data.conversationId,
            message=event.data.message,
            history=event.data.history,
        )
        await self._chat_service.execute(request)
