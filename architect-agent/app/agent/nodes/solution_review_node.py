import json
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage

from app.agent.contracts.agent_interface import ArchitectState
from app.agent.schemas.solution_review_schema import SolutionReviewOut
from app.agent.templates.solution_review_templates import SOLUTION_REVIEW_PERSONA, SOLUTION_REVIEW_PROMPT
from app.metrics import llm_requests


class SolutionReviewNode:
    def __init__(self, llm: ChatAnthropic):
        self._llm = llm.with_structured_output(SolutionReviewOut)

    async def __call__(self, state: ArchitectState) -> dict:
        requirement = state.get("requirement", "")
        solution = state.get("solution")

        prompt = SOLUTION_REVIEW_PROMPT.format(requirement=requirement, solution=json.dumps(solution.model_dump() if solution else {}, indent=2))
        llm_requests.labels(node="solution_review").inc()
        result: SolutionReviewOut = await self._llm.ainvoke([SystemMessage(content=SOLUTION_REVIEW_PERSONA), HumanMessage(content=prompt)])

        return {
            "solution_approved": result.approved,
            "solution_review_comments": result.comments if not result.approved else [],
        }
