import logging
from app.contracts.chat_interface import TicketRequest
from app.events.contracts.event_interface import AcceptEvent
from app.services.ticket_service import TicketService


class AcceptEventHandler:
    def __init__(self, ticket_service: TicketService, logger: logging.Logger):
        self._ticket_service = ticket_service
        self._logger = logger

    async def handle(self, event: AcceptEvent) -> None:
        self._logger.info(
            "AcceptEventHandler.handle: Received accept event",
            extra={"conversationId": event.data.conversationId, "content": event.data.content},
        )
        request = TicketRequest(
            conversationId=event.data.conversationId,
            content=event.data.content,
        )
        await self._ticket_service.execute(request)
