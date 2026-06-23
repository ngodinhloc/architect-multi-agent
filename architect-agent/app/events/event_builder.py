from app.contracts.chat_interface import MessageInterface
from app.events.contracts.event_interface import ChatEvent, ChatEventMeta, ChatEventData


class EventBuilder:
    @staticmethod
    def build(payload: dict) -> ChatEvent:
        data = payload["data"]
        return ChatEvent(
            eventName=payload["eventName"],
            correlationId=payload["correlationId"],
            meta=ChatEventMeta(**payload["meta"]),
            data=ChatEventData(
                conversationId=data["conversationId"],
                message=data["message"],
                history=[MessageInterface(**m) for m in data.get("history", [])],
            ),
        )
