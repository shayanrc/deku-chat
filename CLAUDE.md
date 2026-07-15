# Deku — agent instructions

Agentic LLM chat with git-like branching conversations, implemented from a Claude Design
handoff. GitHub: `shayanrc/deku-chat` (public, branch `master`). **Monorepo producing two
deployables that share one UI**:

- `apps/web` — standalone static SPA, no backend: LangGraph **JS runs in the browser**,
  IndexedDB persistence, deployed to GitHub Pages (https://shayanrc.github.io/deku-chat/)
  by `.github/workflows/deploy-pages.yml` on every push to master.
- `apps/fullstack` — the same UI + **Python** backend (FastAPI + LangGraph Python), HTTP/NDJSON
  contract identical to the original Express server (which lives only in git history now).

## Layout

- `packages/core` (`@deku/core`) — zero-dep isomorphic TS: `types.ts`, `ops.ts` (pure branching
  operations), `registry.ts` (providers/capabilities + `browserCompatible` flags + prompt
  strings), `seed.ts`/`seed.json` (demo data; timestamps are negative offsets from now,
  `{"$ref": "<branchId>"}` splices a prior branch's messages). Tested by
  `test/ops.test.ts` against **JSON fixtures in `fixtures/ops/`** — the same fixtures drive the
  Python `tests/test_ops.py`, keeping both languages' ops provably identical. If you change an
  op, change it in BOTH `packages/core/src/ops.ts` AND
  `apps/fullstack/backend/deku_server/ops.py`, and update the fixtures.
- `packages/ui` (`@deku/ui`) — the entire React app, backend-agnostic. Apps inject a
  `Backend` (`{store: ConversationStore, transport: ChatTransport}`, see `src/backend.ts`)
  into `<App backend={...}>`; the backend object must be a stable module-scope reference.
  The `chat()` side-effect contract is documented on the interface — both transports MUST
  honor it (user-msg persistence, partial + `*(generation interrupted)*` on abort/error,
  `(no response)`, title truncation at 48 + `…`, AbortError on abort, never an error event).
- `apps/web/src` — `store/idb.ts` (idb-keyval), `agent/` (browser port of the agent:
  `models.ts` lazy per-provider dynamic imports with `dangerouslyAllowBrowser` flags; Groq goes
  through ChatOpenAI + baseURL; **Cohere is excluded** — its SDK drags Node-only AWS code into
  the bundle). Web `meta()` is built locally from the registry; `browserCompatible: false`
  entries get `unavailableReason` and render disabled.
- `apps/fullstack/frontend` — thin shell (`http.ts` = REST implementations of the interfaces).
- `apps/fullstack/backend` — uv project (`uv sync`, `uv run pytest`, `uv run ruff check .`).
  Wire parity rules live in `deku_server/models.py` (`dump()`): camelCase aliases, keep
  `forkOf: null`, omit absent optionals, epoch **milliseconds**, `ensure_ascii=False` NDJSON.
  Client disconnect = `asyncio.CancelledError` in the chat generator: persist partial,
  re-raise, no error event. Single-worker uvicorn only (in-memory db cache).

## Design source of truth

`design-handoff/advanced-llm-chat-interface-design/project/Agentic Chat.dc.html` (+
`...Directions.dc.html`). Match it when touching UI. `packages/ui/src/styles/theme.css` is a
**verbatim copy** of the design CSS scopes — never edit it; app styles go in `app.css` using
the theme variables.

## Branching model (core invariant)

Every branch stores its **full message list** plus `forkOf: {branchId, messageId}`.
Branch = full copy (`messageId: null`, forkOf.messageId = tip); Rewind = prefix copy to a new
`Rewind N` branch (original keeps the tail); Combine = **active branch is always the source**:
append missing-by-id onto the target, re-point children, delete source; Summarize = splice a
`summary` node keeping originals in `summaryOf`. The "Branched here" divider appears on every
branch sharing the fork-point message (intentional; matches the design).

## API keys (user-mandated design)

Browser localStorage only (`deku-api-keys`), managed via the avatar menu, sent per-request as
`apiKeys`. Precedence `apiKeys[envKey] || env` (fullstack; the web edition has no env at all).
Never persist keys server-side; no ".env override" copy in the UI.

Adding a provider: registry entry in `packages/core/src/registry.ts` + loader in
`apps/web/src/agent/models.ts` + entry in `apps/fullstack/backend/deku_server/config.py`
(init_chat_model prefix). JS provider packages must peer-depend on **@langchain/core 0.3.x**
(install explicit versions, e.g. `@langchain/mistralai@0.2`, never `latest`); Python is on
langchain-core 1.x and has no such trap.

## Dev workflow

```bash
npm run dev        # fullstack: uvicorn :5175 (--reload) + vite :5173
npm run dev:web    # standalone SPA on :5174
npm run typecheck  # all JS workspaces
npm run test       # vitest ops + pytest (backend)
npm run lint:py
```

Gotchas: `pkill -f` patterns that appear in your own command line kill your shell — kill by
port (`fuser -k 5176/tcp`) instead. The backend caches `db.json` in memory: after hand-editing
it, `touch apps/fullstack/backend/deku_server/main.py` (uvicorn --reload re-imports → re-reads).
`DEKU_DATA_DIR` overrides the backend's data dir; `DEKU_API_URL` overrides the frontend proxy.

## README media

All README images are generated — never hand-edit. Prereqs: dev server running, Playwright
Chromium (`npx playwright install chromium`), system `ffmpeg`. `DEKU_APP_URL` points scripts at
a non-default app URL.
- `node scripts/screenshot.mjs` → hero shots · `scripts/screenshot-modals.mjs` → modal stills
- `node scripts/record-gifs.mjs` → feature GIFs (re-seeds `db.json` from core's seed.json per
  scenario; expects the fullstack dev stack)
- `node scripts/web-smoke.mjs` → apps/web gate: boot/persist/agent-in-browser + CORS probe
  matrix (re-run it before changing any `browserCompatible` flag)

**Always visually inspect captured media (Read the png / extract gif frames) before
committing.** Byte-identical re-captures = no visual change (rendering is deterministic) —
this doubles as a UI regression check.

## Working agreements

- Verification gates over vibes: typecheck + vitest + pytest after changes; screenshots for UI.
- The composer capability menu is intentionally a flat list; `ToolEvent.kind` already carries
  `mcp`/`skill` for later.
- Commits: prose messages on `master`, pushed straight to origin.
