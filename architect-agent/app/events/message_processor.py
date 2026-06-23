import json
import logging
from app.configs.event_configs import EventHandlerMap
from app.events.event_builder import EventBuilder
from app.events.contracts.consumer_message import RabbitMqMessage


class MessageProcessor:
    def __init__(self, handler_map: EventHandlerMap, logger: logging.Logger):
        self._handler_map = handler_map
        self._logger = logger

    async def process(self, message: RabbitMqMessage) -> None:
        try:
            payload = json.loads(message.body)
            event_name = payload.get("eventName")
            handler = self._handler_map.get(event_name)
            if handler is None:
                self._logger.warning("No handler registered for eventName: %s", event_name)
                return
            event = EventBuilder.build(payload)
            await handler.handle(event)
        except Exception:
            self._logger.exception("Failed to process message: %s", message.body)
