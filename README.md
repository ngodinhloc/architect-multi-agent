# Architect Agent

A **multi-agent AI** system for software architecture planning. Describe a requirement — _"implement an SFTP solution"_ — and a pipeline of specialised AI agents collaborates to produce a solution architecture and development tickets. An approval-loop graph designs and reviews the plan; a separate tool-calling agent persists it as an epic and tickets via MCP. Review the plan, refine it with follow-ups, or accept it to trigger ticket creation.

![screenshot 1](screenshot_1.png)

![screenshot 2](screenshot_2.png)

![screenshot 3](screenshot_3.png)

![screenshot 4](screenshot_4.png)

---

## Architecture

![architecture](architecture.png)

The system is composed of seven services communicating over HTTP, WebSocket, RabbitMQ, and Redis.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│  Next.js frontend  (port 3000)                                      │
│  · Requirement input, live thinking log, plan card, final reply     │
│  · "Looks good" button → accept flow; free-text → refine flow       │
│  · Sidebar with conversation history                                │
│  · /epic/:id and /ticket/:id detail pages                           │
└──────────────────────┬───────────────────────┬──────────────────────┘
                       │ HTTP  /api/*           │ WS  /ws
                       │ (Next.js proxy)        │ (direct)
┌──────────────────────▼───────────────────────▼──────────────────────┐
│  Backend  (NestJS · port 8000)                                      │
│  · REST chat API + ticket proxy                                     │
│  · WebSocket gateway — polls Redis, pushes chat-update events       │
│  · PostgreSQL  — persists conversations as MessageInterface[]       │
│  · Redis       — live chat state during agent processing            │
│  · Publishes ChatEventInterface to RabbitMQ (fire-and-forget)       │
└────────────┬─────────────────────────────┬───────────────────────────┘
             │ AMQP publish                │ read / write
             │ architecture-agent.chat     │
┌────────────▼──────────────────────┐   ┌──▼──────────────────────┐
│  RabbitMQ                         │   │  Redis                   │
│  queues:                          │   │  key: chat:{uuid}        │
│  · architecture-agent.chat        │   │  key: mcp_tools          │
│  · architecture-agent.accept      │   └──────────────────────────┘
└────────────┬──────────────────────┘
             │ AMQP subscribe (architecture-agent.chat)
┌────────────▼────────────────────────────────────────────────────────┐
│  Architect Agent  (FastAPI + LangGraph · port 8001)                 │
│                                                                     │
│  START → intent_node                                                │
│              │                                                      │
│    ┌─[plan/refine]──────────────────────────────────┐               │
│    │                                                ▼               │
│    │                                   ┌─► solution_node            │
│    │                                   │        │                   │
│    │                                   │        ▼                   │
│    │                          [rejected]│ solution_review_node      │
│    │                                   └───┘    │ [approved]        │
│    │                                            ▼                   │
│    │                                   ┌─► plan_node                │
│    │                                   │        │                   │
│    │                          [rejected]│ plan_review_node          │
│    │                                   └───┘    │ [approved]        │
│    │                                            ▼                   │
│    │                                       reply_node → END         │
│    │                                                                 │
│    └─[accept]──► publish AcceptEvent ──► END                        │
│                          │                                          │
└──────────────────────────┼──────────────────────────────────────────┘
                           │ AMQP publish (architecture-agent.accept)
┌──────────────────────────▼──────────────────────────────────────────┐
│  Ticket Agent  (FastAPI + LangGraph · StateGraph · port 8004)       │
│                                                                     │
│  START → create_node ◄──────────────┐                               │
│              │                      │                               │
│    ┌─[tool calls]──► tools_node ────┘                               │
│    │                                                                 │
│    └─[done]──► extract_node → END                                   │
│                                                                     │
│  extract_node writes ExtractOut { epicId, ticketIds } to state      │
│  → FinalReplyInterface written to Redis → agentStatus = hasReplied  │
└────────────┬────────────────────────────────────────────────────────┘
             │ MCP (streamable HTTP)
┌────────────▼────────────────┐
│  MCP Server  (port 8002)    │
│  create_epic                │
│  create_ticket              │
└────────────┬────────────────┘
             │ REST  /api/epic  /api/ticket
┌────────────▼────────────────┐
│  Ticket Service  (port 8003)│
│  NestJS — epic + ticket     │
│  CRUD backed by PostgreSQL  │
└─────────────────────────────┘
```

---

## Services

| Service | Port | Directory | Stack |
|---------|------|-----------|-------|
| frontend | 3000 | `frontend/` | Next.js 15 · React 19 · Tailwind CSS 4 |
| backend | 8000 | `backend/` | NestJS 11 · TypeORM · PostgreSQL · Redis · RabbitMQ |
| architect-agent | 8001 | `architect-agent/` | FastAPI · LangGraph · LangChain · Claude |
| mcp-server | 8002 | `mcp-server/` | FastMCP · FastAPI |
| ticket-service | 8003 | `ticket-service/` | NestJS 11 · TypeORM · PostgreSQL |
| ticket-agent | 8004 | `ticket-agent/` | FastAPI · LangGraph · StateGraph · Claude |
| rabbitmq | 5672 / 15672 | — | RabbitMQ 3 |
| redis | 6379 | — | Redis 7 |
| postgres-backend | 5432 | — | PostgreSQL 17 |
| postgres-tickets | 5433 | — | PostgreSQL 17 |

---

## Frontend (port 3000)

- Free-text requirement input with live thinking log streamed over WebSocket
- Thinking log shows each agent node's progress: `Analyzing... → Intention: Plan`, `Designing... / Reviewing... → Result: Approved`, etc.
- Approved plan rendered as a `PlanCard` — solution architecture + component list + development tickets
- **"Looks good"** button sends the accept signal; architect-agent publishes an `AcceptEvent` to RabbitMQ; ticket-agent picks it up and calls `create_epic` + `create_ticket` via MCP
- Free-text follow-up refines the plan through a new agent loop
- `FinalReplyCard` fetches the full epic and ticket data from the ticket-service and renders them with clickable links
- **`/epic/:id`** — epic detail page with solution architecture and full ticket list
- **`/ticket/:id`** — ticket detail page with requirements and acceptance criteria
- Left sidebar lists saved conversations

---

## Backend (port 8000)

### Chat API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat/new` | Create conversation in PostgreSQL + Redis, publish `ChatEvent` to RabbitMQ |
| `POST` | `/api/chat/:id/cont` | Append user message, publish `ChatEvent` to RabbitMQ |
| `GET` | `/api/chat/history` | Return all conversations (id, title, createdAt) |
| `GET` | `/api/chat/:id` | Live state from Redis, or persisted from PostgreSQL |
| `POST` | `/api/chat/:id/stop` | Persist messages to PostgreSQL, delete Redis key |
| `WS` | `/ws` | Polls Redis at 500 ms, pushes `chat-update` events until `agentStatus === hasReplied` |

### Ticket Proxy

Proxies the browser to the internal ticket-service (not directly reachable from the browser).

| Method | Path | Proxies to |
|--------|------|------------|
| `GET` | `/api/epic/:id` | `ticket-service /api/epic/:id` |
| `GET` | `/api/epic/:epicId/tickets` | `ticket-service /api/epic/:epicId/tickets` |
| `GET` | `/api/ticket/:id` | `ticket-service /api/ticket/:id` |

---

## Architect Agent (port 8001)

![Architect Agent graph](architect_agent_graph.png)

Consumes `ChatEvent` messages from the `architecture-agent.chat` RabbitMQ queue and runs a **LangGraph** state graph. Each node is a Python class with injected dependencies — a shared `ChatAnthropic` LLM instance and a `RabbitMQPublisher` — wired together in the application container.

### Node responsibilities

| Node | Class | Role |
|------|-------|------|
| `intent_node` | `IntentNode` | Classify user message as `plan`, `refine`, or `accept`; on accept, publish `AcceptEvent` to RabbitMQ |
| `solution_node` | `SolutionNode` | Generate `SolutionInterface` (architecture + components) |
| `solution_review_node` | `SolutionReviewNode` | Approve/reject solution; feed comments back to `solution_node` |
| `plan_node` | `PlanNode` | Break solution into `TicketInterface[]` |
| `plan_review_node` | `PlanReviewNode` | Approve/reject tickets; feed comments back to `plan_node` |
| `reply_node` | `ReplyNode` | Assemble `ReplyInterface` (epic + tickets) and write to Redis |

### Agent internals

Each node's concerns are separated into three dedicated directories:

```
app/agent/
├── nodes/       — node classes (__call__ + private helpers)
├── schemas/     — Pydantic output models (one file per node)
│   ├── intent_schema.py          IntentOut
│   ├── solution_schema.py        SolutionOut, ComponentOut, FeatureOut
│   ├── solution_review_schema.py SolutionReviewOut
│   ├── plan_schema.py            PlanOut, TicketOut, RequirementOut, AcceptanceCriterionOut
│   └── plan_review_schema.py     PlanReviewOut
├── personas/    — LLM role/behaviour system prompts (one file per node)
│   ├── intent_persona.py
│   ├── solution_persona.py
│   ├── solution_review_persona.py
│   ├── plan_persona.py
│   └── plan_review_persona.py
├── templates/   — parameterised user prompt strings (one file per node)
│   ├── intent_templates.py       INTENT_USER
│   ├── solution_templates.py     SOLUTION_USER_NEW / _REFINE / _REVISE
│   ├── solution_review_templates.py SOLUTION_REVIEW_USER
│   ├── plan_templates.py         PLAN_USER / PLAN_USER_REVISE
│   └── plan_review_templates.py  PLAN_REVIEW_USER
└── contracts/   — ArchitectState and shared interfaces
```

### Dependency injection

All nodes receive their dependencies through `__init__`. The application container (`container.py`) constructs and wires everything:

```
Container
  ├── llm                → ChatAnthropic (claude-sonnet-4-6, max_tokens=4096)
  ├── rabbitmq_publisher → RabbitMQPublisher(rabbitmq_url)
  └── agent_graph        → ArchitectGraph(llm, rabbitmq_publisher).build()
```

### State (`ArchitectState`)

```python
class ArchitectState(MessagesState):
    conversation_id: str
    requirement: str
    raw_history: list[dict]
    user_intent: str               # "plan" | "accept" | "refine"
    prior_solution: dict | None    # solution from previous turn (refine context)
    solution: dict | None
    solution_review_comments: list[str]
    solution_approved: bool
    tickets: list[dict]
    ticket_review_comments: list[str]
    tickets_approved: bool
    final_reply: dict | None
```

---

## Ticket Agent (port 8004)

![Ticket Agent graph](ticket_agent_graph.png)

Subscribes to the `architecture-agent.accept` RabbitMQ queue. When an `AcceptEvent` arrives it runs a **LangGraph `StateGraph`** with two nodes: `create_node` (tool-calling loop) and `extract_node` (structured output extraction).

### Graph

```
START → create_node ◄──────────┐
            │                  │
  ┌─[tool calls]──► tools ─────┘
  │
  └─[done]──► extract_node → END
```

| Node | Class | Role |
|------|-------|------|
| `create_node` | `CreateNode` | Calls `create_epic` and `create_ticket` tools in order |
| `tools` | `ToolNode` | Executes tool calls via MCP |
| `extract_node` | `ExtractNode` | Extracts `epicId` and `ticketIds` from tool results into `ExtractOut` |

### State (`TicketState`)

```python
class TicketState(MessagesState):
    extract_out: ExtractOut | None = None
```

### Tools (dynamic — built from Redis at startup)

On startup, `McpToolBuilder` reads `mcp_tools` from Redis and dynamically creates a `StructuredTool` for each entry using `pydantic.create_model` to derive the input schema from the stored JSON schema. Each tool calls `McpClient` targeting the `providerHost` recorded in the spec.

| Tool | Discovered from | What it does |
|------|----------------|-------------|
| `create_epic` | `mcp_tools` Redis key | Calls MCP `create_epic` → ticket-service `POST /api/epic/` |
| `create_ticket` | `mcp_tools` Redis key | Calls MCP `create_ticket` → ticket-service `POST /api/ticket/` |

After `extract_node` writes `ExtractOut` to state, `TicketService` reads it directly to build `FinalReplyInterface`, writes it to Redis, and sets `agentStatus = hasReplied` — which the backend WebSocket gateway delivers to the browser.

---

## MCP Server (port 8002)

Exposes two tools via MCP protocol (streamable HTTP at `POST /mcp/`). Translates AI tool calls into REST calls to the ticket-service.

On startup, serialises the full tools spec into Redis under the key `mcp_tools` in the following shape:

```json
[
  {
    "providerName": "Ticket MCP Server",
    "providerHost": "http://mcp-server:8000",
    "tools": [
      { "name": "create_epic", "description": "...", "inputSchema": { ... } },
      { "name": "create_ticket", "description": "...", "inputSchema": { ... } }
    ]
  }
]
```

This allows other services (ticket-agent) to discover and build tools dynamically at startup without hardcoding tool definitions.

| Tool | What it does |
|------|-------------|
| `create_epic` | `POST /api/epic/` on ticket-service |
| `create_ticket` | `POST /api/ticket/` on ticket-service |

### MCP JSON-RPC request/response

The ticket-agent sends JSON-RPC 2.0 requests to `POST /mcp/`. Below is a real exchange captured from the logs.

**create_epic request**
```json
POST /mcp/
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_epic",
    "arguments": {
      "epic": {
        "id": "5eb18c3c-3084-4a11-8b13-72b2759884c4",
        "name": "a solution to export reports from Snowflake to SFTP server",
        "requirements": [
          { "requirement": "a solution to export reports from Snowflake to SFTP server" }
        ],
        "solution": {
          "architecture": "A lightweight scheduled pipeline where Python scripts query Snowflake, generate report files, and securely transfer them to an SFTP server — orchestrated by a simple job scheduler with built-in logging and alerting.",
          "components": [
            {
              "tech": "Python (Pandas / Paramiko)",
              "features": [
                { "feature": "Query Snowflake and extract report data via SQLAlchemy connector" },
                { "feature": "Transform and format data into CSV or Excel report files" },
                { "feature": "SSH key-based SFTP upload with checksum verification" },
                { "feature": "Retry logic and failure handling for SFTP transfer errors" }
              ]
            },
            {
              "tech": "APScheduler (Python)",
              "features": [
                { "feature": "Cron-based scheduling of report export jobs (hourly/daily/weekly)" },
                { "feature": "Job execution logging and missed-run detection" }
              ]
            },
            {
              "tech": "Snowflake",
              "features": [
                { "feature": "SQL-based report queries via views or parameterized queries" },
                { "feature": "Role-based access control (RBAC) for secure read-only service account" }
              ]
            },
            {
              "tech": "SQLite",
              "features": [
                { "feature": "Lightweight audit log tracking each export job: report name, row count, file size, status, and timestamp" }
              ]
            },
            {
              "tech": "Slack Webhooks",
              "features": [
                { "feature": "Real-time notifications on export job success or failure" },
                { "feature": "Daily summary digest of all export job statuses" }
              ]
            }
          ]
        }
      }
    },
    "_meta": { "progressToken": 1 }
  }
}
```

**create_epic response**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"id\": \"5eb18c3c-3084-4a11-8b13-72b2759884c4\", \"name\": \"a solution to export reports from Snowflake to SFTP server\"}"
      }
    ]
  }
}
```

**create_ticket request**
```json
POST /mcp/
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "create_ticket",
    "arguments": {
      "ticket": {
        "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "epicId": "5eb18c3c-3084-4a11-8b13-72b2759884c4",
        "name": "Implement Snowflake query and report generation module",
        "requirements": [
          { "description": "Query Snowflake via SQLAlchemy connector and export results to CSV or Excel" },
          { "description": "Support dynamic report naming with timestamps and report type identifiers" }
        ],
        "acceptance_criteria": [
          { "description": "Report file is generated correctly for a parameterized Snowflake query" },
          { "description": "File name includes report type and ISO timestamp" }
        ]
      }
    },
    "_meta": { "progressToken": 2 }
  }
}
```

**create_ticket response**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"id\": \"b2c3d4e5-f6a7-8901-bcde-f12345678901\", \"epicId\": \"5eb18c3c-3084-4a11-8b13-72b2759884c4\", \"name\": \"Implement Snowflake query and report generation module\"}"
      }
    ]
  }
}
```

`_meta.progressToken` is a standard MCP field used for streaming progress notifications. `result.content[0].text` is always a JSON string — `McpClient` parses it with `json.loads` to recover the created object.

---

## Ticket Service (port 8003)

Minimal NestJS CRUD service backed by its own PostgreSQL instance. No RabbitMQ, no Redis, no WebSocket.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/epic/` | Create epic |
| `GET` | `/api/epic/:id` | Get epic by id |
| `POST` | `/api/ticket/` | Create ticket |
| `GET` | `/api/epic/:epicId/tickets` | Get all tickets for an epic |
| `GET` | `/api/ticket/:id` | Get ticket by id |
| `GET` | `/api/health` | Health check |

---

## Data model

```
SolutionInterface  { architecture: string; components: ComponentInterface[] }
ComponentInterface { tech: string; features: FeatureInterface[] }
FeatureInterface   { feature: string }

EpicInterface   { id: uuid; name: string; requirements: RequirementInterface[]; solution: SolutionInterface }
TicketInterface { id: uuid; epicId: uuid; name: string; requirements: RequirementInterface[]; acceptance_criteria: AcceptanceCriterionInterface[] }

ReplyInterface      { epic: EpicInterface; tickets: TicketInterface[] }
FinalReplyInterface { epicId: string; ticketIds: string[] }

MessageInterface {
  actor:       "User" | "Agent"
  timestamp:   datetime
  content:     string | ReplyInterface | FinalReplyInterface
  agentStatus: "isThinking" | "hasReplied" | null
}
```

---

## Workflow

```
User types "implement an SFTP solution"
  → POST /api/chat/new
  → backend creates conversation in PostgreSQL + Redis
  → publishes ChatEvent to architecture-agent.chat
  → frontend opens WebSocket

Architect Agent processes ChatEvent:
  intent_node          → "plan"
  solution_node        → SolutionInterface
  solution_review_node → approved? no → solution_node (loop)
                                  yes →
  plan_node            → TicketInterface[]
  plan_review_node     → approved? no → plan_node (loop)
                                  yes →
  reply_node           → ReplyInterface written to Redis → agentStatus=hasReplied

Frontend renders PlanCard (architecture + tickets)

User clicks "Looks good"
  → POST /api/chat/:id/cont
  → intent_node → "accept"
  → publishes AcceptEvent { conversationId, content } to architecture-agent.accept
  → graph ends (Redis stays isThinking)

Ticket Agent processes AcceptEvent (StateGraph):
  create_node calls tools in order:
  → create_epic   → MCP create_epic   → ticket-service POST /api/epic/
  → create_ticket → MCP create_ticket → ticket-service POST /api/ticket/ (× N)
  extract_node reads tool results → ExtractOut { epicId, ticketIds }
  → FinalReplyInterface written to Redis → agentStatus=hasReplied

Frontend renders FinalReplyCard:
  · Fetches full epic and tickets via /api/epic/:id and /api/epic/:epicId/tickets
  · Epic name links to /epic/:id
  · Each ticket name links to /ticket/:id
```

---

## Quick start

```bash
# 1. Set your Anthropic API key
cp architect-agent/.env.example architect-agent/.env
# edit architect-agent/.env — set ANTHROPIC_API_KEY=sk-ant-...

# 2. Start all services
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

### Required environment

| Key | File | Description |
|-----|------|-------------|
| `ANTHROPIC_API_KEY` | `architect-agent/.env` | [console.anthropic.com](https://console.anthropic.com) — shared by both architect-agent and ticket-agent |
