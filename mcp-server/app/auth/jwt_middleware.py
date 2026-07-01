import logging
import time
import httpx
import jwt
from fastapi import Request
from fastapi.responses import JSONResponse
from app.configs.settings import Settings

_JWKS_TTL = 300  # seconds


class JwtMiddleware:
    def __init__(self, settings: Settings, logger: logging.Logger) -> None:
        self._settings = settings
        self._logger = logger
        self._jwks_cache: dict[str, dict] = {}

    async def handle(self, request: Request, call_next):
        if not request.url.path.startswith("/mcp"):
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Missing or invalid Authorization header"})

        token = auth_header.removeprefix("Bearer ")

        try:
            unverified_header = jwt.get_unverified_header(token)
            unverified_payload = jwt.decode(token, options={"verify_signature": False})
        except jwt.DecodeError as e:
            return JSONResponse(status_code=401, content={"detail": f"Invalid token: {e}"})

        issuer = unverified_payload.get("iss")
        kid = unverified_header.get("kid")

        if issuer not in self._settings.whitelisted_hosts_list:
            self._logger.warning("JwtMiddleware.handle: Issuer not whitelisted", extra={"issuer": issuer})
            return JSONResponse(status_code=403, content={"detail": "Issuer not authorized"})

        keys = await self._fetch_jwks(issuer)
        if keys is None:
            return JSONResponse(status_code=401, content={"detail": "Could not retrieve public key"})

        matching_key = next((k for k in keys if k.get("kid") == kid), None)
        if matching_key is None:
            return JSONResponse(status_code=401, content={"detail": "No matching public key found"})

        try:
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(matching_key)
            jwt.decode(token, public_key, algorithms=["RS256"], audience=self._settings.provider_host)
        except jwt.ExpiredSignatureError:
            return JSONResponse(status_code=401, content={"detail": "Token expired"})
        except jwt.InvalidTokenError as e:
            return JSONResponse(status_code=401, content={"detail": f"Token invalid: {e}"})

        self._logger.info(
            "JwtMiddleware.handle: JWT validated",
            extra={"issuer": issuer, "kid": kid, "path": request.url.path},
        )
        return await call_next(request)

    async def _fetch_jwks(self, issuer: str) -> list[dict] | None:
        cached = self._jwks_cache.get(issuer)
        if cached and (time.time() - cached["fetched_at"]) < _JWKS_TTL:
            return cached["keys"]
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{issuer}/api/.well-known/jwks")
                response.raise_for_status()
                keys = response.json().get("keys", [])
                self._jwks_cache[issuer] = {"keys": keys, "fetched_at": time.time()}
                return keys
        except Exception as e:
            self._logger.error("JwtMiddleware._fetch_jwks: Failed to fetch JWKS", extra={"issuer": issuer, "error": str(e)})
            return None
