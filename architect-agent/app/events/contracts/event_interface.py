from pydantic import BaseModel
from app.contracts.chat_interface import HistoryMessage


class ChatEventMeta(BaseModel):
    publisher: str

class ChatEventData(BaseModel):
    conversationId: str
    message: str
    history: list[HistoryMessage] = []

class ChatEvent(BaseModel):
    eventName: str
    correlationId: str
    meta: ChatEventMeta
    data: ChatEventData
