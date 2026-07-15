# Deku — fullstack edition

The same React UI backed by a **Python** backend: FastAPI + LangGraph (Python) with
`init_chat_model` provider switching. The HTTP/NDJSON contract is identical to the
original Express server — the frontend can't tell the difference (proven by an
endpoint-by-endpoint parity diff and byte-identical UI screenshots during the port).

```bash
npm run dev            # from the repo root → FastAPI :5175 + web :5173
```

Backend workflow (in `backend/`, managed by [uv](https://docs.astral.sh/uv/)):

```bash
uv sync                # install (creates .venv, respects uv.lock)
uv run pytest          # tests — includes fixture parity with @deku/core's vitest suite
                       # and a real-socket disconnect test for partial-answer persistence
uv run ruff check .    # lint
```

Production: `npm run build -w apps/fullstack/frontend`, then
`uv run uvicorn deku_server.main:app --port 5175` — FastAPI serves the built frontend.

Server-side fallback API keys (optional — keys added in the app UI always win):
copy `backend/.env.example` to `backend/.env`. All providers work here, including
Cohere and Tavily web search. Conversations persist in `backend/data/db.json`
(single-worker in-memory cache — run uvicorn with one worker).
