import json
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage

from app.agent.contracts.agent_interface import ArchitectState
from app.agent.schemas.solution_schema import SolutionOut
from app.agent.templates.solution_templates import SOLUTION_PERSONA, SOLUTION_PROMPT_NEW, SOLUTION_PROMPT_REFINE, SOLUTION_PROMPT_REVISE
from app.contracts.chat_interface import SolutionInterface


class SolutionNode:
    def __init__(self, llm: ChatAnthropic):
        self._llm = llm.with_structured_output(SolutionOut)

    async def __call__(self, state: ArchitectState) -> dict:
        requirement = state.get("requirement", "")
        comments = state.get("solution_review_comments", [])
        prior_solution = state.get("prior_solution")

        prompt = self._build_prompt(state, requirement, comments, prior_solution)
        result: SolutionOut = await self._llm.ainvoke([SystemMessage(content=SOLUTION_PERSONA), HumanMessage(content=prompt)])
        return {"solution": SolutionInterface(**result.model_dump()), "solution_approved": False}

    def _build_prompt(self, state: ArchitectState, requirement: str, comments: list, prior_solution: SolutionInterface | None) -> str:
        if comments:
            current = state.get("solution")
            return SOLUTION_PROMPT_REVISE.format(
                requirement=requirement,
                current_solution=json.dumps(current.model_dump() if current else {}, indent=2),
                comments="\n".join(f"- {c}" for c in comments),
            )
        if prior_solution:
            return SOLUTION_PROMPT_REFINE.format(
                requirement=requirement,
                prior_solution=json.dumps(prior_solution.model_dump(), indent=2),
            )
        return SOLUTION_PROMPT_NEW.format(requirement=requirement)
