# Deku — agentic chat with branching conversations

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React 18](https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![LangGraph JS](https://img.shields.io/badge/LangGraph_JS-ReAct_agent-1C3C3C?logo=langchain&logoColor=white)
![Providers](https://img.shields.io/badge/LLM_providers-8-9184d9)

![Deku — light theme](docs/screenshot-light.png)

<details>
<summary>Dark theme</summary>

![Deku — dark theme](docs/screenshot-dark.png)

</details>

An agentic chat app implementing the `Agentic Chat.dc.html` design from the Claude Design handoff
(`design-handoff/`). Conversations are trees: you can **branch** to explore directions, **rewind**
to any earlier message (the later messages stay safe on the old branch), **combine** one branch
onto another, and **summarize** message ranges to reclaim context.

## Two editions, one UI

| | [`apps/web`](apps/web) — standalone | [`apps/fullstack`](apps/fullstack) — Python backend |
| --- | --- | --- |
| Runs as | a **static page**, no backend — [**live demo**](https://shayanrc.github.io/deku-chat/) | FastAPI + LangGraph (Python) |
| Agent | LangGraph **JS in the browser** | `create_react_agent` on the server |
| Storage | IndexedDB in your browser | `db.json` on the server |
| Providers | 7 (Cohere & Tavily need the backend) | all 8 + web search |

Both are thin shells around the same shared packages: **`packages/ui`** (the entire React app,
backend-agnostic behind `ConversationStore`/`ChatTransport` interfaces) and **`packages/core`**
(types, the branching operations, provider registry, demo seed — with JSON fixtures keeping the
TypeScript and Python implementations of the ops provably in lockstep).

## Features

### Conversation tree

![Conversation tree](docs/gif-tree.gif)

Every path the chat has taken, laid out as a git-style graph: the solid neutral node is the root,
hollow rings are branches you can jump to, and the accent node marks where you are. Click a node
to select it, then switch to it or launch rewind / combine / summarize against it. The rail to
your current branch is drawn in the accent color.

### Rewind

![Rewind](docs/gif-rewind.gif)

Pick any earlier message and continue from there on a fresh `Rewind N` branch — the messages
after that point are never deleted, they stay on the branch you rewound from. The rows below
your pick animate away before the rewind commits. Every user bubble also has a "Rewind to here"
shortcut that opens this modal with that message preselected.

### Combine

![Combine branches](docs/gif-combine.gif)

Replays the current branch's messages on top of another branch so two explorations become one
line — the animation lifts the branch's commits off the fork point and winds them onto the
target's tip. You can also trigger it by dragging one branch onto another in the sidebar.
Afterwards the source branch is removed and any of its children are re-pointed at the target.

### Summarize

![Summarize](docs/gif-summarize.gif)

Select a start and end message (or a single message) and the range is compressed into one short
summary node by the current model. The summary card in the transcript shows what was freed and
keeps the originals behind a "Show original" toggle — nothing is destroyed. Also reachable via
"Compact conversation" in the context meter.

### API keys

![API keys](docs/gif-keys.gif)

Click (or right-click) the avatar → **API keys…**. One row per supported provider — Anthropic,
OpenAI, Google, Mistral, Groq, Cohere, xAI, DeepSeek — plus tool keys like Tavily web search.
Keys live in your browser's localStorage only and are sent per-request; the server never stores
them. Saved keys show masked with a "browser" source tag.

## Stack

- **`packages/ui`** — React 18 + TS, the design system's `scope-industry` (light) and
  `scope-nocturne` (dark) scopes copied verbatim into `src/styles/theme.css`.
- **`packages/core`** — zero-dependency isomorphic TS: types, branching ops, registry, seed.
- **`apps/web`** — Vite SPA; LangGraph JS `createReactAgent` in-browser, lazy per-provider
  chunks, `idb-keyval` persistence. Deployed to GitHub Pages by CI.
- **`apps/fullstack`** — Vite frontend + FastAPI backend (uv, ruff, pytest, pydantic v2),
  LangGraph Python, NDJSON streaming with abort + partial-answer persistence.
- **Tools** — calculator and clock (always available), web search via Tavily (fullstack only).

## Setup

```bash
npm install            # JS workspaces
npm run dev            # fullstack edition: FastAPI :5175 + web :5173 (needs uv)
npm run dev:web        # standalone edition: :5174 (no backend, no Python needed)
npm run test           # vitest (core ops) + pytest (backend, incl. fixture parity)
npm run typecheck      # all workspaces
```

Then add a provider key in the app (click the avatar → **API keys…**).

## API keys

![API keys](docs/gif-keys.gif)

Click (or right-click) the avatar → **API keys…**. One row per supported provider — Anthropic,
OpenAI, Google, Mistral, Groq, Cohere, xAI, DeepSeek — plus tool keys like Tavily web search.
Keys live in your browser's localStorage only and are sent per-request; the server never stores
them. Saved keys show masked with a "browser" source tag.

## Stack

- **`packages/ui`** — React 18 + TS, the design system's `scope-industry` (light) and
  `scope-nocturne` (dark) scopes copied verbatim into `src/styles/theme.css`.
- **`packages/core`** — zero-dependency isomorphic TS: types, branching ops, registry, seed.
- **`apps/web`** — Vite SPA; LangGraph JS `createReactAgent` in-browser, lazy per-provider
  chunks, `idb-keyval` persistence. Deployed to GitHub Pages by CI.
- **`apps/fullstack`** — Vite frontend + FastAPI backend (uv, ruff, pytest, pydantic v2),
  LangGraph Python, NDJSON streaming with abort + partial-answer persistence.
- **Tools** — calculator and clock (always available), web search via Tavily (fullstack only).

## Setup

```bash
npm install
npm run dev            # server on :5175, web on :5173 (proxied)
```

Then add a provider key in the app (avatar → **API keys…**) — or optionally
`cp .env.example .env` for server-side fallback keys.

Open http://localhost:5173.

Production: `npm run build && npm start` (serves the built app on :5175).

## API keys

Two ways to provide keys, in priority order:

1. **In the app (recommended)** — click the avatar in the top right → **API keys…**.
   Keys are stored in your **browser's localStorage only**, sent with each request, and never
   persisted by the server.
2. **Server `.env` fallback** — `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`,
   `MISTRAL_API_KEY`, `GROQ_API_KEY`, `COHERE_API_KEY`, `XAI_API_KEY`, `DEEPSEEK_API_KEY`,
   plus optional `TAVILY_API_KEY` (enables the "Web search" tool) and `PORT` (default 5175).

Providers without a key from either source show as "no key" in the provider menu; chat requests
against them return a friendly error. Summarize falls back to a naive first-line summary if no
LLM is reachable.

## How branching is modeled

Each branch stores its **full message list** (copy-on-branch) plus `forkOf: {branchId, messageId}`
pointing at where it diverged. That makes every operation simple:

- **Branch** — copy the active branch, switch to the copy.
- **Rewind to message N** — copy the prefix up to N into a new `Rewind k` branch and switch to it;
  the original branch keeps the later messages.
- **Combine A → B** — append A's messages that B doesn't already have (by id) onto B, re-point
  A's children at B, delete A.
- **Summarize range** — replace the range with a single `summary` node that keeps the originals
  (`summaryOf`) for "Show original", and counts freed tokens toward the context meter.

The context meter estimates tokens (~4 chars/token) across system prompt, enabled tools,
conversation, and summaries against the selected model's context window.
