import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { estimateTokens, messageTokens } from '../shared/types';
import type { ApiKeys, Branch, Conversation, ConversationSummary, Meta, Msg, ToolEvent } from '../shared/types';

export type ModalKind = 'rewind' | 'combine' | 'summarize' | 'tree' | 'keys' | null;

export interface ModalPayload {
  /** rewind modal: message to highlight and scroll to */
  preselectMessageId?: string;
  /** combine modal: target branch to combine onto immediately (drag-and-drop) */
  combineTargetId?: string;
}

export interface Toast {
  msg: string;
  kind: 'info' | 'error';
}

const KEYS_STORAGE = 'deku-api-keys';

function loadStoredKeys(): ApiKeys {
  try {
    return JSON.parse(localStorage.getItem(KEYS_STORAGE) ?? '{}');
  } catch {
    return {};
  }
}

export interface Streaming {
  convId: string;
  branchId: string;
  content: string;
  toolEvents: ToolEvent[];
}

export interface ContextUsage {
  system: number;
  tools: number;
  conversation: number;
  summaries: number;
  used: number;
  window: number;
  pct: number;
}

interface AppStore {
  meta: Meta | null;
  convs: ConversationSummary[];
  conv: Conversation | null;
  activeBranch: Branch | null;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  providerId: string;
  modelId: string;
  setProvider: (id: string) => void;
  setModel: (id: string) => void;
  caps: string[];
  toggleCap: (id: string) => void;
  apiKeys: ApiKeys;
  setApiKey: (envKey: string, value: string) => void;
  removeApiKey: (envKey: string) => void;
  /** provider usable: server has an env key or the browser holds one */
  providerReady: (envKey: string) => boolean;
  modal: ModalKind;
  modalPayload: ModalPayload | null;
  openModal: (m: ModalKind, payload?: ModalPayload) => void;
  closeModal: () => void;
  toast: Toast | null;
  flashToast: (msg: string, kind?: Toast['kind']) => void;
  dismissToast: () => void;
  pauseToast: () => void;
  resumeToast: () => void;
  /** id of a summary node created this session — drives the fade-in highlight */
  freshSummaryId: string | null;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  streaming: Streaming | null;
  stopStreaming: () => void;
  pendingUser: string | null;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  usage: ContextUsage;
  newChat: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  switchBranch: (branchId: string) => Promise<void>;
  send: (content: string) => Promise<void>;
  doBranch: () => Promise<void>;
  doRewind: (messageId: string) => Promise<string>;
  doCombine: (targetBranchId: string) => Promise<void>;
  doSummarize: (fromId: string, toId: string) => Promise<number>;
}

const Ctx = createContext<AppStore | null>(null);

export function useApp(): AppStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useApp outside provider');
  return store;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [convs, setConvs] = useState<ConversationSummary[]>([]);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [theme, setThemeState] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('deku-theme') as 'light' | 'dark') ?? 'light',
  );
  const [providerId, setProviderId] = useState('anthropic');
  const [modelId, setModelId] = useState('claude-sonnet-4-5');
  const [caps, setCaps] = useState<string[]>(['calculator', 'clock']);
  const [apiKeys, setApiKeys] = useState<ApiKeys>(loadStoredKeys);
  const [modal, setModal] = useState<ModalKind>(null);
  const [modalPayload, setModalPayload] = useState<ModalPayload | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [streaming, setStreaming] = useState<Streaming | null>(null);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [freshSummaryId, setFreshSummaryId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController | null>(null);
  // which conversation is on screen right now — lets stream events land only where they belong
  const viewedConvRef = useRef<string | null>(null);

  const refreshList = useCallback(async () => setConvs(await api.listConversations()), []);

  const initRan = useRef(false);
  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;
    (async () => {
      const m = await api.meta();
      setMeta(m);
      const stored = loadStoredKeys();
      const withKey = m.providers.find((p) => p.hasKey || stored[p.envKey]) ?? m.providers[0];
      setProviderId(withKey.id);
      setModelId(withKey.models[0].id);
      const web = m.capabilities.find((c) => c.id === 'web_search');
      if (web && (web.available || (web.envKey && stored[web.envKey]))) {
        setCaps((prev) => ['web_search', ...prev]);
      }
      const list = await api.listConversations();
      setConvs(list);
      setConv(list.length ? await api.getConversation(list[0].id) : await api.createConversation());
      if (!list.length) await refreshList();
    })().catch((err) => flashToast(`Couldn't reach the Deku server: ${err instanceof Error ? err.message : err}`, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshList]);

  const setTheme = useCallback((t: 'light' | 'dark') => {
    setThemeState(t);
    localStorage.setItem('deku-theme', t);
  }, []);

  const flashToast = useCallback((msg: string, kind: Toast['kind'] = 'info') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, kind });
    toastTimer.current = setTimeout(() => setToast(null), kind === 'error' ? 6500 : 3400);
  }, []);

  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  /** toast the failure, then rethrow so the calling modal can reset its animation state */
  const reportFailure = useCallback(
    (what: string, err: unknown): never => {
      flashToast(`${what} failed: ${err instanceof Error ? err.message : err}`, 'error');
      throw err;
    },
    [flashToast],
  );

  const pauseToast = useCallback(() => clearTimeout(toastTimer.current), []);
  const resumeToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const activeBranch = useMemo(
    () => conv?.branches.find((b) => b.id === conv.activeBranchId) ?? null,
    [conv],
  );

  useEffect(() => {
    viewedConvRef.current = conv?.id ?? null;
  }, [conv]);

  const provider = meta?.providers.find((p) => p.id === providerId);
  const model = provider?.models.find((m) => m.id === modelId) ?? provider?.models[0];

  const usage = useMemo<ContextUsage>(() => {
    const msgs = activeBranch?.messages ?? [];
    const system = meta?.systemPromptTokens ?? 0;
    const tools = (meta?.capabilities ?? [])
      .filter((c) => caps.includes(c.id))
      .reduce((n, c) => n + c.tokens, 0);
    const streamingHere = streaming && streaming.branchId === activeBranch?.id;
    const conversation = msgs.filter((m) => m.kind !== 'summary').reduce((n, m) => n + messageTokens(m), 0)
      + (streamingHere ? estimateTokens(streaming.content) : 0)
      + (streamingHere && pendingUser ? estimateTokens(pendingUser) : 0);
    const summaries = msgs.filter((m) => m.kind === 'summary').reduce((n, m) => n + messageTokens(m), 0);
    const used = system + tools + conversation + summaries;
    const window = model?.contextWindow ?? 200_000;
    return { system, tools, conversation, summaries, used, window, pct: Math.min(100, Math.round((used / window) * 100)) };
  }, [activeBranch, meta, caps, model, streaming, pendingUser]);

  const setProvider = useCallback(
    (id: string) => {
      setProviderId(id);
      const p = meta?.providers.find((x) => x.id === id);
      if (p) setModelId(p.models[0].id);
    },
    [meta],
  );

  const toggleCap = useCallback((id: string) => {
    setCaps((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }, []);

  const persistKeys = (next: ApiKeys) => {
    setApiKeys(next);
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(next));
  };
  const setApiKey = useCallback(
    (envKey: string, value: string) => {
      const next = { ...apiKeys, [envKey]: value.trim() };
      if (!value.trim()) delete next[envKey];
      persistKeys(next);
    },
    [apiKeys],
  );
  const removeApiKey = useCallback(
    (envKey: string) => {
      const next = { ...apiKeys };
      delete next[envKey];
      persistKeys(next);
    },
    [apiKeys],
  );
  const providerReady = useCallback(
    (envKey: string) => Boolean(apiKeys[envKey]) || Boolean(meta?.providers.find((p) => p.envKey === envKey)?.hasKey)
      || Boolean(meta?.capabilities.find((c) => c.envKey === envKey)?.available),
    [apiKeys, meta],
  );

  const newChat = useCallback(async () => {
    setConv(await api.createConversation());
    await refreshList();
  }, [refreshList]);

  const selectConversation = useCallback(async (id: string) => {
    setFreshSummaryId(null);
    setConv(await api.getConversation(id));
  }, []);

  const switchBranch = useCallback(
    async (branchId: string) => {
      if (!conv || streaming) return;
      setFreshSummaryId(null);
      setConv(await api.activate(conv.id, branchId));
    },
    [conv, streaming],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      if (streaming?.convId === id) {
        flashToast('Stop the running reply before deleting this conversation', 'error');
        return;
      }
      try {
        await api.deleteConversation(id);
        const list = await api.listConversations();
        setConvs(list);
        if (conv?.id === id) {
          setConv(list.length ? await api.getConversation(list[0].id) : await api.createConversation());
          if (!list.length) setConvs(await api.listConversations());
        }
        flashToast('Conversation deleted');
      } catch (err) {
        reportFailure('Delete', err);
      }
    },
    [conv, streaming, flashToast, reportFailure],
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      if (!title.trim()) return;
      try {
        const updated = await api.renameConversation(id, title.trim());
        if (conv?.id === id) setConv(updated);
        await refreshList();
      } catch (err) {
        reportFailure('Rename', err);
      }
    },
    [conv, refreshList, reportFailure],
  );

  const send = useCallback(
    async (content: string) => {
      if (!conv || !activeBranch || streaming) return;
      const convId = conv.id;
      const branchId = activeBranch.id;
      const ac = new AbortController();
      abortRef.current = ac;
      setPendingUser(content);
      setStreaming({ convId, branchId, content: '', toolEvents: [] });
      // apply a conversation update only if the user is still looking at that conversation
      const applyConv = (c: Conversation) => {
        if (viewedConvRef.current === convId) setConv(c);
      };
      try {
        await api.chat(
          convId,
          { branchId, content, provider: providerId, model: modelId, capabilities: caps, apiKeys },
          (ev) => {
            if (ev.type === 'delta') {
              setStreaming((s) => s && { ...s, content: s.content + ev.text });
            } else if (ev.type === 'tool') {
              setStreaming((s) => s && { ...s, toolEvents: [...s.toolEvents, ev.event] });
            } else if (ev.type === 'done') {
              applyConv(ev.conversation);
            } else if (ev.type === 'error') {
              flashToast(ev.message, 'error');
              void api.getConversation(convId).then(applyConv);
            }
          },
          ac.signal,
        );
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === 'AbortError';
        if (!aborted) flashToast(err instanceof Error ? err.message : String(err), 'error');
        // pick up whatever the server persisted (partial answer on stop/disconnect)
        void api.getConversation(convId).then(applyConv).catch(() => {});
      } finally {
        abortRef.current = null;
        setStreaming(null);
        setPendingUser(null);
        void refreshList();
      }
    },
    [conv, activeBranch, streaming, providerId, modelId, caps, apiKeys, flashToast, refreshList],
  );

  const stopStreaming = useCallback(() => abortRef.current?.abort(), []);

  const doBranch = useCallback(async () => {
    if (!conv || !activeBranch) return;
    try {
      const updated = await api.branch(conv.id, activeBranch.id, null);
      setConv(updated);
      await refreshList();
      const b = updated.branches.find((x) => x.id === updated.activeBranchId);
      flashToast(`Branched — now on “${b?.name}”`);
    } catch (err) {
      reportFailure('Branch', err);
    }
  }, [conv, activeBranch, refreshList, flashToast, reportFailure]);

  const doRewind = useCallback(
    async (messageId: string) => {
      if (!conv || !activeBranch) return '';
      const idx = activeBranch.messages.findIndex((m) => m.id === messageId);
      try {
        const updated = await api.rewind(conv.id, activeBranch.id, messageId);
        setConv(updated);
        await refreshList();
        const b = updated.branches.find((x) => x.id === updated.activeBranchId);
        flashToast(`Rewound to message ${idx + 1} — new branch “${b?.name}” created`);
        return b?.name ?? '';
      } catch (err) {
        return reportFailure('Rewind', err);
      }
    },
    [conv, activeBranch, refreshList, flashToast, reportFailure],
  );

  const doCombine = useCallback(
    async (targetBranchId: string) => {
      if (!conv || !activeBranch) return;
      const sourceName = activeBranch.name;
      const targetName = conv.branches.find((b) => b.id === targetBranchId)?.name;
      try {
        const updated = await api.combine(conv.id, activeBranch.id, targetBranchId);
        setConv(updated);
        await refreshList();
        flashToast(`Combined “${sourceName}” onto “${targetName}”`);
      } catch (err) {
        reportFailure('Combine', err);
      }
    },
    [conv, activeBranch, refreshList, flashToast, reportFailure],
  );

  const doSummarize = useCallback(
    async (fromId: string, toId: string) => {
      if (!conv || !activeBranch) return 0;
      const msgs = activeBranch.messages;
      const n = msgs.findIndex((m) => m.id === toId) - msgs.findIndex((m) => m.id === fromId) + 1;
      try {
        const updated = await api.summarize(conv.id, activeBranch.id, fromId, toId, providerId, modelId, apiKeys);
        setConv(updated);
        const branch = updated.branches.find((b) => b.id === activeBranch.id);
        const summary = branch?.messages.find((m) => m.kind === 'summary' && m.summaryOf?.some((o) => o.id === fromId));
        setFreshSummaryId(summary?.id ?? null);
        flashToast(`Summarized ${n} message${n > 1 ? 's' : ''}`);
        return n;
      } catch (err) {
        return reportFailure('Summarize', err);
      }
    },
    [conv, activeBranch, providerId, modelId, apiKeys, flashToast, reportFailure],
  );

  const store: AppStore = {
    meta,
    convs,
    conv,
    activeBranch,
    theme,
    setTheme,
    providerId,
    modelId,
    setProvider,
    setModel: setModelId,
    caps,
    toggleCap,
    apiKeys,
    setApiKey,
    removeApiKey,
    providerReady,
    modal,
    modalPayload,
    openModal: (m: ModalKind, payload?: ModalPayload) => {
      setModal(m);
      setModalPayload(payload ?? null);
    },
    closeModal: () => {
      setModal(null);
      setModalPayload(null);
    },
    toast,
    flashToast,
    dismissToast,
    pauseToast,
    resumeToast,
    freshSummaryId,
    deleteConversation,
    renameConversation,
    streaming,
    stopStreaming,
    pendingUser,
    sidebarOpen,
    toggleSidebar: () => setSidebarOpen((v) => !v),
    usage,
    newChat,
    selectConversation,
    switchBranch,
    send,
    doBranch,
    doRewind,
    doCombine,
    doSummarize,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

/** All messages in `msgs` role-labelled the way the design labels them. */
export function roleLabel(m: Msg): string {
  if (m.kind === 'summary') return 'summary';
  return m.role === 'user' ? 'you' : 'Deku';
}

export function fmtTokens(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

/** flatten message content to a single plain-text line for picker rows */
export function previewText(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/[*_`#]|^>\s?/gm, '')
    .replace(/\s*\n\s*[-•]\s*/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim();
}
