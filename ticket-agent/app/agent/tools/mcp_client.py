import json
import logging
import httpx
from fastmcp import Client
from mcp.types import TextContent
from app.auth.keycloak_token_service import KeycloakTokenService

logger = logging.getLogger("mcp_tools")


class _BearerAuth(httpx.Auth):
    def __init__(self, token: str) -> None:
        self._token = token

    def auth_flow(self, request: httpx.Request):
        request.headers["Authorization"] = f"Bearer {self._token}"
        yield request


class McpClient:
    def __init__(self, mcp_server_url: str, keycloak_token_service: KeycloakTokenService):
        self._url = f"{mcp_server_url}/mcp/"
        self._keycloak_token_service = keycloak_token_service

    async def call(self, name: str, arguments: dict):
        token = await self._keycloak_token_service.get_token()
        async with Client(self._url, auth=_BearerAuth(token)) as client:
            result = await client.call_tool(name, arguments)
            if result.content and isinstance(result.content[0], TextContent):
                return json.loads(result.content[0].text)
            return {}
