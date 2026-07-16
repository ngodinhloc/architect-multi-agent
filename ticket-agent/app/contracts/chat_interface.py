from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class ChatStatus(str, Enum):
    is_active = "isActive"
    is_stopped = "isStopped"


class AgentStatus(str, Enum):
    is_thinking = "isThinking"
    has_replied = "hasReplied"


class ChatActor(str, Enum):
    user = "User"
    agent = "Agent"


class FinalReplyInterface(BaseModel):
    epicId: str
    ticketIds: list[str] = []


class MessageInterface(BaseModel):
    actor: ChatActor
    timestamp: datetime
    content: str | dict | FinalReplyInterface
    agentStatus: AgentStatus | None = None


class ChatInterface(BaseModel):
    id: str
    title: str | None = None
    messages: list[MessageInterface] = []
    status: ChatStatus
    agentStatus: AgentStatus | None = None


class TicketRequest(BaseModel):
    conversationId: str
    content: dict
