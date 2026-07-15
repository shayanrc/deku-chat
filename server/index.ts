import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { combineBranches, estimateTokens, spliceSummary, type ChatEvent, type Meta } from '@deku/core';
import { SYSTEM_PROMPT, capabilityInfos, providerInfos } from './config.js';
import { runAgent, summarizeMessages } from './agent.js';
import * as store from './store.js';

const app = express();
app.use(cors());
app.use(express.json());

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

store.load();

app.get('/api/meta', (_req, res) => {
  const meta: Meta = {
    providers: providerInfos(),
    capabilities: capabilityInfos(),
    systemPromptTokens: estimateTokens(SYSTEM_PROMPT),
  };
  res.json(meta);
});

app.get('/api/conversations', (_req, res) => {
  res.json(
    store.listConversations().map((c) => ({
      id: c.id,
      title: c.title,
      branchCount: c.branches.length,
      updatedAt: c.updatedAt,
    })),
  );
});

app.post('/api/conversations', (_req, res) => {
  res.json(store.createConversation());
});

function withConv(req: express.Request, res: express.Response) {
  const conv = store.getConversation(req.params.id);
  if (!conv) res.status(404).json({ error: 'conversation not found' });
  return conv;
}

app.get('/api/conversations/:id', (req, res) => {
  const conv = withConv(req, res);
  if (conv) res.json(conv);
});

app.patch('/api/conversations/:id', (req, res) => {
  const conv = withConv(req, res);
  if (!conv) return;
  const title = String(req.body.title ?? '').trim().slice(0, 80);
  if (title) conv.title = title;
  store.touch(conv);
  res.json(conv);
});

app.delete('/api/conversations/:id', (req, res) => {
  if (!store.deleteConversation(req.params.id)) return res.status(404).json({ error: 'conversation not found' });
  res.json({ ok: true });
});

app.post('/api/conversations/:id/activate', (req, res) => {
  const conv = withConv(req, res);
  if (!conv) return;
  const branch = store.getBranch(conv, req.body.branchId);
  if (!branch) return res.status(404).json({ error: 'branch not found' });
  conv.activeBranchId = branch.id;
  store.touch(conv);
  res.json(conv);
});

app.post('/api/conversations/:id/branch', (req, res) => {
  const conv = withConv(req, res);
  if (!conv) return;
  const from = store.getBranch(conv, req.body.branchId ?? conv.activeBranchId);
  if (!from) return res.status(404).json({ error: 'branch not found' });
  const branch = store.forkBranch(conv, from, req.body.messageId ?? null, req.body.name || store.nextName(conv, 'Branch'));
  conv.activeBranchId = branch.id;
  store.touch(conv);
  res.json(conv);
});

app.post('/api/conversations/:id/rewind', (req, res) => {
  const conv = withConv(req, res);
  if (!conv) return;
  const from = store.getBranch(conv, req.body.branchId);
  if (!from) return res.status(404).json({ error: 'branch not found' });
  const branch = store.forkBranch(conv, from, req.body.messageId, store.nextName(conv, 'Rewind'));
  conv.activeBranchId = branch.id;
  store.touch(conv);
  res.json(conv);
});

app.post('/api/conversations/:id/combine', (req, res) => {
  const conv = withConv(req, res);
  if (!conv) return;
  try {
    combineBranches(conv, req.body.sourceBranchId, req.body.targetBranchId);
  } catch {
    return res.status(400).json({ error: 'bad branches' });
  }
  store.touch(conv);
  res.json(conv);
});

app.post('/api/conversations/:id/summarize', async (req, res) => {
  const conv = withConv(req, res);
  if (!conv) return;
  const branch = store.getBranch(conv, req.body.branchId);
  if (!branch) return res.status(404).json({ error: 'branch not found' });
  const { fromId, toId, provider, model, apiKeys = {} } = req.body;
  const lo = branch.messages.findIndex((m) => m.id === fromId);
  const hi = branch.messages.findIndex((m) => m.id === toId);
  if (lo === -1 || hi === -1 || lo > hi) return res.status(400).json({ error: 'bad range' });

  const content = await summarizeMessages(provider, model, branch.messages.slice(lo, hi + 1), apiKeys);
  spliceSummary(branch, fromId, toId, content);
  store.touch(conv);
  res.json(conv);
});

app.post('/api/conversations/:id/chat', async (req, res) => {
  const conv = withConv(req, res);
  if (!conv) return;
  const branch = store.getBranch(conv, req.body.branchId);
  if (!branch) return res.status(404).json({ error: 'branch not found' });
  const { content, provider, model, capabilities = [], apiKeys = {} } = req.body;

  res.setHeader('content-type', 'application/x-ndjson');
  res.setHeader('cache-control', 'no-cache');
  const send = (ev: ChatEvent) => {
    if (!res.writableEnded && res.writable) res.write(JSON.stringify(ev) + '\n');
  };

  // stop the model run if the client disconnects (Stop button, closed tab)
  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });

  const userMsg = store.makeMsg('user', content);
  branch.messages.push(userMsg);
  if (conv.title === 'New chat') conv.title = content.slice(0, 48) + (content.length > 48 ? '…' : '');
  store.touch(conv);
  send({ type: 'user', message: userMsg });

  const assistant = store.makeMsg('assistant', '');
  assistant.toolEvents = [];
  try {
    for await (const ev of runAgent({ provider, model, capabilities, history: branch.messages, apiKeys, signal: abort.signal })) {
      if (ev.type === 'delta') assistant.content += ev.text;
      else assistant.toolEvents.push(ev.event);
      send(ev);
    }
    if (!assistant.content.trim()) assistant.content = '(no response)';
    branch.messages.push(assistant);
    store.touch(conv);
    send({ type: 'done', conversation: conv });
  } catch (err) {
    // keep whatever streamed in so the user doesn't lose a partial answer
    if (assistant.content.trim()) {
      assistant.content += '\n\n*(generation interrupted)*';
      branch.messages.push(assistant);
    }
    store.touch(conv);
    if (!abort.signal.aborted) {
      send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }
  res.end();
});

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(ROOT, 'dist');
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = Number(process.env.PORT ?? 5175);
app.listen(port, () => console.log(`Deku server listening on http://localhost:${port}`));
