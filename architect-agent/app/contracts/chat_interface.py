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


class FeatureInterface(BaseModel):
    feature: str


class ComponentInterface(BaseModel):
    tech: str
    features: list[FeatureInterface] = []


class SolutionInterface(BaseModel):
    architecture: str
    components: list[ComponentInterface] = []


class RequirementInterface(BaseModel):
    requirement: str


class AcceptanceCriterionInterface(BaseModel):
    criterion: str


class EpicInterface(BaseModel):
    id: str
    name: str
    requirements: list[RequirementInterface] = []
    solution: SolutionInterface


class TicketInterface(BaseModel):
    id: str
    epicId: str
    name: str
    requirements: list[RequirementInterface] = []
    acceptance_criteria: list[AcceptanceCriterionInterface] = []


class ReplyInterface(BaseModel):
    epic: EpicInterface
    tickets: list[TicketInterface] = []


class FinalReplyInterface(BaseModel):
    epicId: str
    ticketIds: list[str] = []


class MessageInterface(BaseModel):
    actor: ChatActor
    timestamp: datetime
    content: Union[str, ReplyInterface, FinalReplyInterface]
    agentStatus: Optional[AgentStatus] = None


class ChatInterface(BaseModel):
    id: str
    title: Optional[str] = None
    messages: list[MessageInterface] = []
    status: ChatStatus
    agentStatus: Optional[AgentStatus] = None


class HistoryMessage(BaseModel):
    actor: str
    content: Union[str, dict]
    agentStatus: Optional[str] = None


class ChatRequest(BaseModel):
    correlationId: str
    conversationId: str
    message: str
    history: list[HistoryMessage] = []
