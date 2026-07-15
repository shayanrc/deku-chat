# CLAUDE.md

Deku — an agentic LLM chat webapp where conversations are **trees**: branch, rewind,
combine, and summarize. Single-user, local-first. Implemented from the Claude Design
handoff in `design-handoff/` — **that folder is the visual spec** (read the HTML/CSS
directly; don't render it). A full design-fidelity review has been completed and all
findings fixed; match its look when adding UI.

## Commands

```bash
npm run dev          # tsx watch server (:5175) + vite (:5173, proxies /api)
npm run build        # tsc -b && vite build → dist/
npm start            # production: serves dist/ from the Express server
npm run typecheck    # tsc -b
node scripts/screenshot.mjs        # regen README hero shots (dev server must be running)
node scripts/screenshot-modals.mjs # regen per-modal stills (not in README currently)
node scripts/record-gifs.mjs       # regen README feature GIFs (re-seeds db per scenario)
```

There are no tests; verification is `typecheck`, `build`, and curling the API.

## Architecture

- `shared/types.ts` — single source of truth for `Msg`, `Branch`, `Conversation`,
  `ChatEvent`, `Meta`, plus the token estimator (~4 chars/token) used by both sides.
- `server/` — Express + LangGraph JS:
  - `config.ts` — `PROVIDERS` (8: anthropic, openai, google, mistral, groq, cohere,
    xai, deepseek → models + context windows + env key), `SYSTEM_PROMPT`, capabilities.
  - `agent.ts` — `buildModel()` (per-provider constructor switch), `runAgent()`
    (`createReactAgent` + `streamEvents` v2 → `delta`/`tool` events), `summarizeMessages()`.
  - `tools.ts` — calculator, clock, Tavily web search (key-gated factory).
  - `store.ts` — JSON persistence at `server/data/db.json` (gitignored), branch forking.
  - `index.ts` — REST + NDJSON chat streaming route.
- `src/` — React 18 + Vite:
  - `state.tsx` — **the** central store (`AppProvider` / `useApp()`): all state, all
    actions, toasts, modal routing. Components stay thin.
  - `styles/theme.css` — copied **verbatim** from the design system
    (`scope-industry` = light, `scope-nocturne` = dark, class set on the `.app` root).
    Don't edit it; put app styles in `styles/app.css`.
  - `components/` + `components/modals/` — one file per surface. `markdown.tsx` wraps
    react-markdown + remark-gfm.

## Core invariants

- **Branch model is copy-on-branch**: every branch holds its *full* message list plus
  `forkOf: {branchId, messageId}`. Rewind = copy prefix into a new `Rewind N` branch
  and switch (originals untouched). Combine = append source messages the target lacks
  (dedupe by message id), re-point source's children, delete source. Summarize =
  replace range with one `kind: 'summary'` node keeping originals in `summaryOf`.
  Fork dividers ("Branched here → …") intentionally render on every branch sharing
  the fork-point message — the design's own transcript is a child branch showing it.
- **API keys live in the browser** (`localStorage['deku-api-keys']`), are sent with
  each chat/summarize request as `apiKeys`, and are never persisted server-side.
  Precedence: browser key > server `.env` (which is optional). Resolved keys are
  passed explicitly to provider constructors — never rely on LangChain env fallback.
  Managed via avatar (top right) click/right-click → "API keys…".
- **Streaming** is NDJSON over POST (`user`/`delta`/`tool`/`done`/`error` events).
  The client `Streaming` state carries `convId`/`branchId` — only render/apply a
  stream where it belongs (user may navigate mid-stream). Stop = client
  `AbortController`; server aborts the LangGraph run on `res` close and persists any
  partial answer with an "*(generation interrupted)*" suffix. Same on provider error.
- **Errors**: `flashToast(msg, 'error')`. Branch actions catch, toast via
  `reportFailure`, and **rethrow** so modals can reset their animation state instead
  of closing. Modals gate close during animations (`closeDisabled`), have Escape +
  focus trap via `Modal.tsx` — keep that when adding modals.

## Extending

- **New provider**: add to `PROVIDERS` in `server/config.ts`, add a case in
  `buildModel()` (`server/agent.ts`), update `.env.example` + README. The keys modal
  and provider menu pick it up from `/api/meta` automatically. ⚠️ Provider packages
  must peer-match `@langchain/core` **0.3.x** — latest `@langchain/*` majors need
  core 1.x, so pin (e.g. `@langchain/mistralai@0.2`).
- **New tool/capability**: factory in `server/tools.ts` + entry in `capabilityInfos()`
  (`config.ts`) with a token-cost estimate and `envKey` if key-gated. The composer's
  flat "Add" menu is an intentional simplification of the design's
  Tools/Skills/MCP/Files categories; `ToolEvent.kind` already supports `mcp`/`skill`.

## Gotchas

- `tsx watch` restarts the API when server files change — the gif recorder exploits
  this (`utimesSync` on `server/index.ts`) to reload a re-seeded `db.json`. The demo
  seed lives in `scripts/record-gifs.mjs` (`seedDb()`); screenshots/GIFs assume it.
- Don't `pkill -f "tsx server"` while `npm run dev` runs — it kills the dev watcher.
- Playwright is a devDep; browsers via `npx playwright install chromium`. README
  images are captured at deviceScaleFactor 2, GIFs converted with ffmpeg palettegen.
- Known deferred gaps: branches of *inactive* conversations aren't listed in the
  sidebar (only summaries are loaded); no auth/multi-user; skills/MCP/files pending.
