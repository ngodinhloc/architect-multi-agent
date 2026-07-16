# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A multi-agent AI system for software architecture planning. A user describes a requirement in the frontend; a LangGraph pipeline (architect-agent) designs a solution architecture through an approval-review loop, then a second LangGraph pipeline (ticket-agent) persists the approved plan as an epic + tickets via MCP tool calls. Ten services communicate over HTTP, WebSocket, RabbitMQ, and Redis, all fronted by Kong API Gateway with Keycloak-issued JWTs.

Read `README.md` for the full architecture diagram, data model, and request/response flow — it is kept current and is the best single source of truth for how the system fits together. Each service also has its own `AGENTS.md` (architect-agent, backend, frontend, mcp-server, ticket-service — not ticket-agent) with file-by-file detail for that service.

## Common commands

There is no root build/test/lint — each service is developed independently.

**Run the full stack:**
```bash
docker compose up --build
```
Frontend at http://localhost:3000, Kong proxy at http://localhost:8888, Grafana at http://localhost:3001, RabbitMQ management at http://localhost:15672. First-time setup requires generating RSA keypairs for `ticket-agent`, `mcp-server`, and `backend` `.env` files, and setting `ANTHROPIC_API_KEY` in `architect-agent/.env` — see the "Quick start" section of `README.md`.

**NestJS services** (`backend/`, `ticket-service/`):
```bash
npm install
npm run start:dev   # watch mode
npm run build
npm run lint
```

**FastAPI/LangGraph services** (`architect-agent/`, `ticket-agent/`, `mcp-server/`):
```bash
pip install .
uvicorn app.main:app --reload --port <8001|8002|8004>
```

**Frontend** (`frontend/`):
```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

There are no automated tests in this repository currently.

## Architecture

### Service map

| Service | Port | Role |
|---|---|---|
| frontend | 3000 | Next.js 16 / React 19 chat UI, Keycloak login |
| backend | 8000 | NestJS — conversation state (Postgres + Redis), WebSocket gateway, publishes to RabbitMQ |
| architect-agent | 8001 | FastAPI + LangGraph — plan/refine/accept intent, solution + ticket design with review loops |
| mcp-server | 8002 | FastMCP — exposes `create_epic`/`create_ticket` as MCP tools, calls ticket-service |
| ticket-service | 8003 | NestJS — CRUD for epics/tickets, its own Postgres schema, no queue/cache dependency |
| ticket-agent | 8004 | FastAPI + LangGraph `StateGraph` — tool-calling loop that persists an accepted plan via MCP |
| kong | 8888 (ext) / 8000 (internal) | API gateway — JWT validation, routing, rate limiting |
| keycloak | 8080 | Auth — OIDC (browser) + Client Credentials `private_key_jwt` (service-to-service) |
| rabbitmq, redis, postgres-backend, prometheus, grafana, loki, promtail | — | infra |

### Request flow (new requirement)

`frontend → Kong /backend → backend (Postgres + Redis, publish ChatEvent) → RabbitMQ (architecture-agent.chat) → architect-agent graph (intent → solution → solution_review → plan → plan_review → reply) → Redis → backend WebSocket poll (500ms) → frontend`. On accept, `architect-agent` publishes `AcceptEvent` to `architecture-agent.accept`; `ticket-agent` consumes it, calls `create_epic`/`create_ticket` via MCP (through Kong → mcp-server → Kong → ticket-service), then writes the final reply back to Redis for the same WebSocket poll to pick up.

### LangGraph agent internals (architect-agent, ticket-agent)

Both Python agents share a consistent internal split — when adding or modifying a graph node, touch all four:
- `app/agent/nodes/` — node classes, `__call__` + private helpers, dependencies injected via `__init__`
- `app/agent/schemas/` — one Pydantic output model file per node (used with `ChatAnthropic(...).with_structured_output(...)`)
- `app/agent/personas/` — one system-prompt file per node
- `app/agent/templates/` — one parameterised user-prompt-string file per node

Dependency wiring for both services goes through `app/container.py` (`cached_property` singletons) — there is no DI framework; nodes, the LLM client, and the RabbitMQ publisher are constructed once there and passed down.

### Kong / auth invariants

- **No service ever hardcodes another service's hostname.** All east-west calls go through `http://kong:8000/<service-prefix>`; only the frontend uses the external `localhost:8888`.
- Kong validates every JWT locally against a Keycloak RS256 public key fetched once at Kong startup (`kong/entrypoint.sh`). Services behind Kong do **not** re-validate — they trust whatever Kong forwarded.
- M2M services (`backend`, `mcp-server`, `ticket-agent`) authenticate to Keycloak via Client Credentials + `private_key_jwt` (RSA-2048 key in `.env` as `PRIVATE_KEY_PEM`, JWKS served at `/api/.well-known/jwks`), token cached in memory with refresh 30s before expiry.
- **Known gotcha:** Keycloak has no persistent volume — only the `realm.json` import source is mounted. Recreating the `keycloak` container (resource tweaks, image bumps, etc.) generates a brand-new signing keypair, but Kong's baked-in public key goes stale, so JWT validation starts failing with "Invalid signature." Always `docker compose up -d --force-recreate kong` immediately after restarting/recreating `keycloak`.

### Observability

Prometheus scrapes the five app services every 15s; Grafana (3001) is pre-provisioned with Prometheus + Loki datasources; logs are queried via Grafana Explore (LogQL), not a separate UI. Promtail only tails containers labeled `logs.collect=true` in `docker-compose.yml` — this filtering happens at Docker-API discovery time (`docker_sd_configs.filters`), not via `relabel_configs`, because Loki rejects any push where a stream ends up with zero labels, which corrupts the whole batch. To add a new service to log collection, just add the label — no Promtail config change needed.

### docker-compose.yml resource limits

Every service has a `deploy.resources.limits` block. Default ceiling is **0.5 CPU / 256M memory** — don't raise a service above that without concrete OOM/crash/throttling evidence (check `docker exec <container> cat /sys/fs/cgroup/cpu.stat` for throttling, not just `docker stats`). Current named exceptions (keycloak, rabbitmq, backend/ticket-service/ticket-agent, mcp-server, frontend) were each raised for a specific observed failure — see git history / commit messages on `docker-compose.yml` before changing them further. Healthcheck intervals are short (5-15s) by default except `architect-agent` and `ticket-agent`, which use 15m since nothing's `depends_on: service_healthy` waits on them — never put a long interval on a service that gates another's startup (rabbitmq, postgres-backend, redis, keycloak, ticket-service, mcp-server, backend, kong, loki), since Docker won't run the first healthcheck until the interval elapses.

## Conventions worth knowing before editing

- Redis key convention: `chat:{conversationId}` holds the live `ChatInterface`, polled by the backend's WebSocket gateway every 500ms until `agentStatus === "hasReplied"`. The `mcp_tools` key holds the MCP server's tool spec, read by `ticket-agent` at startup to dynamically build `StructuredTool`s (no hardcoded tool schemas in ticket-agent).
- RabbitMQ queues: `architecture-agent.chat` (new/refine messages) and `architecture-agent.accept` (accept signal) — both durable, `prefetch_count=1` on the consumer side.
- The `ChatInterface`/`MessageInterface`/`ReplyInterface`/`FinalReplyInterface` contracts are duplicated across backend (`chat/contracts/chat.interface.ts`), frontend (`types/chat.ts`), and the Python agents (`events/contracts/chat_interface.py`) — there is no shared package, so changes to these shapes must be applied in every location by hand.
- TypeORM runs with `synchronize: true` in both NestJS services — no migration files exist; schema changes are made directly on entity classes. `ticket-service` and `backend` share one `postgres-backend` Postgres instance but live in separate schemas (`architect`, `tickets`).
- IDs for epics/tickets are generated client-side (`uuid.uuid4()` in `architect-agent`'s `plan_node`) before the MCP calls that persist them — `ticket-service` accepts caller-provided UUIDs rather than generating its own.
