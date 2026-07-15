import type { ApiKeys, ChatEvent, Conversation, ConversationSummary, Meta } from '@deku/core';

/**
 * Conversation persistence + branching. Every mutation returns the updated
 * Conversation — state.tsx replaces its `conv` wholesale with the result.
 */
export interface ConversationStore {
  list(): Promise<ConversationSummary[]>;
  create(): Promise<Conversation>;
  get(id: string): Promise<Conversation>;
  rename(id: string, title: string): Promise<Conversation>;
  remove(id: string): Promise<void>;
  activate(id: string, branchId: string): Promise<Conversation>;
  branch(id: string, branchId: string, messageId: string | null, name?: string): Promise<Conversation>;
  rewind(id: string, branchId: string, messageId: string): Promise<Conversation>;
  combine(id: string, sourceBranchId: string, targetBranchId: string): Promise<Conversation>;
}

export interface ChatRequest {
  branchId: string;
  content: string;
  provider: string;
  model: string;
  capabilities: string[];
  apiKeys: ApiKeys;
}

/**
 * LLM work. Implementations MUST honor the chat() contract state.tsx assumes:
 * 1. Emit {type:'user'} first, then delta/tool events; 'done' carries the FULL
 *    updated Conversation; a single 'error' event on failure — but never on
 *    abort (abort rejects/throws AbortError instead).
 * 2. Side effects persist even on abort/error: user msg saved; partial
 *    assistant content saved with "\n\n*(generation interrupted)*"; empty
 *    response saved as "(no response)"; title auto-set to
 *    content.slice(0,48)+'…' while it is 'New chat'; updatedAt touched.
 */
export interface ChatTransport {
  meta(): Promise<Meta>;
  chat(
    conversationId: string,
    req: ChatRequest,
    onEvent: (ev: ChatEvent) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  summarize(
    conversationId: string,
    branchId: string,
    fromId: string,
    toId: string,
    provider: string,
    model: string,
    apiKeys: ApiKeys,
  ): Promise<Conversation>;
}

export interface Backend {
  store: ConversationStore;
  transport: ChatTransport;
}
