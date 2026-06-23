from pydantic import BaseModel
from app.contracts.chat_interface import MessageInterface


class ChatEventMeta(BaseModel):
    publisher: str

class ChatEventData(BaseModel):
    conversationId: str
    message: str
    history: list[MessageInterface] = []

class ChatEvent(BaseModel):
    eventName: str
    correlationId: str
    meta: ChatEventMeta
    data: ChatEventData
