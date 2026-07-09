# Frontend

## Stack

Next.js 16 (App Router) + React 19 + TypeScript, styled with Tailwind CSS v4 (config lives in `globals.css` now, not `tailwind.config.js`). Auth via `keycloak-js`. No server framework beyond Next itself — API calls go through Next's dev-server rewrite proxy to the backend (via Kong).

## Routing (file-based, App Router)

```
src/app/
  layout.tsx          → root layout, wraps every page
  page.tsx             → "/"                — the chat UI
  epic/[id]/page.tsx    → "/epic/:id"        — epic detail view
  ticket/[id]/page.tsx  → "/ticket/:id"      — ticket detail view
```

Each folder under `app/` is a route segment; a `page.tsx` inside makes it navigable. `[id]` is a dynamic segment, read client-side via `useParams()`. All three pages are `"use client"` components that fetch their own data in a `useEffect` (no server components/data-fetching used here — it's really a client-rendered SPA riding on Next's router).

## Layout & shell (`frontend/src/app/layout.tsx`)

Wraps every page in `<KeycloakProvider>` (auth gate) and a persistent `<Sidebar>`, with the routed page content to the right. This is why every route requires login and shares the same chat-history sidebar.

## Auth (`frontend/src/components/KeycloakProvider.tsx`)

A context provider that:
- Boots a `Keycloak` client on mount with `onLoad: "login-required"` — redirects to Keycloak's login page if not authenticated, blocking render until `ready`.
- On success, stores user info in React context and writes the JWT into a `kc_token` cookie (so the Next.js server/rewrite proxy or backend can read it, since it's not just an in-memory SPA token).
- Registers `onTokenExpired` to silently refresh the token and re-write the cookie; if refresh fails, forces re-login.

`useKeycloak()` is consumed by `Sidebar` (for user info, history, logout).

## Data layer

- `frontend/src/lib/api.ts` — thin `fetch` wrapper (`request<T>`) hitting `/api/...` paths, always `cache: "no-store"`. These `/api/*` calls are rewritten by `frontend/next.config.ts` to `${API_TARGET}/api/*` (→ Kong → backend) so the browser never needs the backend's real origin.
- `frontend/src/types/chat.ts` — the shared type vocabulary: `EpicInterface`, `TicketInterface`, `MessageInterface`, etc., mirroring the backend's response shapes.

## The chat flow (`frontend/src/components/ArchitectChat.tsx`)

This is the meatiest piece. Flow: user types in `SearchBar` → `newChat()` POSTs to the backend and gets a chat `id` → it opens a **WebSocket** (`buildWsUrl()`, via `NEXT_PUBLIC_WS_URL`) and subscribes to that chat id → the backend streams `chat-update` events as the agent "thinks" (`agentStatus: isThinking`) and eventually replies (`hasReplied`).

Key pieces:
- `splitTurns` — reconstructs a flat message list into discrete user/agent conversation turns (used both live and when reloading history via `getChat`).
- The render distinguishes three possible agent reply shapes: a plain string reply, a `ReplyInterface` (draft epic+tickets plan → rendered by `PlanCard`), or a `FinalReplyInterface` (accepted plan, now persisted → rendered by `FinalReplyCard`, which re-fetches the real epic/tickets by id).
- An idle timer (`IDLE_TIMEOUT_MS`) auto-stops the chat/WebSocket if the user goes inactive after the agent has replied, to avoid orphaned connections.
- `handleAccept` just sends a canned "Looks good, please create the epic and tickets" follow-up message — accepting a plan is itself a chat turn, not a separate endpoint.

## Supporting components

- `SearchBar` — controlled input + submit button, disabled while `loading`.
- `PlanCard` — renders a draft `epic`/`tickets` plan (architecture, components, tickets), optionally with "accept" actions or links to detail pages.
- `FinalReplyCard` — given just `{epicId, ticketIds}`, fetches the real records and reuses `PlanCard` to display them.
- `LoadingSkeleton` — placeholder shimmer while waiting.

## Styling

Tailwind v4's newer CSS-based config: `frontend/src/app/globals.css` defines CSS variables (`--background`, `--font-sans`, etc.) inside `@theme inline`, dark mode via `prefers-color-scheme`, and utility classes are used directly in JSX (no separate CSS files per component). Fonts use native OS font stacks (`ui-sans-serif`/`ui-monospace`) rather than `next/font/google`, so the frontend has no external network dependency at compile time.
