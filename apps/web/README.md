# Deku — standalone web edition

The whole app as a **static page**: no backend, no server, no env. LangGraph JS runs the
agent loop *in your browser*, conversations persist in IndexedDB, and API keys live in
localStorage, sent by your browser directly to the provider you pick.

**Live demo:** https://shayanrc.github.io/deku-chat/

```bash
npm run dev:web        # from the repo root → http://localhost:5174
npm run build -w apps/web   # → apps/web/dist (deployable on any static host)
```

Deploys to GitHub Pages automatically on every push to `master`
(`.github/workflows/deploy-pages.yml`).

Provider support is gated by two things a static page can't work around: the provider's
CORS policy and whether its SDK runs in a browser. Verified 2026-07: Anthropic, OpenAI,
Google, Groq, Mistral, xAI, and DeepSeek all work; **Cohere** is disabled (its SDK drags
Node-only AWS code into browser bundles) and **web search (Tavily)** is disabled (its API
blocks browser CORS). Those show as "n/a — Not callable from a browser" in the menus and
work in the fullstack edition instead. Flags live in `packages/core/src/registry.ts`
(`browserCompatible`), probed empirically by `scripts/web-smoke.mjs`.
