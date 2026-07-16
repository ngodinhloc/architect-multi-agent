import json
import logging

from app.configs.event_configs import EventHandlerMap
from app.events.contracts.consumer_message import RabbitMqMessage
from app.events.event_builder import EventBuilder


class MessageProcessor:
    def __init__(self, handler_map: EventHandlerMap, logger: logging.Logger):
        self._handler_map = handler_map
        self._logger = logger

    async def process(self, message: RabbitMqMessage) -> None:
        event_name, conversation_id, payload = self._parse_message(message)
        if payload is None or conversation_id is None or event_name is None:
            self._logger.warning(
                "MessageProcessor.process: Invalid message, missing required fields",
                extra={
                    "conversationId": conversation_id,
                    "eventName": event_name,
                    "hasPayload": payload is not None,
                },
            )
            return

        try:
            handler = self._handler_map.get(event_name)
            if handler is None:
                self._logger.warning(
                    "MessageProcessor.process: No handler registered",
                    extra={"conversationId": conversation_id, "eventName": event_name},
                )
                return
            event = EventBuilder.build(payload)
            await handler.handle(event)
        except Exception as e:
            self._logger.exception(
                "MessageProcessor.process: Failed to process message",
                extra={"conversationId": conversation_id, "eventName": event_name, "error": str(e)},
            )

    def _parse_message(
        self, message: RabbitMqMessage
    ) -> tuple[str | None, str | None, dict | None]:
        try:
            payload = json.loads(message.body)
            event_name = payload.get("eventName")
            conversation_id = payload.get("data", {}).get("conversationId")
            return event_name, conversation_id, payload
        except Exception as e:
            self._logger.exception(
                "MessageProcessor._parse_message: Failed to parse message", extra={"error": str(e)}
            )
            return None, None, None
