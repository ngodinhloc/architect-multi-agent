from typing import Protocol
from app.events.contracts.event_interface import AcceptEvent


class EventHandlerInterface(Protocol):
    async def handle(self, event: AcceptEvent) -> None: ...
