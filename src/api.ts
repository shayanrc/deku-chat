import type { ApiKeys, ChatEvent, Conversation, ConversationSummary, Meta } from '../shared/types';

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  meta: () => json<Meta>('/api/meta'),
  listConversations: () => json<ConversationSummary[]>('/api/conversations'),
  createConversation: () => json<Conversation>('/api/conversations', { method: 'POST' }),
  getConversation: (id: string) => json<Conversation>(`/api/conversations/${id}`),
  renameConversation: (id: string, title: string) =>
    json<Conversation>(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteConversation: (id: string) => json<{ ok: boolean }>(`/api/conversations/${id}`, { method: 'DELETE' }),
  activate: (id: string, branchId: string) =>
    json<Conversation>(`/api/conversations/${id}/activate`, { method: 'POST', body: JSON.stringify({ branchId }) }),
  branch: (id: string, branchId: string, messageId: string | null, name?: string) =>
    json<Conversation>(`/api/conversations/${id}/branch`, {
      method: 'POST',
      body: JSON.stringify({ branchId, messageId, name }),
    }),
  rewind: (id: string, branchId: string, messageId: string) =>
    json<Conversation>(`/api/conversations/${id}/rewind`, {
      method: 'POST',
      body: JSON.stringify({ branchId, messageId }),
    }),
  combine: (id: string, sourceBranchId: string, targetBranchId: string) =>
    json<Conversation>(`/api/conversations/${id}/combine`, {
      method: 'POST',
      body: JSON.stringify({ sourceBranchId, targetBranchId }),
    }),
  summarize: (id: string, branchId: string, fromId: string, toId: string, provider: string, model: string, apiKeys: ApiKeys) =>
    json<Conversation>(`/api/conversations/${id}/summarize`, {
      method: 'POST',
      body: JSON.stringify({ branchId, fromId, toId, provider, model, apiKeys }),
    }),

  async chat(
    id: string,
    body: { branchId: string; content: string; provider: string; model: string; capabilities: string[]; apiKeys: ApiKeys },
    onEvent: (ev: ChatEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await fetch(`/api/conversations/${id}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`chat failed: ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) onEvent(JSON.parse(line) as ChatEvent);
      }
    }
    if (buf.trim()) onEvent(JSON.parse(buf) as ChatEvent);
  },
};
