import type { ApiKeys, ChatEvent, Conversation, ConversationSummary, Meta } from '@deku/core';
import type { Backend, ChatRequest, ChatTransport, ConversationStore } from '@deku/ui';

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

class HttpStore implements ConversationStore {
  list() {
    return json<ConversationSummary[]>('/api/conversations');
  }
  create() {
    return json<Conversation>('/api/conversations', { method: 'POST' });
  }
  get(id: string) {
    return json<Conversation>(`/api/conversations/${id}`);
  }
  rename(id: string, title: string) {
    return json<Conversation>(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) });
  }
  async remove(id: string) {
    await json<{ ok: boolean }>(`/api/conversations/${id}`, { method: 'DELETE' });
  }
  activate(id: string, branchId: string) {
    return json<Conversation>(`/api/conversations/${id}/activate`, {
      method: 'POST',
      body: JSON.stringify({ branchId }),
    });
  }
  branch(id: string, branchId: string, messageId: string | null, name?: string) {
    return json<Conversation>(`/api/conversations/${id}/branch`, {
      method: 'POST',
      body: JSON.stringify({ branchId, messageId, name }),
    });
  }
  rewind(id: string, branchId: string, messageId: string) {
    return json<Conversation>(`/api/conversations/${id}/rewind`, {
      method: 'POST',
      body: JSON.stringify({ branchId, messageId }),
    });
  }
  combine(id: string, sourceBranchId: string, targetBranchId: string) {
    return json<Conversation>(`/api/conversations/${id}/combine`, {
      method: 'POST',
      body: JSON.stringify({ sourceBranchId, targetBranchId }),
    });
  }
}

class HttpTransport implements ChatTransport {
  meta() {
    return json<Meta>('/api/meta');
  }

  summarize(id: string, branchId: string, fromId: string, toId: string, provider: string, model: string, apiKeys: ApiKeys) {
    return json<Conversation>(`/api/conversations/${id}/summarize`, {
      method: 'POST',
      body: JSON.stringify({ branchId, fromId, toId, provider, model, apiKeys }),
    });
  }

  async chat(id: string, req: ChatRequest, onEvent: (ev: ChatEvent) => void, signal?: AbortSignal): Promise<void> {
    const res = await fetch(`/api/conversations/${id}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
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
  }
}

export const httpBackend: Backend = {
  store: new HttpStore(),
  transport: new HttpTransport(),
};
