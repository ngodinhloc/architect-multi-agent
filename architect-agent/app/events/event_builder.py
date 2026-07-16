from app.contracts.chat_interface import MessageInterface
from app.events.contracts.event_interface import ChatEvent, ChatEventData, ChatEventMeta


class EventBuilder:
    @staticmethod
    def build(payload: dict) -> ChatEvent:
        data = payload["data"]
        return ChatEvent(
            eventName=payload["eventName"],
            meta=ChatEventMeta(**payload["meta"]),
            data=ChatEventData(
                conversationId=data["conversationId"],
                message=data["message"],
                history=[MessageInterface(**m) for m in data.get("history", [])],
            ),
        )
