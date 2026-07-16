from app.events.contracts.event_interface import AcceptEvent, AcceptEventData, AcceptEventMeta


class EventBuilder:
    @staticmethod
    def build(payload: dict) -> AcceptEvent:
        data = payload["data"]
        return AcceptEvent(
            eventName=payload["eventName"],
            meta=AcceptEventMeta(**payload["meta"]),
            data=AcceptEventData(
                conversationId=data["conversationId"],
                content=data["content"],
            ),
        )
