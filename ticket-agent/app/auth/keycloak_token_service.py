import asyncio
import time
import uuid
import logging
import httpx
import jwt
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from app.configs.settings import settings

logger = logging.getLogger("keycloak_token_service")

_REFRESH_BUFFER_SECONDS = 30
_CLIENT_ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"


class KeycloakTokenService:
    def __init__(self) -> None:
        self._token_url = (
            f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
            "/protocol/openid-connect/token"
        )
        self._client_id = settings.keycloak_client_id
        pem = settings.private_key_pem.replace("\\n", "\n").encode()
        self._private_key = load_pem_private_key(pem, password=None)
        self._access_token: str | None = None
        self._expires_at: float = 0.0
        self._lock = asyncio.Lock()

    async def get_token(self) -> str:
        now = time.time()
        if self._access_token and now < self._expires_at - _REFRESH_BUFFER_SECONDS:
            logger.debug(
                "KeycloakTokenService.get_token: Serving cached token",
                extra={"client_id": self._client_id, "ttl_seconds": int(self._expires_at - now)},
            )
            return self._access_token
        async with self._lock:
            # Re-check inside lock — another coroutine may have refreshed while we waited
            now = time.time()
            if self._access_token and now < self._expires_at - _REFRESH_BUFFER_SECONDS:
                return self._access_token
            assertion = self._build_assertion()
            response = await self._request_token(assertion)
            self._access_token = response["access_token"]
            self._expires_at = time.time() + response["expires_in"]
            logger.info(
                "KeycloakTokenService.get_token: Token acquired",
                extra={"client_id": self._client_id, "expires_in": response["expires_in"], "token_url": self._token_url},
            )
            return self._access_token

    async def _request_token(self, assertion: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                self._token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._client_id,
                    "client_assertion_type": _CLIENT_ASSERTION_TYPE,
                    "client_assertion": assertion,
                },
            )
            resp.raise_for_status()
        return resp.json()

    def _build_assertion(self) -> str:
        now = int(time.time())
        payload = {
            "iss": self._client_id,
            "sub": self._client_id,
            "aud": self._token_url,
            "jti": str(uuid.uuid4()),
            "iat": now,
            "exp": now + 1800,
        }
        return jwt.encode(payload, self._private_key, algorithm="RS256")
