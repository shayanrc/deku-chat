# Deku — agentic chat with branching conversations

A standalone webapp implementing the `Agentic Chat.dc.html` design from the Claude Design handoff
(`design-handoff/`). Conversations are trees: you can **branch** to explore directions, **rewind**
to any earlier message (the later messages stay safe on the old branch), **combine** one branch
onto another, and **summarize** message ranges to reclaim context.

## Stack

- **Frontend** — React 18 + Vite + TypeScript. Themes are the design system's `scope-industry`
  (light) and `scope-nocturne` (dark) scopes, copied verbatim into `src/styles/theme.css`.
- **Backend** — Node + Express (`server/`). The LLM side is a **LangGraph JS** ReAct agent
  (`createReactAgent`) with pluggable providers: Anthropic, OpenAI, Google Gemini, Mistral,
  Groq, Cohere, xAI, and DeepSeek.
- **Tools** — calculator and clock (always available), web search via Tavily (optional key).
  Tool calls stream into the "Show the work" disclosure on each assistant message.
  (The design's "Tools / Skills / Connectors (MCP) / Files" composer menu is intentionally
  simplified to a flat capability list until skills/MCP/files land; the tool-event model
  already carries `mcp`/`skill` kinds for when they do.)
- **Persistence** — JSON file at `server/data/db.json` (created on first write).
- **Streaming** — NDJSON over a fetch stream (`delta` / `tool` / `done` / `error` events).

## Setup

```bash
npm install
cp .env.example .env   # add at least one provider key
npm run dev            # server on :5175, web on :5173 (proxied)
```

Open http://localhost:5173.

Production: `npm run build && npm start` (serves the built app on :5175).

## API keys

Two ways to provide keys, in priority order:

1. **In the app (recommended)** — right-click the avatar in the top right → **API keys…**.
   Keys are stored in your **browser's localStorage only**, sent with each request, and never
   persisted by the server. A key set here overrides the server's `.env` for that provider.
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
