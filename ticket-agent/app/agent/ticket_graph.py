from langchain_anthropic import ChatAnthropic
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition
from app.agent.nodes.create_node import CreateNode
from app.agent.nodes.extract_node import ExtractNode
from app.agent.contracts.agent_interface import TicketState
from app.agent.tools.mcp_tool_builder import McpToolBuilder


# ┌──────────────────────────────────────────────────────────────────┐
# │                         TicketGraph                              │
# │                                                                  │
# │  START                                                           │
# │    │                                                             │
# │    ▼                                                             │
# │  create_node ◄─────────────────────────────┐                    │
# │    │                                        │                    │
# │    ├──[has tool calls]──► tools_node ───────┘                   │
# │    │                                                             │
# │    └──[no tool calls]──► extract_node                           │
# │                               │                                  │
# │                               ▼                                  │
# │                              END                                 │
# └──────────────────────────────────────────────────────────────────┘


class TicketGraph:
    def __init__(self, llm: ChatAnthropic, mcp_tool_builder: McpToolBuilder):
        self._llm = llm
        self._mcp_tool_builder = mcp_tool_builder

    async def build(self):
        tools = await self._mcp_tool_builder.build()
        llm_with_tools = self._llm.bind_tools(tools)

        graph = StateGraph(TicketState)
        graph.add_node("create_node", CreateNode(llm_with_tools))
        graph.add_node("tools", ToolNode(tools))
        graph.add_node("extract_node", ExtractNode(self._llm))

        graph.add_edge(START, "create_node")
        graph.add_conditional_edges("create_node", tools_condition, {"tools": "tools", END: "extract_node"})
        graph.add_edge("tools", "create_node")
        graph.add_edge("extract_node", END)

        return graph.compile()
