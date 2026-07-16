from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.agent.contracts.agent_interface import ArchitectState
from app.agent.schemas.solution_schema import SolutionOut
from app.agent.templates.solution_templates import (
    SOLUTION_PERSONA,
    SOLUTION_PROMPT_NEW,
    SOLUTION_PROMPT_REFINE,
    SOLUTION_PROMPT_REVISE,
)
from app.contracts.chat_interface import SolutionInterface
from app.metrics import llm_requests


class SolutionNode:
    def __init__(self, llm: ChatAnthropic):
        self._llm = llm.with_structured_output(SolutionOut)

    async def __call__(self, state: ArchitectState) -> dict:
        prompt = self._build_prompt(state)
        result: SolutionOut = await self._llm.ainvoke(
            [SystemMessage(content=SOLUTION_PERSONA), HumanMessage(content=prompt)]
        )
        # increment the llm_requests metric for the solution node
        llm_requests.labels(node="solution").inc()

        return {"solution": SolutionInterface(**result.model_dump()), "solution_approved": False}

    def _build_prompt(self, state: ArchitectState) -> str:
        requirement = state.get("requirement", "")
        solution_approved = state.get("solution_review_approved", False)
        prior_solution: SolutionInterface | None = state.get("prior_solution")

        # If the solution has not been approved, we want to ask for a revision based on the current solution and any review comments.
        # If there is a prior solution, we want to ask for a refinement.
        # Otherwise, we want to ask for a new solution based on the requirement.
        if not solution_approved:
            current_solution = state.get("solution")
            review_comments = state.get("solution_review_comments", [])
            return SOLUTION_PROMPT_REVISE.format(
                requirement=requirement,
                current_solution=current_solution.model_dump_json(indent=2)
                if current_solution
                else "{}",
                comments="\n".join(f"- {c}" for c in review_comments),
            )

        if prior_solution:
            return SOLUTION_PROMPT_REFINE.format(
                requirement=requirement,
                prior_solution=prior_solution.model_dump_json(indent=2),
            )

        return SOLUTION_PROMPT_NEW.format(requirement=requirement)
