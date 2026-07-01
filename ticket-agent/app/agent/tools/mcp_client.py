import json
import logging
import httpx
from fastmcp import Client
from mcp.types import TextContent
from app.auth.jwt_service import JwtService

logger = logging.getLogger("mcp_tools")


class _BearerAuth(httpx.Auth):
    def __init__(self, token: str) -> None:
        self._token = token

    def auth_flow(self, request: httpx.Request):
        request.headers["Authorization"] = f"Bearer {self._token}"
        yield request


class McpClient:
    def __init__(self, mcp_server_url: str, jwt_service: JwtService):
        self._url = f"{mcp_server_url}/mcp/"
        self._jwt_service = jwt_service

    async def call(self, name: str, arguments: dict):
        token = self._jwt_service.sign()
        async with Client(self._url, auth=_BearerAuth(token)) as client:
            result = await client.call_tool(name, arguments)
            if result.content and isinstance(result.content[0], TextContent):
                return json.loads(result.content[0].text)
            return {}
