from enum import Enum
from datetime import datetime
from typing import Optional, Union
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
    content: Union[str, dict, FinalReplyInterface]
    agentStatus: Optional[AgentStatus] = None


class ChatInterface(BaseModel):
    id: str
    title: Optional[str] = None
    messages: list[MessageInterface] = []
    status: ChatStatus
    agentStatus: Optional[AgentStatus] = None


class TicketRequest(BaseModel):
    correlationId: str
    conversationId: str
    content: dict
