import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatMistralAI } from '@langchain/mistralai';
import { ChatGroq } from '@langchain/groq';
import { ChatCohere } from '@langchain/cohere';
import { ChatXAI } from '@langchain/xai';
import { ChatDeepSeek } from '@langchain/deepseek';
import { SUMMARIZE_PROMPT, summaryFallback } from '@deku/core';
import type { ApiKeys, ChatEvent, Msg } from '@deku/core';
import { PROVIDERS, SYSTEM_PROMPT } from './config.js';
import { toolEventFor, toolsFor } from './tools.js';

export function buildModel(provider: string, model: string, apiKeys: ApiKeys = {}): BaseChatModel {
  const def = PROVIDERS.find((p) => p.id === provider);
  if (!def) throw new Error(`Unknown provider: ${provider}`);
  // browser-held key wins; server .env is the fallback
  const apiKey = apiKeys[def.envKey] || process.env[def.envKey];
  if (!apiKey) {
    throw new Error(`No API key for ${def.name} — right-click the avatar → “API keys…” to add one.`);
  }
  switch (provider) {
    case 'anthropic':
      return new ChatAnthropic({ model, apiKey, maxTokens: 4096 });
    case 'openai':
      return new ChatOpenAI({ model, apiKey });
    case 'google':
      return new ChatGoogleGenerativeAI({ model, apiKey });
    case 'mistral':
      return new ChatMistralAI({ model, apiKey });
    case 'groq':
      return new ChatGroq({ model, apiKey });
    case 'cohere':
      return new ChatCohere({ model, apiKey });
    case 'xai':
      return new ChatXAI({ model, apiKey });
    case 'deepseek':
      return new ChatDeepSeek({ model, apiKey });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
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

/** Stream the agent run as ChatEvents (delta / tool). */
export async function* runAgent(opts: {
  provider: string;
  model: string;
  capabilities: string[];
  history: Msg[];
  apiKeys?: ApiKeys;
  signal?: AbortSignal;
}): AsyncGenerator<Extract<ChatEvent, { type: 'delta' | 'tool' }>> {
  const llm = buildModel(opts.provider, opts.model, opts.apiKeys);
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

export async function summarizeMessages(provider: string, model: string, msgs: Msg[], apiKeys: ApiKeys = {}): Promise<string> {
  const transcript = msgs
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
  try {
    const llm = buildModel(provider, model, apiKeys);
    const res = await llm.invoke([new SystemMessage(SUMMARIZE_PROMPT), new HumanMessage(transcript)]);
    return chunkText(res.content).trim() || summaryFallback(msgs);
  } catch {
    return summaryFallback(msgs);
  }
}
