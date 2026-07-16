from langgraph.graph import MessagesState

from app.agent.schemas.extract_node_schemas import ExtractOut


class TicketState(MessagesState):
    extract_out: ExtractOut | None = None
