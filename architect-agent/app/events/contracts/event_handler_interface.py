from typing import Protocol
from app.events.contracts.event_interface import ChatEvent


class EventHandlerInterface(Protocol):
    async def handle(self, event: ChatEvent) -> None: ...
