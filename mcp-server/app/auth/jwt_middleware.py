import json
import logging
import time
import httpx
import jwt
from fastapi import Request
from fastapi.responses import JSONResponse
from app.configs.settings import settings

_JWKS_TTL = 300  # seconds


class JwtMiddleware:
    def __init__(self, logger: logging.Logger) -> None:
        self._logger = logger
        self._jwks_url = (
            f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
            "/protocol/openid-connect/certs"
        )
        self._expected_issuer = (
            f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
        )
        self._jwks_cache: list[dict] | None = None
        self._jwks_fetched_at: float = 0.0

    async def handle(self, request: Request, call_next):
        if not request.url.path.startswith("/mcp"):
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Missing or invalid Authorization header"})

        token = auth_header.removeprefix("Bearer ")

        try:
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")
        except jwt.DecodeError as e:
            return JSONResponse(status_code=401, content={"detail": f"Invalid token: {e}"})

        keys = await self._fetch_jwks()
        if keys is None:
            return JSONResponse(status_code=503, content={"detail": "Could not retrieve public keys from Keycloak"})

        matching_key = next((k for k in keys if k.get("kid") == kid), None)
        if matching_key is None:
            return JSONResponse(status_code=401, content={"detail": "No matching public key found"})

        try:
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(matching_key))
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                issuer=self._expected_issuer,
                options={"verify_aud": False},
            )
        except jwt.ExpiredSignatureError:
            return JSONResponse(status_code=401, content={"detail": "Token expired"})
        except jwt.InvalidTokenError as e:
            return JSONResponse(status_code=401, content={"detail": f"Token invalid: {e}"})

        self._logger.info(
            "JwtMiddleware.handle: JWT validated",
            extra={"issuer": payload.get("iss"), "client_id": payload.get("azp"), "path": request.url.path},
        )
        return await call_next(request)

    async def _fetch_jwks(self) -> list[dict] | None:
        if self._jwks_cache and (time.time() - self._jwks_fetched_at) < _JWKS_TTL:
            return self._jwks_cache
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(self._jwks_url)
                response.raise_for_status()
            self._jwks_cache = response.json().get("keys", [])
            self._jwks_fetched_at = time.time()
            return self._jwks_cache
        except Exception as e:
            self._logger.error(
                "JwtMiddleware._fetch_jwks: Failed to fetch JWKS from Keycloak",
                extra={"error": str(e)},
            )
            return None
