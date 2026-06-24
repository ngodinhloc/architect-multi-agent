import json
import logging
from fastmcp import FastMCP
from redis.asyncio import Redis
from app.configs.settings import settings
from app.container import container

logger = logging.getLogger(__name__)

fast_mcp = FastMCP("Architect MCP Server")


@fast_mcp.tool()
async def create_epic(epic: dict) -> dict:
    """Create an epic in the ticket service. Pass the full EpicInterface object as a dict."""
    return await container.epic_tool.create(epic)


@fast_mcp.tool()
async def create_ticket(ticket: dict) -> dict:
    """Create a ticket in the ticket service. Pass the full TicketInterface object as a dict."""
    return await container.ticket_tool.create(ticket)


async def write_tools_to_redis() -> None:
    tools = await fast_mcp.list_tools()
    spec = [
        {
            "providerName": settings.provider_name,
            "providerHost": settings.provider_host,
            "tools": [
                {
                    "name": tool.name,
                    "description": tool.description,
                    "inputSchema": tool.parameters,
                }
                for tool in tools
            ],
        }
    ]
    redis = Redis.from_url(settings.redis_url)
    async with redis:
        await redis.set("mcp_tools", json.dumps(spec))
    logger.info("Wrote %d tools to Redis key 'mcp_tools'", len(tools))
