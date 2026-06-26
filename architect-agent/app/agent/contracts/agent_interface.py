from langgraph.graph import MessagesState
from app.contracts.chat_interface import MessageInterface, SolutionInterface, TicketInterface, ReplyInterface, UserIntent


class ArchitectState(MessagesState):
    conversation_id: str = ""
    requirement: str = ""
    raw_history: list[MessageInterface] = []
    user_intent: UserIntent = UserIntent.plan
    comment: str | None = None
    prior_solution: SolutionInterface | None = None
    solution: SolutionInterface | None = None
    solution_review_comments: list[str] = []
    solution_approved: bool = False
    tickets: list[TicketInterface] = []
    ticket_review_comments: list[str] = []
    tickets_approved: bool = False
    final_reply: ReplyInterface | None = None
