import json
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage

from app.agent.contracts.agent_interface import ArchitectState
from app.agent.schemas.plan_review_schema import PlanReviewOut
from app.agent.templates.plan_review_templates import PLAN_REVIEW_PERSONA, PLAN_REVIEW_PROMPT


class PlanReviewNode:
    def __init__(self, llm: ChatAnthropic):
        self._llm = llm.with_structured_output(PlanReviewOut)

    async def __call__(self, state: ArchitectState) -> dict:
        solution = state.get("solution")
        tickets = state.get("tickets", [])

        prompt = PLAN_REVIEW_PROMPT.format(
            solution=json.dumps(solution.model_dump() if solution else {}, indent=2),
            tickets=json.dumps([t.model_dump() for t in tickets], indent=2),
        )
        result: PlanReviewOut = await self._llm.ainvoke([SystemMessage(content=PLAN_REVIEW_PERSONA), HumanMessage(content=prompt)])

        return {
            "tickets_approved": result.approved,
            "ticket_review_comments": result.comments if not result.approved else [],
        }
