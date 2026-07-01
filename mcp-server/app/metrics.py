from prometheus_client import Counter

tool_requests = Counter(
    "mcp_server_tool_requests_total",
    "Total MCP tool requests handled by mcp-server",
    ["tool"],
)
