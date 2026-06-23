from langchain_anthropic import ChatAnthropic
from langgraph.graph import StateGraph, START, END
from app.agent.contracts.agent_interface import ArchitectState
from app.contracts.chat_interface import UserIntent, NodeName
from app.agent.nodes.intent_node import IntentNode
from app.agent.nodes.solution_node import SolutionNode
from app.agent.nodes.solution_review_node import SolutionReviewNode
from app.agent.nodes.plan_node import PlanNode
from app.agent.nodes.plan_review_node import PlanReviewNode
from app.agent.nodes.reply_node import ReplyNode
from app.events.rabbitmq_publisher import RabbitMQPublisher


# ┌──────────────────────────────────────────────────────────────────┐
# │                        ArchitectGraph                            │
# │                                                                  │
# │  START                                                           │
# │    │                                                             │
# │    ▼                                                             │
# │  intent_node                                                     │
# │    │                                                             │
# │    ├──[plan / refine]───────────────────────────────────────┐    │
# │    │                                                        ▼    │
# │    │                                           ┌─► solution_node │
# │    │                                           │            │    │
# │    │                                           │            ▼    │
# │    │                                           │ solution_review  │
# │    │                                  [rejected]│   │[approved]  │
# │    │                                           └───┘     │      │
# │    │                                                      ▼      │
# │    │                                           ┌─► plan_node     │
# │    │                                           │        │        │
# │    │                                           │        ▼        │
# │    │                                  [rejected]│ plan_review    │
# │    │                                           └───┘    │[approved]
# │    │                                                     ▼       │
# │    │                                               reply_node    │
# │    │                                                     │       │
# │    │                                                     ▼       │
# │    │                                                    END      │
# │    │                                                             │
# │    └──[accept]──► publishes to architecture-agent.accept ──► END │
# └──────────────────────────────────────────────────────────────────┘


class ArchitectGraph:
    def __init__(self, llm: ChatAnthropic, publisher: RabbitMQPublisher):
        self._llm = llm
        self._publisher = publisher

    def build(self):
        graph = StateGraph(ArchitectState)

        graph.add_node(NodeName.intent, IntentNode(self._llm, self._publisher))
        graph.add_node(NodeName.solution, SolutionNode(self._llm))
        graph.add_node(NodeName.solution_review, SolutionReviewNode(self._llm))
        graph.add_node(NodeName.plan, PlanNode(self._llm))
        graph.add_node(NodeName.plan_review, PlanReviewNode(self._llm))
        graph.add_node(NodeName.reply, ReplyNode())

        graph.add_edge(START, NodeName.intent)

        graph.add_conditional_edges(
            NodeName.intent,
            self._route_intent,
            {"accept": END, "plan": NodeName.solution, "refine": NodeName.solution},
        )

        graph.add_edge(NodeName.solution, NodeName.solution_review)
        graph.add_conditional_edges(
            NodeName.solution_review,
            self._route_solution_review,
            {"approved": NodeName.plan, "rejected": NodeName.solution},
        )

        graph.add_edge(NodeName.plan, NodeName.plan_review)
        graph.add_conditional_edges(
            NodeName.plan_review,
            self._route_plan_review,
            {"approved": NodeName.reply, "rejected": NodeName.plan},
        )

        graph.add_edge(NodeName.reply, END)

        return graph.compile()

    @staticmethod
    def _route_intent(state: ArchitectState) -> str:
        return state.get("user_intent", UserIntent.plan)

    @staticmethod
    def _route_solution_review(state: ArchitectState) -> str:
        return "approved" if state.get("solution_approved") else "rejected"

    @staticmethod
    def _route_plan_review(state: ArchitectState) -> str:
        return "approved" if state.get("tickets_approved") else "rejected"

