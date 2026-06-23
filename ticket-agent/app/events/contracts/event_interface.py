from pydantic import BaseModel


class AcceptEventMeta(BaseModel):
    publisher: str


class AcceptEventData(BaseModel):
    conversationId: str
    content: dict


class AcceptEvent(BaseModel):
    eventName: str
    correlationId: str
    meta: AcceptEventMeta
    data: AcceptEventData
