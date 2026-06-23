import uuid
from app.agent.contracts.agent_interface import ArchitectState
from app.contracts.chat_interface import EpicInterface, NodeName, ReplyInterface, RequirementInterface, SolutionInterface


class ReplyNode:
    async def __call__(self, state: ArchitectState) -> dict:
        solution = state.get("solution") or SolutionInterface(architecture="", components=[])
        tickets = state.get("tickets", [])
        requirement = state.get("requirement", "")
        prior_solution = state.get("prior_solution")

        epic_name = requirement
        epic_requirements = [RequirementInterface(requirement=requirement)]
        if prior_solution:
            epic_name, epic_requirements = self._resolve_epic_meta(state, epic_name, epic_requirements)

        epic_id = tickets[0].epicId if tickets else str(uuid.uuid4())
        epic = EpicInterface(
            id=epic_id,
            name=epic_name[:200] if epic_name else "Software Solution",
            requirements=epic_requirements,
            solution=solution,
        )

        return {"final_reply": ReplyInterface(epic=epic, tickets=tickets)}

    def _resolve_epic_meta(self, state: ArchitectState, default_name: str, default_requirements: list[RequirementInterface]) -> tuple:
        for msg in reversed(state.get("raw_history", [])):
            if msg.node == NodeName.reply and isinstance(msg.content, ReplyInterface):
                epic = msg.content.epic
                return epic.name or default_name, epic.requirements or default_requirements
        return default_name, default_requirements
