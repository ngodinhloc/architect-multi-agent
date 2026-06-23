from app.events.contracts.event_interface import AcceptEvent, AcceptEventMeta, AcceptEventData


class EventBuilder:
    @staticmethod
    def build(payload: dict) -> AcceptEvent:
        data = payload["data"]
        return AcceptEvent(
            eventName=payload["eventName"],
            correlationId=payload["correlationId"],
            meta=AcceptEventMeta(**payload["meta"]),
            data=AcceptEventData(
                conversationId=data["conversationId"],
                content=data["content"],
            ),
        )
