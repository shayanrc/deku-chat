/**
 * Pure branching operations shared by every Deku backend (Express, browser, and
 * — via the JSON fixtures in ../fixtures/ops — the Python port).
 * No IO, no environment: everything operates on plain Conversation objects.
 */
import { estimateTokens, messageTokens } from './types.ts';
import type { Branch, Conversation, ConversationSummary, Msg, Role } from './types.ts';

const uuid = () => globalThis.crypto.randomUUID();

export function makeMsg(role: Role, content: string, id: string = uuid()): Msg {
  return { id, role, kind: 'message', content, createdAt: Date.now() };
}

export function newConversation(id: string = uuid()): Conversation {
  const now = Date.now();
  const main: Branch = { id: uuid(), name: 'Main', forkOf: null, messages: [], createdAt: now };
  return { id, title: 'New chat', branches: [main], activeBranchId: main.id, createdAt: now, updatedAt: now };
}

export function touch(conv: Conversation): void {
  conv.updatedAt = Date.now();
}

export function getBranch(conv: Conversation, branchId: string): Branch | undefined {
  return conv.branches.find((b) => b.id === branchId);
}

/**
 * New branch containing `from`'s messages up to and including messageId.
 * messageId === null means "full copy" (plain Branch); forkOf.messageId is then the tip.
 * Mutates conv (pushes the branch) and returns it.
 */
export function forkBranch(conv: Conversation, from: Branch, messageId: string | null, name: string): Branch {
  let prefix = from.messages;
  if (messageId !== null) {
    const idx = from.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) throw new Error('message not found in branch');
    prefix = from.messages.slice(0, idx + 1);
  }
  const branch: Branch = {
    id: uuid(),
    name,
    forkOf: { branchId: from.id, messageId: messageId ?? from.messages.at(-1)?.id ?? null },
    messages: prefix.map((m) => ({ ...m })),
    createdAt: Date.now(),
  };
  conv.branches.push(branch);
  return branch;
}

export function nextName(conv: Conversation, base: 'Branch' | 'Rewind'): string {
  const n = conv.branches.filter((b) => b.name.startsWith(base)).length + 1;
  return `${base} ${n}`;
}

/**
 * Replay `source` onto `target`: append source's messages target lacks (by id),
 * re-point source's children at target, delete source, activate target.
 * Throws on unknown/identical branches.
 */
export function combineBranches(conv: Conversation, sourceBranchId: string, targetBranchId: string): void {
  const source = getBranch(conv, sourceBranchId);
  const target = getBranch(conv, targetBranchId);
  if (!source || !target || source.id === target.id) throw new Error('bad branches');
  const targetIds = new Set(target.messages.map((m) => m.id));
  target.messages.push(...source.messages.filter((m) => !targetIds.has(m.id)).map((m) => ({ ...m })));
  for (const b of conv.branches) {
    if (b.forkOf?.branchId === source.id) b.forkOf.branchId = target.id;
  }
  conv.branches = conv.branches.filter((b) => b.id !== source.id);
  conv.activeBranchId = target.id;
}

/**
 * Replace branch messages [fromId..toId] with a single summary node carrying the
 * originals and the freed-token estimate (floored at 0). Returns the summary node.
 * Throws 'bad range' on unknown ids or inverted range.
 */
export function spliceSummary(branch: Branch, fromId: string, toId: string, summaryText: string): Msg {
  const lo = branch.messages.findIndex((m) => m.id === fromId);
  const hi = branch.messages.findIndex((m) => m.id === toId);
  if (lo === -1 || hi === -1 || lo > hi) throw new Error('bad range');
  const originals = branch.messages.slice(lo, hi + 1);
  const freed = originals.reduce((n, m) => n + messageTokens(m), 0) - estimateTokens(summaryText);
  const summary: Msg = {
    ...makeMsg('assistant', summaryText),
    kind: 'summary',
    summaryOf: originals,
    freedTokens: Math.max(freed, 0),
  };
  branch.messages.splice(lo, originals.length, summary);
  return summary;
}

/** last-resort summary when no LLM is reachable */
export function summaryFallback(msgs: Msg[]): string {
  const firstLine = (s: string) => s.split('\n')[0].slice(0, 90);
  return `${firstLine(msgs[0].content)} → ${firstLine(msgs.at(-1)!.content)}`;
}

export function toSummary(c: Conversation): ConversationSummary {
  return { id: c.id, title: c.title, branchCount: c.branches.length, updatedAt: c.updatedAt };
}
