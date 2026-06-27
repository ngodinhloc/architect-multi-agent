import json
import logging
from typing import Any, Optional
from pydantic import create_model, Field
from langchain_core.tools import StructuredTool
from app.agent.tools.mcp_client import McpClient
from app.services.redis_client import RedisClient

logger = logging.getLogger(__name__)

_TYPE_MAP = {
    "string": str,
    "integer": int,
    "number": float,
    "boolean": bool,
    "array": list,
    "object": dict,
}


class McpToolBuilder:
    def __init__(self, redis_client: RedisClient, mcp_client_factory):
        self._redis_client = redis_client
        self._mcp_client_factory = mcp_client_factory

    async def build(self) -> list[StructuredTool]:
        raw = await self._redis_client.get("mcp_tools")
        if not raw:
            logger.warning("McpToolBuilder.build: No mcp_tools found in Redis")
            return []
        logger.info("McpToolBuilder.build: mcp_tools from Redis", extra={"raw": raw})

        tools = []
        for provider in json.loads(raw):
            provider_name = provider.get("providerName", "unknown")
            client = self._mcp_client_factory(provider.get("providerHost", ""))
            for tool_spec in provider.get("tools", []):
                tools.append(self._build_tool(tool_spec, client))
                logger.info("McpToolBuilder.build: Registered tool", extra={"tool": tool_spec["name"], "provider": provider_name})

        return tools

    def _build_tool(self, tool_spec: dict, mcp_client: McpClient) -> StructuredTool:
        name = tool_spec["name"]
        description = tool_spec["description"]
        input_schema = tool_spec.get("inputSchema", {})
        properties = input_schema.get("properties", {})
        required = set(input_schema.get("required", []))

        fields: dict = {}
        for field_name, field_schema in properties.items():
            py_type = _TYPE_MAP.get(field_schema.get("type", "object"), Any)
            field_desc = field_schema.get("description", "")
            if field_name in required:
                fields[field_name] = (py_type, Field(description=field_desc))
            else:
                fields[field_name] = (Optional[py_type], Field(default=None, description=field_desc))

        DynamicInput = create_model(f"{name}_input", **fields)

        return StructuredTool.from_function(
            name=name,
            description=description,
            args_schema=DynamicInput,
            coroutine=self._make_coroutine(name, mcp_client),
        )

    @staticmethod
    def _make_coroutine(name: str, mcp_client: McpClient):
        async def run(**kwargs) -> str:
            result = await mcp_client.call(name, kwargs)
            return json.dumps(result)
        return run
