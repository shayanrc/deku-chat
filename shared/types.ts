export type Role = 'user' | 'assistant';

export type ToolKind = 'web' | 'code' | 'mcp' | 'skill' | 'tool';

export interface ToolEvent {
  kind: ToolKind;
  label: string;
  detail: string;
}

export interface Msg {
  id: string;
  role: Role;
  kind: 'message' | 'summary';
  content: string;
  toolEvents?: ToolEvent[];
  /** summary nodes keep the messages they replaced */
  summaryOf?: Msg[];
  freedTokens?: number;
  createdAt: number;
}

export interface Branch {
  id: string;
  name: string;
  /** where this branch diverged from its parent (null for the root branch) */
  forkOf: { branchId: string; messageId: string | null } | null;
  /** full message list — branches copy their prefix on creation */
  messages: Msg[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  branches: Branch[];
  activeBranchId: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  branchCount: number;
  updatedAt: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
}

export interface ProviderInfo {
  id: string;
  name: string;
  envKey: string;
  hasKey: boolean;
  models: ModelInfo[];
}

export interface CapabilityInfo {
  id: string;
  name: string;
  kind: ToolKind;
  /** true when the server has an env key for it (or it needs none) */
  available: boolean;
  /** env var a user-supplied API key maps to, when the capability needs one */
  envKey: string | null;
  /** rough token cost of exposing this tool to the model */
  tokens: number;
}

/** envVar → key value; held in the browser, sent per-request, never persisted server-side */
export type ApiKeys = Record<string, string>;

export interface Meta {
  providers: ProviderInfo[];
  capabilities: CapabilityInfo[];
  systemPromptTokens: number;
}

export type ChatEvent =
  | { type: 'user'; message: Msg }
  | { type: 'delta'; text: string }
  | { type: 'tool'; event: ToolEvent }
  | { type: 'done'; conversation: Conversation }
  | { type: 'error'; message: string };

/** rough universal token estimate: ~4 chars per token */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function messageTokens(m: Msg): number {
  return estimateTokens(m.content) + (m.toolEvents ?? []).reduce((n, t) => n + estimateTokens(t.label + t.detail), 0) + 4;
}
