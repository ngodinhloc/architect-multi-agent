import json
import logging
from app.configs.event_configs import EventHandlerMap
from app.events.event_builder import EventBuilder
from app.events.contracts.consumer_message import ConsumerMessage


class MessageProcessor:
    def __init__(self, handler_map: EventHandlerMap, logger: logging.Logger):
        self._handler_map = handler_map
        self._logger = logger

    async def process(self, message: ConsumerMessage) -> None:
        try:
            payload = json.loads(message.body)
            event_name = payload.get("eventName")
            conversation_id = payload.get("data", {}).get("conversationId")
            handler = self._handler_map.get(event_name)
            if handler is None:
                self._logger.warning(
                    "MessageProcessor.process: No handler registered",
                    extra={"conversationId": conversation_id, "eventName": event_name},
                )
                return
            event = EventBuilder.build(payload)
            await handler.handle(event)
        except Exception:
            self._logger.exception("MessageProcessor.process: Failed to process message")
