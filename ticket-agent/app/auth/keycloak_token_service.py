import time
import logging
import httpx
from app.configs.settings import settings

logger = logging.getLogger("keycloak_token_service")

_REFRESH_BUFFER_SECONDS = 30


class KeycloakTokenService:
    def __init__(self) -> None:
        self._token_url = (
            f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
            "/protocol/openid-connect/token"
        )
        self._client_id = settings.keycloak_client_id
        self._client_secret = settings.keycloak_client_secret
        self._access_token: str | None = None
        self._expires_at: float = 0.0

    async def get_token(self) -> str:
        if self._access_token and time.time() < self._expires_at - _REFRESH_BUFFER_SECONDS:
            return self._access_token
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                self._token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                },
            )
            resp.raise_for_status()
        data = resp.json()
        self._access_token = data["access_token"]
        self._expires_at = time.time() + data["expires_in"]
        logger.info(
            "KeycloakTokenService.get_token: Token acquired",
            extra={"client_id": self._client_id, "expires_in": data["expires_in"]},
        )
        return self._access_token
