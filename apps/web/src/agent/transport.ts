// In-browser ChatTransport: the /chat route body from the old Express server,
// running client-side against the IndexedDB store.
import { CAPABILITIES, PROVIDERS, SYSTEM_PROMPT, estimateTokens, getBranch, makeMsg, spliceSummary } from '@deku/core';
import type { ApiKeys, ChatEvent, Meta, Msg, ToolEvent } from '@deku/core';
import type { ChatRequest, ChatTransport } from '@deku/ui';
import type { IdbStore } from '../store/idb.ts';
import { runAgent, summarizeMessages } from './run.ts';

const BROWSER_BLOCKED = 'Not callable from a browser';

export class BrowserTransport implements ChatTransport {
  constructor(private store: IdbStore) {}

  async meta(): Promise<Meta> {
    return {
      providers: PROVIDERS.map((p) => ({
        id: p.id,
        name: p.name,
        envKey: p.envKey,
        hasKey: false, // a static page has no server env — keys come from the browser only
        models: p.models,
        ...(p.browserCompatible ? {} : { unavailableReason: BROWSER_BLOCKED }),
      })),
      capabilities: CAPABILITIES.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        available: c.envKey === null,
        envKey: c.envKey,
        tokens: c.tokens,
        ...(c.browserCompatible ? {} : { unavailableReason: BROWSER_BLOCKED }),
      })),
      systemPromptTokens: estimateTokens(SYSTEM_PROMPT),
    };
  }

  async chat(
    conversationId: string,
    req: ChatRequest,
    onEvent: (ev: ChatEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const conv = await this.store.get(conversationId);
    const branch = getBranch(conv, req.branchId);
    if (!branch) throw new Error('branch not found');

    const userMsg = makeMsg('user', req.content);
    branch.messages.push(userMsg);
    if (conv.title === 'New chat') conv.title = req.content.slice(0, 48) + (req.content.length > 48 ? '…' : '');
    await this.store.put(conv);
    onEvent({ type: 'user', message: userMsg });

    const assistant: Msg & { toolEvents: ToolEvent[] } = { ...makeMsg('assistant', ''), toolEvents: [] };
    try {
      for await (const ev of runAgent({
        provider: req.provider,
        model: req.model,
        capabilities: req.capabilities,
        history: branch.messages,
        apiKeys: req.apiKeys,
        signal,
      })) {
        if (ev.type === 'delta') assistant.content += ev.text;
        else assistant.toolEvents.push(ev.event);
        onEvent(ev);
      }
      if (!assistant.content.trim()) assistant.content = '(no response)';
      branch.messages.push(assistant);
      await this.store.put(conv);
      onEvent({ type: 'done', conversation: conv });
    } catch (err) {
      // keep whatever streamed in so the user doesn't lose a partial answer
      if (assistant.content.trim()) {
        assistant.content += '\n\n*(generation interrupted)*';
        branch.messages.push(assistant);
      }
      await this.store.put(conv);
      if (signal?.aborted) {
        // state.tsx's abort path expects the AbortError rejection, then re-gets the conversation
        throw new DOMException('aborted', 'AbortError');
      }
      onEvent({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  async summarize(
    conversationId: string,
    branchId: string,
    fromId: string,
    toId: string,
    provider: string,
    model: string,
    apiKeys: ApiKeys,
  ) {
    const conv = await this.store.get(conversationId);
    const branch = getBranch(conv, branchId);
    if (!branch) throw new Error('branch not found');
    const lo = branch.messages.findIndex((m) => m.id === fromId);
    const hi = branch.messages.findIndex((m) => m.id === toId);
    if (lo === -1 || hi === -1 || lo > hi) throw new Error('bad range');

    const content = await summarizeMessages(provider, model, branch.messages.slice(lo, hi + 1), apiKeys);
    spliceSummary(branch, fromId, toId, content);
    return this.store.put(conv);
  }
}
