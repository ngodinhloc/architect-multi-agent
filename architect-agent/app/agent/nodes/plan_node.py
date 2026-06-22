import json
import uuid
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage

from app.agent.contracts.agent_interface import ArchitectState
from app.agent.schemas.plan_schema import PlanOut
from app.agent.templates.plan_templates import PLAN_PERSONA, PLAN_PROMPT, PLAN_PROMPT_REVISE


class PlanNode:
    def __init__(self, llm: ChatAnthropic):
        self._llm = llm.with_structured_output(PlanOut)

    async def __call__(self, state: ArchitectState) -> dict:
        requirement = state.get("requirement", "")
        solution = state.get("solution", {})
        comments = state.get("ticket_review_comments", [])

        solution_json = json.dumps(solution, indent=2)
        if comments:
            prompt = PLAN_PROMPT_REVISE.format(
                requirement=requirement,
                solution=solution_json,
                comments="\n".join(f"- {c}" for c in comments),
            )
        else:
            prompt = PLAN_PROMPT.format(requirement=requirement, solution=solution_json)

        result: PlanOut = await self._llm.ainvoke([SystemMessage(content=PLAN_PERSONA), HumanMessage(content=prompt)])

        return {"tickets": self._build_tickets(result), "tickets_approved": False}

    def _build_tickets(self, result: PlanOut) -> list:
        epic_id = str(uuid.uuid4())
        return [
            {
                "id": str(uuid.uuid4()),
                "epicId": epic_id,
                "name": t.name,
                "requirements": [r.model_dump() for r in t.requirements],
                "acceptance_criteria": [a.model_dump() for a in t.acceptance_criteria],
            }
            for t in result.tickets
        ]
