import httpx
from app.auth.keycloak_token_service import KeycloakTokenService
from app.configs.settings import settings


class EpicTool:
    def __init__(self, keycloak_token_service: KeycloakTokenService) -> None:
        self._keycloak_token_service = keycloak_token_service

    async def create(self, epic: dict) -> dict:
        token = await self._keycloak_token_service.get_token()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.ticket_service_url}/api/epic/",
                json=epic,
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            return resp.json()
