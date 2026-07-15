// Browser port of server/agent.ts: same LangGraph ReAct loop, same event shapes.
import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { PROVIDERS, SUMMARIZE_PROMPT, SYSTEM_PROMPT, summaryFallback } from '@deku/core';
import type { ApiKeys, ChatEvent, Msg } from '@deku/core';
import { MODEL_LOADERS } from './models.ts';
import { toolEventFor, toolsFor } from './tools.ts';

async function buildModel(provider: string, model: string, apiKeys: ApiKeys) {
  const def = PROVIDERS.find((p) => p.id === provider);
  if (!def) throw new Error(`Unknown provider: ${provider}`);
  const apiKey = apiKeys[def.envKey];
  if (!apiKey) {
    throw new Error(`No API key for ${def.name} — right-click the avatar → “API keys…” to add one.`);
  }
  const loader = MODEL_LOADERS[provider];
  if (!loader) throw new Error(`Unknown provider: ${provider}`);
  return loader(model, apiKey);
}

export function toLcMessages(history: Msg[]): BaseMessage[] {
  const out: BaseMessage[] = [new SystemMessage(SYSTEM_PROMPT)];
  for (const m of history) {
    if (m.kind === 'summary') out.push(new AIMessage(`[Summary of earlier conversation] ${m.content}`));
    else if (m.role === 'user') out.push(new HumanMessage(m.content));
    else out.push(new AIMessage(m.content));
  }
  return out;
}

function chunkText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'string' ? c : c?.type === 'text' || c?.type === 'text_delta' ? (c.text ?? '') : ''))
      .join('');
  }
  return '';
}

export async function* runAgent(opts: {
  provider: string;
  model: string;
  capabilities: string[];
  history: Msg[];
  apiKeys: ApiKeys;
  signal?: AbortSignal;
}): AsyncGenerator<Extract<ChatEvent, { type: 'delta' | 'tool' }>> {
  const llm = await buildModel(opts.provider, opts.model, opts.apiKeys);
  const agent = createReactAgent({ llm, tools: toolsFor(opts.capabilities, opts.apiKeys) });

  const stream = agent.streamEvents(
    { messages: toLcMessages(opts.history) },
    { version: 'v2', signal: opts.signal },
  );
  for await (const ev of stream) {
    if (ev.event === 'on_chat_model_stream') {
      const text = chunkText(ev.data?.chunk?.content);
      if (text) yield { type: 'delta', text };
    } else if (ev.event === 'on_tool_end') {
      const output = ev.data?.output;
      const outputText = typeof output === 'string' ? output : chunkText(output?.content) || undefined;
      yield { type: 'tool', event: toolEventFor(ev.name, ev.data?.input, outputText) };
    }
  }
}

export async function summarizeMessages(provider: string, model: string, msgs: Msg[], apiKeys: ApiKeys): Promise<string> {
  const transcript = msgs
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
  try {
    const llm = await buildModel(provider, model, apiKeys);
    const res = await llm.invoke([new SystemMessage(SUMMARIZE_PROMPT), new HumanMessage(transcript)]);
    return chunkText(res.content).trim() || summaryFallback(msgs);
  } catch {
    return summaryFallback(msgs);
  }
}
