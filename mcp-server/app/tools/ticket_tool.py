import httpx
from app.auth.jwt_service import JwtService
from app.configs.settings import settings


class TicketTool:
    def __init__(self, jwt_service: JwtService) -> None:
        self._jwt_service = jwt_service

    async def create(self, ticket: dict) -> dict:
        token = self._jwt_service.sign()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.ticket_service_url}/api/ticket/",
                json=ticket,
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            return resp.json()
