# Deku — agent instructions

Agentic LLM chat webapp with git-like branching conversations, implemented from a Claude Design
handoff. GitHub: `shayanrc/deku-chat` (public, branch `master`).

## Design source of truth

`design-handoff/advanced-llm-chat-interface-design/project/Agentic Chat.dc.html` is the primary
design (plus `Agentic Chat Directions.dc.html` for light/dark statics). Match it when touching UI.
`src/styles/theme.css` is a **verbatim copy** of the design system's two CSS scopes —
`scope-industry` (light) and `scope-nocturne` (dark) — applied at the app root; don't edit it,
put app styles in `src/styles/app.css` using the theme's CSS variables (`--color-accent`,
`--space-*`, `--radius-*`, …).

## Architecture

- `src/` — React 18 + Vite + TS frontend. All app state lives in one context provider,
  `src/state.tsx` (`useApp()`); components under `src/components/` (modals in
  `components/modals/`). API layer: `src/api.ts`. Markdown: `react-markdown` + `remark-gfm`
  via `src/markdown.tsx`.
- `server/` — Express + **LangGraph JS** (`createReactAgent` from `@langchain/langgraph/prebuilt`).
  `index.ts` routes, `agent.ts` model construction + streaming, `tools.ts` tool registry,
  `config.ts` providers/models/system prompt, `store.ts` JSON persistence
  (`server/data/db.json`, gitignored).
- `shared/types.ts` — types + token estimator used by both sides.
- Streaming: NDJSON over fetch (`user` / `delta` / `tool` / `done` / `error` events);
  client aborts propagate via `res.on('close')` → AbortSignal into LangGraph; partial answers
  are persisted with an "*(generation interrupted)*" suffix.

## Branching model (core invariant)

Every branch stores its **full message list** (copy-on-branch) plus
`forkOf: {branchId, messageId}` marking where it diverged. Operations:
**Branch** = full copy + switch (`forkBranch` with `messageId: null` means "full copy", and
sets `forkOf.messageId` to the tip); **Rewind** = prefix copy up to the picked message into a
new `Rewind N` branch (original keeps the tail); **Combine** = source is always the **active**
branch, target is picked in the modal/drop: append source's messages the target lacks (by id),
re-point source's children to the target, delete source; **Summarize** = replace a message
range with a `kind:'summary'` node keeping originals in `summaryOf` (drives "Show original" +
freed-token accounting). The "Branched here → …" divider intentionally shows on every branch
sharing the fork-point message (matches the design's child-branch view).

## API keys (user-mandated design)

Keys live in **browser localStorage only** (`deku-api-keys`), managed via avatar → "API keys…"
(left- or right-click), and are sent per-request in the `apiKeys` body field. Server precedence:
`apiKeys[envKey] || process.env[envKey]` (browser wins; `.env` optional fallback — the app must
work with no `.env` at all). Never persist keys server-side; don't reintroduce copy in the UI
about `.env` override (user had it removed).

Providers (8): Anthropic, OpenAI, Google, Mistral, Groq, Cohere, xAI, DeepSeek. To add one:
entry in `server/config.ts` PROVIDERS (id/name/envKey/models+contextWindow) + case in
`server/agent.ts` buildModel() — the frontend (provider menu, keys modal) is data-driven off
`/api/meta`, no client change needed. **`@langchain/*` provider packages must peer-depend on
`@langchain/core` 0.3.x** — latest majors need core 1.x and break the install. The caret ranges
in package.json (`^0.2.x` etc.) already enforce this for 0.x packages; when installing a NEW
provider package, request an explicit 0.3-core-compatible version (e.g.
`npm i @langchain/mistralai@0.2`), not `latest`.

## Dev workflow

```bash
npm run dev        # Express :5175 (tsx watch) + Vite :5173 (proxies /api)
npm run typecheck  # tsc -b — run after changes; no test suite exists
npm run build      # tsc + vite build → dist/; npm start serves it on :5175
```

Gotchas: `pkill -f "tsx server/index.ts"` also kills the dev server's watcher — check what's
running first. Touching `server/index.ts` restarts the API and re-reads `db.json` (needed after
editing the db by hand, since the store caches in memory).

## README media

All README images are generated — never hand-edit them. Run with `node scripts/<name>.mjs`
from the repo root; prerequisites: dev server running, Playwright's Chromium
(`npx playwright install chromium`, ~160 MB, already installed on this machine), and `ffmpeg`
on PATH (system package):
- `scripts/screenshot.mjs` → hero light/dark shots
- `scripts/screenshot-modals.mjs` → per-modal stills (not currently in README)
- `scripts/record-gifs.mjs` → the five feature GIFs (re-seeds demo data per scenario,
  synthetic cursor, ffmpeg palette conversion)

They need `npm run dev` running and expect the demo seed (the "Q3 campaign messaging"
conversation with Main/Playful tone/Formal tone branches) — `record-gifs.mjs` seeds it itself;
its `seedDb()` is the canonical seed if you need it standalone. **Always visually inspect
captured media (Read the png / extract gif frames with ffmpeg) before committing** — the user
expects screenshots to be verified, and stray branches from live testing often pollute the db.

## Working agreements

- Rendering is deterministic: re-captured screenshots that are byte-identical mean no change.
- The composer capability menu is intentionally a flat list (design's Tools/Skills/MCP/Files
  IA deferred); `ToolEvent.kind` already supports `mcp`/`skill` for later.
- Commits so far are conventional prose messages on `master`, pushed straight to origin.
