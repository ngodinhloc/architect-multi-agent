# Multi-Agent Architect — Specification

A multi-agent system that turns a natural-language software requirement into a reviewed solution architecture and a set of development tickets. The user can accept the plan (persisting it as an epic + tickets) or iterate with follow-up messages.

---

## Data Interfaces

```typescript
// ── Solution ──────────────────────────────────────────────────────────
SolutionInterface {
    architecture: string;
    components:   ComponentInterface[];
}

ComponentInterface {
    tech:     string;              // e.g. "Node.js / NestJS"
    features: FeatureInterface[];
}

FeatureInterface {
    feature: string;
}

// ── Review ────────────────────────────────────────────────────────────
SolutionReviewInterface {
    solution: SolutionInterface;
    comments: CommentInterface[];
    approved: boolean;
}

TicketReviewInterface {
    solution: SolutionInterface;
    tickets:  TicketInterface[];
    comments: CommentInterface[];
    approved: boolean;
}

CommentInterface {
    comment: string;
}

// ── Epic & Tickets ────────────────────────────────────────────────────
EpicInterface {
    id:           uuid;
    name:         string;
    requirements: RequirementInterface[];
    solution:     SolutionInterface;
}

TicketInterface {
    id:                  uuid;
    epicId:              uuid;
    name:                string;
    requirements:        RequirementInterface[];
    acceptance_criteria: AcceptanceCriterionInterface[];
}

RequirementInterface {
    requirement: string;
}

AcceptanceCriterionInterface {
    criterion: string;
}

// ── Chat ──────────────────────────────────────────────────────────────
ChatInterface {
    id:          uuid;
    title:       string;
    messages:    MessageInterface[];
    status:      "isActive" | "isStopped";
    agentStatus: "isThinking" | "hasReplied";
}

MessageInterface {
    actor:       "User" | "Agent";
    timestamp:   Date;
    content:     string | ReplyInterface | FinalReplyInterface;
    agentStatus: "isThinking" | "hasReplied" | null;
}

ReplyInterface {
    epic:    EpicInterface;
    tickets: TicketInterface[];
}

FinalReplyInterface {
    epicId:    string;
    ticketIds: string[];
}

// ── Events ────────────────────────────────────────────────────────────
ChatEventInterface {
    conversationId: string;
    message:        string;
    history:        MessageInterface[];
}
```

---

## Components

### frontend 
Next.js / React / Tailwind CSS. Sends the user's requirement to the backend REST API, then opens a WebSocket to stream live agent progress. Renders `ReplyInterface` as a plan card (solution architecture + ticket list) with "Looks good" and free-text refinement actions. Renders `FinalReplyInterface` as a confirmation card showing the persisted epic and ticket IDs.

### backend 
NestJS API. Owns conversation state in PostgreSQL (`conversations` table, `messages: jsonb`) and Redis (`chat:{uuid}` key as live `ChatInterface`). Exposes REST endpoints for creating and retrieving conversations and a WebSocket gateway that polls Redis at 500 ms to push `chat-update` events. Publishes `ChatEventInterface` to RabbitMQ queue `architecture-agent.chat` (fire-and-forget) when a new message arrives.

### ai-agent 
FastAPI service hosting a LangGraph stateful graph. Subscribes to RabbitMQ queue `architecture-agent.chat`. For each event it runs a graph with the following nodes:

- **intent_node** — classifies the user message as `plan`, `refine`, or `accept`
- **solution_node** — generates a `SolutionInterface` from the requirement
- **solution_review_node** — approves or rejects the solution; rejected solutions loop back to `solution_node`
- **plan_node** — breaks the approved solution into `TicketInterface[]`
- **plan_review_node** — approves or rejects the tickets; rejected plans loop back to `plan_node`
- **reply_node** — assembles `ReplyInterface` and writes it to Redis as the agent's reply
- **create_node** — called on `accept` intent; calls `create_epic` and `create_ticket` MCP tools, writes `FinalReplyInterface` to Redis

Each LLM node uses `ChatAnthropic.with_structured_output()` (claude-sonnet-4-6). After each node update, a thinking-log message is appended to Redis so the frontend can display live progress.

### mcp-server 
FastMCP + FastAPI service. Exposes two MCP tools over streamable HTTP at `POST /mcp/`. Translates each tool call into a REST request to the ticket-service.

| Tool | Calls |
|------|-------|
| `create_epic(epic: dict)` | `POST /api/epic/` on ticket-service |
| `create_ticket(ticket: dict)` | `POST /api/ticket/` on ticket-service |

### ticket-service
NestJS CRUD service with its own PostgreSQL database. Owns the `epics` and `tickets` tables. No RabbitMQ, no Redis, no WebSocket.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/epic/` | Create epic |
| `GET` | `/api/epic/:id` | Get epic |
| `POST` | `/api/ticket/` | Create ticket |
| `GET` | `/api/epic/:epicId/tickets` | Get all tickets for an epic |

### Infrastructure
- **PostgreSQL (postgres-backend)** — backend conversations (`architect` database),  ticket-service epics & tickets (`tickets` database)
- **Redis** — live chat state during agent processing
- **RabbitMQ ** — async message queue between backend and ai-agent

---

## Workflow

### New requirement

1. User types a requirement (e.g. "implement an SFTP solution") in the frontend.
2. Frontend `POST /api/chat/new` → backend creates a `ChatInterface` in PostgreSQL and Redis, publishes `ChatEventInterface` to RabbitMQ, returns `{ id }`.
3. Frontend opens WebSocket to backend with the chat id.
4. AI agent receives the event, runs the graph: `intent_node` → `solution_node` → `solution_review_node` (loop until approved) → `plan_node` → `plan_review_node` (loop until approved) → `reply_node`.
5. After each node, a thinking-log message is written to Redis; the WebSocket gateway picks it up and pushes a `chat-update` event to the frontend.
6. On completion, `reply_node` writes `ReplyInterface` as the final agent message with `agentStatus: hasReplied`. Frontend renders the plan card.

### User accepts the plan

1. User clicks "Looks good" → frontend `POST /api/chat/:id/cont` with message "Looks good, please create the epic and tickets."
2. Backend appends the message to Redis and publishes a new `ChatEventInterface`.
3. AI agent: `intent_node` classifies as `"accept"`, extracts the prior `ReplyInterface` from history, routes to `create_node`.
4. `create_node` calls `create_epic` MCP tool → ticket-service, then `create_ticket` MCP tool × N → ticket-service.
5. Writes `FinalReplyInterface { epicId, ticketIds }` to Redis. Frontend renders the confirmation card.

### User refines the plan

1. User types a refinement (e.g. "add a security ticket").
2. Same flow as a new requirement, but `intent_node` classifies as `"refine"` and carries forward the existing solution context.
3. The planning loop runs again and returns an updated `ReplyInterface`.
